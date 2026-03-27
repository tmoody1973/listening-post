import type { Env, RawStory, TriagedStory } from "../types";

const PERPLEXITY_BASE = "https://api.perplexity.ai";

export async function triageStories(env: Env, stories: RawStory[]): Promise<TriagedStory[]> {
  if (stories.length === 0) return [];

  console.log(`[Triage] Scoring ${stories.length} stories via Perplexity...`);

  // Build compact story list for the prompt
  const storyList = stories.map((s, i) => ({
    i,
    h: s.headline,
    s: s.summary?.slice(0, 150) ?? "",
    src: s.source,
  }));

  try {
    const response = await fetch(`${PERPLEXITY_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You are a news editor for a civic news platform in Milwaukee, Wisconsin. For each story, assign:
1. relevance: 0.0-1.0 score for Milwaukee residents (0.8+ = directly local, 0.6-0.8 = WI/regional, 0.4-0.6 = national with local impact, below 0.4 = not relevant)
2. topic: EXACTLY one of: housing, economy, education, transit, safety, health, environment, politics
3. skip: true if the story is NOT civic news — skip sports, entertainment, listicles, weekend picks, event listings, restaurant reviews, celebrity news, game recaps. false if it IS substantive civic/policy news.

Topic guide:
- housing: zoning, rent, building permits, landlords, real estate, homelessness
- economy: jobs, wages, taxes, business, budget, trade, economic development
- education: schools, universities, students, teachers, MPS, UW system
- transit: roads, buses, MCTS, streetcar, highways, infrastructure, transportation
- safety: crime, police, courts, guns, fire department, public safety, prisons
- health: hospitals, insurance, mental health, drugs, Medicaid, public health
- environment: climate, water, pollution, parks, energy, recycling
- politics: elections, campaigns, voting, executive orders, policy debates, party politics, government leadership

Return ONLY a JSON array: [{"i":0,"r":0.85,"t":"housing","s":false},...]
No explanation. Just the array.`,
          },
          {
            role: "user",
            content: JSON.stringify(storyList),
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error(`[Triage] Perplexity ${response.status}`);
      return assignDefaultScores(stories);
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };

    const responseText = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      console.error("[Triage] No JSON in Perplexity response:", responseText.slice(0, 200));
      return assignDefaultScores(stories);
    }

    const scores = JSON.parse(jsonMatch[0]) as { i: number; r: number; t: string; s?: boolean }[];

    // Delete skipped stories from D1
    const skippedIds: string[] = [];
    for (const score of scores) {
      if (score.s === true && stories[score.i]) {
        skippedIds.push(stories[score.i].id);
      }
    }
    if (skippedIds.length > 0) {
      for (const id of skippedIds) {
        try {
          await env.DB.prepare("DELETE FROM stories WHERE id = ?").bind(id).run();
        } catch { /* ignore */ }
      }
      console.log(`[Triage] Removed ${skippedIds.length} non-civic stories`);
    }

    // Map scores back to stories (exclude skipped)
    const validTopics = new Set(["housing", "economy", "education", "transit", "safety", "health", "environment", "politics"]);

    const skippedSet = new Set(skippedIds);
    const triaged: TriagedStory[] = stories
      .filter((story) => !skippedSet.has(story.id))
      .map((story, _, arr) => {
        const idx = stories.indexOf(story);
        const score = scores.find((s) => s.i === idx);
        const topic = score?.t && validTopics.has(score.t) ? score.t : story.topic;
        return {
          ...story,
          relevance_score: score?.r ?? 0.3,
          topic,
          research_package: null,
        };
      });

    // Sort by relevance descending
    triaged.sort((a, b) => b.relevance_score - a.relevance_score);

    // Update D1 with scores and corrected topics
    for (const story of triaged) {
      try {
        await env.DB.prepare(
          `UPDATE stories SET relevance_score = ?, topic = ? WHERE id = ?`
        ).bind(story.relevance_score, story.topic, story.id).run();
      } catch {
        // Story might not be in D1 yet
      }
    }

    const highRelevance = triaged.filter((s) => s.relevance_score >= 0.6).length;
    const topicCounts: Record<string, number> = {};
    for (const s of triaged) {
      topicCounts[s.topic] = (topicCounts[s.topic] ?? 0) + 1;
    }
    console.log(`[Triage] Scored ${triaged.length} stories. ${highRelevance} high relevance. Topics:`, topicCounts);

    return triaged;
  } catch (error) {
    console.error("[Triage] Perplexity triage failed:", error);
    return assignDefaultScores(stories);
  }
}

function assignDefaultScores(stories: RawStory[]): TriagedStory[] {
  // Fallback: score based on source and keywords
  return stories.map((story) => {
    let score = 0.3;
    const text = `${story.headline} ${story.summary}`.toLowerCase();

    // Boost Milwaukee-specific stories
    if (text.includes("milwaukee")) score += 0.3;
    if (text.includes("wisconsin") || text.includes("wi ")) score += 0.2;

    // Boost by source
    if (story.source === "openstates") score += 0.1;
    if (story.source === "fred") score += 0.1;

    // Cap at 1.0
    score = Math.min(score, 1.0);

    return {
      ...story,
      relevance_score: score,
      research_package: null,
    };
  }).sort((a, b) => b.relevance_score - a.relevance_score);
}

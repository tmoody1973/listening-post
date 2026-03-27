import type { Env, RawStory, TriagedStory } from "../types";

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export async function triageStories(env: Env, stories: RawStory[]): Promise<TriagedStory[]> {
  if (stories.length === 0) return [];

  console.log(`[Triage] Scoring ${stories.length} stories...`);

  // Build the prompt with all stories
  const storyList = stories.map((s, i) => ({
    index: i,
    headline: s.headline,
    summary: s.summary?.slice(0, 200) ?? "",
    topic: s.topic,
    source: s.source,
  }));

  const prompt = `You are an editorial desk for a Milwaukee, Wisconsin local news podcast.
Score each story's relevance to Milwaukee residents on a scale of 0.0 to 1.0.

Scoring criteria:
- 0.8-1.0: Directly affects Milwaukee residents (local policy, WI state law, local economy)
- 0.6-0.8: Wisconsin or Midwest regional impact
- 0.4-0.6: National story with clear local implications
- 0.2-0.4: National story with indirect local relevance
- 0.0-0.2: Not relevant to Milwaukee

Also verify or correct the topic classification for each story.
Valid topics: housing, economy, education, transit, safety, health, environment

Return ONLY a JSON array with objects like:
[{"index": 0, "relevance": 0.85, "topic": "housing"}, ...]

Stories:
${JSON.stringify(storyList, null, 2)}`;

  try {
    const result = await env.AI.run(AI_MODEL, {
      messages: [
        { role: "system", content: "You are a news editor. Return only valid JSON arrays. No explanations." },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }) as { response?: string };

    const responseText = result.response ?? "";

    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[Triage] No JSON array in response:", responseText.slice(0, 200));
      return assignDefaultScores(stories);
    }

    const scores = JSON.parse(jsonMatch[0]) as { index: number; relevance: number; topic: string }[];

    // Map scores back to stories
    const triaged: TriagedStory[] = stories.map((story, i) => {
      const score = scores.find((s) => s.index === i);
      return {
        ...story,
        relevance_score: score?.relevance ?? 0.3,
        topic: score?.topic ?? story.topic,
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
        // Story might not be in D1 yet, skip
      }
    }

    const highRelevance = triaged.filter((s) => s.relevance_score >= 0.6).length;
    console.log(`[Triage] Scored ${triaged.length} stories. ${highRelevance} scored >= 0.6`);

    return triaged;
  } catch (error) {
    console.error("[Triage] Workers AI failed:", error);
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

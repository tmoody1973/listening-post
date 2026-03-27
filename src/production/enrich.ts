import type { Env } from "../types";

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

interface StoryRow {
  id: string;
  headline: string;
  summary: string | null;
  body: string | null;
  topic: string;
  source: string;
  source_url: string | null;
}

export async function enrichStories(env: Env): Promise<{ enriched: number; errors: number }> {
  // Get stories that need enrichment: no body, or bill-style headlines
  const result = await env.DB.prepare(
    `SELECT id, headline, summary, body, topic, source, source_url
     FROM stories
     WHERE body IS NULL OR body = ''
     ORDER BY created_at DESC
     LIMIT 15`
  ).all();

  const stories = (result.results ?? []) as unknown as StoryRow[];
  if (stories.length === 0) return { enriched: 0, errors: 0 };

  console.log(`[Enrich] Processing ${stories.length} stories...`);

  // Batch the headlines for rewriting + topic correction
  const storyData = stories.map((s, i) => ({
    index: i,
    headline: s.headline,
    summary: (s.summary ?? "").slice(0, 200),
    source: s.source,
    currentTopic: s.topic,
  }));

  let rewrittenHeadlines: { index: number; headline: string; topic: string }[] = [];

  try {
    const rewriteResult = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content: `You rewrite legislative bill titles and technical headlines into clear, conversational news headlines.

Rules:
- Make headlines sound like they belong on NPR or a local news website
- Remove "Relating to:" prefixes from bill titles
- Remove bill numbers from the start (put them at the end if relevant)
- Keep headlines under 80 characters
- Use active voice: "Wisconsin bill would..." not "A bill relating to..."
- If the story is already a good headline, keep it as-is
- Also correct the topic. Valid topics: housing, economy, education, transit, safety, health, environment
- Be specific with topics: a bill about schools is "education" not "economy"

Return ONLY a JSON array: [{"index": 0, "headline": "...", "topic": "..."}]`,
        },
        {
          role: "user",
          content: `Rewrite these headlines and classify topics:\n${JSON.stringify(storyData, null, 2)}`,
        },
      ],
      max_tokens: 3000,
      temperature: 0.2,
    }) as { response?: string };

    const jsonMatch = (rewriteResult.response ?? "").match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      rewrittenHeadlines = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("[Enrich] Headline rewrite failed:", error);
  }

  let enriched = 0;
  let errors = 0;

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    const rewrite = rewrittenHeadlines.find((r) => r.index === i);
    const newHeadline = rewrite?.headline ?? story.headline;
    const newTopic = rewrite?.topic ?? story.topic;

    // Generate article body
    try {
      const bodyResult = await env.AI.run(AI_MODEL, {
        messages: [
          {
            role: "system",
            content: `You are a local news writer for Milwaukee, Wisconsin. Write a concise 3-4 paragraph article based on the headline and summary.

Rules:
- Write in clear, journalistic prose — not academic or technical
- First paragraph: the key news in 2-3 sentences
- Second paragraph: context and background
- Third paragraph: why this matters to Milwaukee residents
- Optional fourth paragraph: what happens next
- Do NOT say "according to Perigon" or "according to OpenStates" — cite real sources
- For bills, cite "the Wisconsin State Legislature" or "Congress"
- For economic data, cite "Federal Reserve data" or "Bureau of Labor Statistics"
- Keep it under 300 words total
- Do not include a headline — just the article body`,
          },
          {
            role: "user",
            content: `Write an article:\nHeadline: ${newHeadline}\nSummary: ${story.summary ?? "No summary available"}\nTopic: ${newTopic}\nSource: ${story.source}`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }) as { response?: string };

      const body = bodyResult.response ?? "";

      if (body.length > 50) {
        await env.DB.prepare(
          `UPDATE stories SET headline = ?, topic = ?, body = ? WHERE id = ?`
        ).bind(newHeadline, newTopic, body, story.id).run();
        enriched++;
      } else {
        // At least update headline and topic
        await env.DB.prepare(
          `UPDATE stories SET headline = ?, topic = ? WHERE id = ?`
        ).bind(newHeadline, newTopic, story.id).run();
        enriched++;
      }
    } catch (error) {
      console.error(`[Enrich] Failed to enrich "${story.headline}":`, error);
      // Still update headline and topic even if body generation fails
      try {
        await env.DB.prepare(
          `UPDATE stories SET headline = ?, topic = ? WHERE id = ?`
        ).bind(newHeadline, newTopic, story.id).run();
      } catch {
        errors++;
      }
    }
  }

  console.log(`[Enrich] Done: ${enriched} enriched, ${errors} errors`);
  return { enriched, errors };
}

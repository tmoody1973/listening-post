import type { Env, RawStory } from "../types";

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

export async function embedStories(env: Env, stories: RawStory[]): Promise<void> {
  if (stories.length === 0) return;

  console.log(`[Vectorize] Embedding ${stories.length} stories...`);

  // Process in batches of 10 (Workers AI embedding limit)
  const batchSize = 10;
  let embedded = 0;

  for (let i = 0; i < stories.length; i += batchSize) {
    const batch = stories.slice(i, i + batchSize);

    try {
      // Generate text for embedding: headline + summary
      const texts = batch.map((s) =>
        `${s.headline}. ${s.summary ?? ""}`.slice(0, 512)
      );

      const result = await env.AI.run(EMBEDDING_MODEL, { text: texts }) as {
        data: number[][];
      };

      if (!result.data || result.data.length === 0) {
        console.error("[Vectorize] No embeddings returned for batch");
        continue;
      }

      // Build vectors for upsert
      const vectors = batch.map((story, idx) => ({
        id: story.id,
        values: result.data[idx],
        metadata: {
          headline: story.headline.slice(0, 200),
          topic: story.topic,
          source: story.source,
        },
      }));

      await env.STORY_INDEX.upsert(vectors);
      embedded += vectors.length;
    } catch (error) {
      console.error(`[Vectorize] Batch ${i} error:`, error);
    }
  }

  console.log(`[Vectorize] Embedded ${embedded}/${stories.length} stories`);
}

export async function findRelatedStories(
  env: Env,
  storyId: string,
  headline: string,
  summary: string,
  topK: number = 5
): Promise<{ id: string; score: number; headline: string; topic: string }[]> {
  try {
    // Generate embedding for the query story
    const text = `${headline}. ${summary ?? ""}`.slice(0, 512);
    const result = await env.AI.run(EMBEDDING_MODEL, { text: [text] }) as {
      data: number[][];
    };

    if (!result.data || result.data.length === 0) {
      return [];
    }

    // Query Vectorize for similar stories
    const matches = await env.STORY_INDEX.query(result.data[0], {
      topK: topK + 1, // +1 to exclude self
      returnMetadata: "all",
    });

    // Filter out the query story itself and return
    return matches.matches
      .filter((m) => m.id !== storyId)
      .slice(0, topK)
      .map((m) => ({
        id: m.id,
        score: m.score,
        headline: (m.metadata?.headline as string) ?? "",
        topic: (m.metadata?.topic as string) ?? "",
      }));
  } catch (error) {
    console.error("[Vectorize] Related stories query failed:", error);
    return [];
  }
}

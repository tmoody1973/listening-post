import type { Env, RawStory } from "../types";

const PERPLEXITY_BASE = "https://api.perplexity.ai";

interface PerplexityResponse {
  id: string;
  choices: {
    message: {
      content: string;
    };
  }[];
  citations?: string[];
}

export async function getEditorialSynthesis(env: Env, topStories: RawStory[]): Promise<{
  briefing: string;
  citations: string[];
}> {
  if (topStories.length === 0) {
    return { briefing: "", citations: [] };
  }

  const storyList = topStories
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s.headline} (${s.topic}, source: ${s.source})`)
    .join("\n");

  console.log("[Perplexity] Generating editorial synthesis...");

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
          content: "You are a local news editor for Milwaukee, Wisconsin. Synthesize today's stories into a concise editorial briefing. Focus on what matters to Milwaukee residents: how federal and state legislation affects them, economic trends, and civic developments. Be specific and cite sources.",
        },
        {
          role: "user",
          content: `Here are today's top stories for Milwaukee. Write a 200-300 word editorial briefing summarizing the key developments and why they matter locally:\n\n${storyList}`,
        },
      ],
      search_recency_filter: "day",
      web_search_options: {
        search_context_size: "medium",
        user_location: {
          latitude: 43.0389,
          longitude: -87.9065,
          country: "US",
        },
      },
      temperature: 0.2,
      return_related_questions: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Perplexity API ${response.status}: ${text}`);
  }

  const data = await response.json() as PerplexityResponse;
  const briefing = data.choices?.[0]?.message?.content ?? "";
  const citations = data.citations ?? [];

  console.log(`[Perplexity] Editorial synthesis: ${briefing.length} chars, ${citations.length} citations`);
  return { briefing, citations };
}

export async function getDeepResearch(env: Env, story: RawStory): Promise<{
  research: string;
  citations: string[];
}> {
  console.log(`[Perplexity] Deep research on: ${story.headline}`);

  const response = await fetch(`${PERPLEXITY_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: "You are a senior research journalist at a Milwaukee local news operation. Provide thorough, sourced background research. Include: historical context, key stakeholders and their positions, relevant data, local community impact for Milwaukee residents, and what to watch next. Cite all sources.",
        },
        {
          role: "user",
          content: `Research this story in depth for a Milwaukee audience:\n\nHeadline: ${story.headline}\nSummary: ${story.summary}\nTopic: ${story.topic}\nSource: ${story.source}\n\nProvide 400-600 words of sourced research.`,
        },
      ],
      search_recency_filter: "week",
      search_domain_filter: ["jsonline.com", "urbanmilwaukee.com", "wpr.org", "legis.wisconsin.gov"],
      web_search_options: {
        search_context_size: "high",
        user_location: {
          latitude: 43.0389,
          longitude: -87.9065,
          country: "US",
        },
      },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Perplexity API ${response.status}: ${text}`);
  }

  const data = await response.json() as PerplexityResponse;
  const research = data.choices?.[0]?.message?.content ?? "";
  const citations = data.citations ?? [];

  console.log(`[Perplexity] Deep research: ${research.length} chars, ${citations.length} citations`);
  return { research, citations };
}

// Perplexity-based news discovery — backup for when Perigon quota runs out
export async function discoverNewsViaPerplexity(env: Env): Promise<RawStory[]> {
  console.log("[Perplexity] Discovering Milwaukee news...");

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
          content: `You are a local news wire service. Find today's most important civic news stories for Milwaukee, Wisconsin. Return structured JSON.

Return ONLY a JSON array of 8-12 stories:
[{"headline": "...", "summary": "2-3 sentence summary", "topic": "housing|economy|education|transit|safety|health|environment|politics", "source_name": "original publication name"}]

Focus on: city government, county board, state legislature, housing, crime, education, economic development, infrastructure. Skip sports, entertainment, weather.`,
        },
        {
          role: "user",
          content: "What are today's most important news stories? Include: 1) Milwaukee/Wisconsin local stories (4-5), 2) National policy stories that affect Wisconsin residents — healthcare, housing, economy, infrastructure (3-4), 3) Business news — local Milwaukee companies and national business with local impact (2-3). Focus on substance, not fluff.",
        },
      ],
      search_recency_filter: "day",
      web_search_options: {
        search_context_size: "high",
        user_location: { latitude: 43.0389, longitude: -87.9065, country: "US" },
      },
      temperature: 0.1,
      return_images: true,
    }),
  });

  if (!response.ok) {
    console.error(`[Perplexity] News discovery ${response.status}`);
    return [];
  }

  const data = await response.json() as PerplexityResponse & { images?: { imageUrl: string }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  const citations = data.citations ?? [];
  const images = (data as any).images ?? [];

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("[Perplexity] No JSON in news discovery response");
    return [];
  }

  const discovered = JSON.parse(jsonMatch[0]) as {
    headline: string;
    summary: string;
    topic: string;
    source_name: string;
  }[];

  const stories: RawStory[] = discovered.map((d, i) => ({
    id: `perplexity-${Date.now()}-${i}`,
    headline: d.headline,
    summary: d.summary,
    topic: d.topic,
    source: "perplexity",
    source_url: citations[i] ?? null,
    image_url: images[i]?.imageUrl ?? null,
    image_caption: null,
    image_attribution: d.source_name,
    sentiment_positive: null,
    sentiment_negative: null,
    content: null,
    perigon_cluster_id: null,
  }));

  // Store in D1
  const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const n = (v: unknown): string | number | null => v === undefined ? null : v as string | number | null;

  for (const story of stories) {
    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO stories (id, headline, summary, slug, topic, source, source_url, image_url, image_attribution, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(story.id, story.headline, n(story.summary), slugify(story.headline), story.topic, story.source, n(story.source_url), n(story.image_url), n(story.image_attribution)).run();
    } catch { /* ignore dupes */ }
  }

  console.log(`[Perplexity] Discovered ${stories.length} civic news stories`);
  return stories;
}

// Wrapper for the ingestion pipeline — generates editorial synthesis
// and deep research for the top story
export async function ingestFromPerplexity(env: Env, stories: RawStory[]): Promise<{
  briefing: string;
  topStoryResearch: string | null;
  citations: string[];
}> {
  const { briefing, citations: briefingCitations } = await getEditorialSynthesis(env, stories);

  let topStoryResearch: string | null = null;
  let researchCitations: string[] = [];

  // Deep research on the #1 story (if we have one with enough substance)
  const topStory = stories.find((s) => s.summary && s.summary.length > 50);
  if (topStory) {
    try {
      const result = await getDeepResearch(env, topStory);
      topStoryResearch = result.research;
      researchCitations = result.citations;
    } catch (error) {
      console.error("[Perplexity] Deep research failed:", error);
    }
  }

  // Cache the briefing in KV for the agents to use
  await env.CONFIG_KV.put(
    "editorial:latest-briefing",
    JSON.stringify({
      briefing,
      topStoryResearch,
      citations: [...briefingCitations, ...researchCitations],
      generatedAt: new Date().toISOString(),
    }),
    { expirationTtl: 43200 } // 12 hour cache
  );

  console.log("[Perplexity] Editorial package cached in KV");

  return {
    briefing,
    topStoryResearch,
    citations: [...briefingCitations, ...researchCitations],
  };
}

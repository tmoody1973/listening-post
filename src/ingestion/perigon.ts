import type { Env, RawStory } from "../types";

const PERIGON_BASE = "https://api.goperigon.com/v1";

interface PerigonArticle {
  articleId: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  imageUrl: string | null;
  source: {
    domain: string;
    name: string;
  };
  authoredDate: string | null;
  publishedDate: string | null;
  state: string | null;
  city: string | null;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  } | null;
  topics: { name: string }[];
  categories: string[];
  entities: { name: string; type: string }[];
  clusterId: string | null;
}

interface PerigonResponse {
  status: number;
  numResults: number;
  articles: PerigonArticle[];
}

function mapTopicFromPerigon(article: PerigonArticle): string {
  const topicNames = (article.topics ?? []).map((t) => (t.name ?? "").toLowerCase());
  const categories = (article.categories ?? []).map((c) => (typeof c === "string" ? c : "").toLowerCase());
  const text = `${article.title} ${article.description ?? ""}`.toLowerCase();

  if (topicNames.some((t) => t.includes("housing") || t.includes("zoning") || t.includes("real estate")) ||
      text.includes("housing") || text.includes("zoning") || text.includes("rent")) {
    return "housing";
  }
  if (topicNames.some((t) => t.includes("education") || t.includes("school")) ||
      text.includes("school") || text.includes("mps") || text.includes("education")) {
    return "education";
  }
  if (topicNames.some((t) => t.includes("transit") || t.includes("transport")) ||
      text.includes("transit") || text.includes("mcts") || text.includes("bus") || text.includes("streetcar")) {
    return "transit";
  }
  if (topicNames.some((t) => t.includes("crime") || t.includes("police") || t.includes("safety")) ||
      text.includes("police") || text.includes("crime") || text.includes("public safety")) {
    return "safety";
  }
  if (topicNames.some((t) => t.includes("health") || t.includes("hospital")) ||
      categories.includes("health") || text.includes("health") || text.includes("hospital")) {
    return "health";
  }
  if (topicNames.some((t) => t.includes("environment") || t.includes("climate")) ||
      categories.includes("environment") || text.includes("environment") || text.includes("climate")) {
    return "environment";
  }

  return "economy";
}

function articleToRawStory(article: PerigonArticle): RawStory {
  return {
    id: `perigon-${article.articleId}`,
    headline: article.title ?? "",
    summary: article.description ?? "",
    topic: mapTopicFromPerigon(article),
    source: "perigon",
    source_url: article.url ?? null,
    image_url: article.imageUrl ?? null,
    image_caption: null,
    image_attribution: article.source?.name ?? null,
    sentiment_positive: article.sentiment?.positive ?? null,
    sentiment_negative: article.sentiment?.negative ?? null,
    content: article.content ?? null,
    perigon_cluster_id: article.clusterId ?? null,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function ingestFromPerigon(env: Env): Promise<RawStory[]> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Single combined query to conserve Perigon API quota (150 req/month free tier)
  const queries = [
    { q: "Milwaukee Wisconsin", sortBy: "date", size: 30, from: yesterday, showReprints: "false" },
  ];

  const allStories: RawStory[] = [];

  for (const params of queries) {
    try {
      const url = new URL(`${PERIGON_BASE}/all`);
      url.searchParams.set("apiKey", env.PERIGON_API_KEY);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }

      console.log(`[Perigon] Fetching: ${params.q}`);
      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`[Perigon] HTTP ${response.status}: ${await response.text()}`);
        continue;
      }

      const data = await response.json() as PerigonResponse;
      console.log(`[Perigon] Got ${data.numResults} results for "${params.q}"`);

      const stories = data.articles.map(articleToRawStory);
      allStories.push(...stories);
    } catch (error) {
      console.error(`[Perigon] Error fetching "${params.q}":`, error);
    }
  }

  // Deduplicate by cluster ID
  const seen = new Set<string>();
  const deduped = allStories.filter((story) => {
    const key = story.perigon_cluster_id ?? story.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Store in D1
  let stored = 0;
  for (const story of deduped) {
    try {
      const slug = slugify(story.headline);
      // D1 does not accept undefined — coerce all values to null
      const n = (v: unknown): string | number | null => v === undefined ? null : v as string | number | null;

      await env.DB.prepare(
        `INSERT OR IGNORE INTO stories (id, headline, summary, body, slug, topic, source, source_url, image_url, image_caption, image_attribution, sentiment_positive, sentiment_negative, perigon_cluster_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        story.id,
        story.headline,
        n(story.summary),
        n(story.content),
        slug,
        story.topic,
        story.source,
        n(story.source_url),
        n(story.image_url),
        n(story.image_caption),
        n(story.image_attribution),
        n(story.sentiment_positive),
        n(story.sentiment_negative),
        n(story.perigon_cluster_id),
      ).run();
      stored++;
    } catch (error) {
      console.error(`[Perigon] Failed to store story "${story.headline}":`, error);
    }
  }

  console.log(`[Perigon] Stored ${stored}/${deduped.length} stories in D1`);
  return deduped;
}

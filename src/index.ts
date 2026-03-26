import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import type { Env } from "./types";
import { NewsroomAgent } from "./agents/newsroom";
import { EpisodeAgent } from "./agents/episode";

// Re-export agents so Wrangler registers them as Durable Objects
export { NewsroomAgent, EpisodeAgent };

const app = new Hono<{ Bindings: Env }>();

// ─── Agent routing (WebSocket + HTTP to agents) ─────────────
app.all("/agents/*", async (c) => {
  const response = await routeAgentRequest(c.req.raw, c.env);
  return response ?? c.text("Agent not found", 404);
});

// ─── Manual triggers (dev) ──────────────────────────────────
app.post("/api/trigger/ingest", async (c) => {
  const { ingestFromPerigon } = await import("./ingestion/perigon");
  const { ingestFromCongress } = await import("./ingestion/congress");
  const { ingestFromFRED } = await import("./ingestion/fred");
  const { ingestFromOpenStates } = await import("./ingestion/openstates");
  const { ingestFromPerplexity } = await import("./ingestion/perplexity");
  // Phase 1: Ingest from all data sources in parallel
  const results = await Promise.allSettled([
    ingestFromPerigon(c.env),
    ingestFromCongress(c.env),
    ingestFromFRED(c.env),
    ingestFromOpenStates(c.env),
  ]);

  const allStories: unknown[] = [];
  const errors: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allStories.push(...(result.value as unknown[]));
    } else {
      errors.push(String(result.reason));
    }
  }

  // Phase 2: Editorial synthesis via Perplexity (needs stories first)
  let briefing: string | null = null;
  try {
    const editorial = await ingestFromPerplexity(c.env, allStories as any);
    briefing = editorial.briefing;
  } catch (error) {
    errors.push(`Perplexity: ${String(error)}`);
  }

  return c.json({
    status: "ingestion complete",
    storiesIngested: allStories.length,
    briefingLength: briefing?.length ?? 0,
    errors: errors.length > 0 ? errors : undefined,
  });
});

app.post("/api/trigger/produce", async (c) => {
  const edition = c.req.query("edition") ?? "morning";
  // TODO: Wire up episode production (Day 3)
  return c.json({ status: `${edition} production not yet implemented` });
});

// ─── Public API endpoints ───────────────────────────────────
app.get("/api/stories", async (c) => {
  const topic = c.req.query("topic");
  const all = c.req.query("all");

  // By default return published stories; ?all=true returns everything (dev)
  const publishedFilter = all ? "" : "AND published_at IS NOT NULL";
  let query = `SELECT * FROM stories WHERE 1=1 ${publishedFilter} ORDER BY created_at DESC LIMIT 20`;
  const params: string[] = [];

  if (topic) {
    query = `SELECT * FROM stories WHERE topic = ? ${publishedFilter} ORDER BY created_at DESC LIMIT 20`;
    params.push(topic);
  }

  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ stories: result.results });
});

app.get("/api/episodes", async (c) => {
  const edition = c.req.query("edition");
  let query = "SELECT * FROM episodes WHERE status = 'published' ORDER BY date DESC, edition LIMIT 20";
  const params: string[] = [];

  if (edition) {
    query = "SELECT * FROM episodes WHERE status = 'published' AND edition = ? ORDER BY date DESC LIMIT 20";
    params.push(edition);
  }

  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ episodes: result.results });
});

app.get("/api/article/:slug", async (c) => {
  const slug = c.req.param("slug");
  const result = await c.env.DB.prepare(
    "SELECT * FROM stories WHERE slug = ?"
  ).bind(slug).first();

  if (!result) {
    return c.json({ error: "Article not found" }, 404);
  }

  return c.json({ article: result });
});

app.get("/api/topic/:topic", async (c) => {
  const topic = c.req.param("topic");

  const [stories, bills] = await Promise.all([
    c.env.DB.prepare(
      "SELECT * FROM stories WHERE topic = ? AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 20"
    ).bind(topic).all(),
    c.env.DB.prepare(
      "SELECT * FROM bills WHERE topic = ? ORDER BY updated_at DESC LIMIT 10"
    ).bind(topic).all(),
  ]);

  return c.json({
    topic,
    stories: stories.results,
    bills: bills.results,
  });
});

app.get("/api/data/:topic", async (c) => {
  const topic = c.req.param("topic");
  const { FRED_SERIES } = await import("./types");

  const topicSeries = FRED_SERIES.filter((s) => s.topic === topic);
  const seriesData: unknown[] = [];

  for (const series of topicSeries) {
    const cached = await c.env.CONFIG_KV.get(`fred:${series.id}`, "json");
    if (cached) {
      seriesData.push(cached);
    }
  }

  return c.json({ topic, series: seriesData });
});

// ─── Media serving from R2 ──────────────────────────────────
app.get("/audio/:key{.+}", async (c) => {
  const key = `audio/${c.req.param("key")}`;
  const object = await c.env.MEDIA_BUCKET.get(key);

  if (!object) {
    return c.text("Not found", 404);
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

app.get("/images/:key{.+}", async (c) => {
  const key = `images/${c.req.param("key")}`;
  const object = await c.env.MEDIA_BUCKET.get(key);

  if (!object) {
    return c.text("Not found", 404);
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

// ─── Health check ───────────────────────────────────────────
app.get("/", (c) => {
  return c.json({
    name: "The Listening Post",
    status: "running",
    version: "0.1.0",
  });
});

export default app;

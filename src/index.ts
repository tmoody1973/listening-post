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
  const { ingestFromPerplexity, discoverNewsViaPerplexity } = await import("./ingestion/perplexity");
  const { triageStories } = await import("./production/triage");
  const { embedStories } = await import("./vectorize/embeddings");
  const { enrichStories } = await import("./production/enrich");
  const { rewriteBillHeadlines } = await import("./production/rewrite-headlines");

  // Phase 1: Ingest from all data sources in parallel
  // Perplexity news discovery runs alongside Perigon as backup/supplement
  const results = await Promise.allSettled([
    ingestFromPerigon(c.env),
    ingestFromCongress(c.env),
    ingestFromFRED(c.env),
    ingestFromOpenStates(c.env),
    discoverNewsViaPerplexity(c.env),
  ]);

  const allStories: any[] = [];
  const errors: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allStories.push(...(result.value as any[]));
    } else {
      errors.push(String(result.reason));
    }
  }

  // Phase 2: Workers AI triage — score relevance and correct topics
  let triagedStories: any[] = [];
  try {
    triagedStories = await triageStories(c.env, allStories);
  } catch (error) {
    errors.push(`Triage: ${String(error)}`);
    triagedStories = allStories;
  }

  // Phase 3: Vectorize — embed stories for editorial memory
  try {
    await embedStories(c.env, allStories);
  } catch (error) {
    errors.push(`Vectorize: ${String(error)}`);
  }

  // Phase 4: Enrich stories — rewrite headlines, fix topics, generate article bodies
  let enrichResult = { enriched: 0, errors: 0 };
  try {
    enrichResult = await enrichStories(c.env);
  } catch (error) {
    errors.push(`Enrich: ${String(error)}`);
  }

  // Phase 5: Rewrite bill headlines into plain language
  let headlinesRewritten = 0;
  try {
    headlinesRewritten = await rewriteBillHeadlines(c.env);
  } catch (error) {
    errors.push(`Headlines: ${String(error)}`);
  }

  // Phase 6: Editorial synthesis via Perplexity (uses triaged stories)
  let briefing: string | null = null;
  try {
    const editorial = await ingestFromPerplexity(c.env, triagedStories);
    briefing = editorial.briefing;
  } catch (error) {
    errors.push(`Perplexity: ${String(error)}`);
  }

  const highRelevance = triagedStories.filter((s: any) => s.relevance_score >= 0.6).length;

  return c.json({
    status: "ingestion complete",
    storiesIngested: allStories.length,
    storiesTriaged: triagedStories.length,
    highRelevance,
    storiesEnriched: enrichResult.enriched,
    headlinesRewritten,
    briefingLength: briefing?.length ?? 0,
    topStory: triagedStories.length > 0 ? {
      headline: triagedStories[0].headline,
      relevance: triagedStories[0].relevance_score,
      topic: triagedStories[0].topic,
    } : null,
    errors: errors.length > 0 ? errors : undefined,
  });
});

app.post("/api/trigger/produce", async (c) => {
  const edition = (c.req.query("edition") ?? "morning") as "morning" | "evening";
  const { buildShowRundown, generateActDialogue } = await import("./production/scriptwriter");
  const { voiceAct, voiceActFallbackTTS } = await import("./production/voices");
  const { assembleEpisode, generateTranscript } = await import("./production/assembler");

  const today = new Date().toISOString().split("T")[0];
  const episodeId = `${edition}-${today}`;

  console.log(`[Produce] Starting ${edition} episode: ${episodeId}`);

  // Step 1: Get recent stories from D1 (prefer scored, fall back to recent)
  let storiesResult = await c.env.DB.prepare(
    `SELECT * FROM stories WHERE relevance_score IS NOT NULL ORDER BY relevance_score DESC LIMIT 10`
  ).all();

  // Fallback: if no scored stories, grab the most recent ones
  if ((storiesResult.results ?? []).length === 0) {
    storiesResult = await c.env.DB.prepare(
      `SELECT * FROM stories ORDER BY created_at DESC LIMIT 10`
    ).all();
  }

  const stories = (storiesResult.results ?? []).map((s: any) => ({
    ...s,
    relevance_score: s.relevance_score ?? 0.3,
    research_package: null,
  }));

  if (stories.length === 0) {
    return c.json({ error: "No triaged stories available. Run /api/trigger/ingest first." }, 400);
  }

  // Step 2: Build show rundown
  console.log(`[Produce] Building rundown with ${stories.length} stories...`);
  const rundown = await buildShowRundown(edition, stories as any, c.env);

  // Step 3: Generate dialogue scripts for each act
  const acts: any[] = [];
  for (let i = 0; i < rundown.acts.length; i++) {
    const act = rundown.acts[i];
    console.log(`[Produce] Scripting ${act.title}...`);
    const dialogue = await generateActDialogue(act, edition, i, c.env);
    acts.push({
      id: act.id,
      title: act.title,
      dialogue,
      audioR2Key: null,
      durationSeconds: null,
      status: dialogue.length > 0 ? "scripted" : "failed",
    });
  }

  // Step 4: Voice each act via ElevenLabs Text to Dialogue
  const actAudioKeys: string[] = [];
  for (const act of acts) {
    if (act.status !== "scripted" || act.dialogue.length === 0) {
      console.log(`[Produce] Skipping ${act.title} — no dialogue`);
      continue;
    }

    console.log(`[Produce] Voicing ${act.title} (${act.dialogue.length} turns)...`);

    try {
      // Try Text to Dialogue (v3) first
      const { audioBuffer, durationEstimate } = await voiceAct(
        c.env, act.dialogue, episodeId, act.id
      );

      const r2Key = `audio/${episodeId}/${act.id}.mp3`;
      await c.env.MEDIA_BUCKET.put(r2Key, audioBuffer, {
        httpMetadata: { contentType: "audio/mpeg" },
      });

      act.audioR2Key = r2Key;
      act.durationSeconds = durationEstimate;
      act.status = "voiced";
      actAudioKeys.push(r2Key);
    } catch (error) {
      console.error(`[Produce] Text to Dialogue failed for ${act.title}:`, error);

      // Fallback to standard TTS
      try {
        console.log(`[Produce] Trying fallback TTS for ${act.title}...`);
        const { audioBuffer, durationEstimate } = await voiceActFallbackTTS(
          c.env, act.dialogue, episodeId, act.id
        );

        const r2Key = `audio/${episodeId}/${act.id}.mp3`;
        await c.env.MEDIA_BUCKET.put(r2Key, audioBuffer, {
          httpMetadata: { contentType: "audio/mpeg" },
        });

        act.audioR2Key = r2Key;
        act.durationSeconds = durationEstimate;
        act.status = "voiced";
        actAudioKeys.push(r2Key);
      } catch (fallbackError) {
        console.error(`[Produce] Fallback TTS also failed for ${act.title}:`, fallbackError);
        act.status = "failed";
      }
    }
  }

  // Step 5: Assemble final episode
  let finalR2Key: string | null = null;
  let totalDuration = 0;

  if (actAudioKeys.length > 0) {
    try {
      const assembled = await assembleEpisode(c.env, episodeId, actAudioKeys);
      finalR2Key = assembled.finalR2Key;
      // Use actual durations from file sizes, not estimates
      assembled.actDurations.forEach((d, i) => {
        if (acts[i]) acts[i].durationSeconds = d;
      });
      totalDuration = assembled.actDurations.reduce((sum, d) => sum + d, 0);
    } catch (error) {
      console.error("[Produce] Assembly failed:", error);
    }
  }

  // Step 6: Generate transcript
  const transcript = generateTranscript(acts);

  // Step 7: Write episode to D1
  const storyIds = stories.map((s: any) => s.id);
  try {
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO episodes (id, edition, date, status, audio_r2_key, transcript, duration_seconds, segment_count, segments_json, story_ids_json, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      episodeId,
      edition,
      today,
      finalR2Key ? "published" : "failed",
      finalR2Key,
      transcript,
      totalDuration,
      acts.length,
      JSON.stringify(acts.map((a: any) => ({ id: a.id, title: a.title, duration: a.durationSeconds, r2Key: a.audioR2Key }))),
      JSON.stringify(storyIds),
    ).run();

    // Mark stories as published with this episode
    for (const id of storyIds) {
      await c.env.DB.prepare(
        `UPDATE stories SET episode_id = ?, edition = ?, published_at = datetime('now') WHERE id = ?`
      ).bind(episodeId, edition, id).run();
    }
  } catch (error) {
    console.error("[Produce] D1 write failed:", error);
  }

  console.log(`[Produce] ${episodeId} complete. Status: ${finalR2Key ? "published" : "failed"}`);

  return c.json({
    status: finalR2Key ? "published" : "partial",
    episodeId,
    edition,
    acts: acts.map((a: any) => ({
      id: a.id,
      title: a.title,
      turns: a.dialogue?.length ?? 0,
      duration: a.durationSeconds,
      status: a.status,
    })),
    finalAudioUrl: finalR2Key ? `/audio/${episodeId}/final.mp3` : null,
    totalDuration,
    storiesUsed: stories.length,
  });
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

  // Find related stories via Vectorize
  let related: any[] = [];
  try {
    const { findRelatedStories } = await import("./vectorize/embeddings");
    related = await findRelatedStories(
      c.env,
      result.id as string,
      result.headline as string,
      (result.summary as string) ?? "",
      3
    );
  } catch {
    // Vectorize might not be available locally
  }

  return c.json({ article: result, related });
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

// Floor data — bills, floor actions, presidential actions, congressional record
app.get("/api/floor", async (c) => {
  const [federalBills, stateBills, floorActions, presidentialActions, congressionalRecord] = await Promise.all([
    c.env.DB.prepare(
      "SELECT * FROM bills WHERE source = 'congress' ORDER BY updated_at DESC LIMIT 10"
    ).all(),
    c.env.DB.prepare(
      "SELECT * FROM bills WHERE source = 'openstates' ORDER BY updated_at DESC LIMIT 10"
    ).all(),
    c.env.DB.prepare(
      "SELECT * FROM floor_actions ORDER BY date DESC, created_at DESC LIMIT 10"
    ).all(),
    c.env.DB.prepare(
      "SELECT * FROM presidential_actions ORDER BY created_at DESC LIMIT 5"
    ).all(),
    c.env.DB.prepare(
      "SELECT * FROM congressional_record ORDER BY date DESC LIMIT 5"
    ).all(),
  ]);

  return c.json({
    federalBills: federalBills.results ?? [],
    stateBills: stateBills.results ?? [],
    floorActions: floorActions.results ?? [],
    presidentialActions: presidentialActions.results ?? [],
    congressionalRecord: congressionalRecord.results ?? [],
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

// ─── Episode manifest (act-by-act audio for gapless playback) ─
app.get("/api/episode/:id/manifest", async (c) => {
  const id = c.req.param("id");
  const manifestKey = `audio/${id}/manifest.json`;
  const object = await c.env.MEDIA_BUCKET.get(manifestKey);

  if (!object) {
    return c.json({ error: "Episode manifest not found" }, 404);
  }

  const manifest = await object.json();
  return c.json(manifest);
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

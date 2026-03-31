import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import type { Env } from "./types";
import { NewsroomAgent } from "./agents/newsroom";
import { EpisodeAgent } from "./agents/episode";

// Re-export agents so Wrangler registers them as Durable Objects
export { NewsroomAgent, EpisodeAgent };

const app = new Hono<{ Bindings: Env }>();

// CORS — allow frontend to fetch from backend
app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
});

app.options("*", (c) => {
  return new Response(null, { status: 204 });
});

// ─── Agent routing (WebSocket + HTTP to agents) ─────────────
app.all("/agents/*", async (c) => {
  const response = await routeAgentRequest(c.req.raw, c.env);
  return response ?? c.text("Agent not found", 404);
});

// ─── Initialize the NewsroomAgent (call once to start scheduling) ──
app.post("/api/init", async (c) => {
  // Route through the agent SDK pattern to properly initialize
  const agentUrl = new URL(c.req.url);
  agentUrl.pathname = "/agents/NewsroomAgent/main-newsroom";
  const initReq = new Request(agentUrl.toString(), { method: "GET" });
  const res = await routeAgentRequest(initReq, c.env);
  if (res) {
    return c.json({ status: "Agent initialized — cron schedules set" });
  }
  return c.json({ status: "Agent initialization attempted" });
});

// ─── Agent status ──
app.get("/api/newsroom/status", async (c) => {
  const agentUrl = new URL(c.req.url);
  agentUrl.pathname = "/agents/NewsroomAgent/main-newsroom";
  const res = await routeAgentRequest(new Request(agentUrl.toString()), c.env);
  return res ?? c.json({ error: "Agent not found" }, 404);
});

// ─── Admin auth check ───────────────────────────────────────
function requireAdmin(c: any): Response | null {
  const key = c.req.header("X-Admin-Key") ?? c.req.query("key");
  if (key !== c.env.ADMIN_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return null;
}

// ─── Civic data trigger ─────────────────────────────────────
app.post("/api/trigger/civic", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  const { ingestCivicData } = await import("./ingestion/civic");
  const counts = await ingestCivicData(c.env);
  return c.json({ status: "civic ingestion complete", ...counts });
});

// ─── Manual triggers (dev) ──────────────────────────────────
app.post("/api/trigger/ingest", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  const { ingestFromPerigon } = await import("./ingestion/perigon");
  const { ingestFromCongress } = await import("./ingestion/congress");
  const { ingestFromFRED } = await import("./ingestion/fred");
  const { ingestFromOpenStates } = await import("./ingestion/openstates");
  const { ingestFromPerplexity, discoverNewsViaPerplexity } = await import("./ingestion/perplexity");
  const { ingestCongressionalRecordArticles } = await import("./ingestion/congressional-record");
  const { triageStories } = await import("./production/triage");
  const { embedStories } = await import("./vectorize/embeddings");
  const { enrichStories } = await import("./production/enrich");
  const { rewriteBillHeadlines } = await import("./production/rewrite-headlines");
  const { generateMissingImages } = await import("./production/images");

  // Phase 1: Ingest from all data sources in parallel
  // Perplexity news discovery runs alongside Perigon as backup/supplement
  const results = await Promise.allSettled([
    ingestFromPerigon(c.env),
    ingestFromCongress(c.env),
    ingestFromFRED(c.env),
    ingestFromOpenStates(c.env),
    discoverNewsViaPerplexity(c.env),
    ingestCongressionalRecordArticles(c.env),
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

  // Phase 6: Generate editorial illustrations for stories without images
  let imagesGenerated = 0;
  try {
    imagesGenerated = await generateMissingImages(c.env);
  } catch (error) {
    errors.push(`Images: ${String(error)}`);
  }

  // Phase 7: Editorial synthesis via Perplexity (uses triaged stories)
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
    imagesGenerated,
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
  const denied = requireAdmin(c);
  if (denied) return denied;
  const edition = (c.req.query("edition") ?? "morning") as "morning" | "evening";
  const { buildShowRundown, generateActDialogue } = await import("./production/scriptwriter");
  const { voiceAct, voiceActFallbackTTS } = await import("./production/voices");
  const { assembleEpisode, generateTranscript } = await import("./production/assembler");

  const today = new Date().toISOString().split("T")[0];
  const episodeId = `${edition}-${today}`;

  console.log(`[Produce] Starting ${edition} episode: ${episodeId}`);

  // Step 1: Get today's stories not yet used in an episode
  let storiesResult = await c.env.DB.prepare(
    `SELECT * FROM stories WHERE episode_id IS NULL AND date(created_at) = ? ORDER BY relevance_score DESC LIMIT 10`
  ).bind(today).all();

  // Fallback: if not enough today, get any unused stories
  if ((storiesResult.results ?? []).length < 5) {
    storiesResult = await c.env.DB.prepare(
      `SELECT * FROM stories WHERE episode_id IS NULL ORDER BY created_at DESC LIMIT 10`
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
  // Show all stories — published filter removed since most stories
  // are ingested without explicit publish step
  const publishedFilter = "";
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
      "SELECT * FROM stories WHERE topic = ? ORDER BY created_at DESC LIMIT 20"
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

// Bills by chamber
app.get("/api/bills/:chamber", async (c) => {
  const chamber = c.req.param("chamber");
  let source = "congress";
  if (chamber === "wisconsin") source = "openstates";

  const result = await c.env.DB.prepare(
    "SELECT * FROM bills WHERE source = ? ORDER BY updated_at DESC LIMIT 50"
  ).bind(source).all();

  return c.json({ bills: result.results ?? [], chamber });
});

// Bill detail
app.get("/api/bill/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));

  const bill = await c.env.DB.prepare(
    "SELECT * FROM bills WHERE id = ?"
  ).bind(id).first();

  if (!bill) {
    return c.json({ error: "Bill not found" }, 404);
  }

  // Find the corresponding story for this bill (if article was generated)
  const story = await c.env.DB.prepare(
    "SELECT * FROM stories WHERE id = ?"
  ).bind(id).first();

  return c.json({ bill, story });
});

// Voice agent for article conversations (rate limited)
app.get("/api/voice-agent/:slug", async (c) => {
  try {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const rlKey = `ratelimit:voice:${ip}`;
    const recent = await c.env.CONFIG_KV.get(rlKey);
    if (recent) return c.json({ error: "Too many requests. Wait 30 seconds." }, 429);
    await c.env.CONFIG_KV.put(rlKey, "1", { expirationTtl: 60 });

    const slug = c.req.param("slug");
    console.log(`[VoiceAgent] Request for slug: ${slug}`);

    const article = await c.env.DB.prepare("SELECT * FROM stories WHERE slug = ?").bind(slug).first() as any;

    if (!article) {
      return c.json({ error: "Article not found" }, 404);
    }
    if (!article.body) {
      return c.json({ error: "Article has no content for voice agent" }, 404);
    }

    console.log(`[VoiceAgent] Creating agent for: ${article.headline?.slice(0, 50)}`);

    const { getOrCreateArticleAgent } = await import("./production/voice-agent");
    const result = await getOrCreateArticleAgent(
      c.env,
      article.id,
      article.headline,
      article.body,
      article.topic,
      article.source
    );
    return c.json(result);
  } catch (error) {
    console.error("[VoiceAgent] Failed:", error);
    return c.json({ error: `Voice agent error: ${String(error)}` }, 500);
  }
});

// Voice agent for civic items (rate limited)
app.get("/api/voice-agent/civic/:id", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const rlKey = `ratelimit:voice:${ip}`;
  const recent = await c.env.CONFIG_KV.get(rlKey);
  if (recent) return c.json({ error: "Too many requests. Wait 30 seconds." }, 429);
  await c.env.CONFIG_KV.put(rlKey, "1", { expirationTtl: 60 });
  const id = decodeURIComponent(c.req.param("id"));
  const item = await c.env.DB.prepare("SELECT * FROM civic_items WHERE id = ?").bind(id).first() as any;

  if (!item || !item.body) {
    return c.json({ error: "Item not found or has no content" }, 404);
  }

  try {
    const { getOrCreateArticleAgent } = await import("./production/voice-agent");
    const result = await getOrCreateArticleAgent(
      c.env,
      item.id,
      item.title,
      item.body,
      item.category ?? "politics",
      item.source
    );
    return c.json(result);
  } catch (error) {
    console.error("[VoiceAgent] Failed:", error);
    return c.json({ error: String(error) }, 500);
  }
});

// Civic item detail — enriches with Perplexity if no body exists
app.get("/api/civic/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  const item = await c.env.DB.prepare("SELECT * FROM civic_items WHERE id = ?").bind(id).first() as any;
  if (!item) return c.json({ error: "Not found" }, 404);

  // If no body yet, generate one with Perplexity (with lock to prevent concurrent calls)
  if (!item.body && item.body !== "ENRICHING" && item.title) {
    // Set lock to prevent concurrent enrichment
    await c.env.DB.prepare("UPDATE civic_items SET body = 'ENRICHING' WHERE id = ? AND body IS NULL").bind(id).run();
    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "You explain Milwaukee city legislation and civic items in plain language for residents. Write 3-4 paragraphs. First paragraph: what this is and what it does. Second: why it matters to Milwaukee residents. Third: what happens next. Be clear and specific.",
            },
            {
              role: "user",
              content: `Explain this Milwaukee civic item:\nTitle: ${item.title}\nType: ${item.matter_type ?? item.type}\nStatus: ${item.matter_status ?? "Unknown"}\nSponsor: ${item.sponsor_name ?? "N/A"}\nSummary: ${item.summary ?? "No summary"}\nFile: ${item.matter_file ?? "N/A"}`,
            },
          ],
          web_search_options: { search_context_size: "medium", user_location: { latitude: 43.0389, longitude: -87.9065, country: "US" } },
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json() as { choices: { message: { content: string } }[]; citations?: string[] };
        const body = data.choices?.[0]?.message?.content ?? "";
        const citations = data.citations ?? [];

        if (body.length > 50) {
          const sourcesJson = citations.length > 0
            ? JSON.stringify(citations.map((url: string) => {
                try { return { name: new URL(url).hostname.replace("www.", ""), url }; }
                catch { return { name: url, url }; }
              }))
            : null;

          await c.env.DB.prepare(
            "UPDATE civic_items SET body = ? WHERE id = ?"
          ).bind(body, id).run();

          item.body = body;
        }
      }
    } catch (error) {
      console.error("[Civic] On-demand enrichment failed:", error);
    }
  }

  return c.json({ item });
});

// City Hall civic data
app.get("/api/city-hall", async (c) => {
  const [meetings, legislation, votes, permits, licenses, pressReleases] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM civic_items WHERE type = 'meeting' ORDER BY date DESC LIMIT 20").all(),
    c.env.DB.prepare("SELECT * FROM civic_items WHERE type = 'legislation' ORDER BY date DESC LIMIT 20").all(),
    c.env.DB.prepare("SELECT * FROM civic_items WHERE type = 'vote' ORDER BY date DESC LIMIT 10").all(),
    c.env.DB.prepare("SELECT * FROM civic_items WHERE type = 'permit' ORDER BY created_at DESC LIMIT 15").all(),
    c.env.DB.prepare("SELECT * FROM civic_items WHERE type = 'license' AND category = 'restaurant' ORDER BY date DESC LIMIT 20").all(),
    c.env.DB.prepare("SELECT * FROM civic_items WHERE type = 'press_release' ORDER BY date DESC LIMIT 10").all(),
  ]);

  return c.json({
    meetings: meetings.results ?? [],
    legislation: legislation.results ?? [],
    votes: votes.results ?? [],
    permits: permits.results ?? [],
    licenses: licenses.results ?? [],
    pressReleases: pressReleases.results ?? [],
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

// Cron trigger handler — backup scheduling for the NewsroomAgent
const worker = {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const hour = new Date(event.scheduledTime).getUTCHours();
    console.log(`[Cron] Triggered at UTC hour ${hour}`);

    if (hour === 8) {
      // 3 AM CT — morning ingestion
      const { ingestFromPerigon } = await import("./ingestion/perigon");
      const { ingestFromCongress } = await import("./ingestion/congress");
      const { ingestFromFRED } = await import("./ingestion/fred");
      const { ingestFromOpenStates } = await import("./ingestion/openstates");
      const { discoverNewsViaPerplexity } = await import("./ingestion/perplexity");
      const { ingestCongressionalRecordArticles } = await import("./ingestion/congressional-record");
      const { ingestCivicData } = await import("./ingestion/civic");
      const { triageStories } = await import("./production/triage");
      const { enrichStories } = await import("./production/enrich");
      const { generateMissingImages } = await import("./production/images");

      const results = await Promise.allSettled([
        ingestFromPerigon(env), ingestFromCongress(env), ingestFromFRED(env),
        ingestFromOpenStates(env), discoverNewsViaPerplexity(env),
        ingestCongressionalRecordArticles(env), ingestCivicData(env),
      ]);

      const allStories: any[] = [];
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value)) allStories.push(...r.value);
      }

      await triageStories(env, allStories).catch(() => {});
      await enrichStories(env).catch(() => {});
      await generateMissingImages(env).catch(() => {});
      console.log(`[Cron] Morning ingestion complete: ${allStories.length} stories`);
    }

    if (hour === 10 || hour === 22) {
      // 5 AM CT or 5 PM CT — episode production
      const edition = hour === 10 ? "morning" : "evening";
      const { buildShowRundown, generateActDialogue } = await import("./production/scriptwriter");
      const { voiceAct, voiceActFallbackTTS } = await import("./production/voices");
      const { assembleEpisode, generateTranscript } = await import("./production/assembler");

      const today = new Date().toISOString().split("T")[0];
      const episodeId = `${edition}-${today}`;

      // Get today's unused stories — exclude stories already in an episode
      let storiesResult = await env.DB.prepare(
        "SELECT * FROM stories WHERE episode_id IS NULL AND date(created_at) = ? ORDER BY relevance_score DESC LIMIT 10"
      ).bind(today).all();
      if ((storiesResult.results ?? []).length < 5) {
        // On slow days (weekends), pull from civic items too
        storiesResult = await env.DB.prepare(
          "SELECT * FROM stories WHERE episode_id IS NULL ORDER BY created_at DESC LIMIT 10"
        ).all();
      }

      const stories = (storiesResult.results ?? []).map((s: any) => ({ ...s, relevance_score: s.relevance_score ?? 0.3, research_package: null }));
      if (stories.length === 0) { console.log("[Cron] No stories for production"); return; }

      const rundown = await buildShowRundown(edition as any, stories as any, env);
      const acts: any[] = [];
      for (let i = 0; i < rundown.acts.length; i++) {
        const dialogue = await generateActDialogue(rundown.acts[i], edition as any, i, env);
        acts.push({ id: rundown.acts[i].id, title: rundown.acts[i].title, dialogue, audioR2Key: null, durationSeconds: null, status: dialogue.length > 0 ? "scripted" : "failed" });
      }

      const actAudioKeys: string[] = [];
      for (const act of acts) {
        if (act.status !== "scripted") continue;
        try {
          const { audioBuffer } = await voiceAct(env, act.dialogue, episodeId, act.id);
          const r2Key = `audio/${episodeId}/${act.id}.mp3`;
          await env.MEDIA_BUCKET.put(r2Key, audioBuffer, { httpMetadata: { contentType: "audio/mpeg" } });
          act.audioR2Key = r2Key; act.status = "voiced"; actAudioKeys.push(r2Key);
        } catch {
          try {
            const { audioBuffer } = await voiceActFallbackTTS(env, act.dialogue, episodeId, act.id);
            const r2Key = `audio/${episodeId}/${act.id}.mp3`;
            await env.MEDIA_BUCKET.put(r2Key, audioBuffer, { httpMetadata: { contentType: "audio/mpeg" } });
            act.audioR2Key = r2Key; act.status = "voiced"; actAudioKeys.push(r2Key);
          } catch { act.status = "failed"; }
        }
      }

      if (actAudioKeys.length > 0) {
        const assembled = await assembleEpisode(env, episodeId, actAudioKeys);
        const transcript = generateTranscript(acts);
        const totalDuration = assembled.actDurations.reduce((s, d) => s + d, 0);
        await env.DB.prepare(
          `INSERT OR REPLACE INTO episodes (id, edition, date, status, audio_r2_key, transcript, duration_seconds, segment_count, segments_json, story_ids_json, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(episodeId, edition, today, "published", assembled.finalR2Key, transcript, totalDuration, acts.length,
          JSON.stringify(acts.map((a: any) => ({ id: a.id, title: a.title, duration: a.durationSeconds, r2Key: a.audioR2Key }))),
          JSON.stringify(stories.map((s: any) => s.id)),
        ).run();
        console.log(`[Cron] ${episodeId} published. Duration: ${totalDuration}s`);
      }
    }

    if (hour === 18) {
      // 1 PM CT — afternoon ingestion (same as morning)
      const { ingestFromPerigon } = await import("./ingestion/perigon");
      const { discoverNewsViaPerplexity } = await import("./ingestion/perplexity");
      const { triageStories } = await import("./production/triage");

      const { ingestCivicData } = await import("./ingestion/civic");

      const results = await Promise.allSettled([
        ingestFromPerigon(env), discoverNewsViaPerplexity(env), ingestCivicData(env),
      ]);
      const stories: any[] = [];
      for (const r of results) { if (r.status === "fulfilled" && Array.isArray(r.value)) stories.push(...r.value); }
      await triageStories(env, stories).catch(() => {});
      console.log(`[Cron] Afternoon ingestion: ${stories.length} stories + civic data`);
    }
  },
};

export default worker;

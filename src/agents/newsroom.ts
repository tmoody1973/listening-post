import { Agent } from "agents";
import type { Env, RawStory } from "../types";
import { ingestFromPerigon } from "../ingestion/perigon";
import { ingestFromCongress } from "../ingestion/congress";
import { ingestFromFRED } from "../ingestion/fred";
import { ingestFromOpenStates } from "../ingestion/openstates";
import { ingestFromPerplexity, discoverNewsViaPerplexity } from "../ingestion/perplexity";
import { ingestCongressionalRecordArticles } from "../ingestion/congressional-record";
import { triageStories } from "../production/triage";
import { embedStories } from "../vectorize/embeddings";
import { enrichStories } from "../production/enrich";
import { rewriteBillHeadlines } from "../production/rewrite-headlines";
import { generateMissingImages } from "../production/images";
import { buildShowRundown, generateActDialogue } from "../production/scriptwriter";
import { voiceAct, voiceActFallbackTTS } from "../production/voices";
import { assembleEpisode, generateTranscript } from "../production/assembler";

interface NewsroomState {
  status: "idle" | "ingesting" | "triaging" | "enriching" | "producing" | "error";
  lastIngestion: string | null;
  lastEpisode: string | null;
  ingestionProgress: {
    perigon: "pending" | "done" | "failed";
    congress: "pending" | "done" | "failed";
    openstates: "pending" | "done" | "failed";
    fred: "pending" | "done" | "failed";
    perplexity: "pending" | "done" | "failed";
    record: "pending" | "done" | "failed";
  };
  storiesIngestedToday: number;
  topStorySummary: string;
  morningEpisodeId: string | null;
  eveningEpisodeId: string | null;
  lastError: string | null;
}

export class NewsroomAgent extends Agent<Env, NewsroomState> {
  initialState: NewsroomState = {
    status: "idle",
    lastIngestion: null,
    lastEpisode: null,
    ingestionProgress: {
      perigon: "pending",
      congress: "pending",
      openstates: "pending",
      fred: "pending",
      perplexity: "pending",
      record: "pending",
    },
    storiesIngestedToday: 0,
    topStorySummary: "",
    morningEpisodeId: null,
    eveningEpisodeId: null,
    lastError: null,
  };

  async onStart() {
    console.log("[Newsroom] Agent started, scheduling daily cycles");

    // Morning ingestion at 3:00 AM CT (8:00 UTC)
    await this.schedule("0 8 * * *", "runIngestion", { label: "morning" });
    // Morning episode production at 5:00 AM CT (10:00 UTC)
    await this.schedule("0 10 * * *", "runProduction", { edition: "morning" });
    // Afternoon ingestion at 1:00 PM CT (18:00 UTC)
    await this.schedule("0 18 * * *", "runIngestion", { label: "afternoon" });
    // Evening episode production at 5:00 PM CT (22:00 UTC)
    await this.schedule("0 22 * * *", "runProduction", { edition: "evening" });
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return Response.json(this.state);
    }

    if (url.pathname === "/trigger/ingest" && request.method === "POST") {
      // Run immediately, non-blocking
      await this.schedule(0, "runIngestion", { label: "manual" });
      return Response.json({ status: "ingestion started", state: this.state });
    }

    if (url.pathname === "/trigger/produce" && request.method === "POST") {
      const edition = url.searchParams.get("edition") ?? "morning";
      await this.schedule(0, "runProduction", { edition });
      return Response.json({ status: `${edition} production started`, state: this.state });
    }

    return Response.json({ agent: "NewsroomAgent", state: this.state });
  }

  async onConnect(connection: unknown) {
    console.log("[Newsroom] Client connected");
  }

  onStateChanged(state: NewsroomState, source: string | unknown) {
    console.log(`[Newsroom] ${state.status} | Stories: ${state.storiesIngestedToday} | Last: ${state.lastIngestion}`);
  }

  // ─── Full Ingestion Pipeline ──────────────────────────────

  async runIngestion(payload: { label: string }) {
    console.log(`[Newsroom] Starting ${payload.label} ingestion...`);

    this.setState({
      ...this.state,
      status: "ingesting",
      lastError: null,
      ingestionProgress: {
        perigon: "pending",
        congress: "pending",
        openstates: "pending",
        fred: "pending",
        perplexity: "pending",
        record: "pending",
      },
    });

    const allStories: RawStory[] = [];

    // Phase 1: Ingest from all sources in parallel
    const results = await Promise.allSettled([
      ingestFromPerigon(this.env),
      ingestFromCongress(this.env),
      ingestFromFRED(this.env),
      ingestFromOpenStates(this.env),
      discoverNewsViaPerplexity(this.env),
      ingestCongressionalRecordArticles(this.env),
    ]);

    const sourceNames = ["perigon", "congress", "fred", "openstates", "perplexity", "record"] as const;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const name = sourceNames[i];
      if (result.status === "fulfilled") {
        allStories.push(...(result.value as RawStory[]));
        this.setState({
          ...this.state,
          ingestionProgress: { ...this.state.ingestionProgress, [name]: "done" },
        });
      } else {
        console.error(`[Newsroom] ${name} failed:`, result.reason);
        this.setState({
          ...this.state,
          ingestionProgress: { ...this.state.ingestionProgress, [name]: "failed" },
        });
      }
    }

    // Phase 2: Triage
    this.setState({ ...this.state, status: "triaging" });
    try {
      await triageStories(this.env, allStories);
    } catch (error) {
      console.error("[Newsroom] Triage failed:", error);
    }

    // Phase 3: Vectorize
    try {
      await embedStories(this.env, allStories);
    } catch (error) {
      console.error("[Newsroom] Vectorize failed:", error);
    }

    // Phase 4: Enrich (headlines, articles, topics)
    this.setState({ ...this.state, status: "enriching" });
    try {
      await enrichStories(this.env);
    } catch (error) {
      console.error("[Newsroom] Enrich failed:", error);
    }

    // Phase 5: Rewrite bill headlines
    try {
      await rewriteBillHeadlines(this.env);
    } catch (error) {
      console.error("[Newsroom] Headline rewrite failed:", error);
    }

    // Phase 6: Generate images
    try {
      await generateMissingImages(this.env);
    } catch (error) {
      console.error("[Newsroom] Image generation failed:", error);
    }

    // Phase 7: Editorial synthesis
    try {
      await ingestFromPerplexity(this.env, allStories);
    } catch (error) {
      console.error("[Newsroom] Editorial synthesis failed:", error);
    }

    this.setState({
      ...this.state,
      status: "idle",
      lastIngestion: new Date().toISOString(),
      storiesIngestedToday: this.state.storiesIngestedToday + allStories.length,
      topStorySummary: allStories.length > 0 ? allStories[0].headline : "",
    });

    console.log(`[Newsroom] ${payload.label} ingestion complete: ${allStories.length} stories`);
  }

  // ─── Episode Production Pipeline ──────────────────────────

  async runProduction(payload: { edition: string }) {
    const edition = payload.edition as "morning" | "evening";
    const today = new Date().toISOString().split("T")[0];
    const episodeId = `${edition}-${today}`;

    console.log(`[Newsroom] Starting ${edition} episode production: ${episodeId}`);
    this.setState({ ...this.state, status: "producing" });

    try {
      // Get stories
      let storiesResult = await this.env.DB.prepare(
        "SELECT * FROM stories WHERE relevance_score IS NOT NULL ORDER BY relevance_score DESC LIMIT 10"
      ).all();

      if ((storiesResult.results ?? []).length === 0) {
        storiesResult = await this.env.DB.prepare(
          "SELECT * FROM stories ORDER BY created_at DESC LIMIT 10"
        ).all();
      }

      const stories = (storiesResult.results ?? []).map((s: any) => ({
        ...s,
        relevance_score: s.relevance_score ?? 0.3,
        research_package: null,
      }));

      if (stories.length === 0) {
        console.error("[Newsroom] No stories for production");
        this.setState({ ...this.state, status: "idle", lastError: "No stories available" });
        return;
      }

      // Build rundown
      const rundown = await buildShowRundown(edition, stories as any, this.env);

      // Generate scripts
      const acts: any[] = [];
      for (let i = 0; i < rundown.acts.length; i++) {
        const dialogue = await generateActDialogue(rundown.acts[i], edition, i, this.env);
        acts.push({
          id: rundown.acts[i].id,
          title: rundown.acts[i].title,
          dialogue,
          audioR2Key: null,
          durationSeconds: null,
          status: dialogue.length > 0 ? "scripted" : "failed",
        });
      }

      // Voice each act
      const actAudioKeys: string[] = [];
      for (const act of acts) {
        if (act.status !== "scripted" || act.dialogue.length === 0) continue;

        try {
          const { audioBuffer } = await voiceAct(this.env, act.dialogue, episodeId, act.id);
          const r2Key = `audio/${episodeId}/${act.id}.mp3`;
          await this.env.MEDIA_BUCKET.put(r2Key, audioBuffer, {
            httpMetadata: { contentType: "audio/mpeg" },
          });
          act.audioR2Key = r2Key;
          act.status = "voiced";
          actAudioKeys.push(r2Key);
        } catch (error) {
          console.error(`[Newsroom] Voice failed for ${act.title}, trying fallback:`, error);
          try {
            const { audioBuffer } = await voiceActFallbackTTS(this.env, act.dialogue, episodeId, act.id);
            const r2Key = `audio/${episodeId}/${act.id}.mp3`;
            await this.env.MEDIA_BUCKET.put(r2Key, audioBuffer, {
              httpMetadata: { contentType: "audio/mpeg" },
            });
            act.audioR2Key = r2Key;
            act.status = "voiced";
            actAudioKeys.push(r2Key);
          } catch {
            act.status = "failed";
          }
        }
      }

      // Assemble
      let finalR2Key: string | null = null;
      let totalDuration = 0;
      if (actAudioKeys.length > 0) {
        const assembled = await assembleEpisode(this.env, episodeId, actAudioKeys);
        finalR2Key = assembled.finalR2Key;
        assembled.actDurations.forEach((d, i) => { if (acts[i]) acts[i].durationSeconds = d; });
        totalDuration = assembled.actDurations.reduce((sum, d) => sum + d, 0);
      }

      // Generate transcript
      const transcript = generateTranscript(acts);

      // Write to D1
      const storyIds = stories.map((s: any) => s.id);
      await this.env.DB.prepare(
        `INSERT OR REPLACE INTO episodes (id, edition, date, status, audio_r2_key, transcript, duration_seconds, segment_count, segments_json, story_ids_json, published_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(
        episodeId, edition, today,
        finalR2Key ? "published" : "failed",
        finalR2Key, transcript, totalDuration, acts.length,
        JSON.stringify(acts.map((a: any) => ({ id: a.id, title: a.title, duration: a.durationSeconds, r2Key: a.audioR2Key }))),
        JSON.stringify(storyIds),
      ).run();

      // Mark stories published
      for (const id of storyIds) {
        await this.env.DB.prepare(
          "UPDATE stories SET episode_id = ?, edition = ?, published_at = datetime('now') WHERE id = ?"
        ).bind(episodeId, edition, id).run();
      }

      this.setState({
        ...this.state,
        status: "idle",
        lastEpisode: episodeId,
        [edition === "morning" ? "morningEpisodeId" : "eveningEpisodeId"]: episodeId,
      });

      console.log(`[Newsroom] ${episodeId} published. Duration: ${totalDuration}s`);
    } catch (error) {
      console.error(`[Newsroom] Production failed:`, error);
      this.setState({ ...this.state, status: "error", lastError: String(error) });
    }
  }
}

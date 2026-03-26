import { Agent } from "agents";
import type { Env, RawStory } from "../types";
import { ingestFromPerigon } from "../ingestion/perigon";

interface NewsroomState {
  status: "idle" | "ingesting" | "triaging" | "ready";
  lastIngestion: string | null;
  ingestionProgress: {
    perigon: "pending" | "done" | "failed";
    congress: "pending" | "done" | "failed";
    openstates: "pending" | "done" | "failed";
    fred: "pending" | "done" | "failed";
    perplexity: "pending" | "done" | "failed";
  };
  storiesIngestedToday: number;
  topStorySummary: string;
  morningEpisodeId: string | null;
  eveningEpisodeId: string | null;
}

export class NewsroomAgent extends Agent<Env, NewsroomState> {
  initialState: NewsroomState = {
    status: "idle",
    lastIngestion: null,
    ingestionProgress: {
      perigon: "pending",
      congress: "pending",
      openstates: "pending",
      fred: "pending",
      perplexity: "pending",
    },
    storiesIngestedToday: 0,
    topStorySummary: "",
    morningEpisodeId: null,
    eveningEpisodeId: null,
  };

  async onStart() {
    console.log("[Newsroom] Agent started, scheduling daily cycles");

    // Morning ingestion at 3:00 AM CT (8:00 UTC)
    await this.schedule("0 8 * * *", "runMorningIngestion", {});
    // Morning episode production at 5:00 AM CT (10:00 UTC)
    await this.schedule("0 10 * * *", "produceMorningEpisode", {});
    // Afternoon ingestion at 1:00 PM CT (18:00 UTC)
    await this.schedule("0 18 * * *", "runAfternoonIngestion", {});
    // Evening episode production at 5:00 PM CT (22:00 UTC)
    await this.schedule("0 22 * * *", "produceEveningEpisode", {});
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return Response.json(this.state);
    }

    if (url.pathname === "/trigger/ingest" && request.method === "POST") {
      await this.runMorningIngestion();
      return Response.json({ status: "ingestion complete", state: this.state });
    }

    if (url.pathname === "/trigger/produce" && request.method === "POST") {
      const edition = url.searchParams.get("edition") ?? "morning";
      if (edition === "morning") {
        await this.produceMorningEpisode();
      } else {
        await this.produceEveningEpisode();
      }
      return Response.json({ status: `${edition} production started`, state: this.state });
    }

    return Response.json({ agent: "NewsroomAgent", state: this.state });
  }

  async onConnect(connection: unknown) {
    // New WebSocket client gets current state automatically via SDK
    console.log("[Newsroom] Client connected");
  }

  onStateChanged(state: NewsroomState, source: string | unknown) {
    console.log(`[Newsroom] State updated: ${state.status}`);
  }

  // ─── Ingestion ────────────────────────────────────────────

  async runMorningIngestion() {
    console.log("[Newsroom] Starting morning ingestion...");
    this.setState({
      ...this.state,
      status: "ingesting",
      ingestionProgress: {
        perigon: "pending",
        congress: "pending",
        openstates: "pending",
        fred: "pending",
        perplexity: "pending",
      },
    });

    const allStories: RawStory[] = [];

    // Perigon
    try {
      const perigonStories = await ingestFromPerigon(this.env);
      allStories.push(...perigonStories);
      this.setState({
        ...this.state,
        ingestionProgress: { ...this.state.ingestionProgress, perigon: "done" },
      });
    } catch (error) {
      console.error("[Newsroom] Perigon ingestion failed:", error);
      this.setState({
        ...this.state,
        ingestionProgress: { ...this.state.ingestionProgress, perigon: "failed" },
      });
    }

    // TODO: Congress.gov (Day 2)
    this.setState({
      ...this.state,
      ingestionProgress: { ...this.state.ingestionProgress, congress: "done" },
    });

    // TODO: OpenStates (Day 2)
    this.setState({
      ...this.state,
      ingestionProgress: { ...this.state.ingestionProgress, openstates: "done" },
    });

    // TODO: FRED (Day 2)
    this.setState({
      ...this.state,
      ingestionProgress: { ...this.state.ingestionProgress, fred: "done" },
    });

    // TODO: Perplexity (Day 2)
    this.setState({
      ...this.state,
      ingestionProgress: { ...this.state.ingestionProgress, perplexity: "done" },
    });

    this.setState({
      ...this.state,
      status: "idle",
      lastIngestion: new Date().toISOString(),
      storiesIngestedToday: this.state.storiesIngestedToday + allStories.length,
      topStorySummary: allStories.length > 0 ? allStories[0].headline : "",
    });

    console.log(`[Newsroom] Morning ingestion complete: ${allStories.length} stories`);
  }

  async runAfternoonIngestion() {
    console.log("[Newsroom] Starting afternoon ingestion...");
    // Same pattern as morning, different time window
    await this.runMorningIngestion();
  }

  // ─── Episode Production ───────────────────────────────────

  async produceMorningEpisode() {
    const today = new Date().toISOString().split("T")[0];
    const episodeId = `morning-${today}`;

    console.log(`[Newsroom] Spawning EpisodeAgent: ${episodeId}`);

    const agentId = this.env.EPISODE_AGENT.idFromName(episodeId);
    const episodeAgent = this.env.EPISODE_AGENT.get(agentId);

    // TODO: Get triaged stories from agent SQL and send to EpisodeAgent
    const stories: unknown[] = [];

    await episodeAgent.fetch(new Request("https://internal/produce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId, edition: "morning", stories }),
    }));

    this.setState({
      ...this.state,
      morningEpisodeId: episodeId,
    });
  }

  async produceEveningEpisode() {
    const today = new Date().toISOString().split("T")[0];
    const episodeId = `evening-${today}`;

    console.log(`[Newsroom] Spawning EpisodeAgent: ${episodeId}`);

    const agentId = this.env.EPISODE_AGENT.idFromName(episodeId);
    const episodeAgent = this.env.EPISODE_AGENT.get(agentId);

    const stories: unknown[] = [];

    await episodeAgent.fetch(new Request("https://internal/produce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId, edition: "evening", stories }),
    }));

    this.setState({
      ...this.state,
      eveningEpisodeId: episodeId,
    });
  }
}

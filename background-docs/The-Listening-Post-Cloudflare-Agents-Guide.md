# The Listening Post — Cloudflare Agents Guide

## Why Cloudflare Agents matters for this hackathon

The hackathon explicitly says: "We're most excited to see creative use of Cloudflare Workers, Durable Objects, and a combination of ElevenLabs APIs." Cloudflare Agents is the official SDK for building AI agents on top of Durable Objects. Using it instead of raw Durable Objects shows the judges you're using their latest platform capability — not just wrapping a class around `DurableObjectState`.

The Agents SDK gives us features we were building by hand: built-in state persistence, scheduled tasks (replacing cron triggers), WebSocket connections for real-time updates, SQL storage built into every agent, and React hooks for the frontend. Our Episode production pipeline becomes cleaner, more resilient, and more impressive.

---

## What is the Agents SDK?

The Agents SDK (`npm i agents`) provides an `Agent` class that extends Durable Objects with:

- `this.state` / `this.setState()` — built-in state management that persists across restarts and syncs to connected clients
- `this.schedule()` — schedule tasks to run in the future (seconds, specific dates, or cron expressions)
- `this.sql` — built-in SQLite database per agent instance
- WebSocket support — `onConnect`, `onMessage`, `onClose` handlers
- React hooks — `useAgent` and `useAgentChat` for the frontend

Every Agent instance is globally unique: given the same name, you always get the same instance. This is perfect for our episode production — `morning-2026-03-26` always routes to the same agent instance, even across Worker restarts.

---

## Installing and configuring

### Install the package

```bash
npm i agents
```

### Configure wrangler.toml

The critical difference from raw Durable Objects: Agents use `new_sqlite_classes` instead of `new_classes` in the migration.

```toml
# ─── Durable Objects (Agents) ──────────────────────────────
[durable_objects]
bindings = [
  { name = "EPISODE_AGENT", class_name = "EpisodeAgent" },
  { name = "NEWSROOM_AGENT", class_name = "NewsroomAgent" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["EpisodeAgent", "NewsroomAgent"]
```

Note: `new_sqlite_classes` gives each agent instance its own SQLite database, which is what enables `this.sql`.

---

## Architecture: two agents for The Listening Post

### Agent 1: NewsroomAgent — the editorial desk

One global instance that orchestrates the entire newsroom. It runs on a schedule, ingests data, triages stories, and spawns episode production.

```typescript
import { Agent } from "agents";
import { Env } from "./types";

interface NewsroomState {
  lastIngestion: string | null;
  storiesIngested: number;
  todaysMorningEpisodeId: string | null;
  todaysEveningEpisodeId: string | null;
  activeTopics: string[];
}

export class NewsroomAgent extends Agent<Env, NewsroomState> {
  initialState: NewsroomState = {
    lastIngestion: null,
    storiesIngested: 0,
    todaysMorningEpisodeId: null,
    todaysEveningEpisodeId: null,
    activeTopics: [],
  };

  // Called when agent starts or wakes from hibernation
  async onStart() {
    console.log("[Newsroom] Agent started, scheduling daily cycles");

    // Schedule the daily production cycle using cron
    // Morning ingestion at 3:00 AM CT (8:00 UTC)
    await this.schedule("0 8 * * *", "runMorningIngestion", {});
    // Morning episode production at 5:00 AM CT (10:00 UTC)
    await this.schedule("0 10 * * *", "produceMorningEpisode", {});
    // Afternoon ingestion at 1:00 PM CT (18:00 UTC)
    await this.schedule("0 18 * * *", "runAfternoonIngestion", {});
    // Evening episode production at 5:00 PM CT (22:00 UTC)
    await this.schedule("0 22 * * *", "produceEveningEpisode", {});
  }

  // Scheduled task: morning data ingestion
  async runMorningIngestion() {
    console.log("[Newsroom] Starting morning ingestion...");

    // Ingest from all sources
    const perigonStories = await this.ingestFromPerigon();
    const congressStories = await this.ingestFromCongress();
    const openstatesStories = await this.ingestFromOpenStates();
    const fredStories = await this.ingestFromFRED();
    const rssStories = await this.ingestFromRSS();

    const allStories = [
      ...perigonStories,
      ...congressStories,
      ...openstatesStories,
      ...fredStories,
      ...rssStories,
    ];

    // Get editorial synthesis from Perplexity
    const editorialBrief = await this.getPerplexitySynthesis(allStories);

    // Store in the agent's built-in SQL database
    for (const story of allStories) {
      this.sql.exec(
        `INSERT OR IGNORE INTO stories (id, headline, summary, topic, source, relevance, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        story.id, story.headline, story.summary, story.topic, story.source, story.relevance
      );
    }

    // Update state (auto-syncs to any connected frontend clients)
    this.setState({
      ...this.state,
      lastIngestion: new Date().toISOString(),
      storiesIngested: this.state.storiesIngested + allStories.length,
    });

    console.log(`[Newsroom] Ingested ${allStories.length} stories`);
  }

  // Scheduled task: produce morning episode
  async produceMorningEpisode() {
    const today = new Date().toISOString().split("T")[0];
    const episodeId = `morning-${today}`;

    // Get the EpisodeAgent for this edition
    const episodeAgentId = this.env.EPISODE_AGENT.idFromName(episodeId);
    const episodeAgent = this.env.EPISODE_AGENT.get(episodeAgentId);

    // Get today's triaged stories from our SQL database
    const stories = this.sql.exec(
      `SELECT * FROM stories
       WHERE date(ingested_at) = ? AND relevance > 0.3
       ORDER BY relevance DESC LIMIT 8`,
      today
    ).toArray();

    // Tell the EpisodeAgent to start production
    await episodeAgent.fetch(new Request("https://internal/produce", {
      method: "POST",
      body: JSON.stringify({ episodeId, edition: "morning", stories }),
    }));

    this.setState({
      ...this.state,
      todaysMorningEpisodeId: episodeId,
    });
  }

  // Scheduled task: produce evening episode
  async produceEveningEpisode() {
    // Same pattern as morning, different editorial prompts
    const today = new Date().toISOString().split("T")[0];
    const episodeId = `evening-${today}`;
    // ... similar to produceMorningEpisode
  }

  // HTTP handler — serves API endpoints
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return Response.json(this.state);
    }

    if (url.pathname === "/trigger/ingest" && request.method === "POST") {
      await this.runMorningIngestion();
      return Response.json({ status: "ingestion complete" });
    }

    return new Response("Newsroom Agent", { status: 200 });
  }

  // WebSocket — real-time dashboard updates
  async onConnect(connection, ctx) {
    // Send current state to newly connected client
    connection.send(JSON.stringify({ type: "state", data: this.state }));
  }

  // State changes auto-sync to all connected WebSocket clients
  onStateUpdate(state, source) {
    console.log(`[Newsroom] State updated by ${source === "server" ? "server" : "client"}`);
  }

  // Private methods for each data source
  private async ingestFromPerigon() { /* ... */ return []; }
  private async ingestFromCongress() { /* ... */ return []; }
  private async ingestFromOpenStates() { /* ... */ return []; }
  private async ingestFromFRED() { /* ... */ return []; }
  private async ingestFromRSS() { /* ... */ return []; }
  private async getPerplexitySynthesis(stories: any[]) { /* ... */ return {}; }
}
```

### Agent 2: EpisodeAgent — the show producer

One instance per episode. Manages the six-state production pipeline: ingesting, triaging, scripting, voicing, assembling, published.

```typescript
import { Agent } from "agents";
import { Env } from "./types";

interface EpisodeState {
  episodeId: string;
  edition: "morning" | "evening";
  status: "idle" | "ingesting" | "triaging" | "scripting" | "voicing" | "assembling" | "published" | "failed";
  stories: any[];
  segments: any[];
  audioChunks: { segmentId: string; r2Key: string }[];
  finalAudioR2Key: string | null;
  transcript: string | null;
  retryCount: number;
  lastError: string | null;
  progress: number; // 0-100
}

export class EpisodeAgent extends Agent<Env, EpisodeState> {
  initialState: EpisodeState = {
    episodeId: "",
    edition: "morning",
    status: "idle",
    stories: [],
    segments: [],
    audioChunks: [],
    finalAudioR2Key: null,
    transcript: null,
    retryCount: 0,
    lastError: null,
    progress: 0,
  };

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/produce" && request.method === "POST") {
      const { episodeId, edition, stories } = await request.json() as any;

      this.setState({
        ...this.state,
        episodeId,
        edition,
        status: "ingesting",
        stories,
        progress: 0,
      });

      // Run the full pipeline
      // Using schedule(0, ...) to run immediately but non-blocking
      await this.schedule(0, "runPipeline", { episodeId, edition });

      return Response.json({ status: "production started", episodeId });
    }

    if (url.pathname === "/status") {
      return Response.json(this.state);
    }

    return new Response("Episode Agent", { status: 200 });
  }

  // The full production pipeline
  async runPipeline(payload: { episodeId: string; edition: string }) {
    try {
      // Stage 1: Triage
      await this.transitionTo("triaging", 10);
      await this.triageStories();

      // Stage 2: Script generation
      await this.transitionTo("scripting", 30);
      await this.generateScripts();

      // Stage 3: Voice production via ElevenLabs
      await this.transitionTo("voicing", 50);
      await this.voiceSegments();

      // Stage 4: Audio assembly
      await this.transitionTo("assembling", 80);
      await this.assembleAudio();

      // Stage 5: Publish
      await this.transitionTo("published", 100);
      await this.publishEpisode();

      console.log(`[Episode ${this.state.episodeId}] Published successfully`);

    } catch (error) {
      this.setState({
        ...this.state,
        status: "failed",
        lastError: String(error),
      });

      // Schedule a retry in 60 seconds if under retry limit
      if (this.state.retryCount < 3) {
        this.setState({ ...this.state, retryCount: this.state.retryCount + 1 });
        await this.schedule(60, "retryFromLastState", {});
      }
    }
  }

  // Retry from the last successful state
  async retryFromLastState() {
    const status = this.state.status;
    console.log(`[Episode] Retrying from state: ${status}`);

    if (status === "voicing" || status === "failed") {
      // Resume voicing for any unvoiced segments
      try {
        await this.voiceSegments();
        await this.transitionTo("assembling", 80);
        await this.assembleAudio();
        await this.transitionTo("published", 100);
        await this.publishEpisode();
      } catch (error) {
        this.setState({ ...this.state, lastError: String(error) });
      }
    }
  }

  // WebSocket — stream progress to connected dashboards
  async onConnect(connection, ctx) {
    connection.send(JSON.stringify({
      type: "episode_status",
      data: {
        episodeId: this.state.episodeId,
        status: this.state.status,
        progress: this.state.progress,
      }
    }));
  }

  // State updates auto-push to all connected WebSocket clients
  onStateUpdate(state, source) {
    // Any connected dashboard sees real-time progress
    // No manual WebSocket broadcast needed — the SDK handles it
  }

  // Helper: transition to a new production stage
  private async transitionTo(status: EpisodeState["status"], progress: number) {
    this.setState({ ...this.state, status, progress });
    console.log(`[Episode ${this.state.episodeId}] → ${status} (${progress}%)`);
  }

  // Production stage implementations
  private async triageStories() {
    // Use Workers AI to rank stories for the show
    const ranked = await this.env.AI.run("@cf/meta/llama-3.1-70b-instruct", {
      messages: [
        { role: "system", content: "You are an editorial desk..." },
        { role: "user", content: `Triage these stories:\n${JSON.stringify(this.state.stories)}` }
      ]
    });
    // Process and store triage results
  }

  private async generateScripts() {
    // Generate per-segment scripts via Workers AI
    // Store in this.state.segments
  }

  private async voiceSegments() {
    // Call ElevenLabs TTS per segment
    // Store audio chunks in R2
    // Update this.state.audioChunks
    for (const segment of this.state.segments) {
      const audio = await this.callElevenLabs(segment.script, segment.voice);
      const r2Key = `audio/${this.state.episodeId}/${segment.id}.mp3`;
      await this.env.MEDIA_BUCKET.put(r2Key, audio);
      this.setState({
        ...this.state,
        audioChunks: [...this.state.audioChunks, { segmentId: segment.id, r2Key }],
        progress: 50 + (this.state.audioChunks.length / this.state.segments.length) * 30,
      });
    }
  }

  private async assembleAudio() {
    // Concatenate audio chunks from R2 into final episode
    // Store final MP3 in R2
  }

  private async publishEpisode() {
    // Update D1 with episode metadata
    // Refresh RSS feed
    // Store embeddings in Vectorize
  }

  private async callElevenLabs(script: string, voice: string): Promise<ArrayBuffer> {
    // ElevenLabs TTS API call
    return new ArrayBuffer(0);
  }
}
```

---

## Key Agents SDK features we use

### 1. Built-in scheduling (replaces cron triggers)

Instead of configuring cron triggers in `wrangler.toml`, the NewsroomAgent schedules its own tasks:

```typescript
// In onStart() — runs when the agent first initializes
async onStart() {
  // Morning ingestion at 3 AM CT (8:00 UTC)
  await this.schedule("0 8 * * *", "runMorningIngestion", {});

  // Morning episode at 5 AM CT (10:00 UTC)
  await this.schedule("0 10 * * *", "produceMorningEpisode", {});

  // Afternoon ingestion at 1 PM CT (18:00 UTC)
  await this.schedule("0 18 * * *", "runAfternoonIngestion", {});

  // Evening episode at 5 PM CT (22:00 UTC)
  await this.schedule("0 22 * * *", "produceEveningEpisode", {});
}
```

Advantages over `wrangler.toml` cron triggers: schedules survive agent restarts, can be dynamically modified, support sub-minute precision with `scheduleEvery()`, and each scheduled task can carry a payload.

### 2. Built-in state (replaces manual storage.put/get)

State is automatically persisted and can sync to connected clients:

```typescript
// Set state — persists to SQLite, notifies all WebSocket clients
this.setState({
  ...this.state,
  status: "voicing",
  progress: 55,
});

// Read state — always available, even after restart
console.log(this.state.progress); // 55
```

The `onStateUpdate` callback fires whenever state changes, from any source (server method or client WebSocket message). This is how the frontend dashboard gets real-time production progress without polling.

### 3. Built-in SQL (replaces D1 for agent-local data)

Every agent instance has its own SQLite database:

```typescript
// Create tables
this.sql.exec(`
  CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    headline TEXT,
    summary TEXT,
    topic TEXT,
    source TEXT,
    relevance REAL,
    ingested_at TEXT
  )
`);

// Insert data
this.sql.exec(
  "INSERT INTO stories (id, headline, topic) VALUES (?, ?, ?)",
  "story-123", "Milwaukee zoning reform advances", "housing"
);

// Query data
const topStories = this.sql.exec(
  "SELECT * FROM stories WHERE relevance > 0.5 ORDER BY relevance DESC LIMIT 10"
).toArray();
```

This is separate from D1 — use it for agent-local working data (current ingestion cycle stories, production pipeline state). D1 remains for the published content that the frontend queries.

### 4. React hooks for the frontend

The Agents SDK includes React hooks for connecting to agents from the Next.js frontend:

```typescript
import { useAgent } from "agents/react";

function ProductionDashboard() {
  // Connect to the NewsroomAgent
  const newsroom = useAgent({
    agent: "NewsroomAgent",
    name: "main-newsroom", // always the same instance
  });

  // State auto-syncs — no polling needed
  return (
    <div>
      <p>Last ingestion: {newsroom.state?.lastIngestion}</p>
      <p>Stories ingested today: {newsroom.state?.storiesIngested}</p>
      <p>Morning episode: {newsroom.state?.todaysMorningEpisodeId}</p>
    </div>
  );
}
```

```typescript
import { useAgent } from "agents/react";

function EpisodeProgress({ episodeId }: { episodeId: string }) {
  // Connect to a specific EpisodeAgent instance
  const episode = useAgent({
    agent: "EpisodeAgent",
    name: episodeId, // e.g., "morning-2026-03-26"
  });

  return (
    <div>
      <p>Status: {episode.state?.status}</p>
      <progress value={episode.state?.progress} max={100} />
      {episode.state?.lastError && (
        <p>Error: {episode.state.lastError}</p>
      )}
    </div>
  );
}
```

### 5. WebSocket connections for real-time updates

Agents natively support WebSocket connections. When the homepage audio player is streaming an episode being produced, the frontend can show real-time progress:

```typescript
// Agent-side: progress automatically broadcasts via onStateUpdate
async onStateUpdate(state, source) {
  // The SDK automatically sends state updates to all connected
  // WebSocket clients — no manual broadcast needed
}

// Client-side: useAgent hook auto-receives state updates
const episode = useAgent({ agent: "EpisodeAgent", name: "morning-2026-03-26" });
// episode.state updates in real-time as the agent progresses
```

---

## How Agents replaces our original architecture

| Original (raw Durable Objects) | With Agents SDK |
|-------------------------------|-----------------|
| Manual `state.storage.put/get` | `this.state` / `this.setState()` |
| Cron triggers in `wrangler.toml` | `this.schedule("0 8 * * *", ...)` |
| Manual WebSocket handling | `onConnect` / `onMessage` + auto state sync |
| Separate D1 for working data | `this.sql` (built-in SQLite per agent) |
| Manual retry logic | `this.schedule(60, "retry", {})` + state persistence |
| Polling API for production status | React `useAgent` hook with real-time state sync |
| `new_classes` migration | `new_sqlite_classes` migration |

---

## Wrangler configuration for Agents

```toml
name = "listening-post"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# ─── Durable Objects (Agents) ──────────────────────────────
[durable_objects]
bindings = [
  { name = "EPISODE_AGENT", class_name = "EpisodeAgent" },
  { name = "NEWSROOM_AGENT", class_name = "NewsroomAgent" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["EpisodeAgent", "NewsroomAgent"]

# ─── D1 (published content for frontend) ───────────────────
[[d1_databases]]
binding = "DB"
database_name = "listening-post-db"
database_id = ""

# ─── R2 (audio + images) ──────────────────────────────────
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "listening-post-media"

# ─── KV (config + FRED cache) ─────────────────────────────
[[kv_namespaces]]
binding = "CONFIG_KV"
id = ""

# ─── Vectorize (editorial memory) ─────────────────────────
[[vectorize]]
binding = "STORY_INDEX"
index_name = "story-embeddings"

# ─── Workers AI ───────────────────────────────────────────
[ai]
binding = "AI"
```

---

## Worker entry point with Agents routing

```typescript
import { Agent, AgentNamespace, routeAgentRequest } from "agents";
import { EpisodeAgent } from "./agents/episode";
import { NewsroomAgent } from "./agents/newsroom";

export { EpisodeAgent, NewsroomAgent };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route agent requests (WebSocket upgrades, agent HTTP)
    // The SDK handles routing to the correct agent instance
    if (url.pathname.startsWith("/agents/")) {
      return (await routeAgentRequest(request, env)) || new Response("Not found", { status: 404 });
    }

    // Initialize the NewsroomAgent on first request
    if (url.pathname === "/api/init") {
      const id = env.NEWSROOM_AGENT.idFromName("main-newsroom");
      const agent = env.NEWSROOM_AGENT.get(id);
      return agent.fetch(request);
    }

    // API routes for the frontend
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env);
    }

    // Audio and image serving from R2
    if (url.pathname.startsWith("/audio/") || url.pathname.startsWith("/images/")) {
      return handleMediaRequest(request, env);
    }

    return new Response("The Listening Post", { status: 200 });
  }
};
```

---

## What this means for the hackathon judges

Using the Agents SDK demonstrates:

1. You're building on Cloudflare's latest agent platform, not just using Workers as serverless functions
2. The episode production pipeline is a proper stateful agent with durable execution, not a fire-and-forget Worker
3. Real-time state sync between the agent and the frontend dashboard (production progress, ingestion status) uses the SDK's built-in WebSocket infrastructure
4. Scheduled tasks use the agent's native scheduling instead of wrangler cron triggers, showing you understand the platform's capabilities
5. Built-in SQL for working data alongside D1 for published content shows thoughtful data architecture
6. The NewsroomAgent is genuinely autonomous — it runs on its own schedule, ingests data, triages, produces episodes, and publishes, all without human intervention

This is exactly what "Build agents on Cloudflare with durable execution, serverless inference, and pricing that scales" means in practice.

---

## Quick reference: key imports

```typescript
// Server-side
import { Agent, AgentNamespace, routeAgentRequest } from "agents";

// Client-side (React)
import { useAgent, useAgentChat } from "agents/react";
```

## Quick reference: Agent lifecycle

```
onStart()       → Agent instance created or wakes from hibernation
onRequest()     → HTTP request received
onConnect()     → WebSocket connection established
onMessage()     → WebSocket message received
onStateUpdate() → State changed from any source
onClose()       → WebSocket connection closed
onError()       → WebSocket error
schedule()      → Schedule future task
setState()      → Update + persist state + notify clients
this.sql        → Agent's built-in SQLite database
this.env        → Environment bindings (AI, R2, D1, KV, etc.)
```

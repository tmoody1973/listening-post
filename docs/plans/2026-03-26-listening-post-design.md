# The Listening Post — Implementation Design

An AI-powered local news platform for Milwaukee that ingests civic data, applies editorial intelligence, and produces twice-daily podcast episodes with broadcast-quality multi-voice production. Entirely edge-deployed on Cloudflare.

**Hackathon:** Cloudflare x ElevenLabs
**Timeline:** 7 days, full-time
**Date:** March 26, 2026

---

## Scope

### What we build

- **5 data sources:** Perigon (structured news), Congress.gov (bills, votes, floor actions, Congressional Record, presidential actions), OpenStates (Wisconsin state legislation), FRED (16 Milwaukee/WI economic indicators), Perplexity (editorial synthesis)
- **2 agents:** NewsroomAgent (editorial desk) + EpisodeAgent (show producer) using Cloudflare Agents SDK
- **3 voices:** Anchor, correspondent, district desk via ElevenLabs v3 Text to Dialogue API
- **3 acts per episode** with natural multi-speaker dialogue and audio tags
- **4 frontend pages:** Homepage, article detail, topic page, podcast archive
- **8 Cloudflare services:** Workers, Agents/Durable Objects, D1, R2, KV, Vectorize, Workers AI, Pages (via OpenNext on Workers)
- **Morning + evening editions**, fully autonomous

### What we skip

- District dashboard / zip code lookup (complex, low demo value)
- RSS ingestion (Perigon covers this better)
- User authentication
- Custom domain (nice-to-have if time allows)

---

## Project structure

```
listening-post/
├── src/
│   ├── index.ts                    # Worker entry point + Hono router
│   ├── agents/
│   │   ├── newsroom.ts             # NewsroomAgent — editorial desk
│   │   └── episode.ts              # EpisodeAgent — show producer
│   ├── ingestion/
│   │   ├── perigon.ts              # Perigon article + story search
│   │   ├── congress.ts             # Congress.gov (bills, votes, floor, record, presidential)
│   │   ├── openstates.ts           # OpenStates GraphQL (Wisconsin)
│   │   ├── fred.ts                 # FRED economic indicators
│   │   └── perplexity.ts           # Perplexity editorial synthesis
│   ├── production/
│   │   ├── triage.ts               # Workers AI relevance scoring
│   │   ├── scriptwriter.ts         # Dialogue script generation per act
│   │   ├── voices.ts               # ElevenLabs Text to Dialogue
│   │   └── assembler.ts            # Audio concatenation + R2 upload
│   ├── api/
│   │   ├── stories.ts              # GET /api/stories
│   │   ├── episodes.ts             # GET /api/episodes
│   │   ├── article.ts              # GET /api/article/[slug]
│   │   ├── topic.ts                # GET /api/topic/[topic]
│   │   ├── data.ts                 # GET /api/data/[topic] (FRED charts)
│   │   └── feed.ts                 # GET /feed.xml (podcast RSS)
│   ├── vectorize/
│   │   └── embeddings.ts           # Embed stories + similarity search
│   └── types.ts                    # Env bindings, shared interfaces
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Homepage
│   │   ├── story/[slug]/page.tsx   # Article detail
│   │   ├── topic/[topic]/page.tsx  # Topic page with charts
│   │   ├── podcast/page.tsx        # Podcast archive
│   │   └── layout.tsx              # Shell, nav, dark mode
│   └── components/
│       ├── EditionPlayer.tsx       # Audio player + live production view
│       ├── StoryCard.tsx
│       ├── ChartCard.tsx
│       ├── BillTracker.tsx
│       ├── StatCard.tsx
│       ├── SourceAttribution.tsx
│       └── ProductionDashboard.tsx # Real-time agent status via useAgent
├── scripts/
│   └── schema.sql                  # D1 schema (7 tables)
├── open-next.config.ts             # OpenNext Cloudflare config
├── wrangler.toml
├── package.json
└── .dev.vars                       # Local API keys (gitignored)
```

---

## Cloudflare configuration

```toml
name = "listening-post"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# Durable Objects (Agents)
[durable_objects]
bindings = [
  { name = "EPISODE_AGENT", class_name = "EpisodeAgent" },
  { name = "NEWSROOM_AGENT", class_name = "NewsroomAgent" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["EpisodeAgent", "NewsroomAgent"]

# D1 (published content)
[[d1_databases]]
binding = "DB"
database_name = "listening-post-db"
database_id = ""

# R2 (audio + images)
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "listening-post-media"

# KV (config + FRED cache)
[[kv_namespaces]]
binding = "CONFIG_KV"
id = ""

# Vectorize (editorial memory)
[[vectorize]]
binding = "STORY_INDEX"
index_name = "story-embeddings"

# Workers AI
[ai]
binding = "AI"
```

---

## D1 schema

7 tables covering published content, legislative data, and economic indicators.

```sql
-- Stories (articles from all sources)
CREATE TABLE stories (
    id TEXT PRIMARY KEY,
    headline TEXT NOT NULL,
    summary TEXT,
    body TEXT,
    slug TEXT UNIQUE NOT NULL,
    topic TEXT NOT NULL,
    source TEXT NOT NULL,
    source_url TEXT,
    image_url TEXT,
    image_caption TEXT,
    image_attribution TEXT,
    sentiment_positive REAL,
    sentiment_negative REAL,
    relevance_score REAL,
    perigon_cluster_id TEXT,
    edition TEXT,
    episode_id TEXT,
    audio_segment_key TEXT,
    sources_json TEXT,
    bill_data_json TEXT,
    fred_series_id TEXT,
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_stories_topic ON stories(topic);
CREATE INDEX idx_stories_edition ON stories(edition, published_at DESC);
CREATE INDEX idx_stories_slug ON stories(slug);

-- Episodes (podcast editions)
CREATE TABLE episodes (
    id TEXT PRIMARY KEY,
    edition TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    audio_r2_key TEXT,
    transcript TEXT,
    duration_seconds INTEGER,
    segment_count INTEGER,
    segments_json TEXT,
    story_ids_json TEXT,
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_episodes_date ON episodes(date DESC, edition);

-- Legislators (federal + state)
CREATE TABLE legislators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    party TEXT,
    chamber TEXT,
    state TEXT DEFAULT 'WI',
    district TEXT,
    image_url TEXT,
    source TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Bills (federal + state)
CREATE TABLE bills (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT,
    sponsor_id TEXT,
    sponsor_name TEXT,
    topic TEXT,
    source TEXT,
    source_url TEXT,
    actions_json TEXT,
    last_action TEXT,
    last_action_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_bills_topic ON bills(topic);
CREATE INDEX idx_bills_status ON bills(status);

-- Floor actions (daily House + Senate activity)
CREATE TABLE floor_actions (
    id TEXT PRIMARY KEY,
    chamber TEXT NOT NULL,
    date TEXT NOT NULL,
    action_type TEXT,
    description TEXT NOT NULL,
    bill_id TEXT,
    bill_identifier TEXT,
    source_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_floor_chamber_date ON floor_actions(chamber, date DESC);
CREATE INDEX idx_floor_bill ON floor_actions(bill_id);

-- Presidential actions (presented, signed, vetoed)
CREATE TABLE presidential_actions (
    id TEXT PRIMARY KEY,
    bill_identifier TEXT NOT NULL,
    title TEXT NOT NULL,
    date_presented TEXT,
    date_signed TEXT,
    date_vetoed TEXT,
    status TEXT,
    congress INTEGER,
    source_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_presidential_status ON presidential_actions(status, date_presented DESC);

-- Congressional Record (daily proceedings)
CREATE TABLE congressional_record (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    volume INTEGER,
    issue_number TEXT,
    section TEXT,
    title TEXT,
    description TEXT,
    url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_record_date ON congressional_record(date DESC, section);

-- FRED data (also cached in KV, D1 for chart history)
CREATE TABLE fred_observations (
    series_id TEXT NOT NULL,
    date TEXT NOT NULL,
    value REAL,
    PRIMARY KEY (series_id, date)
);

CREATE INDEX idx_fred_series ON fred_observations(series_id, date DESC);
```

---

## Agent state machines

### NewsroomAgent — the editorial desk

One global instance (`main-newsroom`). Gathers data from all sources, triages with Workers AI, hands ranked stories to the EpisodeAgent.

**States:** `idle` → `ingesting` → `triaging` → `ready`

```
IDLE
  ├── [cron 3AM CT]  → INGESTING (morning)
  └── [cron 1PM CT]  → INGESTING (afternoon)

INGESTING
  ├── Pull Perigon articles + stories
  ├── Pull Congress.gov (bills, votes, floor, record, presidential)
  ├── Pull OpenStates (WI bills, legislators)
  ├── Pull FRED (16 series, check for new data)
  ├── Get Perplexity editorial synthesis
  └── All sources done → TRIAGING

TRIAGING
  ├── Workers AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast) scores relevance 0-1
  ├── Topic classification (housing, economy, education, transit, safety, health, environment)
  ├── Vectorize: embed stories, find connections to past coverage
  ├── Rank and select stories for the edition
  └── Stories ranked → READY

READY
  ├── [cron 5AM CT]  → Spawn EpisodeAgent("morning-YYYY-MM-DD")
  ├── [cron 5PM CT]  → Spawn EpisodeAgent("evening-YYYY-MM-DD")
  └── After spawn → IDLE
```

**State shape:**

```typescript
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
```

**Key SDK details:**
- Scheduling uses `this.schedule("0 8 * * *", "runMorningIngestion", {})`
- Agent-local SQL uses tagged templates: `` this.sql`SELECT * FROM stories WHERE relevance > ${0.3}` ``
- State changes via `this.setState({...})` auto-sync to connected WebSocket clients
- Server-side state hook is `onStateChanged(state, source)` (not `onStateUpdate`)

### EpisodeAgent — the show producer

One instance per episode (`morning-2026-03-26`). Manages the production pipeline using ElevenLabs v3 Text to Dialogue.

**States:** `idle` → `scripting` → `voicing` → `assembling` → `published` (or `failed` with retry)

```
IDLE
  └── Receives stories from NewsroomAgent → SCRIPTING

SCRIPTING (progress 0-30%)
  ├── Build show rundown (which stories go in which act)
  ├── Generate dialogue scripts per act via Workers AI
  ├── Audio tags embedded: [confidently], [curious], [jumping in]
  ├── FRED data, Congressional Record, bill data injected as context
  └── All 3 acts scripted → VOICING

VOICING (progress 30-80%)
  ├── For each act:
  │   ├── POST /v1/text-to-dialogue (ElevenLabs v3)
  │   ├── dialogue array with voice_id + text per turn
  │   ├── Store returned MP3 in R2
  │   ├── Update progress (act 1/3... act 2/3...)
  │   └── If fails → retry that act up to 3x
  └── All 3 acts voiced → ASSEMBLING

ASSEMBLING (progress 80-95%)
  ├── Concatenate 3 act MP3s in order
  ├── Upload final MP3 to R2
  ├── Generate transcript from dialogue scripts
  └── Done → PUBLISHED

PUBLISHED (progress 100%)
  ├── Write episode + stories to D1
  ├── Embed stories in Vectorize
  └── Terminal state
```

**State shape:**

```typescript
interface EpisodeState {
  episodeId: string;
  edition: "morning" | "evening";
  status: "idle" | "scripting" | "voicing" | "assembling" | "published" | "failed";
  stories: TriagedStory[];
  acts: {
    id: string;
    title: string;
    dialogue: {
      voice: "anchor" | "correspondent" | "district_desk";
      voiceId: string;
      text: string;
    }[];
    audioR2Key: string | null;
    durationSeconds: number | null;
    status: "pending" | "scripted" | "voiced" | "failed";
  }[];
  finalAudioR2Key: string | null;
  transcript: string | null;
  totalDuration: number;
  progress: number;
  retryCount: number;
  lastError: string | null;
}
```

---

## Show format

### Three acts per episode

| Act | Morning | Evening |
|-----|---------|---------|
| Act 1: The Briefing | Cold open + top stories (3-4 headlines). Anchor leads, correspondent adds color. | Today's lead + day in review (Congressional Record digest). Anchor leads. |
| Act 2: The Deep Dive | Deep dive (Perplexity research) + on the floor today + bills at president's desk. All 3 voices. | Analysis (why today matters) + by the numbers (FRED data). Correspondent leads, district desk covers votes. |
| Act 3: The Outlook | What to watch this week + sign-off. Correspondent sets up trends, anchor wraps. | The signal (long-term trend) + sign-off with tomorrow preview. |

### Voice personas

| Voice | Role | When they speak |
|-------|------|----------------|
| Anchor | Warm, authoritative | Headlines, framing, floor activity, sign-off |
| Correspondent | Detailed, explanatory | Deep dives, analysis, trends |
| District desk | Direct, data-driven | Floor actions, voting records, bill status |

### ElevenLabs configuration

- **Model:** `eleven_v3` via `/v1/text-to-dialogue`
- **Output format:** `mp3_44100_128`
- **Audio tags:** `[confidently]`, `[curious]`, `[analytical]`, `[jumping in]`, `[serious]`, `[thoughtful]`, `[direct]`, `[genuine]`, `[wrapping up]`
- **Interruptions:** Dashes for cut-ins ("So what you're saying is—"), ellipses for trailing ("And that means...")
- **Seed:** Deterministic per episode for reproducibility
- **Character budget:** ~2500-3500 chars per act, under 5000 char limit per call
- **Total calls per episode:** 3 (one per act)

---

## Congress.gov ingestion

Full use of the Congress.gov v3 API:

```
Morning (3 AM CT):
  GET /bill?sort=updateDate+desc&limit=20             → recent bills
  GET /member?stateCode=WI&currentMember=true          → WI delegation
  GET /house-roll-call-vote/{congress}/{session}       → recent House votes
  GET /house-communication?limit=20                     → House floor activity
  GET /senate-communication?limit=20                    → Senate floor activity
  GET /nomination?limit=20                              → nominations
  GET /treaty?limit=20                                  → treaty documents
  GET /congressional-record?limit=10                    → daily proceedings
  GET /bill (filter: latestAction "Presented to President") → presidential desk

For each top-ranked bill:
  GET /bill/{congress}/{type}/{number}/actions          → legislative history
  GET /bill/{congress}/{type}/{number}/cosponsors       → sponsor data
  GET /bill/{congress}/{type}/{number}/summaries        → CRS summaries
```

---

## Frontend

### Deployment

Next.js on Cloudflare Workers via `@opennextjs/cloudflare` (OpenNext). Deploy with `wrangler deploy`. NOT Cloudflare Pages — the old `@cloudflare/next-on-pages` approach is deprecated.

### Pages

**Homepage ( / ):** Edition player hero (audio player or live production progress), lead story with image, 2-column story grid (4 stories), evening preview teaser.

**Article detail ( /story/[slug] ):** Audio player, serif body, bill tracker sidebar (legislative stories), FRED chart (topic-matched), source attribution (always visible), previous coverage via Vectorize.

**Topic page ( /topic/[topic] ):** Stat cards with sparklines, active legislation tracker, primary FRED line chart with policy annotations, secondary charts (bar + dual-axis), coverage timeline grouped by day.

**Podcast archive ( /podcast ):** Episode list by week, embedded players, subscribe links.

### Real-time dashboard

The edition player on the homepage transforms into a live production view when an episode is actively producing. Uses `useAgent` from `agents/react` to connect to both NewsroomAgent and EpisodeAgent via WebSocket. Progress bars show ingestion sources lighting up, then scripting/voicing/assembling per act.

### Design system

- **Brand color:** Coral `#D85A30`
- **Typography:** Serif for headlines/body (Georgia), sans-serif for UI/labels (system font)
- **Topic colors:** Housing (blue), Economy (teal), Education (purple), Transit (amber), Safety (red), Health (pink), Environment (green)
- **Charts:** Chart.js 4.x, sparklines 24px tall, standard charts 200px, policy annotation rows below
- **Dark mode:** Full support via CSS variables and `prefers-color-scheme`
- **Responsive:** Desktop (>768px), tablet (480-768px), mobile (<480px)

---

## Demo video (~70 seconds)

**Hook (5s):** Walking through Milwaukee. "1,800 local newsrooms have closed since 2005. Not because the journalists were bad. Because the money left."

**The pivot (10s):** Hold up phone. "I built something to hold the seat until they come back."

**The audio hit (10s):** Play morning edition — three AI voices discussing real Wisconsin legislation. "That's not a journalist. It's infrastructure."

**The how (20s):** Screen recording of the production dashboard. "Every morning at 3 AM it wakes up, pulls from Congress, the state legislature, economic data, local news. It figures out what matters, writes a broadcast script, sends it to ElevenLabs, and by 6 AM there's a full episode."

**The website (10s):** Scrolling on phone. "Every story has sources linked. Real Fed economic data. Bill trackers. If an AI is covering the news, you should be able to check its work."

**The kicker (10s):** "Eight Cloudflare services. ElevenLabs. Six bucks. Swap the data sources and this runs for any city in America."

**Close (5s):** "Local news didn't die because nobody needed it. It died because nobody could pay for it."

---

## 7-day build plan

### Day 1: Foundation + first data
- Install tooling, `wrangler login`, scaffold project
- Provision Cloudflare resources (D1, R2, KV, Vectorize)
- Sign up for remaining APIs (Perigon, OpenStates, FRED)
- D1 schema migration, store all secrets
- Build Perigon ingestion → stories in D1
- **Done when:** `curl /api/stories` returns real Milwaukee articles

### Day 2: Full ingestion + editorial intelligence
- Congress.gov ingestion (bills, votes, floor, record, presidential)
- OpenStates GraphQL ingestion (WI bills, legislators)
- FRED ingestion (16 series → KV + D1)
- Perplexity editorial synthesis
- Workers AI triage + Vectorize embeddings
- **Done when:** All 5 sources flowing, `/api/topic/housing` returns stories + bills + FRED data

### Day 3: Agents + first podcast (make-or-break day)
- NewsroomAgent with scheduling and ingestion orchestration
- EpisodeAgent with dialogue script generation (3 acts)
- ElevenLabs Text to Dialogue integration (select 3 voices)
- Full loop: trigger → ingest → triage → script → voice → publish
- **Done when:** Hear a real podcast with 3 voices discussing Milwaukee news

### Day 4: Frontend core
- Next.js scaffold via `npm create cloudflare@latest -- --framework=next`
- Homepage: edition player, lead story, story grid
- Article detail: audio player, body, sources, bill tracker
- `useAgent` hooks for real-time production status
- **Done when:** Website shows real stories, audio plays, live production progress works

### Day 5: Data journalism + topic page
- Topic page: stat cards, sparklines, FRED charts, legislation tracker
- Policy annotation rows on charts
- Vectorize previous coverage on article pages
- Podcast archive page
- **Done when:** `/topic/housing` shows real charts, legislation, and coverage timeline

### Day 6: Polish + full autonomy
- Evening edition prompts
- Dark mode, responsive mobile
- Podcast RSS feed
- Error handling hardening
- Full autonomous cycle (no manual triggers)
- Deploy to production
- Plan demo video shot list
- **Done when:** Both editions produce autonomously on schedule, live site works

### Day 7: Demo video + ship
- Record demo video (~70 seconds)
- Film Milwaukee outdoor shots + phone screen
- Edit and submit
- **Done when:** Submitted

### Risk fallbacks

| Risk | Fallback |
|------|----------|
| Text to Dialogue issues | Separate TTS calls per speaker with Multilingual v2, stitch MP3s |
| Workers AI script quality | Use Perplexity sonar-pro for script generation |
| Vectorize local dev issues | Use `wrangler dev --remote` |
| Frontend takes too long | Skip podcast archive and dark mode |
| Autonomous cycle fails | Keep manual triggers, demo the trigger in the video |

---

## API keys needed

| Service | Status | Tier |
|---------|--------|------|
| Congress.gov | Have it | Free |
| Perplexity | Have it | Pro |
| ElevenLabs | Have it | Pro (823K credits remaining) |
| Unsplash | Have it | Free |
| Pexels | Have it | Free |
| Perigon | Need to sign up | Free |
| OpenStates | Need to sign up | Free |
| FRED | Need to sign up | Free |

---

## Key technical decisions

1. **ElevenLabs v3 Text to Dialogue** over separate TTS calls — natural multi-speaker transitions, audio tags, single API call per act
2. **Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`** over 3.1 — newer model, same pricing, better quality
3. **Next.js on Workers via OpenNext** — not Cloudflare Pages, not `next-on-pages`
4. **Agents SDK** over raw Durable Objects — built-in state, scheduling, SQL, WebSocket, React hooks
5. **Vectorize + Workers AI embeddings** — low effort, high judge impact, enables "editorial memory"
6. **Three acts** instead of six to eight segments — maps to Text to Dialogue call limits, cleaner dashboard visualization
7. **`Promise.allSettled()`** for ingestion — partial source failure doesn't crash the cycle

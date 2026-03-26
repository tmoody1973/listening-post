# the listening **post**

> An AI-powered local news platform that wakes up every morning, reads what Congress and the state legislature did, and produces a broadcast-quality podcast — entirely on Cloudflare's edge.

## Overview

The Listening Post is an automated newsroom for Milwaukee, Wisconsin. It ingests civic and news data from five sources, applies editorial intelligence, and produces twice-daily podcast episodes with multi-voice production using ElevenLabs. No journalists, no servers, no manual intervention.

Built for the **Cloudflare x ElevenLabs Hackathon** (March 2026).

**Demo video:** _Coming soon_

## How It Works

```
3:00 AM  →  NewsroomAgent wakes up
             Pulls from Congress.gov, OpenStates, Perigon, FRED, Perplexity
             Triages and ranks stories with Workers AI

5:00 AM  →  EpisodeAgent produces the morning edition
             Writes a 3-act dialogue script
             Sends to ElevenLabs v3 Text to Dialogue (3 voices)
             Publishes podcast + articles to the website

6:00 AM  →  Milwaukee wakes up to a new episode

5:00 PM  →  Evening edition drops with the day's outcomes
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Compute | Cloudflare Workers |
| Agents | Cloudflare Agents SDK (Durable Objects) |
| AI | Workers AI (Llama 3.3 70B) |
| Voice | ElevenLabs v3 Text to Dialogue |
| Database | Cloudflare D1 (SQLite at edge) |
| Storage | Cloudflare R2 (audio + images) |
| Cache | Cloudflare KV |
| Search | Cloudflare Vectorize (editorial memory) |
| Frontend | Next.js on Workers (OpenNext) |
| Styling | Tailwind CSS |
| Charts | Chart.js 4.x |

## Data Sources

| Source | What It Provides |
|--------|-----------------|
| [Congress.gov API](https://api.congress.gov/) | Bills, votes, floor actions, Congressional Record, presidential actions |
| [OpenStates GraphQL](https://openstates.org/) | Wisconsin state legislation and legislators |
| [Perigon API](https://www.perigon.io/) | Structured news articles with images, sentiment, entities |
| [Perplexity Sonar](https://docs.perplexity.ai/) | Editorial synthesis and deep research |
| [FRED API](https://fred.stlouisfed.org/) | 16 Milwaukee/WI economic indicators |

## Quick Start

### Prerequisites

- Node.js 20+
- Cloudflare account (free tier works)
- API keys for: Congress.gov, OpenStates, Perigon, Perplexity, ElevenLabs, FRED, Unsplash, Pexels

### Installation

```bash
git clone https://github.com/tmoody1973/listening-post.git
cd listening-post
npm install

# Install and authenticate Wrangler
npm install -g wrangler
wrangler login
```

### Provision Cloudflare Resources

```bash
wrangler d1 create listening-post-db
wrangler r2 bucket create listening-post-media
wrangler kv namespace create CONFIG_KV
wrangler vectorize create story-embeddings --dimensions=768 --metric=cosine
```

Update `wrangler.toml` with the IDs printed by each command.

### Store API Keys

```bash
# Store as Wrangler secrets (for production)
wrangler secret put CONGRESS_API_KEY
wrangler secret put OPENSTATES_API_KEY
wrangler secret put PERIGON_API_KEY
wrangler secret put PERPLEXITY_API_KEY
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put FRED_API_KEY
wrangler secret put UNSPLASH_ACCESS_KEY
wrangler secret put PEXELS_API_KEY

# For local dev, create .dev.vars with the same keys
cp .dev.vars.example .dev.vars
```

### Development

```bash
# Local dev (Workers AI and Vectorize need --remote)
wrangler dev --remote

# Test ingestion
curl -X POST http://localhost:8787/api/trigger/ingest

# Test episode production
curl -X POST http://localhost:8787/api/trigger/produce?edition=morning
```

### Deploy

```bash
# Run schema migration
wrangler d1 execute listening-post-db --file=./scripts/schema.sql

# Deploy
wrangler deploy
```

## Project Structure

```
listening-post/
├── src/
│   ├── index.ts              # Worker entry point + routing
│   ├── agents/
│   │   ├── newsroom.ts       # NewsroomAgent — editorial desk
│   │   └── episode.ts        # EpisodeAgent — show producer
│   ├── ingestion/            # Data source integrations
│   ├── production/           # Script generation + voice + assembly
│   ├── api/                  # Frontend API endpoints
│   ├── vectorize/            # Embeddings + similarity search
│   └── types.ts              # Shared types
├── frontend/                 # Next.js app
│   ├── app/                  # Pages (home, article, topic, podcast)
│   └── components/           # UI components
├── scripts/
│   └── schema.sql            # D1 database schema
├── background-docs/          # Planning documents
├── docs/plans/               # Implementation design
└── wrangler.toml             # Cloudflare configuration
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CONGRESS_API_KEY` | Congress.gov API access | Yes |
| `OPENSTATES_API_KEY` | OpenStates GraphQL access | Yes |
| `PERIGON_API_KEY` | Perigon news data | Yes |
| `PERPLEXITY_API_KEY` | Perplexity editorial research | Yes |
| `ELEVENLABS_API_KEY` | ElevenLabs voice synthesis | Yes |
| `FRED_API_KEY` | Federal Reserve economic data | Yes |
| `UNSPLASH_ACCESS_KEY` | Unsplash photos (fallback) | No |
| `PEXELS_API_KEY` | Pexels photos (fallback) | No |

## Show Format

Each episode has three acts with three voice personas:

| Voice | Role |
|-------|------|
| **Anchor** | Headlines, framing, sign-off |
| **Correspondent** | Deep dives, analysis, trends |
| **District Desk** | Floor actions, voting records |

**Morning Edition (~12 min):** The Briefing → The Deep Dive → The Outlook

**Evening Edition (~15 min):** Day in Review → Analysis + By the Numbers → The Signal

## Cloudflare Services Used

1. **Workers** — compute and API routing
2. **Agents SDK / Durable Objects** — stateful NewsroomAgent and EpisodeAgent
3. **Workers AI** — editorial triage, script generation, embeddings
4. **D1** — published content database (7 tables)
5. **R2** — audio files and images
6. **KV** — config and FRED data cache
7. **Vectorize** — editorial memory and related story search
8. **Workers (OpenNext)** — Next.js frontend

## Why

Since 2005, over 1,800 local newspapers have closed in the United States. The Listening Post demonstrates that edge AI infrastructure can fill this gap — not by replacing journalists, but by building editorial infrastructure that makes local civic coverage economically viable in communities that currently have none.

Swap the data sources and this runs for any city in America.

## License

MIT

  
the listening **post**

Product Requirements Document

*An AI-powered local news platform delivering twice-daily podcasts and a living newsroom, entirely edge-deployed on Cloudflare.*

**Hackathon:** Cloudflare x ElevenLabs

**Timeline:** 7 days

**Target market:** Milwaukee, Wisconsin

**Version:** 1.0 — March 2026

# **Product overview**

The Listening Post is an AI-powered local news platform that continuously ingests civic and news data, applies editorial intelligence, and produces both a living website and twice-daily podcast episodes with broadcast-quality production. Entirely edge-deployed on Cloudflare.

**One-liner:** An automated newsroom at the edge — Morning Edition meets Politico, built on Cloudflare Workers and ElevenLabs.

**Target audience:** Civically engaged residents of Milwaukee who want to stay informed about local government, policy, and community issues without reading five separate sources.

**Core differentiator:** Not a news aggregator. The Listening Post applies editorial intelligence — it triages, researches, connects stories to legislative history, assigns narrative structure, and produces broadcast-quality audio with multi-voice production.

## **Cloudflare services**

* Workers — compute and cron triggers for data ingestion

* Durable Objects — episode production state machine

* Workers AI — editorial triage, article generation, image generation

* Vectorize — editorial memory / follow-up detection

* D1 — article and episode database

* KV — config, district lookup, FRED data cache

* R2 — audio and image storage

* Pages — frontend with Image Resizing

## **ElevenLabs services**

* Text-to-Speech API — three voice personas (anchor, correspondent, district desk)

* Voice Library — voice selection and configuration

# **Data sources**

* Congress.gov API — federal bills, votes, floor actions, member data

* OpenStates API — Wisconsin state legislation, committee actions

* NewsAPI — national and local headlines, article metadata

* ProPublica Congress API — voting records, committee assignments

* Perplexity API — deep sourced research for top stories

* FRED API — 16 Milwaukee/WI economic indicators (housing, employment, CPI, income)

* Local RSS — Milwaukee Journal Sentinel, Urban Milwaukee, WPR

* Unsplash / Pexels — editorial photography

# **Show format**

## **Morning edition (6:00 AM, \~12 min)**

1. Cold open (\~30s) — hook from biggest story

2. Top stories (\~2 min) — 3-4 headlines, anchor voice

3. Deep dive (\~4 min) — one story with Perplexity research, correspondent voice

4. District watch (\~3 min) — your reps today, district desk voice

5. What to watch (\~2 min) — upcoming hearings/votes, anchor voice

6. Sign-off (\~30s)

## **Evening edition (5:00 PM, \~15 min)**

7. Today’s lead (\~30s)

8. Day in review (\~3 min) — outcomes, anchor voice

9. Analysis (\~5 min) — why it matters, correspondent voice

10. District scorecard (\~3 min) — how reps voted, district desk

11. The signal (\~2 min) — long-term trend, correspondent

12. Sign-off \+ tomorrow preview (\~1 min)

# **Frontend and charts**

## **Homepage**

Edition player hero. Lead story with image. 2-column story grid. District summary. Evening preview. Minimal charts.

## **Article detail**

Audio player, serif body, bill tracker sidebar, source attribution, one contextual FRED chart, previous coverage via Vectorize.

## **Topic page (chart-heavy)**

* Stat cards with sparklines — tiny trend indicators in each metric card

* Primary line chart — 12+ quarter FRED time series (e.g., median home price)

* 2-column chart grid — bar charts (monthly permits), dual-axis (vacancy vs. rent CPI)

* Threshold charts — affordability index with policy annotation lines

* Policy annotations — connecting legislative events to chart data points

# **7-day build plan**

* Day 1 — Cloudflare project setup, D1 schema, R2, KV, Congress/OpenStates ingestion

* Day 2 — NewsAPI, RSS, FRED ingestion, Workers AI triage, Vectorize, Perplexity

* Day 3 — Episode Durable Object, script generators, editorial prompts

* Day 4 — ElevenLabs TTS, three voices, audio assembly, transcripts

* Day 5 — Article generation, image pipeline, RSS feed, bill tracker

* Day 6 — Next.js frontend, all pages, Chart.js data viz, polish

* Day 7 — End-to-end test, 2-3 min demo video, submit

# **Impact**

Since 2005, over 1,800 local newspapers have closed in the United States, creating news deserts where residents have no regular source of local civic information.

The Listening Post demonstrates that AI infrastructure — Cloudflare’s edge compute and ElevenLabs’ voice synthesis — can fill this gap. Not by replacing journalists, but by building editorial infrastructure that makes local civic coverage economically viable in communities that currently have none.

This is not a toy. This is the blueprint for a new kind of local news institution.
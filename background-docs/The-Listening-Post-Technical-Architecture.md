  
the listening **post**

Technical Architecture

*System design, database schema, API integrations, and infrastructure specifications.*

**Platform:** Cloudflare Workers \+ ElevenLabs

**Database:** Cloudflare D1 (SQLite at edge)

**Storage:** Cloudflare R2

**AI:** Workers AI (Llama 3.1 70B, BGE embeddings, Stable Diffusion)

**Voice:** ElevenLabs Turbo v2.5

**Research:** Perplexity API (Sonar Large 128K)

# **System architecture**

## **Layer 1: Data ingestion**

Scheduled Workers on cron triggers (3 AM and 1 PM CT) pull from Congress.gov, OpenStates, NewsAPI, ProPublica, local RSS, and FRED. Data normalized to common story objects in D1. FRED auto-generates stories on new data releases.

## **Layer 2: Editorial intelligence**

Workers AI (Llama 3.1 70B) triages stories: relevance scoring 0-1, topic clustering, narrative connection mapping, follow-up detection via Vectorize similarity. Perplexity provides deep sourced research for top-3 stories.

## **Layer 3: Show production (Durable Objects)**

Six-state pipeline: Ingesting → Triaging → Scripting → Voicing → Assembling → Published. Survives Worker restarts. Retries failed ElevenLabs calls per-segment without regenerating entire episode.

## **Layer 4: Voice production (ElevenLabs)**

Three personas: anchor (warm, authoritative), correspondent (detailed, explanatory), district desk (direct, data-driven). Per-segment TTS via Turbo v2.5. Individual MP3 chunks in R2 for segment-level retry.

## **Layer 5: Content generation**

Each story forks: podcast script (broadcast tone) and written article (editorial, sourced). Both from same Perplexity research package. Images via OG tags, Unsplash, Pexels, or Workers AI SD fallback.

## **Layer 6: Delivery**

Next.js on Cloudflare Pages. R2 for audio/images. Valid podcast RSS feed. Chart.js renders FRED data. D1 stores structured data. KV for district mapping and data cache.

# **Episode Durable Object**

Each episode is a stateful Durable Object managing its own production pipeline through six states:

* INGESTING — receiving story objects. State: rawStories\[\]

* TRIAGING — Workers AI re-ranks. State: rankedStories\[\], connections\[\]

* SCRIPTING — show rundown \+ per-segment scripts. State: segmentScripts\[\], voiceAssignments\[\]

* VOICING — ElevenLabs TTS per segment. State: audioChunks\[\], progress%

* ASSEMBLING — stitch audio \+ metadata. State: finalMp3, transcript, timestamps\[\]

* PUBLISHED — R2 upload, D1 update, RSS refresh. State: audioUrl, rssEntry

Retry logic: max 3 retries per segment. Only failed segment is re-attempted. State persists across cold restarts.

# **FRED integration**

16 Milwaukee/Wisconsin economic indicators across topic beats:

### **Housing**

* ATNHPIUS33340Q — Milwaukee MSA median home price (quarterly)

* BPPRIV255079 — Milwaukee County building permits (monthly)

* WUSTHPI — Wisconsin house price index (quarterly)

* CUURS23ASAH — CPI Midwest housing (monthly)

### **Economy**

* MILK555URN — Milwaukee unemployment rate (monthly)

* WINGSP — Wisconsin gross state product (quarterly)

* MILV526PCPI — Milwaukee MSA per capita income (annual)

* ENUC334030010 — Milwaukee MSA average weekly wage (quarterly)

* CUURS23ASA0 — CPI Midwest urban consumers (monthly)

### **Demographics**

* S1701ACS055079 — Milwaukee County poverty rate (annual)

* WIGINIALLH — Wisconsin Gini index (annual)

Auto-story generation: when new FRED data is detected, stories are auto-created with headline, topic, and FRED source link. These enter the triage pipeline alongside other sources.

Editorial context: the getDataContextForTopic() function injects relevant FRED data into script generation prompts, enabling data-driven commentary in podcast segments.

# **API rate limits**

* Congress.gov: 5,000 requests/hour (API key)

* OpenStates: 1,000 requests/day (API key)

* NewsAPI: 1,000 requests/day (API key)

* ProPublica: 5,000 requests/day (API key)

* Perplexity: pay-per-use (API key)

* ElevenLabs: 100K+ characters/month (API key)

* FRED: 120 requests/minute (free API key)

* Unsplash: 50 requests/hour (API key)

* Workers AI: included with Workers plan (binding)

# **Cloudflare bindings**

* DB — D1 database

* MEDIA\_BUCKET — R2 bucket

* CONFIG\_KV — KV namespace

* STORY\_INDEX — Vectorize (768 dim, cosine)

* EPISODE\_DO — Durable Object namespace

* AI — Workers AI binding

# **Cron schedule**

* 08:00 UTC (3 AM CT) — morning data ingestion

* 10:00 UTC (5 AM CT) — morning episode production

* 18:00 UTC (1 PM CT) — afternoon data ingestion

* 22:00 UTC (5 PM CT) — evening episode production
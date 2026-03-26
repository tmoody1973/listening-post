# The Listening Post — API Integration Guide

## Architecture note: where everything is hosted

The entire application runs on Cloudflare's edge network:

- **Backend (Workers)**: All API ingestion, editorial intelligence, show production, and data endpoints run as Cloudflare Workers. These are serverless functions deployed globally on Cloudflare's edge. No separate backend server.
- **Frontend (Pages)**: The Next.js app deploys to Cloudflare Pages, which is Cloudflare's static/SSR hosting platform. Pages integrates directly with Workers for server-side rendering and API routes.
- **Database (D1)**: SQLite at the edge. No external database server.
- **Storage (R2)**: Audio files and images. S3-compatible, served from Cloudflare's edge.
- **Everything is one deployment.** `wrangler deploy` pushes the Workers. The Pages frontend auto-deploys from Git or via `wrangler pages deploy`.

There is no separate Express server, no Vercel, no AWS. The only external calls are to the APIs listed below.

---

## API sources overview

ProPublica archived February 2025. NewsAPI replaced by Perplexity (intelligence) + Perigon (structured data). Two APIs that don't overlap — Perplexity synthesizes, Perigon structures.

| Source | What it provides | Role |
|--------|-----------------|------|
| Congress.gov v3 API | Federal bills, votes, members, cosponsors | Authoritative legislative data |
| OpenStates GraphQL | State legislation, state legislator data | Wisconsin state coverage |
| Perigon API | Structured articles, images, sentiment, entities, story clustering | Website content layer |
| Perplexity Sonar API | Editorial synthesis, deep research, sourced citations | Intelligence layer |
| FRED API | Economic indicators (16 Milwaukee/WI series) | Data journalism layer |
| ElevenLabs API | Text-to-speech voice synthesis | Voice production |
| Unsplash / Pexels | Editorial photography fallback | If Perigon/Perplexity images insufficient |
| Local RSS feeds | Milwaukee Journal Sentinel, Urban Milwaukee, WPR | Supplementary, free |

### How Perigon and Perplexity divide the work

**Perigon** = the structured data layer. It gives you individual article objects with metadata: title, full content, imageUrl, sentiment score, topic tags, entity extraction, source name, city/state location, and story clustering. This populates the website — homepage story cards, article detail pages, topic page timelines, the image pipeline. Think of it as your wire service.

**Perplexity** = the editorial intelligence layer. It synthesizes multiple sources into researched briefings with citations. This produces podcast scripts, article body text, deep dive analysis, and the "why it matters" editorial voice. Think of it as your senior editor.

---

## 1. Congress.gov API (v3)

**Base URL**: `https://api.congress.gov/v3`
**Auth**: API key as query parameter `?api_key=YOUR_KEY`
**Rate limit**: 5,000 requests/hour
**Free**: Yes
**Sign up**: https://api.congress.gov/sign-up
**Docs**: https://github.com/LibraryOfCongress/api.congress.gov

This is our primary federal data source. It covers everything ProPublica used to provide.

### Endpoints we need

#### Get recent bills (sorted by update date)
```
GET /bill?format=json&limit=20&sort=updateDate+desc&api_key={key}
```
Returns list of recently updated bills across both chambers. We use this in the morning ingestion to catch overnight legislative activity.

Response fields we use: `congress`, `type`, `number`, `title`, `updateDate`, `url`, `latestAction`

#### Get bill details
```
GET /bill/{congress}/{billType}/{billNumber}?format=json&api_key={key}
```
Example: `GET /bill/119/s/247?format=json&api_key={key}`

Returns full bill detail including title, sponsors, latest action, policy area. We use this when a bill is triaged as a deep dive candidate.

#### Get bill actions (legislative history)
```
GET /bill/{congress}/{billType}/{billNumber}/actions?format=json&api_key={key}
```
Returns chronological list of actions taken on a bill (introduced, referred to committee, passed, etc). Powers the bill tracker sidebar on article pages.

#### Get bill cosponsors
```
GET /bill/{congress}/{billType}/{billNumber}/cosponsors?format=json&api_key={key}
```
Returns list of cosponsors with party, state, district. Used to populate the "your rep's position" field in the bill tracker.

#### Get bill subjects
```
GET /bill/{congress}/{billType}/{billNumber}/subjects?format=json&api_key={key}
```
Returns policy area and legislative subjects. Used by the triage system to map bills to topic categories (housing, education, etc).

#### Get bill summaries
```
GET /bill/{congress}/{billType}/{billNumber}/summaries?format=json&api_key={key}
```
CRS summaries of the bill in plain language. Fed directly into Perplexity research prompts and article generation.

#### List members by state
```
GET /member?stateCode=WI&format=json&api_key={key}
```
Returns all current and former Wisconsin members. We filter by `currentMember: true` to populate the district dashboard.

Response fields: `bioguideId`, `name`, `party`, `state`, `district`, `depiction` (photo URL), `terms`

#### Get specific member
```
GET /member/{bioguideId}?format=json&api_key={key}
```
Full member profile with sponsored legislation, committee assignments, and official photo URL from `depiction.imageUrl`.

#### Get member's sponsored legislation
```
GET /member/{bioguideId}/sponsored-legislation?format=json&limit=10&api_key={key}
```
Recent bills sponsored by this member. Powers the district dashboard "recent activity" section.

#### Get House roll call votes (added May 2025)
```
GET /house-roll-call-vote/{congress}/{session}?format=json&limit=20&api_key={key}
```
Returns recent House roll call votes. This endpoint replaced what ProPublica used to provide.

#### Get vote details with member positions
```
GET /house-roll-call-vote/{congress}/{session}/{rollCallNumber}/members?format=json&api_key={key}
```
Returns how each member voted (Yea/Nay/Not Voting). We filter for Wisconsin members to power the district scorecard segment.

### Ingestion pattern
```
Morning (3 AM CT):
  1. GET /bill?sort=updateDate+desc&limit=20  → new/updated bills
  2. GET /member?stateCode=WI&currentMember=true  → refresh WI delegation
  3. GET /house-roll-call-vote/{congress}/{session}?limit=10  → recent votes

For each top-ranked bill:
  4. GET /bill/{congress}/{type}/{number}/actions
  5. GET /bill/{congress}/{type}/{number}/cosponsors
  6. GET /bill/{congress}/{type}/{number}/summaries
```

---

## 2. OpenStates GraphQL API

**Base URL**: `https://v3.openstates.org/graphql`
**Auth**: API key as `X-API-KEY` header
**Rate limit**: 1,000 requests/day
**Free**: Yes (with registration)
**Sign up**: https://openstates.org/accounts/signup/
**Docs**: https://docs.openstates.org/api-v3/

Covers all 50 state legislatures. We only query Wisconsin.

### Queries we need

#### Recent Wisconsin bills
```graphql
{
  bills(
    jurisdiction: "Wisconsin"
    first: 20
    sort: "UPDATED_DESC"
  ) {
    edges {
      node {
        id
        identifier
        title
        updatedAt
        createdAt
        classification
        subject
        openstatesUrl
        latestAction {
          description
          date
          classification
        }
        sponsors {
          name
          classification
          entityType
          organization {
            name
          }
        }
        abstracts {
          abstract
        }
      }
    }
  }
}
```

#### Wisconsin legislators
```graphql
{
  people(
    jurisdiction: "Wisconsin"
    first: 150
    memberOf: "Wisconsin State Senate"
  ) {
    edges {
      node {
        id
        name
        party {
          name
        }
        currentMemberships {
          post {
            label
            division {
              name
            }
          }
          organization {
            name
            classification
          }
        }
        image
        links {
          url
        }
      }
    }
  }
}
```
Run this twice: once for `memberOf: "Wisconsin State Senate"` and once for `memberOf: "Wisconsin State Assembly"`.

#### Specific bill detail
```graphql
{
  bill(jurisdiction: "Wisconsin", session: "2025-2026", identifier: "SB 247") {
    id
    identifier
    title
    classification
    subject
    abstracts { abstract }
    latestAction { description date }
    actions {
      description
      date
      classification
      organization { name }
    }
    votes {
      motionText
      startDate
      result
      counts { option value }
      votes { option voter { name } }
    }
    sponsors { name classification }
    sources { url }
    openstatesUrl
  }
}
```

### Ingestion pattern
```
Morning (3 AM CT):
  1. Query recent bills (sort: UPDATED_DESC, first: 20)
  2. For each new/updated bill, store in D1

Weekly refresh:
  3. Query all WI legislators (Senate + Assembly)
  4. Update legislators table in D1
```

---

## 3. Perigon API (structured news data)

**Base URL**: `https://api.goperigon.com/v1`
**Auth**: API key as query parameter `apiKey={key}`
**Rate limit**: Based on plan (free tier has limited usage)
**Free**: Yes — free tier with full platform access, limited usage
**Sign up**: https://www.perigon.io/products/pricing
**Docs**: https://docs.goperigon.com/docs/overview
**TypeScript SDK**: `npm install @goperigon/perigon-ts` (zero-dependency, edge-compatible)

Perigon is the structured data layer — it gives you individual article objects with full metadata, images, sentiment, topic tags, entity extraction, story clustering, and journalist data. This is what populates the website. Perplexity synthesizes; Perigon structures.

### Why Perigon complements Perplexity

| Need | Perigon | Perplexity |
|------|---------|------------|
| Individual article objects for story cards | Yes — full article metadata | No — returns synthesized prose |
| Article images (imageUrl per article) | Yes — every article has media | Yes — but aggregated, not per-article |
| Sentiment analysis | Yes — per article | No |
| Entity extraction (people, orgs, locations) | Yes — structured tags | Mentions in prose only |
| Story clustering (dedup + grouping) | Yes — `/stories` endpoint | No |
| Topic classification | Yes — pre-tagged | Can be prompted for |
| Full article content | Yes — `content` field | No — synthesized summary |
| Editorial synthesis ("why it matters") | No | Yes — this is its strength |
| Deep research with citations | No | Yes — sourced briefings |

### Endpoints we need

#### Search articles (`/all`) — the primary endpoint

```
GET /all?apiKey={key}&q=Milwaukee&state=Wisconsin&sortBy=date&size=20&from=2026-03-23

Or POST:
POST /all
Body: {
  "apiKey": "{key}",
  "q": "Milwaukee",
  "state": "Wisconsin",
  "sortBy": "date",
  "size": 20,
  "from": "2026-03-23"
}
```

**Key parameters:**
- `q` — keyword search (supports AND, OR, NOT operators)
- `state` — filter by US state (e.g., `Wisconsin`)
- `city` — filter by city (e.g., `Milwaukee`)
- `source` — filter by source domain (e.g., `jsonline.com`)
- `category` — filter by topic: `Politics`, `Business`, `Tech`, `Sports`, `Entertainment`, `Science`, `Health`, `Environment`, `Finance`, `Lifestyle`, `World`, `General`
- `sortBy` — `date` (newest first), `relevance`, or `share`
- `from` / `to` — date range (ISO format)
- `size` — results per page (max 100)
- `page` — pagination (zero-indexed)
- `showReprints` — `false` to deduplicate (default: true)

**Response structure:**
```json
{
  "status": 200,
  "numResults": 847,
  "articles": [
    {
      "articleId": "abc123",
      "title": "Milwaukee zoning overhaul advances to full Senate vote",
      "description": "Senate Bill 247 would allow multi-family...",
      "content": "Full article text here...",
      "url": "https://jsonline.com/story/...",
      "imageUrl": "https://jsonline.com/image.jpg",
      "source": {
        "domain": "jsonline.com",
        "name": "Milwaukee Journal Sentinel"
      },
      "authoredDate": "2026-03-25T14:30:00Z",
      "publishedDate": "2026-03-25T14:35:00Z",
      "country": "us",
      "state": "Wisconsin",
      "city": "Milwaukee",
      "language": "en",
      "sentiment": {
        "positive": 0.12,
        "negative": 0.05,
        "neutral": 0.83
      },
      "topics": [
        { "name": "Housing" },
        { "name": "Zoning" }
      ],
      "entities": [
        { "name": "Wisconsin State Senate", "type": "ORG" },
        { "name": "Milwaukee", "type": "LOC" },
        { "name": "Sen. Larson", "type": "PERSON" }
      ],
      "categories": ["Politics"],
      "matchedAuthors": [
        { "id": "auth123", "name": "Jane Reporter" }
      ],
      "clusterId": "story-456",
      "reprintGroupId": null
    }
  ]
}
```

Key fields for The Listening Post: `title`, `content` (full text for article generation), `imageUrl` (hero image — no Unsplash needed), `sentiment` (editorial tone decisions), `topics` + `categories` (pre-classified — reduces Workers AI triage), `entities` (people, orgs for district matching), `state` + `city` (Milwaukee filtering), `clusterId` (story dedup).

#### Search stories (`/stories`) — clustered coverage

```
GET /stories?apiKey={key}&q=Milwaukee&state=Wisconsin&sortBy=date&size=10
```

Returns story clusters instead of individual articles. Each story groups related articles covering the same event.

**Response:**
```json
{
  "stories": [
    {
      "storyId": "story-456",
      "title": "Milwaukee zoning overhaul debate",
      "summary": "Wisconsin Senate committee advances SB 247...",
      "numArticles": 7,
      "topArticle": { /* full article object */ },
      "createdDate": "2026-03-25T10:00:00Z",
      "updatedDate": "2026-03-25T18:30:00Z",
      "topics": [{ "name": "Housing" }],
      "entities": [{ "name": "Wisconsin State Senate", "type": "ORG" }],
      "sentiment": { "positive": 0.15, "negative": 0.10, "neutral": 0.75 }
    }
  ]
}
```

This is perfect for the topic page coverage timeline — each story has a count of articles, aggregate sentiment, and a top article. Stories with `numArticles > 3` are clearly significant.

#### Get journalist data (`/journalists`)

```
GET /journalists/{id}?apiKey={key}
```

Returns journalist details when `matchedAuthors` is present in an article. Useful for attribution on article pages.

#### Search people (`/people`)

```
GET /people?apiKey={key}&q=Gwen Moore
```

Returns entity data for known persons — useful for populating legislator profiles with additional context.

#### Search companies (`/companies`)

```
GET /companies?apiKey={key}&q=Milwaukee Public Schools
```

Returns entity data for organizations mentioned in articles.

#### Vector search (`/vector`)

```
POST /vector
Body: {
  "apiKey": "{key}",
  "prompt": "affordable housing policy in Milwaukee Wisconsin",
  "size": 10
}
```

Semantic search across all articles. Could supplement or replace Vectorize for finding related coverage.

### Using the TypeScript SDK in Cloudflare Workers

```typescript
import { Configuration, V1Api } from "@goperigon/perigon-ts";

const perigon = new V1Api(
  new Configuration({ apiKey: env.PERIGON_API_KEY })
);

// Search Milwaukee news
const { articles, numResults } = await perigon.searchArticles({
  q: "Milwaukee",
  state: "Wisconsin",
  sortBy: "date",
  size: 20,
  from: "2026-03-23",
  showReprints: false,
});

// Get story clusters
const { stories } = await perigon.searchStories({
  q: "Milwaukee",
  state: "Wisconsin",
  sortBy: "date",
  size: 10,
});

// Vector search for related articles
const related = await perigon.vectorSearchArticles({
  articleSearchParams: {
    prompt: "Milwaukee zoning reform impact on housing",
    size: 5,
  },
});
```

The SDK is zero-dependency and works in edge runtimes, so it runs directly in Cloudflare Workers.

### Ingestion pattern

```
Morning ingestion (3 AM CT):
  1. GET /all — Milwaukee Wisconsin news, last 24h, sortBy=date
  2. GET /all — Wisconsin politics category, last 24h
  3. GET /stories — Milwaukee clusters for topic page timelines

  From each article response:
  - Store article metadata + imageUrl in D1
  - Use pre-tagged topics/categories to skip Workers AI topic classification
  - Use sentiment scores for editorial tone decisions
  - Use entities for district/legislator matching
  - Use clusterId to group related coverage

Afternoon ingestion (1 PM CT):
  Same pattern with from= set to morning

Total: ~6-8 Perigon calls per day
Free tier: more than sufficient for hackathon
```

---

## 4. Perplexity Sonar API (editorial intelligence + research)

**Base URL**: `https://api.perplexity.ai`
**Auth**: Bearer token in Authorization header
**Rate limit**: Tier-based (Tier 1: 50 req/min, Tier 2: 500 req/min)
**Sign up**: https://docs.perplexity.ai/ → API Keys tab
**Docs**: https://docs.perplexity.ai/docs/sonar/quickstart
**Pricing**: Pay-per-use. Pro subscribers get $5/month in free credits.

With Perigon handling structured article data, Perplexity's role focuses on what it does best: editorial synthesis, deep research, and the "why it matters" intelligence that becomes podcast scripts and article body text. It also provides images via `return_images` to supplement Perigon's article images.

### Endpoint (one endpoint does everything)

```
POST /chat/completions
Headers:
  Authorization: Bearer {key}
  Content-Type: application/json
```

### Models we use

| Model | Use case | Cost (per 1K req + tokens) |
|-------|----------|---------------------------|
| `sonar` | News discovery, headline scanning | ~$0.006/query (cheapest) |
| `sonar-pro` | Deep research, analysis, multi-step | ~$0.013/query |
| `sonar-reasoning-pro` | Complex analysis, The Signal segment | ~$0.013/query |
| `sonar-deep-research` | Weekly deep dives, long-form research | ~$0.40-1.20/query |

### Key parameters

```json
{
  "model": "sonar-pro",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "return_images": true,
  "search_recency_filter": "day",
  "search_domain_filter": ["jsonline.com", "urbanmilwaukee.com", "-pinterest.com"],
  "search_after_date_filter": "03/23/2026",
  "search_before_date_filter": "03/26/2026",
  "web_search_options": {
    "search_context_size": "high",
    "user_location": {
      "latitude": 43.0389,
      "longitude": -87.9065,
      "country": "US"
    }
  },
  "temperature": 0.2,
  "return_related_questions": true
}
```

**Parameter reference:**
- `return_images`: Returns image objects with `imageUrl`, `originUrl`, `height`, `width` (Tier 2+)
- `search_recency_filter`: `"hour"`, `"day"`, `"week"`, `"month"` — controls source freshness
- `search_domain_filter`: Include specific domains or exclude with `-` prefix (max 10)
- `search_after_date_filter` / `search_before_date_filter`: Date range in `MM/DD/YYYY`
- `web_search_options.search_context_size`: `"low"` (fast/cheap), `"medium"`, `"high"` (thorough)
- `web_search_options.user_location`: Geo-localize search results to Milwaukee
- `response_format`: Can request JSON schema for structured output
- `return_related_questions`: Get follow-up suggestions (useful for "what to watch" segments)

### Response structure

```json
{
  "id": "pplx-abc123",
  "model": "sonar-pro",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Here are today's key developments in Milwaukee..."
      },
      "finish_reason": "stop"
    }
  ],
  "citations": [
    "https://www.jsonline.com/story/news/...",
    "https://urbanmilwaukee.com/2026/03/...",
    "https://legis.wisconsin.gov/..."
  ],
  "images": [
    {
      "imageUrl": "https://example.com/photo.jpg",
      "originUrl": "https://source.com/article",
      "height": 600,
      "width": 1200
    }
  ],
  "related_questions": [
    "What is the timeline for SB 247 reaching the full Senate?",
    "How does Milwaukee's zoning compare to other Midwest cities?"
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 800,
    "total_tokens": 950
  }
}
```

### The three query patterns we run

#### Pattern 1: News discovery (replaces NewsAPI)
Uses `sonar` for speed and cost. Runs every ingestion cycle.

```json
{
  "model": "sonar",
  "return_images": true,
  "search_recency_filter": "day",
  "web_search_options": {
    "search_context_size": "medium",
    "user_location": { "latitude": 43.0389, "longitude": -87.9065, "country": "US" }
  },
  "temperature": 0.1,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "schema": {
        "type": "object",
        "properties": {
          "stories": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "headline": { "type": "string" },
                "summary": { "type": "string" },
                "topic": { "type": "string" },
                "relevance": { "type": "number" },
                "source": { "type": "string" }
              }
            }
          }
        }
      }
    }
  },
  "messages": [
    {
      "role": "system",
      "content": "You are a local news editor for Milwaukee, Wisconsin. Return structured JSON with today's most important local stories."
    },
    {
      "role": "user",
      "content": "What are today's most important news stories affecting Milwaukee residents? Focus on: city council actions, county board decisions, state legislature bills affecting Wisconsin, housing and development, education (MPS), transit (MCTS), public safety, and local economy. Return 6-8 stories ranked by local importance."
    }
  ]
}
```

We run 3-4 of these per cycle with different topic focuses:
- General Milwaukee news
- Wisconsin state legislature activity
- Milwaukee housing and development
- Education, transit, and public safety

#### Pattern 2: Deep research (for top stories)
Uses `sonar-pro` with high context. Runs 1-3 times per cycle for deep dive candidates.

```json
{
  "model": "sonar-pro",
  "return_images": true,
  "search_recency_filter": "week",
  "search_domain_filter": ["legis.wisconsin.gov", "jsonline.com", "urbanmilwaukee.com", "wpr.org"],
  "web_search_options": { "search_context_size": "high" },
  "temperature": 0.2,
  "messages": [
    {
      "role": "system",
      "content": "You are a senior research journalist at a Milwaukee local news operation. Provide thorough, sourced background research. Include: historical context, key stakeholders and positions, relevant data, local community impact, and what to watch next. Cite all sources."
    },
    {
      "role": "user",
      "content": "Research Wisconsin Senate Bill 247 (zoning reform). What does it do? Who sponsored it? What happened in committee? What are the arguments for and against? How would it specifically affect Milwaukee residents and neighborhoods? What similar reforms have other cities enacted?"
    }
  ]
}
```

#### Pattern 3: Image sourcing
Uses `sonar` with `return_images` and image filters. Called when articles need images.

```json
{
  "model": "sonar",
  "return_images": true,
  "image_domain_filter": ["-gettyimages.com", "-shutterstock.com"],
  "image_format_filter": ["jpg", "png", "webp"],
  "messages": [
    {
      "role": "user",
      "content": "Milwaukee Wisconsin state capitol building senate committee hearing"
    }
  ]
}
```

Response includes `images[]` array with `imageUrl`, `originUrl`, `height`, `width`. Download and store in R2.

### Ingestion workflow with Perplexity + Perigon

```
Morning ingestion (3 AM CT):
  PERIGON (structured data):
  1. /all — Milwaukee articles, last 24h → story objects with metadata + images
  2. /all — Wisconsin politics → state-level coverage
  3. /stories — Milwaukee clusters → topic page timelines

  PERPLEXITY (editorial intelligence):
  4. sonar: "Milwaukee civic news synthesis" → editorial briefing for show rundown
  5. sonar-pro: Deep research on top 1-3 stories → research packages
  6. sonar: Image sourcing for stories missing Perigon imageUrl

Afternoon ingestion (1 PM CT):
  Same pattern, focused on what happened since morning

Total: ~6-8 Perigon + ~6-8 Perplexity calls per day
```

### Cost estimate for the hackathon

| Query type | Model | Calls/day | Cost/call | Daily cost |
|-----------|-------|-----------|-----------|------------|
| Editorial synthesis | sonar | 3-4 | ~$0.006 | ~$0.02 |
| Deep research | sonar-pro | 2-3 | ~$0.013 | ~$0.03 |
| Image sourcing | sonar | 2-3 | ~$0.006 | ~$0.01 |
| **Total Perplexity** | | **~8** | | **~$0.06/day** |

**7-day Perplexity total: ~$0.50-1.00.** Even cheaper now that Perigon handles structured discovery.

---

## 5. FRED API (Federal Reserve Economic Data)

**Base URL**: `https://api.stlouisfed.org/fred`
**Auth**: API key as query parameter `api_key={key}`
**Rate limit**: 120 requests/minute
**Free**: Yes
**Sign up**: https://fred.stlouisfed.org/docs/api/api_key.html
**Docs**: https://fred.stlouisfed.org/docs/api/fred/

### Endpoints we need

#### Get series observations (the main one)
```
GET /series/observations?series_id={id}&api_key={key}&file_type=json&sort_order=desc&limit=12
```

We call this for each of our 16 series. Returns date/value pairs.

#### Get series metadata
```
GET /series?series_id={id}&api_key={key}&file_type=json
```
Returns title, frequency, units, seasonal adjustment, last updated date. Called once per series to populate metadata.

### Our 16 series IDs

**Housing**: `ATNHPIUS33340Q` (MKE median price), `BPPRIV255079` (MKE permits), `WUSTHPI` (WI house price index), `WIHOWN` (WI homeownership), `CUURS23ASAH` (CPI Midwest housing), `RRVRUSQ156N` (US rental vacancy)

**Economy**: `MILK555URN` (MKE unemployment), `WINGSP` (WI GDP), `MILV526PCPI` (MKE per capita income), `ENUC334030010` (MKE avg weekly wage), `LAUMT553334000000003` (MKE employment level), `SMU55334000500000001` (MKE private employment), `CUURS23ASA0` (CPI Midwest)

**Transit**: `CUURS23ASAT` (CPI Midwest transportation)

**Demographics**: `S1701ACS055079` (MKE poverty rate), `WIGINIALLH` (WI Gini index)

### Ingestion pattern
```
Every ingestion cycle:
  For each of 16 series:
    1. GET /series/observations (limit=2, sort=desc)
    2. Compare latest date against KV cached last_date
    3. If new data → auto-generate story, update KV cache
    4. Store latest + previous value in KV for frontend charts

Total calls per cycle: 16 (well within 120/min limit)
```

---

## 6. ElevenLabs API

**Base URL**: `https://api.elevenlabs.io/v1`
**Auth**: API key as `xi-api-key` header
**Rate limit**: Based on subscription tier (character count)
**Sign up**: https://elevenlabs.io/sign-up
**Docs**: https://elevenlabs.io/docs/api-reference

### Endpoints we need

#### Text-to-speech (the main one)
```
POST /text-to-speech/{voice_id}
Headers:
  xi-api-key: {key}
  Content-Type: application/json
  Accept: audio/mpeg

Body:
{
  "text": "Script text for this segment...",
  "model_id": "eleven_turbo_v2_5",
  "voice_settings": {
    "stability": 0.65,
    "similarity_boost": 0.80,
    "style": 0.35,
    "use_speaker_boost": true
  }
}
```
Returns raw MP3 audio as binary response.

#### List available voices
```
GET /voices
Headers: xi-api-key: {key}
```
Returns all available voices with IDs, names, and preview URLs. Use this to select your three personas.

#### Check usage / subscription
```
GET /user/subscription
Headers: xi-api-key: {key}
```
Returns `character_count` (used) and `character_limit` (total for billing period). Check before each production run.

### Voice persona configuration

| Persona | Suggested voice | stability | similarity | style |
|---------|----------------|-----------|------------|-------|
| Anchor | Adam or custom | 0.65 | 0.80 | 0.35 |
| Correspondent | Antoni or custom | 0.55 | 0.75 | 0.20 |
| District desk | Arnold or custom | 0.70 | 0.85 | 0.15 |

### Character budget estimate
- Morning edition (~12 min): ~3,500 characters of script
- Evening edition (~15 min): ~4,500 characters of script
- Daily total: ~8,000 characters
- Weekly total: ~56,000 characters
- **Recommended plan**: Starter ($5/mo, 30,000 chars) or Creator ($22/mo, 100,000 chars)

---

## 7. Unsplash API

**Base URL**: `https://api.unsplash.com`
**Auth**: `Authorization: Client-ID {key}` header
**Rate limit**: 50 requests/hour
**Free**: Yes
**Sign up**: https://unsplash.com/developers
**Docs**: https://unsplash.com/documentation

### Endpoint we need

#### Search photos by topic
```
GET /search/photos?query={topic}+{location}&per_page=1&orientation=landscape
Headers: Authorization: Client-ID {key}
```

Response fields: `results[0].urls.regular` (1080px wide image URL), `results[0].user.name` (attribution), `results[0].alt_description`

### Usage pattern
- Called once per article that needs an image
- Download the image and store in R2 (do not hotlink — against Unsplash ToS for server-side usage)
- Provide attribution: "Photo by {user.name} on Unsplash"

---

## 8. Pexels API

**Base URL**: `https://api.pexels.com/v1`
**Auth**: `Authorization: {key}` header
**Rate limit**: 200 requests/hour
**Free**: Yes
**Sign up**: https://www.pexels.com/api/
**Docs**: https://www.pexels.com/api/documentation/

### Endpoint we need

#### Search photos
```
GET /search?query={topic}+{location}&per_page=1&orientation=landscape
Headers: Authorization: {key}
```

Response fields: `photos[0].src.large` (image URL), `photos[0].photographer` (attribution)

### Usage pattern
- Fallback when Unsplash returns no results
- Same download-and-store-in-R2 pattern
- Attribution: "Photo by {photographer} on Pexels"

---

## Internal API endpoints (our Workers)

These are the API routes our frontend calls, served by the Cloudflare Worker:

```
GET  /api/stories                    → List published stories (filterable by ?topic=)
GET  /api/stories?topic=housing      → Filter by topic
GET  /api/episodes                   → List published episodes
GET  /api/episodes?edition=morning   → Filter by edition
GET  /api/episode/{id}               → Episode detail with segments
GET  /api/article/{slug}             → Article detail with related articles
GET  /api/topic/{topic}              → Topic page data (stories, bills, stats)
GET  /api/data/{topic}               → FRED data points for topic charts
GET  /api/district?zip={zip}         → District lookup with legislator info
GET  /feed.xml                       → Podcast RSS feed
GET  /audio/{key}                    → Audio file from R2
GET  /images/{key}                   → Image file from R2

POST /api/trigger/ingest             → Manual ingestion trigger (dev only)
POST /api/trigger/produce?edition=   → Manual production trigger (dev only)
```

---

## Error handling strategy

All external API calls should:
1. Wrap in try/catch — a single API failure should not crash the entire ingestion cycle
2. Log errors with source name: `console.error("[Congress] API error: ${status}")`
3. Use `Promise.allSettled()` for parallel ingestion — collect results from sources that succeed
4. Implement exponential backoff for rate limit errors (429 responses)
5. Cache successful responses in KV with TTL where appropriate
6. For ElevenLabs failures during voicing: retry individual segments up to 3 times via the Durable Object state machine

---

## API key cost summary for hackathon week

| Service | Plan needed | Cost |
|---------|------------|------|
| Congress.gov | Free | $0 |
| OpenStates | Free | $0 |
| Perigon | Free tier | $0 |
| Perplexity Sonar | Pay-per-use (Pro gets $5/mo credits) | ~$0.50-1 |
| FRED | Free | $0 |
| ElevenLabs | Starter or Creator | $5-22 |
| Unsplash | Free (fallback only) | $0 |
| Pexels | Free (fallback only) | $0 |

**Minimum viable cost: ~$6-23 for the entire hackathon.** Perigon's free tier handles structured news data. Perplexity is under $1 for the week. The real cost is ElevenLabs voice synthesis.

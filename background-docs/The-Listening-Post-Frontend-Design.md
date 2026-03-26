# The Listening Post — Frontend Design Document

## Hosting and framework

The frontend is a Next.js application deployed to Cloudflare Pages. This is not a separate server — Pages is Cloudflare's hosting platform for static sites and server-rendered apps. It integrates directly with Workers for API routes and server-side rendering.

**Deploy command**: `wrangler pages deploy .next` (or via Git integration)
**URL**: `https://thelisteningpost.news` (custom domain) or `https://listening-post.pages.dev` (default)

All API calls from the frontend hit the same Cloudflare Worker backend at `/api/*`. No CORS issues because everything is on the same domain.

### Data sources powering the frontend

- **Perigon API** — provides structured article objects with `imageUrl`, `sentiment`, `topics[]`, `entities[]`, and story clustering. Populates homepage story cards, article detail pages, topic page timelines, and the image pipeline. Most article images come directly from Perigon's `imageUrl` field (sourced from the original publication).
- **Perplexity Sonar API** — provides editorial synthesis and deep research. Powers article body text, podcast scripts, and the "why it matters" analysis. Supplementary images via `return_images`.
- **Congress.gov / OpenStates** — structured legislative data for bill tracker sidebars, district dashboard, and legislator cards.
- **FRED API** — economic indicators cached in KV, rendered as Chart.js charts on topic pages and in article body context.

### Real-time updates via Agents SDK

The frontend uses the Agents SDK's React hooks for real-time state sync with the backend agents:

```typescript
import { useAgent } from "agents/react";

// Connect to the NewsroomAgent for dashboard state
const newsroom = useAgent({ agent: "NewsroomAgent", name: "main-newsroom" });

// Connect to an EpisodeAgent for production progress
const episode = useAgent({ agent: "EpisodeAgent", name: "morning-2026-03-26" });
```

State updates (ingestion progress, episode production status) push to connected clients automatically via WebSocket — no polling required.

---

## Design philosophy

**Editorial, not dashboard.** The Listening Post looks like a publication, not a SaaS product. Serif headlines, generous whitespace, restrained color. The design says "this is journalism" before the user reads a word.

**Podcast-first.** The audio player is the hero element on the homepage, not buried in a sidebar. Every article has an audio badge linking to its segment. The experience is "listen, then read deeper."

**Transparency by default.** Every article shows its sources. Every data point links to FRED. The AI-generated label is visible. Trust comes from showing your work.

**Data journalism, not data dashboards.** Charts appear in editorial context — inside articles, on topic pages — not as standalone analytics. Charts have annotations connecting data to policy events.

---

## Color system

**Brand color**: Coral `#D85A30` — used for the logo accent, play buttons, edition badges, and accent borders. Warm and editorial without being aggressive.

**Topic colors** (consistent across all pages):

| Topic | Color | Use case |
|-------|-------|----------|
| Housing | Blue `#185FA5` | Topic labels, chart lines |
| Education | Purple `#534AB7` | Topic labels |
| Transit | Amber `#BA7517` | Topic labels |
| Public safety | Red `#A32D2D` | Topic labels |
| Economy | Teal `#0F6E56` | Topic labels, chart lines |
| Health | Pink `#993556` | Topic labels |
| Environment | Green `#3B6D11` | Topic labels |

**Text hierarchy**: Primary (headlines, body), Secondary (metadata, descriptions), Tertiary (timestamps, hints). All adapt to dark mode via CSS variables.

---

## Typography

- **Headlines**: Serif font (Georgia, `font-serif` in Tailwind). Used for article headlines, topic page titles, and pull quotes. Weight 500, never bold.
- **Body text (articles)**: Serif, 16px, line-height 1.7. Long-form reading optimized.
- **UI text (navigation, labels, metadata)**: Sans-serif (system font stack). 12-14px for labels, 13px for metadata.
- **Data (stat cards, charts)**: Sans-serif, 18-24px for values, 11px for labels.

---

## Page designs

### Homepage ( / )

**Layout**: Single column, max-width 720px centered.

**Sections (top to bottom)**:

1. **Navigation bar**
   - Logo: "the listening" (regular) + "post" (coral, bold)
   - Nav links: Topics, Podcast, My district, About
   - Minimal, no background color, bottom border only

2. **Edition player** (hero element)
   - Background: secondary surface color
   - Edition badge: coral pill with "Morning edition" or "Evening edition"
   - Date in serif font
   - Metadata line: duration, story count, publish time
   - Audio player: coral play button, progress bar, current segment indicator
   - Segment pills: clickable, jump to Headlines / Deep dive / District watch / etc.
   - This is the most important element on the page

3. **Lead story**
   - Full-width hero image (16:9 ratio placeholder, border-radius)
   - Topic label (colored, uppercase, small)
   - Headline in serif, 20px
   - Deck (summary) in sans, 14px, secondary color
   - Byline: "AI-generated from N sources — X min read" + listen badge

4. **Story grid**
   - 2-column grid, 16px gap
   - Each card: thumbnail (100px tall), topic label, headline (serif, 15px), deck (12px), byline with audio badge
   - 4 stories maximum
   - No borders on cards — whitespace separates them

5. **District summary**
   - Bordered card
   - Header: district name (e.g., "Wisconsin 4th congressional district")
   - Summary: "2 votes today, 1 committee hearing relevant"
   - Representative rows: avatar circle (initials), name, party, recent action

6. **Evening edition teaser**
   - Surface background
   - Clock icon + "Evening edition at 5:00 PM"
   - Preview text of upcoming coverage
   - Creates anticipation for the return visit

**What is NOT on the homepage**: No charts (save for topic pages). No sidebar. No infinite scroll. No ads. No "trending" or "most read." This is curated, not algorithmic.

---

### Article detail page ( /story/[slug] )

**Layout**: Single column, max-width 680px centered.

**Sections (top to bottom)**:

1. **Back navigation** — "← Back" link

2. **Article header**
   - Topic label (colored, uppercase)
   - Headline (serif, 22px, 1.3 line-height)
   - Deck (sans, 15px, secondary color)
   - Metadata row: edition badge, date, read time, source count, "AI-generated"

3. **Audio player**
   - Surface background card
   - Label: "Listen to this segment"
   - Play button + progress bar + "Deep dive segment" indicator
   - Transcript toggle link

4. **Hero image**
   - Full-width, border-radius, 200px height
   - Caption below in italic, 11px, tertiary color
   - Attribution to photographer/source

5. **Article body**
   - Serif font, 16px, 1.7 line-height
   - Paragraphs spaced 16px apart
   - No bold within body text (use italic for emphasis sparingly)

6. **Bill tracker sidebar** (for legislative stories)
   - Surface background card
   - Structured data rows: Bill number, Status (badge), Sponsor, Vote count, Next step, Your rep's position
   - Status badges: green (passed), amber (in committee), blue (introduced)

7. **Pull quote** (if the article has one)
   - Left border accent (3px coral)
   - Serif, 17px, italic
   - No background — just the border accent

8. **Contextual FRED chart** (one per article, topic-matched)
   - Chart card with title, subtitle (source + series ID), and Chart.js line/bar
   - Only shown if the article's topic has relevant FRED data
   - Housing article → median home price trend
   - Economy article → unemployment rate trend
   - Annotation connecting chart data to the article's story

9. **Source attribution**
   - Bordered card
   - Label: "Sources used for this article"
   - Numbered list: source name, description, link
   - This is a trust signal — always visible, never collapsed

10. **Previous coverage**
    - Section divider label
    - 3 related articles (powered by Vectorize similarity)
    - Each: date, edition badge, headline (clickable), snippet

---

### Topic page ( /topic/[topic] )

**Layout**: Single column, max-width 720px.

This is the data journalism showcase — the most chart-heavy page.

**Sections (top to bottom)**:

1. **Topic header**
   - Topic label (small, colored)
   - Topic name (serif, 22px)
   - Description (sans, 14px, secondary)

2. **Key stats grid**
   - 4-column grid of metric cards
   - Each card: label (11px, tertiary), value (18px, bold), change indicator (+/- with direction color), sparkline (24px tall, Chart.js mini line)
   - Data source: FRED via `/api/data/{topic}`
   - Example for Housing: Median price ($198K, +8.3%), Vacancy (4.1%, -0.8pts), Permits (347, +18%), CPI Housing (312.4, +6.2%)

3. **Active legislation tracker**
   - Surface background card
   - Label: "Active legislation"
   - Bill rows: bill number + short title, status badge
   - Status badges: Passed committee (green), In committee (amber), Introduced (blue)
   - Data from D1 bill_tracker table

4. **Trend charts section**
   - Section divider: "Trend charts"

   **Primary chart** (full width):
   - Bordered card
   - Title (14px bold), subtitle (12px, source + FRED series ID)
   - Custom HTML legend (not Chart.js default)
   - Chart.js line chart, 200px tall
   - Multiple series if comparing (e.g., Milwaukee vs. Wisconsin statewide)
   - Annotation row below chart connecting data to policy events

   **Secondary charts** (2-column grid):
   - Bordered cards, same structure as primary but shorter (160px)
   - Left: bar chart (monthly data like building permits)
   - Right: dual-axis line chart (correlated metrics like vacancy vs. rent CPI)

   **Threshold chart** (full width):
   - Line chart with a dashed threshold line (e.g., affordability ratio at 3.5x)
   - Fill below/above threshold for visual emphasis
   - Shows when a metric crosses into concerning territory

5. **Coverage timeline**
   - Section divider: "Coverage timeline"
   - Grouped by day, reverse chronological
   - Day label with dot indicator on a vertical line
   - Story cards within each day: edition label, headline, snippet, read time, source count, audio duration badge
   - Cards are clickable, link to article detail

6. **Key data points table**
   - Bordered card
   - Label: "Key data points — Milwaukee housing"
   - Simple two-column rows: label, value
   - All sourced from FRED via KV cache

7. **Follow CTA**
   - Bordered card, flex layout
   - "Follow this topic — get Housing stories in your daily briefing"
   - Follow button (coral background, white text)

---

### Podcast archive ( /podcast )

**Layout**: Single column.

- Episode list grouped by week
- Each episode card: edition type pill, date (serif), duration, segment count
- Embedded audio player per episode
- Subscribe section: Apple Podcasts, Spotify, RSS icons with links

---

### District dashboard ( /district )

**Layout**: Single column with lookup input.

1. **Zip code lookup** — text input + "Look up" button
2. **District result card**
   - District name and number
   - Map placeholder (future: Cloudflare Workers AI generated map)
3. **Representative cards**
   - Photo (from Congress.gov `depiction.imageUrl`), name, party, chamber
   - Recent actions list
   - Voting record summary
4. **Relevant bills** — bills involving district reps, with status badges
5. **Personalized briefing audio** — audio player with district-specific segments

---

## Chart implementation notes

All charts use Chart.js 4.x loaded from CDN. No server-side chart rendering.

**Data flow**: FRED data → KV cache (on each cron cycle) → `/api/data/{topic}` endpoint → Frontend fetch → Chart.js render

**Sparklines in stat cards**:
- Chart.js line chart with all chrome removed (no axes, no grid, no legend, no tooltip)
- 24px tall, responsive width
- Single color line matching the stat's direction (green for up, red for down, or topic color)
- 12 data points (trailing 12 periods of the FRED series)

**Standard line charts**:
- 200px container height, responsive width
- Custom HTML legend above chart (not Chart.js default)
- Grid lines: horizontal only, very light opacity
- Point radius: 2-3px, same color as line
- Tension: 0.2 for slight smoothing
- Y-axis: formatted with units ($, %, x)

**Bar charts**:
- Vertical bars with border-radius: 3
- Auto-skip disabled for ≤12 categories
- Single color, topic-matched

**Dual-axis charts**:
- Left y-axis for primary metric, right y-axis for secondary
- Right axis grid lines hidden (avoid visual noise)
- Two distinct colors for the two series

**Policy annotations**:
- Row below the chart with an info icon
- Text connecting the data trend to a legislative action
- Example: "SB 247 (zoning reform) passed committee March 25, 2026 — may impact future supply"
- This is what makes it data journalism, not just a chart

---

## Responsive behavior

**Desktop** (>768px): Full layouts as designed. 2-column story grid, 4-column stat cards, 2-column chart grid.

**Tablet** (480-768px): Single column story cards, 2-column stat cards, stacked charts.

**Mobile** (<480px): Everything single column. Edition player full width. Stat cards 2x2 grid. Charts full width stacked. Font sizes reduce slightly (headlines 18px, body 15px).

---

## Dark mode

Full dark mode support via CSS variables and `prefers-color-scheme` media queries.

- Background: dark surface
- Text: light tones
- Charts: adjusted grid colors, kept line/bar colors
- Topic labels: shifted to lighter stops of the same color ramp (e.g., Housing blue shifts from `#185FA5` to `#85B7EB`)
- Edition badges: darker background with lighter text (coral shifts)
- Images: no filter (photos should look normal)
- Audio player: coral play button stays coral (brand consistency)

---

## Component library

Built with Tailwind CSS utility classes. Key reusable components:

- `EditionPlayer` — audio player with segment pills
- `StoryCard` — headline + image + topic label + metadata
- `TopicLabel` — colored uppercase label
- `StatCard` — metric value + change indicator + sparkline
- `BillTracker` — structured bill data with status badges
- `ChartCard` — wrapper for Chart.js with title, subtitle, legend, annotation
- `SourceAttribution` — numbered source list
- `LegislatorCard` — photo/initials + name + party + recent action
- `DistrictSummary` — district header + rep list
- `CoveragTimeline` — day-grouped story list with vertical line

---

## Performance targets

- **First Contentful Paint**: < 1.0s (edge-cached via Cloudflare Pages)
- **Largest Contentful Paint**: < 2.0s (hero image lazy loaded, audio not blocking)
- **Chart.js bundle**: ~60KB gzipped, loaded async after initial paint
- **Total page weight**: < 200KB excluding images and audio
- **Image strategy**: Perigon provides `imageUrl` for most articles (from the original publication). Downloaded and stored in R2 on ingestion. Cloudflare Image Resizing serves responsive variants (320w, 640w, 1024w). Fallback to Unsplash/Pexels for articles without Perigon images.

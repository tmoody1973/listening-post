# City Hall Page UX Plan

## The Problem

The City Hall page currently feels like a data dump. We built it from the data sources outward — Legistar matters, CKAN permits, ArcGIS licenses — instead of from the user's needs inward. A Milwaukee resident visiting this page is asking:

1. "What happened at City Hall that affects me?"
2. "Is anything new in my neighborhood?"
3. "Any new restaurants or bars opening?"
4. "What did the mayor or council say?"
5. "What's coming up that I should know about?"

They are NOT asking: "Show me MatterFile 252010 with MatterTypeName Resolution and MatterStatusName In Committee."

## The Fix: Think Like a Newsletter, Not a Database

The page should read like a **daily civic digest** — something you'd scan over coffee. Every item should be in plain language. Every click should lead to a readable article, not a raw data page or a broken Legistar link.

---

## Page Structure (in order of user interest)

### 1. Hero Header
Milwaukee City Hall photo (already done). "CITY HALL — Your Daily Civic Digest" with today's date.

### 2. Today's Top Civic Story
The single most important civic item from today, presented as a headline + 2-sentence summary. Pulled from the highest-tier Legistar item or press release. This is the "above the fold" beat.

Example: "Council Advances $5M Lead Pipe Replacement Fund — The Finance Committee recommended approval of a resolution directing $5 million toward lead lateral replacement, prioritizing homes in Districts 6, 7, and 15."

### 3. New Restaurants & Bars (accordion, 5 shown)
Already built. This stays near the top because it's the most engaging, shareable content. Each entry expands to show Perplexity's blurb + application PDF link.

### 4. From City Hall (Press Releases)
2-column grid of press release cards. Each links to a detail page with a Perplexity-generated summary of the PDF content. Shows the official's name, date, and a 1-2 sentence preview.

### 5. What's Changing (Zoning + Development)
Curated from Legistar: zoning variances, TIF district actions, development agreements, property deconstruction orders. These are the items that directly change neighborhoods. Each shows:
- What it is (plain language, not legislative title)
- Where (address or neighborhood)
- Status badge (approved / in committee / hearing scheduled)
- Click → detail page with Perplexity article

### 6. This Week's Meetings (sidebar on desktop, stacked on mobile)
Calendar-style list of upcoming committee meetings. Key committees (Common Council, Zoning, Licenses, Plan Commission) highlighted. Each shows:
- Committee name
- Date and time
- Location
- Links to agenda PDF, minutes PDF, video

### 7. Legislation by Type
For the policy-engaged users who want to browse everything. Grouped into tabs or sections:
- **Ordinances** — laws being created or changed
- **Resolutions** — council positions and approvals
- **Communications** — reports from city departments
Each shows file number, status badge, plain-language title, sponsor.

---

## Detail Page (`/legislation/[id]`)

When a user clicks ANY civic item, they land on our detail page — never on Legistar. The page shows:

1. **Plain-language headline** (rewritten from legislative title)
2. **Status badge** (color-coded: adopted/committee/introduced)
3. **Info cards**: Sponsor, Committee, Date, Source link
4. **Article body** — Perplexity-generated 3-4 paragraph explanation:
   - What this does
   - Why it matters to Milwaukee residents
   - What happens next
5. **Source documents** — links to agenda PDFs, attachments, Legistar page
6. **Related items** — other legislation on the same topic

The article is generated on-demand (first visit triggers Perplexity) and cached in D1.

---

## Data Pipeline for City Hall

### What We Ingest Daily (3 AM + 1 PM CT):

| Source | What | How |
|--------|------|-----|
| Legistar Events API | Meetings, agendas, minutes | Free, no key |
| Legistar Matters API | Legislation, sponsors, status | Free, no key |
| LIRA Application Search | New restaurant/bar applications | HTML scrape |
| ArcGIS License Layers | Recently granted food/alcohol/entertainment licenses | Free REST |
| Perplexity | Press releases from city.milwaukee.gov | Web search |
| Perplexity | Article generation for each civic item | On-demand |

### What We Filter:
- **Tier 1 bodies** (Common Council, Zoning, Licenses, Plan Commission, etc.) — always show
- **New applications only** (not renewals) — for restaurants
- **Recent items only** — last 7 days for legislation, last 30 days for licenses

### What We Enrich:
- Every civic item gets a Perplexity-generated plain-language summary on first visit
- Restaurant applications get a 2-3 sentence Perplexity blurb
- Press releases get summarized from their PDF content

---

## What's NOT on the City Hall Page

- Raw building permits (no useful context without neighborhood knowledge)
- Tier 3 body meetings (BID boards, architectural review — too niche)
- Renewals (not news)
- Items older than 30 days

---

## Implementation Priority

| Step | What | Time |
|------|------|------|
| 1 | Add "Today's Top Civic Story" hero section | 20 min |
| 2 | Add "What's Changing" section (filter zoning/TIF from legislation) | 30 min |
| 3 | Fix all remaining external Legistar links | 15 min |
| 4 | Improve detail page with better article formatting | 20 min |
| 5 | Add press release PDF fetching via Perplexity | 20 min |
| 6 | Polish typography and spacing | 15 min |

Total: ~2 hours

---

## Success Criteria

A Milwaukee resident should be able to:
1. Open the City Hall page and immediately understand what happened today
2. See new restaurants opening without knowing what LIRA is
3. Understand a zoning change without reading legislative language
4. Click any item and get a readable article — never a broken link
5. Know what meetings are coming up this week and access the agenda

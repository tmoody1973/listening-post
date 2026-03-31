# Perplexity Search + Agent API Upgrade Plan

**Status:** Saved for post-hackathon implementation
**Date:** March 31, 2026

## Overview

Replace the current Perplexity Chat Completions-based news discovery with the Search API + Agent API for better accuracy and no hallucination risk.

## Three APIs Available (same API key)

| API | Endpoint | What it does | Pricing |
|-----|----------|-------------|---------|
| Search API | `POST /v1/search` | Raw web search results — real URLs, titles, snippets. Up to 5 queries batched. | $0.005/search |
| Agent API | `POST /v1/agent` | Multi-model gateway with `web_search` + `fetch_url` tools. Model decides when to search/fetch. | $0.005/search + $0.0005/fetch + token costs |
| Sonar API | `POST /chat/completions` | Current approach — synthesized prose with citations. | Per-token |

## Implementation Plan

### Phase 1: Search API for News Discovery
Replace `discoverNewsViaPerplexity()` with Search API:
```typescript
const search = await client.search.create({
  query: [
    "Milwaukee Wisconsin news today",
    "Wisconsin state legislature bills",
    "Milwaukee economy business hiring layoffs",
    "Milwaukee housing zoning development",
    "national healthcare education policy"
  ],
  max_results: 10,
  max_tokens_per_page: 2048,
  country: "US",
  search_recency_filter: "day",
  search_domain_filter: ["jsonline.com", "urbanmilwaukee.com", "wpr.org", "biztimes.com"]
});
```
- No hallucination risk — real URLs and snippets
- 5 queries batched = one API call covers all topics
- Domain filter ensures trusted local sources

### Phase 2: Agent API for Content Extraction
Use `fetch_url` tool for:
- Press release PDFs from city.milwaukee.gov
- Legistar agenda/minutes content
- Full article text from discovered URLs
- Cost: $0.0005 per fetch

### Phase 3: Agent API for Article Generation
Use cheap model (sonar or gpt-5-mini) with extracted content to generate readable articles with real citations.

## Cost Estimate
- 100 searches/day × $0.005 = $0.50/day = ~$15/month
- 200 fetches/day × $0.0005 = $0.10/day = ~$3/month
- Token costs for summaries = ~$5/month
- **Total: ~$23/month** (vs current approach which risks hallucinated content)

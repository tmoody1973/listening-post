// Cloudflare environment bindings
export interface Env {
  // D1
  DB: D1Database;

  // R2
  MEDIA_BUCKET: R2Bucket;

  // KV
  CONFIG_KV: KVNamespace;

  // Vectorize
  STORY_INDEX: VectorizeIndex;

  // Workers AI
  AI: Ai;

  // Durable Object Agent namespaces
  EPISODE_AGENT: DurableObjectNamespace;
  NEWSROOM_AGENT: DurableObjectNamespace;

  // API keys (from wrangler secrets / .dev.vars)
  CONGRESS_API_KEY: string;
  OPENSTATES_API_KEY: string;
  PERIGON_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  FRED_API_KEY: string;
  UNSPLASH_ACCESS_KEY: string;
  PEXELS_API_KEY: string;
  GEMINI_API_KEY: string;
}

// Story as stored in D1
export interface Story {
  id: string;
  headline: string;
  summary: string | null;
  body: string | null;
  slug: string;
  topic: string;
  source: string;
  source_url: string | null;
  image_url: string | null;
  image_caption: string | null;
  image_attribution: string | null;
  sentiment_positive: number | null;
  sentiment_negative: number | null;
  relevance_score: number | null;
  perigon_cluster_id: string | null;
  edition: string | null;
  episode_id: string | null;
  audio_segment_key: string | null;
  sources_json: string | null;
  bill_data_json: string | null;
  fred_series_id: string | null;
  published_at: string | null;
  created_at: string;
}

// Raw story from ingestion (before D1)
export interface RawStory {
  id: string;
  headline: string;
  summary: string;
  topic: string;
  source: string;
  source_url: string | null;
  image_url: string | null;
  image_caption: string | null;
  image_attribution: string | null;
  sentiment_positive: number | null;
  sentiment_negative: number | null;
  content: string | null;
  perigon_cluster_id: string | null;
}

// Story after triage
export interface TriagedStory extends RawStory {
  relevance_score: number;
  research_package: string | null;
}

// Episode act for Text to Dialogue
export interface DialogueTurn {
  voice: "anchor" | "correspondent" | "district_desk";
  voiceId: string;
  text: string;
}

export interface EpisodeAct {
  id: string;
  title: string;
  dialogue: DialogueTurn[];
  audioR2Key: string | null;
  durationSeconds: number | null;
  status: "pending" | "scripted" | "voiced" | "failed";
}

// Bill as stored in D1
export interface Bill {
  id: string;
  identifier: string;
  title: string;
  summary: string | null;
  status: string | null;
  sponsor_id: string | null;
  sponsor_name: string | null;
  topic: string | null;
  source: string;
  source_url: string | null;
  actions_json: string | null;
  last_action: string | null;
  last_action_date: string | null;
}

// Legislator as stored in D1
export interface Legislator {
  id: string;
  name: string;
  party: string | null;
  chamber: string | null;
  state: string;
  district: string | null;
  image_url: string | null;
  source: string;
}

// FRED observation
export interface FredObservation {
  series_id: string;
  date: string;
  value: number | null;
}

// FRED series metadata
export interface FredSeries {
  id: string;
  title: string;
  frequency: string;
  units: string;
  topic: string;
}

// The 16 FRED series we track
export const FRED_SERIES: FredSeries[] = [
  // Housing
  { id: "ATNHPIUS33340Q", title: "Milwaukee MSA Median Home Price", frequency: "quarterly", units: "$", topic: "housing" },
  { id: "BPPRIV255079", title: "Milwaukee County Building Permits", frequency: "monthly", units: "permits", topic: "housing" },
  { id: "WUSTHPI", title: "Wisconsin House Price Index", frequency: "quarterly", units: "index", topic: "housing" },
  { id: "WIHOWN", title: "Wisconsin Homeownership Rate", frequency: "quarterly", units: "%", topic: "housing" },
  { id: "CUURS23ASAH", title: "CPI Midwest Housing", frequency: "monthly", units: "index", topic: "housing" },
  { id: "RRVRUSQ156N", title: "US Rental Vacancy Rate", frequency: "quarterly", units: "%", topic: "housing" },
  // Economy
  { id: "MILK555URN", title: "Milwaukee Unemployment Rate", frequency: "monthly", units: "%", topic: "economy" },
  { id: "WINGSP", title: "Wisconsin Gross State Product", frequency: "quarterly", units: "$M", topic: "economy" },
  { id: "MILV526PCPI", title: "Milwaukee MSA Per Capita Income", frequency: "annual", units: "$", topic: "economy" },
  { id: "ENUC334030010", title: "Milwaukee MSA Avg Weekly Wage", frequency: "quarterly", units: "$", topic: "economy" },
  { id: "LAUMT553334000000003", title: "Milwaukee Employment Level", frequency: "monthly", units: "persons", topic: "economy" },
  { id: "SMU55334000500000001", title: "Milwaukee Private Employment", frequency: "monthly", units: "K persons", topic: "economy" },
  { id: "CUURS23ASA0", title: "CPI Midwest Urban Consumers", frequency: "monthly", units: "index", topic: "economy" },
  // Transit
  { id: "CUURS23ASAT", title: "CPI Midwest Transportation", frequency: "monthly", units: "index", topic: "transit" },
  // Demographics
  { id: "S1701ACS055079", title: "Milwaukee County Poverty Rate", frequency: "annual", units: "%", topic: "economy" },
  { id: "WIGINIALLH", title: "Wisconsin Gini Index", frequency: "annual", units: "index", topic: "economy" },
];

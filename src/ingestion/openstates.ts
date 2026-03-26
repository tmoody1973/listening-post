import type { Env, RawStory } from "../types";

const OPENSTATES_BASE = "https://v3.openstates.org";

function n(v: unknown): string | number | null {
  return v === undefined || v === "" ? null : v as string | number | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function mapBillTopic(title: string, subjects: string[]): string {
  const text = `${title} ${subjects.join(" ")}`.toLowerCase();

  if (text.includes("housing") || text.includes("zoning") || text.includes("landlord") || text.includes("rent") || text.includes("mortgage")) return "housing";
  if (text.includes("education") || text.includes("school") || text.includes("university") || text.includes("student")) return "education";
  if (text.includes("transit") || text.includes("transport") || text.includes("highway") || text.includes("road") || text.includes("rail")) return "transit";
  if (text.includes("crime") || text.includes("police") || text.includes("gun") || text.includes("safety") || text.includes("prison")) return "safety";
  if (text.includes("health") || text.includes("hospital") || text.includes("medicaid") || text.includes("drug") || text.includes("mental")) return "health";
  if (text.includes("environment") || text.includes("climate") || text.includes("water") || text.includes("energy") || text.includes("pollution")) return "environment";

  return "economy";
}

// ─── Types ──────────────────────────────────────────────────

interface OpenStatesBill {
  id: string;
  identifier: string;
  title: string;
  updated_at: string;
  created_at: string;
  classification: string[];
  subject: string[];
  openstates_url: string;
  latest_action_date: string | null;
  latest_action_description: string | null;
  sponsorships?: {
    name: string;
    classification: string;
    entity_type: string;
  }[];
  abstracts?: {
    abstract: string;
  }[];
}

interface OpenStatesPerson {
  id: string;
  name: string;
  party: string;
  current_role: {
    title: string;
    org_classification: string;
    district: string;
    division_id: string | null;
  } | null;
  image: string;
  openstates_url: string;
}

interface PaginatedResponse<T> {
  results: T[];
  pagination: {
    per_page: number;
    page: number;
    max_page: number;
    total_items: number;
  };
}

// ─── API Helpers ────────────────────────────────────────────

async function openstatesFetch<T>(path: string, apiKey: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${OPENSTATES_BASE}${path}${separator}apikey=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenStates API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

// ─── Bills ──────────────────────────────────────────────────

async function ingestWisconsinBills(env: Env): Promise<RawStory[]> {
  console.log("[OpenStates] Fetching Wisconsin bills...");

  const data = await openstatesFetch<PaginatedResponse<OpenStatesBill>>(
    "/bills?jurisdiction=Wisconsin&sort=updated_desc&per_page=20&include=sponsorships&include=abstracts",
    env.OPENSTATES_API_KEY
  );

  const stories: RawStory[] = [];

  for (const bill of data.results) {
    const id = `openstates-${bill.id}`;
    const topic = mapBillTopic(bill.title, bill.subject ?? []);
    const sponsor = bill.sponsorships?.[0]?.name ?? null;
    const summary = bill.abstracts?.[0]?.abstract ?? bill.latest_action_description ?? "";

    // Store in bills table
    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO bills (id, identifier, title, summary, status, sponsor_name, topic, source, source_url, last_action, last_action_date, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        id,
        bill.identifier,
        bill.title,
        n(summary),
        n(bill.latest_action_description),
        n(sponsor),
        topic,
        "openstates",
        n(bill.openstates_url),
        n(bill.latest_action_description),
        n(bill.latest_action_date),
      ).run();
    } catch (error) {
      console.error(`[OpenStates] Failed to store bill ${bill.identifier}:`, error);
    }

    stories.push({
      id,
      headline: `WI ${bill.identifier}: ${bill.title}`,
      summary,
      topic,
      source: "openstates",
      source_url: bill.openstates_url ?? null,
      image_url: null,
      image_caption: null,
      image_attribution: "OpenStates",
      sentiment_positive: null,
      sentiment_negative: null,
      content: bill.abstracts?.[0]?.abstract ?? null,
      perigon_cluster_id: null,
    });
  }

  console.log(`[OpenStates] Ingested ${stories.length} Wisconsin bills`);
  return stories;
}

// ─── Legislators ────────────────────────────────────────────

async function ingestWisconsinLegislators(env: Env): Promise<void> {
  console.log("[OpenStates] Fetching Wisconsin legislators...");

  for (const chamber of ["upper", "lower"] as const) {
    try {
      const data = await openstatesFetch<PaginatedResponse<OpenStatesPerson>>(
        `/people?jurisdiction=Wisconsin&org_classification=${chamber}&per_page=150`,
        env.OPENSTATES_API_KEY
      );

      const chamberName = chamber === "upper" ? "state_senate" : "state_assembly";

      for (const person of data.results) {
        const district = person.current_role?.district ?? null;

        await env.DB.prepare(
          `INSERT OR REPLACE INTO legislators (id, name, party, chamber, state, district, image_url, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          person.id,
          person.name,
          n(person.party),
          chamberName,
          "WI",
          n(district),
          n(person.image),
          "openstates",
        ).run();
      }

      console.log(`[OpenStates] Stored ${data.results.length} ${chamberName} members`);
    } catch (error) {
      console.error(`[OpenStates] ${chamber} chamber error:`, error);
    }
  }
}

// ─── Main Export ─────────────────────────────────────────────

export async function ingestFromOpenStates(env: Env): Promise<RawStory[]> {
  const results = await Promise.allSettled([
    ingestWisconsinBills(env),
    ingestWisconsinLegislators(env),
  ]);

  const allStories: RawStory[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      allStories.push(...result.value);
    } else if (result.status === "rejected") {
      console.error("[OpenStates] Subtask failed:", result.reason);
    }
  }

  // Store stories in D1
  let stored = 0;
  for (const story of allStories) {
    try {
      const slug = slugify(story.headline);
      await env.DB.prepare(
        `INSERT OR IGNORE INTO stories (id, headline, summary, slug, topic, source, source_url, image_attribution, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        story.id,
        story.headline,
        n(story.summary),
        slug,
        story.topic,
        story.source,
        n(story.source_url),
        "OpenStates",
      ).run();
      stored++;
    } catch (error) {
      console.error(`[OpenStates] Failed to store story: ${story.headline}`, error);
    }
  }

  console.log(`[OpenStates] Total: ${stored}/${allStories.length} stories stored`);
  return allStories;
}

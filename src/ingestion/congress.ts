import type { Env, RawStory } from "../types";

const CONGRESS_BASE = "https://api.congress.gov/v3";

// ─── Types ──────────────────────────────────────────────────

interface CongressBill {
  congress: number;
  type: string;
  number: string;
  title: string;
  updateDate: string;
  url: string;
  latestAction?: {
    actionDate: string;
    text: string;
  };
}

interface CongressMember {
  bioguideId: string;
  name: string;
  partyName: string;
  state: string;
  district?: number;
  depiction?: {
    imageUrl: string;
  };
  terms?: { item: { chamber: string }[] };
}

interface CongressVote {
  rollCallNumber: number;
  congress: number;
  session: number;
  date: string;
  question: string;
  result: string;
  url: string;
}

// ─── Helpers ────────────────────────────────────────────────

function n(v: unknown): string | number | null {
  return v === undefined || v === "" ? null : v as string | number | null;
}

async function congressFetch(path: string, apiKey: string): Promise<unknown> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${CONGRESS_BASE}${path}${separator}format=json&api_key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Congress API ${response.status}: ${text}`);
  }

  return response.json();
}

function toHumanUrl(bill: CongressBill): string {
  // Convert "HR" -> "house-bill", "S" -> "senate-bill", etc.
  const typeMap: Record<string, string> = {
    hr: "house-bill",
    s: "senate-bill",
    hjres: "house-joint-resolution",
    sjres: "senate-joint-resolution",
    hconres: "house-concurrent-resolution",
    sconres: "senate-concurrent-resolution",
    hres: "house-resolution",
    sres: "senate-resolution",
  };
  const slug = typeMap[bill.type.toLowerCase()] ?? bill.type.toLowerCase();
  return `https://www.congress.gov/bill/${bill.congress}th-congress/${slug}/${bill.number}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function mapBillTopic(title: string, policyArea?: string): string {
  const text = `${title} ${policyArea ?? ""}`.toLowerCase();

  if (text.includes("housing") || text.includes("zoning") || text.includes("mortgage") || text.includes("rent")) return "housing";
  if (text.includes("education") || text.includes("school") || text.includes("student")) return "education";
  if (text.includes("transit") || text.includes("transport") || text.includes("highway") || text.includes("rail")) return "transit";
  if (text.includes("crime") || text.includes("police") || text.includes("gun") || text.includes("safety")) return "safety";
  if (text.includes("health") || text.includes("medicare") || text.includes("medicaid") || text.includes("drug")) return "health";
  if (text.includes("environment") || text.includes("climate") || text.includes("energy") || text.includes("water")) return "environment";

  return "economy";
}

// ─── Ingestion Functions ────────────────────────────────────

async function ingestRecentBills(env: Env): Promise<RawStory[]> {
  console.log("[Congress] Fetching recent bills...");
  const data = await congressFetch("/bill?limit=20&sort=updateDate+desc", env.CONGRESS_API_KEY) as {
    bills: CongressBill[];
  };

  const stories: RawStory[] = [];

  for (const bill of data.bills ?? []) {
    const identifier = `${bill.type.toUpperCase()}.${bill.number}`;
    const id = `congress-bill-${bill.congress}-${bill.type}-${bill.number}`;
    const topic = mapBillTopic(bill.title);

    // Store in bills table
    await env.DB.prepare(
      `INSERT OR REPLACE INTO bills (id, identifier, title, status, topic, source, source_url, last_action, last_action_date, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      id,
      identifier,
      bill.title,
      n(bill.latestAction?.text),
      topic,
      "congress",
      n(toHumanUrl(bill)),
      n(bill.latestAction?.text),
      n(bill.latestAction?.actionDate),
    ).run();

    // Also create a story for the pipeline
    stories.push({
      id,
      headline: `${identifier}: ${bill.title}`,
      summary: bill.latestAction?.text ?? "",
      topic,
      source: "congress",
      source_url: toHumanUrl(bill),
      image_url: null,
      image_caption: null,
      image_attribution: "Congress.gov",
      sentiment_positive: null,
      sentiment_negative: null,
      content: null,
      perigon_cluster_id: null,
    });
  }

  console.log(`[Congress] Ingested ${stories.length} bills`);
  return stories;
}

async function ingestWisconsinMembers(env: Env): Promise<void> {
  console.log("[Congress] Fetching Wisconsin members...");
  const data = await congressFetch("/member?stateCode=WI&limit=20", env.CONGRESS_API_KEY) as {
    members: CongressMember[];
  };

  for (const member of data.members ?? []) {
    const chamber = member.terms?.item?.[0]?.chamber?.toLowerCase() ?? "unknown";
    await env.DB.prepare(
      `INSERT OR REPLACE INTO legislators (id, name, party, chamber, state, district, image_url, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      member.bioguideId,
      member.name,
      n(member.partyName),
      chamber,
      "WI",
      n(member.district?.toString()),
      n(member.depiction?.imageUrl),
      "congress",
    ).run();
  }

  console.log(`[Congress] Stored ${(data.members ?? []).length} WI members`);
}

async function ingestFloorActions(env: Env): Promise<RawStory[]> {
  console.log("[Congress] Fetching floor actions...");
  const stories: RawStory[] = [];

  // House communications
  try {
    const houseData = await congressFetch("/house-communication?limit=10", env.CONGRESS_API_KEY) as {
      houseCommunications?: { item: string; chamber: string; communicationDate: string; url: string }[];
    };

    for (const item of houseData.houseCommunications ?? []) {
      const id = `congress-floor-house-${slugify(String(item))}`.slice(0, 100);
      await env.DB.prepare(
        `INSERT OR IGNORE INTO floor_actions (id, chamber, date, action_type, description, source_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(id, "house", new Date().toISOString().split("T")[0], "communication", String(item), null).run();
    }
  } catch (error) {
    console.error("[Congress] House communications error:", error);
  }

  // Senate communications
  try {
    const senateData = await congressFetch("/senate-communication?limit=10", env.CONGRESS_API_KEY) as {
      senateCommunications?: unknown[];
    };

    for (const item of senateData.senateCommunications ?? []) {
      const id = `congress-floor-senate-${slugify(String(item))}`.slice(0, 100);
      await env.DB.prepare(
        `INSERT OR IGNORE INTO floor_actions (id, chamber, date, action_type, description, source_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(id, "senate", new Date().toISOString().split("T")[0], "communication", String(item), null).run();
    }
  } catch (error) {
    console.error("[Congress] Senate communications error:", error);
  }

  console.log("[Congress] Floor actions ingested");
  return stories;
}

async function ingestCongressionalRecord(env: Env): Promise<void> {
  console.log("[Congress] Fetching Congressional Record...");
  try {
    const data = await congressFetch("/congressional-record?limit=5", env.CONGRESS_API_KEY) as {
      Results?: { Issues?: { Issue?: unknown[] } };
    };

    const issues = data.Results?.Issues?.Issue ?? [];
    for (const issue of issues) {
      const rec = issue as { volumeNumber?: number; issueNumber?: string; publishDate?: string; url?: string; links?: { fullRecordLink?: string } };
      const id = `record-${rec.volumeNumber}-${rec.issueNumber}`;

      await env.DB.prepare(
        `INSERT OR IGNORE INTO congressional_record (id, date, volume, issue_number, section, title, description, url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        id,
        n(rec.publishDate),
        n(rec.volumeNumber),
        n(rec.issueNumber),
        "dailydigest",
        `Congressional Record Vol. ${rec.volumeNumber}, No. ${rec.issueNumber}`,
        null,
        n(rec.links?.fullRecordLink ?? rec.url),
      ).run();
    }

    console.log(`[Congress] Stored ${issues.length} Congressional Record issues`);
  } catch (error) {
    console.error("[Congress] Congressional Record error:", error);
  }
}

async function ingestPresidentialActions(env: Env): Promise<RawStory[]> {
  console.log("[Congress] Fetching bills at president's desk...");
  const stories: RawStory[] = [];

  try {
    // Get recent bills and filter for presidential actions
    const data = await congressFetch("/bill?limit=20&sort=updateDate+desc", env.CONGRESS_API_KEY) as {
      bills: CongressBill[];
    };

    for (const bill of data.bills ?? []) {
      const actionText = bill.latestAction?.text?.toLowerCase() ?? "";
      const isPresidential = actionText.includes("presented to president") ||
                             actionText.includes("signed by president") ||
                             actionText.includes("became public law") ||
                             actionText.includes("vetoed");

      if (!isPresidential) continue;

      const identifier = `${bill.type.toUpperCase()}.${bill.number}`;
      const id = `presidential-${bill.congress}-${bill.type}-${bill.number}`;

      let status = "presented";
      if (actionText.includes("signed") || actionText.includes("public law")) status = "signed";
      if (actionText.includes("vetoed")) status = "vetoed";

      await env.DB.prepare(
        `INSERT OR REPLACE INTO presidential_actions (id, bill_identifier, title, date_presented, status, congress, source_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        id,
        identifier,
        bill.title,
        n(bill.latestAction?.actionDate),
        status,
        bill.congress,
        n(bill.url),
      ).run();

      stories.push({
        id,
        headline: `${status === "signed" ? "Signed into law" : status === "vetoed" ? "Vetoed" : "Presented to President"}: ${identifier} — ${bill.title}`,
        summary: bill.latestAction?.text ?? "",
        topic: mapBillTopic(bill.title),
        source: "congress",
        source_url: bill.url ?? null,
        image_url: null,
        image_caption: null,
        image_attribution: "Congress.gov",
        sentiment_positive: null,
        sentiment_negative: null,
        content: null,
        perigon_cluster_id: null,
      });
    }

    console.log(`[Congress] Found ${stories.length} presidential actions`);
  } catch (error) {
    console.error("[Congress] Presidential actions error:", error);
  }

  return stories;
}

// ─── Main Export ─────────────────────────────────────────────

export async function ingestFromCongress(env: Env): Promise<RawStory[]> {
  const results = await Promise.allSettled([
    ingestRecentBills(env),
    ingestWisconsinMembers(env),
    ingestFloorActions(env),
    ingestCongressionalRecord(env),
    ingestPresidentialActions(env),
  ]);

  const allStories: RawStory[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      allStories.push(...result.value);
    } else if (result.status === "rejected") {
      console.error("[Congress] Ingestion subtask failed:", result.reason);
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
        "Congress.gov",
      ).run();
      stored++;
    } catch (error) {
      console.error(`[Congress] Failed to store: ${story.headline}`, error);
    }
  }

  console.log(`[Congress] Total: ${stored}/${allStories.length} stories stored in D1`);
  return allStories;
}

import type { Env } from "../types";

const LEGISTAR_BASE = "https://webapi.legistar.com/v1/milwaukee";
const CKAN_BASE = "https://data.milwaukee.gov/api/3/action";
const PERPLEXITY_BASE = "https://api.perplexity.ai";

const CKAN_RESOURCES = {
  BUILDING_PERMITS: "828e9630-d7cb-42e4-960e-964eae916397",
};

const TIER_1_BODIES = [
  "COMMON COUNCIL", "LICENSES COMMITTEE", "ZONING, NEIGHBORHOODS & DEVELOPMENT",
  "CITY PLAN COMMISSION", "BOARD OF ZONING APPEALS", "COMMUNITY & ECONOMIC DEVELOPMENT COMMITTEE",
  "FIRE AND POLICE COMMISSION", "FINANCE & PERSONNEL COMMITTEE",
  "BOARD OF HEALTH", "HOUSING AUTHORITY",
];

function n(v: unknown): string | number | null {
  return v === undefined || v === "" ? null : v as string | number | null;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ─── Legistar: Meetings + Legislation + Votes ──────────────

async function legistarFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${LEGISTAR_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Legistar ${response.status}`);
  return response.json() as Promise<T>;
}

async function ingestMeetings(env: Env): Promise<number> {
  console.log("[Civic] Fetching upcoming meetings...");

  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const events = await legistarFetch<any[]>(
    `/events?$filter=EventDate ge datetime'${isoDate(past)}' and EventDate lt datetime'${isoDate(future)}'&$orderby=EventDate desc&$top=30`
  );

  let stored = 0;
  for (const event of events) {
    const bodyName = event.EventBodyName ?? "";
    const tier = TIER_1_BODIES.includes(bodyName.toUpperCase()) ? 1 : 2;
    const id = `legistar-event-${event.EventId}`;

    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO civic_items (id, type, title, summary, date, source, source_url, category, body_name, location, agenda_url, minutes_url, video_url, tier, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        id, "meeting",
        `${bodyName} Meeting`,
        `${bodyName} meeting at ${event.EventLocation ?? "City Hall"}. ${event.EventAgendaStatusName === "Final" ? "Agenda published." : "Agenda pending."}`,
        n(event.EventDate?.split("T")[0]),
        "legistar",
        n(event.EventInSiteURL),
        bodyName.toLowerCase().includes("zoning") ? "zoning" :
          bodyName.toLowerCase().includes("license") ? "licenses" :
          bodyName.toLowerCase().includes("police") || bodyName.toLowerCase().includes("fire") ? "safety" :
          "council",
        n(bodyName),
        n(event.EventLocation),
        n(event.EventAgendaFile),
        n(event.EventMinutesFile),
        n(event.EventVideoPath),
        tier,
      ).run();
      stored++;
    } catch (error) {
      console.error(`[Civic] Meeting store failed:`, error);
    }
  }

  console.log(`[Civic] Stored ${stored} meetings`);
  return stored;
}

async function ingestLegislation(env: Env): Promise<number> {
  console.log("[Civic] Fetching recent legislation...");

  // Get most recently modified legislation — last 7 days, newest first
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const matters = await legistarFetch<any[]>(
    `/matters?$filter=MatterLastModifiedUtc ge datetime'${since.toISOString()}'&$orderby=MatterLastModifiedUtc desc&$top=50`
  );

  let stored = 0;
  for (const matter of matters) {
    const id = `legistar-matter-${matter.MatterId}`;

    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO civic_items (id, type, title, summary, date, source, source_url, category, matter_file, matter_type, matter_status, sponsor_name, tier, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        id, "legislation",
        matter.MatterTitle ?? matter.MatterName ?? "Untitled",
        `${matter.MatterTypeName ?? "Item"} ${matter.MatterFile ?? ""} — ${matter.MatterStatusName ?? "Pending"}. Sponsored by ${matter.MatterSponsorName ?? "N/A"}.`,
        n(matter.MatterIntroDate?.split("T")[0] ?? isoDate(new Date())),
        "legistar",
        n(matter.MatterGuid ? `https://milwaukee.legistar.com/LegislationDetail.aspx?ID=${matter.MatterId}&GUID=${matter.MatterGuid}` : null),
        matter.MatterTypeName?.toLowerCase().includes("ordinance") ? "zoning" :
          matter.MatterTypeName?.toLowerCase().includes("resolution") ? "council" : "council",
        n(matter.MatterFile),
        n(matter.MatterTypeName),
        n(matter.MatterStatusName),
        n(matter.MatterSponsorName),
        1,
      ).run();
      stored++;
    } catch (error) {
      console.error(`[Civic] Legislation store failed:`, error);
    }
  }

  console.log(`[Civic] Stored ${stored} legislation items`);
  return stored;
}

// ─── CKAN: Building Permits ─────────────────────────────────

async function ingestPermits(env: Env): Promise<number> {
  console.log("[Civic] Fetching building permits...");

  try {
    const response = await fetch(
      `${CKAN_BASE}/datastore_search?resource_id=${CKAN_RESOURCES.BUILDING_PERMITS}&limit=30&sort=_id desc`
    );
    if (!response.ok) throw new Error(`CKAN ${response.status}`);

    const data = await response.json() as { success: boolean; result: { records: any[] } };
    if (!data.success) throw new Error("CKAN returned false");

    const records = data.result.records ?? [];
    let stored = 0;

    for (const record of records) {
      const id = `ckan-permit-${record._id}`;
      const address = record["Address"] ?? "Unknown location";
      const permitType = record["Permit Type"] ?? "Building permit";
      const cost = record["Construction Total Cost"];
      const useOfBuilding = record["Use of Building"];
      const dateIssued = record["Date Issued"] ?? record["Date Opened"];

      try {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO civic_items (id, type, title, summary, date, source, category, address, applicant, permit_type, tier, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          id, "permit",
          `${permitType}`,
          `${permitType} at ${address}${cost && cost !== "0.00" ? ` — $${Number(cost).toLocaleString()}` : ""}${useOfBuilding ? ` (${useOfBuilding})` : ""}`,
          n(dateIssued?.split("T")[0] ?? dateIssued?.split(" ")[0] ?? isoDate(new Date())),
          "ckan",
          "permits",
          n(address),
          n(record["Record ID"]),
          n(permitType),
          3,
        ).run();
        stored++;
      } catch { /* ignore dupes */ }
    }

    console.log(`[Civic] Stored ${stored} permits`);
    return stored;
  } catch (error) {
    console.error("[Civic] Permits failed:", error);
    return 0;
  }
}

// ─── Press Releases via Perplexity ──────────────────────────

async function ingestPressReleases(env: Env): Promise<number> {
  console.log("[Civic] Fetching press releases via Perplexity...");

  try {
    const response = await fetch(`${PERPLEXITY_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `Extract recent Milwaukee city government press releases and official communications. Return a JSON array: [{"title": "...", "summary": "...", "author": "official name", "date": "YYYY-MM-DD", "source_url": "..."}]. Only items from the last 7 days. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: "Milwaukee Common Council press releases, Mayor Cavalier Johnson announcements, Milwaukee alderperson statements this week site:city.milwaukee.gov",
          },
        ],
        search_recency_filter: "week",
        web_search_options: {
          search_context_size: "medium",
          user_location: { latitude: 43.0389, longitude: -87.9065, country: "US" },
        },
        temperature: 0.1,
      }),
    });

    if (!response.ok) throw new Error(`Perplexity ${response.status}`);

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return 0;

    const releases = JSON.parse(jsonMatch[0]) as { title: string; summary: string; author: string; date: string; source_url: string }[];
    let stored = 0;

    for (const pr of releases) {
      const slug = pr.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
      const id = `press-${slug}`;

      try {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO civic_items (id, type, title, summary, date, source, source_url, category, sponsor_name, tier, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          id, "press_release",
          pr.title,
          n(pr.summary),
          n(pr.date ?? isoDate(new Date())),
          "scrape",
          n(pr.source_url),
          pr.author?.toLowerCase().includes("mayor") ? "mayor" : "press_release",
          n(pr.author),
          1,
        ).run();
        stored++;
      } catch { /* ignore dupes */ }
    }

    console.log(`[Civic] Stored ${stored} press releases`);
    return stored;
  } catch (error) {
    console.error("[Civic] Press releases failed:", error);
    return 0;
  }
}

// ─── Main Export ─────────────────────────────────────────────

export async function ingestCivicData(env: Env): Promise<{
  meetings: number;
  legislation: number;
  permits: number;
  pressReleases: number;
}> {
  console.log("[Civic] Starting civic data ingestion...");

  const results = await Promise.allSettled([
    ingestMeetings(env),
    ingestLegislation(env),
    ingestPermits(env),
    ingestPressReleases(env),
  ]);

  const counts = {
    meetings: results[0].status === "fulfilled" ? results[0].value : 0,
    legislation: results[1].status === "fulfilled" ? results[1].value : 0,
    permits: results[2].status === "fulfilled" ? results[2].value : 0,
    pressReleases: results[3].status === "fulfilled" ? results[3].value : 0,
  };

  const total = counts.meetings + counts.legislation + counts.permits + counts.pressReleases;
  console.log(`[Civic] Complete: ${total} civic items (${counts.meetings} meetings, ${counts.legislation} legislation, ${counts.permits} permits, ${counts.pressReleases} press releases)`);

  return counts;
}

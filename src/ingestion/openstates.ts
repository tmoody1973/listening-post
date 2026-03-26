import type { Env, RawStory } from "../types";

const OPENSTATES_BASE = "https://v3.openstates.org/graphql";

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

interface GraphQLBillNode {
  id: string;
  identifier: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  classification: string[];
  subject: string[];
  openstatesUrl: string;
  latestAction: {
    description: string;
    date: string;
    classification: string[];
  } | null;
  sponsors: {
    name: string;
    classification: string;
  }[];
  abstracts: {
    abstract: string;
  }[];
}

interface GraphQLPersonNode {
  id: string;
  name: string;
  party: {
    name: string;
  } | null;
  currentMemberships: {
    post: {
      label: string;
      division: {
        name: string;
      } | null;
    } | null;
    organization: {
      name: string;
      classification: string;
    };
  }[];
  image: string;
}

async function graphqlFetch(query: string, apiKey: string): Promise<unknown> {
  const response = await fetch(OPENSTATES_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenStates API ${response.status}: ${text}`);
  }

  const result = await response.json() as { data?: unknown; errors?: { message: string }[] };
  if (result.errors) {
    throw new Error(`OpenStates GraphQL: ${result.errors.map((e) => e.message).join(", ")}`);
  }

  return result.data;
}

async function ingestWisconsinBills(env: Env): Promise<RawStory[]> {
  console.log("[OpenStates] Fetching Wisconsin bills...");

  const query = `{
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
          }
          abstracts {
            abstract
          }
        }
      }
    }
  }`;

  const data = await graphqlFetch(query, env.OPENSTATES_API_KEY) as {
    bills: { edges: { node: GraphQLBillNode }[] };
  };

  const stories: RawStory[] = [];
  const bills = data.bills?.edges ?? [];

  for (const { node: bill } of bills) {
    const id = `openstates-${bill.id}`;
    const topic = mapBillTopic(bill.title, bill.subject ?? []);
    const sponsor = bill.sponsors?.[0]?.name ?? null;
    const summary = bill.abstracts?.[0]?.abstract ?? bill.latestAction?.description ?? "";

    // Store in bills table
    await env.DB.prepare(
      `INSERT OR REPLACE INTO bills (id, identifier, title, summary, status, sponsor_name, topic, source, source_url, last_action, last_action_date, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      id,
      bill.identifier,
      bill.title,
      n(summary),
      n(bill.latestAction?.description),
      n(sponsor),
      topic,
      "openstates",
      n(bill.openstatesUrl),
      n(bill.latestAction?.description),
      n(bill.latestAction?.date),
    ).run();

    // Create story for the pipeline
    stories.push({
      id,
      headline: `WI ${bill.identifier}: ${bill.title}`,
      summary,
      topic,
      source: "openstates",
      source_url: bill.openstatesUrl ?? null,
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

async function ingestWisconsinLegislators(env: Env): Promise<void> {
  console.log("[OpenStates] Fetching Wisconsin legislators...");

  for (const chamber of ["Wisconsin State Senate", "Wisconsin State Assembly"]) {
    const query = `{
      people(
        jurisdiction: "Wisconsin"
        first: 150
        memberOf: "${chamber}"
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
          }
        }
      }
    }`;

    try {
      const data = await graphqlFetch(query, env.OPENSTATES_API_KEY) as {
        people: { edges: { node: GraphQLPersonNode }[] };
      };

      const people = data.people?.edges ?? [];
      const chamberShort = chamber.includes("Senate") ? "state_senate" : "state_assembly";

      for (const { node: person } of people) {
        const district = person.currentMemberships?.[0]?.post?.label ?? null;

        await env.DB.prepare(
          `INSERT OR REPLACE INTO legislators (id, name, party, chamber, state, district, image_url, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          person.id,
          person.name,
          n(person.party?.name),
          chamberShort,
          "WI",
          n(district),
          n(person.image),
          "openstates",
        ).run();
      }

      console.log(`[OpenStates] Stored ${people.length} ${chamberShort} members`);
    } catch (error) {
      console.error(`[OpenStates] ${chamber} error:`, error);
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
      console.error(`[OpenStates] Failed to store: ${story.headline}`, error);
    }
  }

  console.log(`[OpenStates] Total: ${stored}/${allStories.length} stories stored`);
  return allStories;
}

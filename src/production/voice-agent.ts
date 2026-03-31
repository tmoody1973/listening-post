import type { Env } from "../types";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

// Kesha's voice — our capitol reporter
const CORRESPONDENT_VOICE_ID = "RILOU7YmBhvwJGDGjNmP";

export async function getOrCreateArticleAgent(
  env: Env,
  articleId: string,
  headline: string,
  body: string,
  topic: string,
  source: string
): Promise<{ agentId: string; signedUrl: string }> {
  // Check if agent already exists for this article
  const cached = await env.CONFIG_KV.get(`agent:${articleId}`);
  if (cached) {
    const { agentId } = JSON.parse(cached);
    // Get fresh signed URL
    const signedUrl = await getSignedUrl(env, agentId);
    return { agentId, signedUrl };
  }

  // Build knowledge document from article + related data
  const knowledge = await buildKnowledge(env, articleId, headline, body, topic);

  // Create the agent
  const agentId = await createAgent(env, headline, topic, knowledge);

  // Get signed URL for widget
  const signedUrl = await getSignedUrl(env, agentId);

  // Cache agent ID
  await env.CONFIG_KV.put(`agent:${articleId}`, JSON.stringify({ agentId }), {
    expirationTtl: 86400 * 7, // 7 day cache
  });

  return { agentId, signedUrl };
}

async function buildKnowledge(
  env: Env,
  articleId: string,
  headline: string,
  body: string,
  topic: string
): Promise<string> {
  const sections: string[] = [];

  sections.push(`# ${headline}\n`);
  sections.push(`Topic: ${topic}`);
  sections.push(`\n## Article\n${body}\n`);

  // Add related legislation
  try {
    const bills = await env.DB.prepare(
      "SELECT identifier, title, status, sponsor_name, last_action FROM bills WHERE topic = ? ORDER BY updated_at DESC LIMIT 5"
    ).bind(topic).all();

    if (bills.results && bills.results.length > 0) {
      sections.push("\n## Related Legislation\n");
      for (const bill of bills.results as any[]) {
        sections.push(`- ${bill.identifier}: ${bill.title}`);
        if (bill.status) sections.push(`  Status: ${bill.status}`);
        if (bill.sponsor_name) sections.push(`  Sponsor: ${bill.sponsor_name}`);
      }
    }
  } catch { /* ignore */ }

  // Add FRED data context
  try {
    const { FRED_SERIES } = await import("../types");
    const topicSeries = FRED_SERIES.filter(s => s.topic === topic);
    if (topicSeries.length > 0) {
      sections.push("\n## Economic Data\n");
      for (const series of topicSeries) {
        const cached = await env.CONFIG_KV.get(`fred:${series.id}`, "json") as any;
        if (cached) {
          sections.push(`- ${cached.title}: ${cached.latestValue} ${series.units} (${cached.latestDate})`);
          if (cached.changePercent) sections.push(`  Change: ${cached.changePercent > 0 ? "+" : ""}${cached.changePercent.toFixed(1)}%`);
        }
      }
    }
  } catch { /* ignore */ }

  // Add civic items
  try {
    const civic = await env.DB.prepare(
      "SELECT title, summary, type, date FROM civic_items WHERE category = ? OR type = 'meeting' ORDER BY date DESC LIMIT 5"
    ).bind(topic).all();

    if (civic.results && civic.results.length > 0) {
      sections.push("\n## Recent City Hall Activity\n");
      for (const item of civic.results as any[]) {
        sections.push(`- ${item.title} (${item.date})`);
        if (item.summary) sections.push(`  ${(item.summary as string).slice(0, 100)}`);
      }
    }
  } catch { /* ignore */ }

  return sections.join("\n");
}

async function createAgent(
  env: Env,
  headline: string,
  topic: string,
  knowledge: string
): Promise<string> {
  const prompt = `You are Kesha, a Milwaukee civic affairs correspondent for The Listening Post. You just covered this story and the reader wants to ask you about it.

PERSONALITY:
- Knowledgeable and approachable, like a beat reporter who knows every block in Milwaukee
- You explain civic processes in plain language — no jargon
- You cite specific data when available
- You have a public radio sensibility — thoughtful, fair, curious

GROUNDING RULES:
- Answer from your knowledge base first
- If you don't know, say so honestly
- When citing data, mention the source naturally
- Keep responses concise — 2-3 sentences for simple questions
- Format for speech: spell out numbers and abbreviations

ARTICLE KNOWLEDGE:
${knowledge}`;

  // Create agent via ElevenLabs API
  const response = await fetch(`${ELEVENLABS_BASE}/convai/agents/create`, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `listening-post-${Date.now()}`,
      conversation_config: {
        agent: {
          prompt: { prompt },
          first_message: `Hey, thanks for reading. I covered this story about ${headline.toLowerCase().slice(0, 60)} for The Listening Post. What would you like to know?`,
          language: "en",
        },
        tts: {
          voice_id: CORRESPONDENT_VOICE_ID,
          model_id: "eleven_turbo_v2",
        },
      },
      platform_settings: {
        widget: {
          variant: "compact",
          avatar: { type: "orb" },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs agent creation failed: ${response.status} ${error}`);
  }

  const data = await response.json() as { agent_id: string };
  return data.agent_id;
}

async function getSignedUrl(env: Env, agentId: string): Promise<string> {
  const response = await fetch(
    `${ELEVENLABS_BASE}/convai/conversation/get-signed-url?agent_id=${agentId}`,
    {
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
    }
  );

  if (!response.ok) {
    throw new Error(`Signed URL failed: ${response.status}`);
  }

  const data = await response.json() as { signed_url: string };
  return data.signed_url;
}

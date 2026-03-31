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
  const cached = await env.CONFIG_KV.get(`agent:v2:${articleId}`);
  if (cached) {
    const { agentId } = JSON.parse(cached);
    try {
      const signedUrl = await getSignedUrl(env, agentId);
      return { agentId, signedUrl };
    } catch {
      // Agent may have expired — recreate
      await env.CONFIG_KV.delete(`agent:v2:${articleId}`);
    }
  }

  // Build knowledge document from article + related data
  const knowledge = await buildKnowledge(env, articleId, headline, body, topic);

  // Create the agent
  const agentId = await createAgent(env, headline, topic, knowledge);

  // Get signed URL for widget
  const signedUrl = await getSignedUrl(env, agentId);

  // Cache agent ID (v2 key busts old cache without search tool)
  await env.CONFIG_KV.put(`agent:v2:${articleId}`, JSON.stringify({ agentId }), {
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
- Answer from your knowledge base FIRST — don't search if you already know
- If the reader asks something beyond the article, use your search_for_more_info tool to look it up
- When you search, tell the reader: "Let me look that up for you..."
- When citing data, mention the source naturally
- Keep responses concise — 2-3 sentences for simple questions
- For complex questions, give a brief answer then ask if they want more detail
- Format for speech: spell out numbers and abbreviations
- If you truly can't find an answer, say so honestly

ARTICLE KNOWLEDGE:
${knowledge}`;

  // Worker base URL for webhook tools
  const workerUrl = "https://listening-post.tarikjmoody.workers.dev";

  // Create agent with Perplexity search tool
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
          tools: [
            {
              type: "webhook",
              name: "search_for_more_info",
              description: "Search the web for more information about a topic the reader asked about that is not in your knowledge base. Use this when the reader asks about background, context, history, comparisons, or anything beyond what you already know about the article.",
              api_schema: {
                url: `${workerUrl}/api/voice-agent/search`,
                method: "POST",
                request_body: {
                  query: {
                    type: "string",
                    description: "The search query — what the reader wants to know more about. Be specific and include Milwaukee or Wisconsin context when relevant.",
                    required: true,
                  },
                },
              },
            },
          ],
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

import type { Env, TriagedStory, EpisodeAct, DialogueTurn } from "../types";

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

interface ShowRundown {
  edition: "morning" | "evening";
  acts: {
    id: string;
    title: string;
    stories: TriagedStory[];
    context: string;
  }[];
}

export async function buildShowRundown(
  edition: "morning" | "evening",
  stories: TriagedStory[],
  env: Env
): Promise<ShowRundown> {
  // Get top stories by relevance
  const ranked = [...stories].sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
  const top = ranked.slice(0, 8);

  // Get editorial briefing from KV
  const briefingRaw = await env.CONFIG_KV.get("editorial:latest-briefing", "json") as {
    briefing?: string;
    topStoryResearch?: string;
  } | null;

  const briefing = briefingRaw?.briefing ?? "";
  const research = briefingRaw?.topStoryResearch ?? "";

  // Get floor actions for today
  const today = new Date().toISOString().split("T")[0];
  const floorResult = await env.DB.prepare(
    "SELECT * FROM floor_actions WHERE date = ? ORDER BY chamber, created_at DESC LIMIT 10"
  ).bind(today).all();
  const floorActions = floorResult.results ?? [];

  // Get presidential actions
  const presResult = await env.DB.prepare(
    "SELECT * FROM presidential_actions ORDER BY created_at DESC LIMIT 5"
  ).all();
  const presidentialActions = presResult.results ?? [];

  // Get FRED context for top story's topic
  const topTopic = top[0]?.topic ?? "economy";
  const fredRaw = await env.CONFIG_KV.get(`fred:${topTopic === "housing" ? "ATNHPIUS33340Q" : "MILK555URN"}`, "json") as {
    title?: string;
    latestValue?: number;
    units?: string;
    changePercent?: number;
  } | null;

  const fredContext = fredRaw
    ? `${fredRaw.title}: ${fredRaw.latestValue} ${fredRaw.units} (${fredRaw.changePercent && fredRaw.changePercent > 0 ? "+" : ""}${fredRaw.changePercent?.toFixed(1)}%)`
    : "";

  const floorContext = floorActions.length > 0
    ? `Floor activity today:\n${floorActions.map((a: any) => `- ${a.chamber}: ${a.description}`).join("\n")}`
    : "No floor actions today.";

  const presContext = presidentialActions.length > 0
    ? `At the president's desk:\n${presidentialActions.map((a: any) => `- ${a.bill_identifier}: ${a.title} (${a.status})`).join("\n")}`
    : "";

  if (edition === "morning") {
    return {
      edition,
      acts: [
        {
          id: "act-1",
          title: "The Briefing",
          stories: top.slice(0, 4),
          context: `Editorial briefing:\n${briefing}\n\n${fredContext}`,
        },
        {
          id: "act-2",
          title: "The Deep Dive",
          stories: top.slice(0, 2),
          context: `Deep research:\n${research}\n\n${floorContext}\n\n${presContext}`,
        },
        {
          id: "act-3",
          title: "The Outlook",
          stories: top.slice(4, 7),
          context: `${fredContext}\n\nUpcoming: look for developments on these stories this week.`,
        },
      ],
    };
  }

  return {
    edition,
    acts: [
      {
        id: "act-1",
        title: "Day in Review",
        stories: top.slice(0, 4),
        context: `Editorial briefing:\n${briefing}\n\n${floorContext}`,
      },
      {
        id: "act-2",
        title: "Analysis",
        stories: top.slice(0, 3),
        context: `Deep research:\n${research}\n\n${fredContext}\n\n${presContext}`,
      },
      {
        id: "act-3",
        title: "The Signal",
        stories: top.slice(3, 6),
        context: `${fredContext}\n\nLong-term trends to watch.`,
      },
    ],
  };
}

export async function generateActDialogue(
  act: ShowRundown["acts"][0],
  edition: "morning" | "evening",
  actIndex: number,
  env: Env
): Promise<DialogueTurn[]> {
  // Map internal source names to broadcast-friendly names
  const sourceNames: Record<string, string> = {
    perigon: "as reported by local news outlets",
    congress: "according to Congress dot gov",
    openstates: "from the Wisconsin State Legislature",
    fred: "according to Federal Reserve economic data",
    perplexity: "based on multiple news sources",
  };

  const storyList = act.stories
    .map((s, i) => {
      const sourceName = sourceNames[s.source] ?? s.source;
      const imageAttrib = (s as any).image_attribution;
      const realSource = imageAttrib && imageAttrib !== "Congress.gov" && imageAttrib !== "OpenStates" && imageAttrib !== "FRED"
        ? `Originally reported by: ${imageAttrib}`
        : sourceName;
      return `${i + 1}. ${s.headline}\n   Summary: ${s.summary?.slice(0, 300) ?? "No summary"}\n   Topic: ${s.topic}\n   Source to cite: ${realSource}`;
    })
    .join("\n\n");

  const voiceGuide = `Three speakers. NEVER confuse their names or roles:

ANCHOR = Marcus. He is the main host. He opens and closes the show. He introduces stories and asks questions.
CORRESPONDENT = Sarah. She is the correspondent. She explains, analyzes, and goes deep on stories.
DISTRICT_DESK = Kesha. She is the capitol reporter. She covers legislation, floor votes, and government data.

CRITICAL RULES:
- Lines starting with "ANCHOR:" are ALWAYS spoken by Marcus. Marcus NEVER calls himself Sarah or Kesha.
- Lines starting with "CORRESPONDENT:" are ALWAYS spoken by Sarah. Sarah NEVER calls herself Marcus or Kesha.
- Lines starting with "DISTRICT_DESK:" are ALWAYS spoken by Kesha. Kesha NEVER calls herself Marcus or Sarah.
- When Marcus hands off to Sarah, he says "Sarah" — and the NEXT line MUST start with "CORRESPONDENT:"
- When Marcus hands off to Kesha, he says "Kesha" — and the NEXT line MUST start with "DISTRICT_DESK:"
- Each person only refers to THEMSELVES by their OWN name, and refers to the OTHERS by their names.`;

  const formatGuide = `Format each line EXACTLY as:
SPEAKER: Dialogue text here.

Valid speakers: ANCHOR, CORRESPONDENT, DISTRICT_DESK

IMPORTANT RULES:
- Write with energy and emotion like NPR hosts. These are real people who care about their city.
- Use these ElevenLabs audio tags naturally where they fit: [laughs], [sighs], [chuckles], [short pause], [long pause], [excited], [surprised], [whispers], [thoughtful]
- Do NOT invent other tags. Only use the ones listed above.
- Use dashes for interruptions: "So what you're saying is—"
- Use ellipses for trailing: "And that means..."
- Write numbers spelled out: "one hundred ninety-eight thousand dollars" not "$198,000"
- Write dates spelled out: "March twenty-sixth" not "March 26"
- NEVER say "according to Perigon" or "according to OpenStates" or "according to FRED"
- These are data pipelines, not sources. Cite the REAL source: "according to the Milwaukee Journal Sentinel", "according to the Bureau of Labor Statistics", "according to the Wisconsin State Legislature", "according to Congress dot gov"
- When citing economic data, say "Federal Reserve data shows" or "Bureau of Labor Statistics reports"
- When citing bills, say "the Wisconsin State Senate" or "the U.S. House" — not "OpenStates"
- Make the conversation feel alive. The hosts should react to each other. "Wait, really?" "That's a big deal." "I did not see that coming." Think Morning Edition, not a textbook.`;

  let actPrompt = "";

  if (edition === "morning") {
    if (actIndex === 0) {
      actPrompt = `This is ACT 1: THE BRIEFING for the Morning Edition.
Start with Marcus introducing the show: "Good morning, I'm Marcus, and this is The Listening Post — your Milwaukee morning briefing. I'm joined by our correspondent Sarah and our capitol reporter Kesha."
Then Marcus hooks the biggest story with one compelling line.
Cover 3-4 top headlines with Marcus leading. Sarah adds color on the lead story. Kesha jumps in on any legislative news.
End with Marcus transitioning to the deep dive: "Sarah, take us deeper on this one."
Target: 4000-4500 characters total across all speakers. This should produce about three to four minutes of audio. Write a full, substantive segment — not a summary.`;
    } else if (actIndex === 1) {
      actPrompt = `This is ACT 2: THE DEEP DIVE for the Morning Edition.
The correspondent leads an in-depth exploration of the top story. The anchor asks questions.
The district desk enters to cover today's floor activity and any bills at the president's desk.
Target: 4000-4500 characters total. This should produce about three to four minutes of audio. Write a full, substantive deep dive — not a summary.`;
    } else {
      actPrompt = `This is ACT 3: THE OUTLOOK for the Morning Edition.
The correspondent covers what to watch this week — upcoming hearings, votes, deadlines.
The anchor wraps up and teases the evening edition.
Target: 3000-4000 characters total. This should produce about three minutes of audio. Write substantive content — not a quick wrap.`;
    }
  } else {
    if (actIndex === 0) {
      actPrompt = `This is ACT 1: DAY IN REVIEW for the Evening Edition.
Start with Marcus: "Good evening, I'm Marcus, and this is The Listening Post evening edition. Sarah and Kesha are here with me."
Marcus leads with today's biggest outcome. Sarah adds context. Kesha covers what happened on the floor.
Target: 4000-4500 characters total. This should produce about three to four minutes of audio.`;
    } else if (actIndex === 1) {
      actPrompt = `This is ACT 2: ANALYSIS for the Evening Edition.
The correspondent leads with "why today matters" analysis. The anchor asks probing questions.
The district desk covers how reps voted today. Include economic data context.
Target: 4000-4500 characters total. This should produce about three to four minutes of audio.`;
    } else {
      actPrompt = `This is ACT 3: THE SIGNAL for the Evening Edition.
The correspondent identifies one long-term trend most people aren't watching.
The anchor wraps up genuinely, previews tomorrow's morning edition.
Target: 4000-4500 characters total. This should produce about three to four minutes of audio.`;
    }
  }

  const prompt = `${voiceGuide}

${formatGuide}

${actPrompt}

STORIES FOR THIS ACT:
${storyList}

ADDITIONAL CONTEXT:
${act.context}

Write the dialogue script now. Remember: write for the EAR, not the eye. Short sentences. No jargon. Cite sources naturally in speech. Make the conversation feel natural — not alternating monologues.`;

  try {
    const result = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content: "You are a broadcast script writer for a Milwaukee local news podcast called The Listening Post. Write natural, engaging dialogue between three hosts: ANCHOR, CORRESPONDENT, and DISTRICT_DESK. Follow the format exactly. Do NOT include any brackets, tags, stage directions, or emotional cues — just clean dialogue text. Do NOT mention data sources like Perigon, OpenStates, or FRED — always cite the real source (e.g., Milwaukee Journal Sentinel, Wisconsin State Legislature, Bureau of Labor Statistics, Congress).",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 4000,
      temperature: 0.4,
    }) as { response?: string };

    const script = result.response ?? "";
    return parseDialogueScript(script);
  } catch (error) {
    console.error(`[Scriptwriter] Act ${act.id} failed:`, error);
    return getFallbackDialogue(act, edition, actIndex);
  }
}

function parseDialogueScript(script: string): DialogueTurn[] {
  const lines = script.split("\n").filter((l) => l.trim().length > 0);
  const turns: DialogueTurn[] = [];

  const speakerMap: Record<string, DialogueTurn["voice"]> = {
    "ANCHOR": "anchor",
    "CORRESPONDENT": "correspondent",
    "DISTRICT_DESK": "district_desk",
    "DISTRICT DESK": "district_desk",
  };

  for (const line of lines) {
    // Match patterns like "ANCHOR: text here" or "CORRESPONDENT: text here"
    const match = line.match(/^(ANCHOR|CORRESPONDENT|DISTRICT[_ ]DESK)\s*:\s*(.+)$/i);
    if (!match) continue;

    const speaker = match[1].toUpperCase().replace(" ", "_");
    const voice = speakerMap[speaker];
    if (!voice) continue;

    const text = match[2].trim();
    if (text.length === 0) continue;

    turns.push({
      voice,
      voiceId: "", // Will be assigned when sending to ElevenLabs
      text,
    });
  }

  if (turns.length === 0) {
    console.error("[Scriptwriter] No dialogue turns parsed from script");
  }

  return turns;
}

function getFallbackDialogue(
  act: ShowRundown["acts"][0],
  edition: "morning" | "evening",
  actIndex: number
): DialogueTurn[] {
  const topStory = act.stories[0];
  if (!topStory) {
    return [
      { voice: "anchor", voiceId: "", text: `[confidently] Welcome to The Listening Post ${edition} edition. We're tracking developments in Milwaukee today.` },
    ];
  }

  return [
    { voice: "anchor", voiceId: "", text: `[confidently] ${actIndex === 0 ? "Good morning, Milwaukee." : ""} Our top story: ${topStory.headline}.` },
    { voice: "correspondent", voiceId: "", text: `[analytical] ${topStory.summary?.slice(0, 300) ?? "We're following this developing story."}` },
    { voice: "anchor", voiceId: "", text: `[genuine] We'll continue to follow this story. ${actIndex === 2 ? `That's your ${edition} edition from The Listening Post.` : ""}` },
  ];
}

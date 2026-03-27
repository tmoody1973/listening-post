import type { Env, DialogueTurn } from "../types";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

// Voice IDs — these should be selected from the ElevenLabs voice library
// TODO: Replace with actual selected voice IDs after auditioning on Day 3
const VOICE_IDS: Record<string, string> = {
  anchor: "pNInz6obpgDQGcFmaJgB",       // Adam — warm, authoritative
  correspondent: "ErXwobaYiN019PkySvjV", // Antoni — detailed, explanatory
  district_desk: "VR6AewLTigWG4xSOukaG", // Arnold — direct, data-driven
};

interface TextToDialogueRequest {
  model_id: string;
  dialogue: {
    voice_id: string;
    text: string;
  }[];
  output_format?: string;
  seed?: number;
}

export async function voiceAct(
  env: Env,
  dialogue: DialogueTurn[],
  episodeId: string,
  actId: string,
  seed?: number
): Promise<{ audioBuffer: ArrayBuffer; durationEstimate: number }> {
  if (dialogue.length === 0) {
    throw new Error("No dialogue turns to voice");
  }

  // Assign voice IDs to each turn
  const dialogueWithVoices = dialogue.map((turn) => ({
    voice_id: VOICE_IDS[turn.voice] ?? VOICE_IDS.anchor,
    text: turn.text,
  }));

  // Calculate total character count
  const totalChars = dialogueWithVoices.reduce((sum, d) => sum + d.text.length, 0);
  console.log(`[Voices] Act ${actId}: ${dialogue.length} turns, ${totalChars} chars`);

  // Check if under 5000 char limit for v3
  if (totalChars > 5000) {
    console.warn(`[Voices] Act ${actId} exceeds 5000 chars (${totalChars}). Truncating.`);
    // Truncate from the end until under limit
    let charCount = 0;
    const truncated = dialogueWithVoices.filter((d) => {
      charCount += d.text.length;
      return charCount <= 4800;
    });
    dialogueWithVoices.length = 0;
    dialogueWithVoices.push(...truncated);
  }

  const requestBody: TextToDialogueRequest = {
    model_id: "eleven_v3",
    dialogue: dialogueWithVoices,
    output_format: "mp3_44100_128",
  };

  if (seed !== undefined) {
    requestBody.seed = seed;
  }

  console.log(`[Voices] Calling Text to Dialogue API for ${actId}...`);

  const response = await fetch(`${ELEVENLABS_BASE}/text-to-dialogue`, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API ${response.status}: ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();

  // Estimate duration: ~150 words per minute, ~5 chars per word
  const estimatedWords = totalChars / 5;
  const durationEstimate = Math.round((estimatedWords / 150) * 60);

  console.log(`[Voices] Act ${actId}: ${(audioBuffer.byteLength / 1024).toFixed(0)}KB audio, ~${durationEstimate}s estimated`);

  return { audioBuffer, durationEstimate };
}

export async function voiceActFallbackTTS(
  env: Env,
  dialogue: DialogueTurn[],
  episodeId: string,
  actId: string
): Promise<{ audioBuffer: ArrayBuffer; durationEstimate: number }> {
  // Fallback: use standard TTS per turn with Multilingual v2, then concatenate
  console.log(`[Voices] Fallback TTS for ${actId}: ${dialogue.length} turns`);

  const chunks: ArrayBuffer[] = [];
  let totalChars = 0;

  for (const turn of dialogue) {
    const voiceId = VOICE_IDS[turn.voice] ?? VOICE_IDS.anchor;

    const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: turn.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.80,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      console.error(`[Voices] TTS failed for turn: ${response.status}`);
      continue;
    }

    const chunk = await response.arrayBuffer();
    chunks.push(chunk);
    totalChars += turn.text.length;
  }

  // Simple concatenation of MP3 chunks
  // Note: proper MP3 concatenation should strip headers, but for hackathon this works
  const totalSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  const estimatedWords = totalChars / 5;
  const durationEstimate = Math.round((estimatedWords / 150) * 60);

  console.log(`[Voices] Fallback complete: ${(totalSize / 1024).toFixed(0)}KB, ~${durationEstimate}s`);

  return { audioBuffer: combined.buffer, durationEstimate };
}

export function getVoiceIds(): Record<string, string> {
  return { ...VOICE_IDS };
}

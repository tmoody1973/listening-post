import type { Env } from "../types";

export async function assembleEpisode(
  env: Env,
  episodeId: string,
  actAudioKeys: string[]
): Promise<{ finalR2Key: string; totalSize: number; actDurations: number[] }> {
  console.log(`[Assembler] Processing ${actAudioKeys.length} acts for ${episodeId}...`);

  // Calculate actual duration from each act's file size (128kbps = 16000 bytes/sec)
  const actDurations: number[] = [];
  let totalSize = 0;

  for (const key of actAudioKeys) {
    const head = await env.MEDIA_BUCKET.head(key);
    if (head) {
      const bytes = head.size;
      const duration = Math.round(bytes / 16000);
      actDurations.push(duration);
      totalSize += bytes;
      console.log(`[Assembler] ${key}: ${(bytes / 1024).toFixed(0)}KB, ~${duration}s`);
    }
  }

  // Build playlist manifest: intro → act1 → stinger → act2 → stinger → act3 → outro
  // Music files are pre-generated and stored in R2
  const INTRO_KEY = "audio/music/intro-jingle.mp3";
  const STINGER_KEY = "audio/music/stinger.mp3";
  const OUTRO_KEY = "audio/music/outro.mp3";
  const INTRO_DURATION = 10;
  const STINGER_DURATION = 3;
  const OUTRO_DURATION = 8;

  const playlist: { r2Key: string; url: string; durationSeconds: number; type: string; title?: string }[] = [];

  // Intro jingle
  playlist.push({ r2Key: INTRO_KEY, url: `/${INTRO_KEY}`, durationSeconds: INTRO_DURATION, type: "music", title: "Intro" });

  // Interleave acts with stingers
  for (let i = 0; i < actAudioKeys.length; i++) {
    playlist.push({
      r2Key: actAudioKeys[i],
      url: `/${actAudioKeys[i]}`,
      durationSeconds: actDurations[i] ?? 0,
      type: "act",
      title: `Act ${i + 1}`,
    });

    // Add stinger between acts (not after the last one)
    if (i < actAudioKeys.length - 1) {
      playlist.push({ r2Key: STINGER_KEY, url: `/${STINGER_KEY}`, durationSeconds: STINGER_DURATION, type: "music", title: "Transition" });
    }
  }

  // Outro
  playlist.push({ r2Key: OUTRO_KEY, url: `/${OUTRO_KEY}`, durationSeconds: OUTRO_DURATION, type: "music", title: "Outro" });

  const totalWithMusic = playlist.reduce((sum, p) => sum + p.durationSeconds, 0);

  const manifest = {
    episodeId,
    playlist,
    acts: actAudioKeys.map((key, i) => ({
      r2Key: key,
      url: `/${key}`,
      durationSeconds: actDurations[i] ?? 0,
    })),
    totalDurationSeconds: totalWithMusic,
  };

  const manifestKey = `audio/${episodeId}/manifest.json`;
  await env.MEDIA_BUCKET.put(manifestKey, JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json" },
  });

  // Also create a concatenated file for direct download/RSS
  // Uses the full playlist order: intro → act1 → stinger → act2 → stinger → act3 → outro
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < playlist.length; i++) {
    const object = await env.MEDIA_BUCKET.get(playlist[i].r2Key);
    if (!object) {
      console.error(`[Assembler] Missing: ${playlist[i].r2Key}`);
      continue;
    }
    let buffer = new Uint8Array(await object.arrayBuffer());

    // Strip ID3v2 header from all files after the first for cleaner concatenation
    if (i > 0 && buffer.length > 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      const headerSize = (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
      buffer = buffer.slice(headerSize + 10);
    }
    chunks.push(buffer);
  }

  const concatSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const combined = new Uint8Array(concatSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const finalR2Key = `audio/${episodeId}/final.mp3`;
  await env.MEDIA_BUCKET.put(finalR2Key, combined.buffer, {
    httpMetadata: { contentType: "audio/mpeg" },
  });

  console.log(`[Assembler] Published: manifest + concat (${(concatSize / 1024).toFixed(0)}KB)`);

  return { finalR2Key, totalSize: concatSize, actDurations };
}

export function generateTranscript(
  acts: { title: string; dialogue: { voice: string; text: string }[] }[]
): string {
  const lines: string[] = [];

  for (const act of acts) {
    lines.push(`\n--- ${act.title} ---\n`);

    for (const turn of act.dialogue) {
      // Strip audio tags for transcript
      const cleanText = turn.text.replace(/\[[\w\s]+\]\s*/g, "");
      const speaker = turn.voice.replace("_", " ").toUpperCase();
      lines.push(`${speaker}: ${cleanText}`);
    }
  }

  return lines.join("\n");
}

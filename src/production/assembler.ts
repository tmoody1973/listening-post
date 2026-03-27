import type { Env } from "../types";

export async function assembleEpisode(
  env: Env,
  episodeId: string,
  actAudioKeys: string[]
): Promise<{ finalR2Key: string; totalSize: number }> {
  console.log(`[Assembler] Combining ${actAudioKeys.length} acts for ${episodeId}...`);

  // Fetch all act audio from R2
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < actAudioKeys.length; i++) {
    const key = actAudioKeys[i];
    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) {
      console.error(`[Assembler] Missing audio: ${key}`);
      continue;
    }
    let buffer = new Uint8Array(await object.arrayBuffer());

    // For acts after the first, strip the ID3v2 header to allow clean MP3 concatenation.
    // ID3v2 starts with "ID3" (0x49, 0x44, 0x33). The header size is encoded in bytes 6-9.
    if (i > 0 && buffer.length > 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      const headerSize = (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
      const totalHeaderSize = headerSize + 10;
      buffer = buffer.slice(totalHeaderSize);
      console.log(`[Assembler] Stripped ${totalHeaderSize} byte ID3 header from act ${i + 1}`);
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    throw new Error("No audio chunks to assemble");
  }

  // Concatenate MP3 frames
  const totalSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Upload final episode to R2
  const finalR2Key = `audio/${episodeId}/final.mp3`;
  await env.MEDIA_BUCKET.put(finalR2Key, combined.buffer, {
    httpMetadata: {
      contentType: "audio/mpeg",
    },
  });

  console.log(`[Assembler] Published: ${finalR2Key} (${(totalSize / 1024).toFixed(0)}KB)`);

  return { finalR2Key, totalSize };
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

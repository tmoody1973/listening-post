import type { Env } from "../types";
import { GoogleGenAI } from "@google/genai";

function buildImagePrompt(headline: string): string {
  return `A wide cinematic editorial illustration in the style of New Yorker magazine. Stylized flat design with thick outlines, muted color palette of dusty blues, warm yellows, soft pinks, and deep purples. [${headline}]. Set against a dark atmospheric background. Subtle grain texture overlay, analog print feel, slight paper texture. Bold, confident linework. Modern editorial flat illustration, web feature header format, 16:9 widescreen composition, grain texture, risograph print aesthetic. ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO CAPTIONS, NO TITLES, NO LABELS, NO WATERMARKS anywhere on the image. Pure illustration only.`;
}

async function generateWithGemini(env: Env, headline: string): Promise<ArrayBuffer | null> {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const prompt = buildImagePrompt(headline);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        generationConfig: {
          imageGenerationConfig: {
            numberOfImages: 1,
          },
        },
      } as any,
    });

    // Check all parts for image data
    const candidates = (response as any).candidates ?? [];
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts ?? [];
      for (const part of parts) {
        if (part?.inlineData?.data) {
          const binary = atob(part.inlineData.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          console.log(`[Images] Gemini returned ${bytes.length} bytes`);
          return bytes.buffer as ArrayBuffer;
        }
      }
    }

    // Try alternate response structure
    const resp = response as any;
    if (resp.response?.candidates) {
      for (const candidate of resp.response.candidates) {
        for (const part of candidate?.content?.parts ?? []) {
          if (part?.inlineData?.data) {
            const binary = atob(part.inlineData.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            return bytes.buffer as ArrayBuffer;
          }
        }
      }
    }

    console.error("[Images] Gemini returned no image data. Response keys:", Object.keys(response ?? {}));
    console.error("[Images] Full response:", JSON.stringify(response).slice(0, 500));
    return null;
  } catch (error) {
    console.error("[Images] Gemini generation failed:", error);
    return null;
  }
}

async function generateWithFlux(env: Env, headline: string): Promise<ArrayBuffer | null> {
  // Fallback to Cloudflare Workers AI Flux
  const prompt = buildImagePrompt(headline);

  try {
    const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt,
      num_steps: 4,
    });

    if (result instanceof ReadableStream) {
      const reader = result.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return combined.buffer as ArrayBuffer;
    }

    const img = (result as any).image;
    if (img instanceof Uint8Array) return img.buffer as ArrayBuffer;
    if (typeof img === "string") {
      const binary = atob(img);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer as ArrayBuffer;
    }

    return null;
  } catch (error) {
    console.error("[Images] Flux fallback failed:", error);
    return null;
  }
}

export async function generateMissingImages(env: Env): Promise<number> {
  const result = await env.DB.prepare(
    `SELECT id, headline, topic FROM stories
     WHERE (image_url IS NULL OR image_url = '')
     AND headline IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 10`
  ).all();

  const stories = result.results ?? [];
  if (stories.length === 0) return 0;

  console.log(`[Images] Generating illustrations for ${stories.length} stories...`);

  let generated = 0;
  const hasGemini = !!env.GEMINI_API_KEY;

  for (const story of stories) {
    const s = story as { id: string; headline: string; topic: string };

    // Try Gemini first, fall back to Flux
    let imageData: ArrayBuffer | null = null;

    console.log(`[Images] Generating: ${s.headline.slice(0, 50)}...`);
    imageData = await generateWithFlux(env, s.headline);

    if (!imageData || imageData.byteLength < 1000) {
      console.error(`[Images] No image generated for ${s.id}`);
      continue;
    }

    // Store in R2
    const safeId = s.id.replace(/[^a-zA-Z0-9-]/g, "-");
    const r2Key = `images/generated/${safeId}.png`;
    await env.MEDIA_BUCKET.put(r2Key, imageData, {
      httpMetadata: { contentType: "image/png" },
    });

    // Update story
    const imageUrl = `/images/${r2Key.replace("images/", "")}`;
    await env.DB.prepare(
      `UPDATE stories SET image_url = ?, image_attribution = ? WHERE id = ?`
    ).bind(imageUrl, "AI-generated illustration", s.id).run();

    generated++;
    console.log(`[Images] Generated: ${s.headline.slice(0, 50)}... (${(imageData.byteLength / 1024).toFixed(0)}KB)`);
  }

  console.log(`[Images] Generated ${generated}/${stories.length} illustrations`);
  return generated;
}

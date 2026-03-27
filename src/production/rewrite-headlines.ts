import type { Env } from "../types";

const PERPLEXITY_BASE = "https://api.perplexity.ai";

export async function rewriteBillHeadlines(env: Env): Promise<number> {
  // Find all stories with bill-style headlines that haven't been rewritten
  const result = await env.DB.prepare(
    `SELECT id, headline, summary, topic, source FROM stories
     WHERE (headline LIKE 'HR.%' OR headline LIKE 'S.%' OR headline LIKE 'HRES.%'
            OR headline LIKE 'SRES.%' OR headline LIKE 'HJRES.%' OR headline LIKE 'SJRES.%'
            OR headline LIKE 'WI SB%' OR headline LIKE 'WI AB%' OR headline LIKE 'WI AJR%'
            OR headline LIKE 'WI SJR%' OR headline LIKE 'WI SR%' OR headline LIKE 'WI AR%'
            OR headline LIKE '%Relating to:%')
     ORDER BY created_at DESC
     LIMIT 30`
  ).all();

  const bills = result.results ?? [];
  if (bills.length === 0) return 0;

  console.log(`[Rewrite] Found ${bills.length} bill headlines to rewrite`);

  // Process in batches of 15
  let rewritten = 0;
  for (let i = 0; i < bills.length; i += 15) {
    const batch = bills.slice(i, i + 15);
    const batchData = batch.map((b: any, idx: number) => ({
      index: idx,
      headline: b.headline,
      summary: (b.summary ?? "").slice(0, 150),
    }));

    try {
      const response = await fetch(`${PERPLEXITY_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: `Rewrite legislative bill headlines into clear, plain-language news headlines.

Rules:
- Sound like an NPR headline, not a legal document
- Remove bill numbers from the start (e.g., "HR.4769:" or "WI SB 123:")
- Remove "Relating to:" prefixes
- Keep under 80 characters
- Use active voice: "New bill would..." or "Wisconsin proposes..."
- Make it clear what the bill DOES, not just its title
- If the bill name is already clear (like "Foster Youth Mentoring Act"), use it naturally

Examples:
- "HR.4769: Foster Youth Mentoring Act of 2025" → "Congress proposes mentoring program for foster youth"
- "WI SB 64: Relating to: injuring or killing a police or fire animal and providing a penalty." → "Wisconsin bill would increase penalties for harming police dogs"
- "SJRES.103: A joint resolution providing for congressional disapproval..." → "Senate moves to block VA reproductive health rule"

Return ONLY a JSON array: [{"index": 0, "headline": "..."}]`,
            },
            {
              role: "user",
              content: JSON.stringify(batchData),
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        console.error(`[Rewrite] Perplexity ${response.status}`);
        continue;
      }

      const data = await response.json() as { choices: { message: { content: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        console.error("[Rewrite] No JSON in response");
        continue;
      }

      const rewrites = JSON.parse(jsonMatch[0]) as { index: number; headline: string }[];

      for (const r of rewrites) {
        const bill = batch[r.index] as any;
        if (!bill || !r.headline || r.headline.length < 10) continue;

        await env.DB.prepare(
          `UPDATE stories SET headline = ? WHERE id = ?`
        ).bind(r.headline, bill.id).run();
        rewritten++;
      }

      console.log(`[Rewrite] Batch ${i}: ${rewrites.length} rewritten`);
    } catch (error) {
      console.error(`[Rewrite] Batch ${i} failed:`, error);
    }
  }

  console.log(`[Rewrite] Total: ${rewritten}/${bills.length} headlines rewritten`);
  return rewritten;
}

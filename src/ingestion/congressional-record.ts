import type { Env, RawStory } from "../types";

const CONGRESS_BASE = "https://api.congress.gov/v3";
const PERPLEXITY_BASE = "https://api.perplexity.ai";

function n(v: unknown): string | number | null {
  return v === undefined || v === "" ? null : v as string | number | null;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

interface RecordArticle {
  title: string;
  textUrl: string;
  pdfUrl: string | null;
}

async function fetchLatestRecordArticles(apiKey: string): Promise<{ articles: RecordArticle[]; date: string; volume: number; issue: string }> {
  // Get the latest issue
  const listRes = await fetch(
    `${CONGRESS_BASE}/daily-congressional-record?format=json&limit=1&api_key=${apiKey}`
  );
  if (!listRes.ok) throw new Error(`Daily record list ${listRes.status}`);

  const listData = await listRes.json() as {
    dailyCongressionalRecord: { volumeNumber: number; issueNumber: string; issueDate: string }[];
  };

  const latest = listData.dailyCongressionalRecord?.[0];
  if (!latest) throw new Error("No Congressional Record issues found");

  const volume = latest.volumeNumber;
  const issue = latest.issueNumber;
  const date = latest.issueDate.split("T")[0];

  // Get articles for this issue
  const articlesRes = await fetch(
    `${CONGRESS_BASE}/daily-congressional-record/${volume}/${issue}/articles?format=json&limit=50&api_key=${apiKey}`
  );
  if (!articlesRes.ok) throw new Error(`Record articles ${articlesRes.status}`);

  const articlesData = await articlesRes.json() as {
    articles: {
      name: string;
      sectionArticles: {
        title: string;
        text: { type: string; url: string }[];
      }[];
    }[];
  };

  const articles: RecordArticle[] = [];

  for (const section of articlesData.articles ?? []) {
    for (const article of section.sectionArticles ?? []) {
      const htmlText = article.text?.find((t) => t.type === "Formatted Text");
      const pdfText = article.text?.find((t) => t.type === "PDF");

      if (htmlText) {
        articles.push({
          title: article.title ?? section.name,
          textUrl: htmlText.url,
          pdfUrl: pdfText?.url ?? null,
        });
      }
    }
  }

  return { articles, date, volume, issue };
}

async function fetchHtmlText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) return "";

  const html = await res.text();

  // Strip HTML tags to get plain text
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000); // Keep under Perplexity's context limit
}

async function summarizeWithPerplexity(
  env: Env,
  title: string,
  text: string,
  date: string
): Promise<{ body: string; citations: string[] }> {
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
          content: `You are a congressional reporter for a Milwaukee news platform. Summarize the Congressional Record proceedings into a clear, readable article. Write for a general audience — no legislative jargon. Explain what happened, what was voted on, and why it matters. Focus on actions that affect Wisconsin or Milwaukee when possible. Write 4-6 paragraphs. Do not include a headline.`,
        },
        {
          role: "user",
          content: `Summarize this Congressional Record section from ${date}:\n\nTitle: ${title}\n\nContent:\n${text}`,
        },
      ],
      temperature: 0.3,
      web_search_options: {
        search_context_size: "medium",
        user_location: { latitude: 43.0389, longitude: -87.9065, country: "US" },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity ${response.status}`);
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[];
    citations?: string[];
  };

  return {
    body: data.choices?.[0]?.message?.content ?? "",
    citations: data.citations ?? [],
  };
}

export async function ingestCongressionalRecordArticles(env: Env): Promise<RawStory[]> {
  console.log("[CongressRecord] Fetching and summarizing daily record...");

  const stories: RawStory[] = [];

  try {
    const { articles, date, volume, issue } = await fetchLatestRecordArticles(env.CONGRESS_API_KEY);
    console.log(`[CongressRecord] Found ${articles.length} articles for ${date} (Vol. ${volume}, No. ${issue})`);

    // Focus on the key sections — Daily Digest and main chamber proceedings
    const keyArticles = articles.filter((a) =>
      a.title.includes("Daily Digest") ||
      a.title.includes("Chamber Action") ||
      a.title.includes("SENATE") ||
      a.title.includes("HOUSE") ||
      a.title.includes("Committee Meetings")
    ).slice(0, 4); // Limit to 4 to conserve Perplexity calls

    for (const article of keyArticles) {
      try {
        // Fetch the HTML text
        const text = await fetchHtmlText(article.textUrl);
        if (text.length < 100) {
          console.log(`[CongressRecord] Skipping "${article.title}" — too short`);
          continue;
        }

        // Summarize with Perplexity
        const { body, citations } = await summarizeWithPerplexity(env, article.title, text, date);

        if (body.length < 50) continue;

        // Clean up the title
        const cleanTitle = article.title
          .replace(/; Congressional Record Vol\. \d+, No\. \d+/g, "")
          .replace(/Daily Digest\//g, "")
          .trim();

        const headline = `What Congress Did: ${cleanTitle}`;
        const id = `record-article-${date}-${slugify(cleanTitle)}`;

        const sourcesJson = citations.length > 0
          ? JSON.stringify(citations.map((url: string) => {
              try { return { name: new URL(url).hostname.replace("www.", ""), url }; }
              catch { return { name: url, url }; }
            }))
          : JSON.stringify([{ name: "Congressional Record", url: article.pdfUrl ?? article.textUrl }]);

        // Store in D1
        await env.DB.prepare(
          `INSERT OR REPLACE INTO stories (id, headline, summary, body, slug, topic, source, source_url, image_attribution, sources_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          id,
          headline,
          n(body.slice(0, 200)),
          body,
          slugify(headline),
          "politics",
          "congress",
          n(article.pdfUrl ?? article.textUrl),
          "Congressional Record",
          sourcesJson,
        ).run();

        stories.push({
          id,
          headline,
          summary: body.slice(0, 200),
          topic: "politics",
          source: "congress",
          source_url: article.pdfUrl ?? article.textUrl,
          image_url: null,
          image_caption: null,
          image_attribution: "Congressional Record",
          sentiment_positive: null,
          sentiment_negative: null,
          content: body,
          perigon_cluster_id: null,
        });

        console.log(`[CongressRecord] Summarized: ${cleanTitle}`);
      } catch (error) {
        console.error(`[CongressRecord] Failed to process "${article.title}":`, error);
      }
    }
  } catch (error) {
    console.error("[CongressRecord] Failed:", error);
  }

  console.log(`[CongressRecord] Created ${stories.length} articles from Congressional Record`);
  return stories;
}

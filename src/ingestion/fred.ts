import type { Env, RawStory } from "../types";
import { FRED_SERIES } from "../types";

const FRED_BASE = "https://api.stlouisfed.org/fred";

interface FredObservationResponse {
  observations: {
    date: string;
    value: string;
  }[];
}

function n(v: unknown): string | number | null {
  return v === undefined || v === "" ? null : v as string | number | null;
}

export async function ingestFromFRED(env: Env): Promise<RawStory[]> {
  console.log("[FRED] Starting ingestion of 16 series...");
  const stories: RawStory[] = [];

  for (const series of FRED_SERIES) {
    try {
      const url = `${FRED_BASE}/series/observations?series_id=${series.id}&api_key=${env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=12`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`[FRED] ${series.id} HTTP ${response.status}`);
        continue;
      }

      const data = await response.json() as FredObservationResponse;
      const observations = data.observations ?? [];

      if (observations.length === 0) {
        console.log(`[FRED] ${series.id}: no observations`);
        continue;
      }

      // Store observations in D1
      for (const obs of observations) {
        const value = obs.value === "." ? null : parseFloat(obs.value);
        if (value === null || isNaN(value)) continue;

        await env.DB.prepare(
          `INSERT OR REPLACE INTO fred_observations (series_id, date, value)
           VALUES (?, ?, ?)`
        ).bind(series.id, obs.date, value).run();
      }

      // Cache latest value in KV for fast frontend access
      const latest = observations[0];
      const previous = observations.length > 1 ? observations[1] : null;
      const latestValue = latest.value === "." ? null : parseFloat(latest.value);
      const previousValue = previous?.value === "." ? null : (previous ? parseFloat(previous.value) : null);

      await env.CONFIG_KV.put(
        `fred:${series.id}`,
        JSON.stringify({
          seriesId: series.id,
          title: series.title,
          topic: series.topic,
          frequency: series.frequency,
          units: series.units,
          latestDate: latest.date,
          latestValue,
          previousValue,
          change: latestValue !== null && previousValue !== null
            ? latestValue - previousValue
            : null,
          changePercent: latestValue !== null && previousValue !== null && previousValue !== 0
            ? ((latestValue - previousValue) / previousValue) * 100
            : null,
          observations: observations
            .filter((o) => o.value !== ".")
            .map((o) => ({ date: o.date, value: parseFloat(o.value) })),
        }),
        { expirationTtl: 86400 } // 24 hour cache
      );

      // Check if this is new data (compare with KV cached last date)
      const cachedLastDate = await env.CONFIG_KV.get(`fred:lastDate:${series.id}`);
      if (cachedLastDate !== latest.date && latestValue !== null) {
        // New data release — generate a story
        const changeDir = previousValue !== null && latestValue > previousValue ? "up" : "down";
        const changeAmt = previousValue !== null
          ? Math.abs(latestValue - previousValue).toFixed(1)
          : "N/A";

        stories.push({
          id: `fred-${series.id}-${latest.date}`,
          headline: `${series.title}: ${latestValue}${series.units === "%" ? "%" : ` ${series.units}`} (${changeDir} ${changeAmt})`,
          summary: `New ${series.frequency} data released for ${series.title}. Latest value: ${latestValue}${series.units === "%" ? "%" : ` ${series.units}`} as of ${latest.date}.`,
          topic: series.topic,
          source: "fred",
          source_url: `https://fred.stlouisfed.org/series/${series.id}`,
          image_url: null,
          image_caption: null,
          image_attribution: "Federal Reserve Economic Data (FRED)",
          sentiment_positive: null,
          sentiment_negative: null,
          content: null,
          perigon_cluster_id: null,
        });

        await env.CONFIG_KV.put(`fred:lastDate:${series.id}`, latest.date);
      }

      console.log(`[FRED] ${series.id}: ${observations.length} observations, latest ${latest.date} = ${latest.value}`);
    } catch (error) {
      console.error(`[FRED] ${series.id} error:`, error);
    }
  }

  // Store any new FRED stories in D1
  for (const story of stories) {
    try {
      const slug = story.id;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO stories (id, headline, summary, slug, topic, source, source_url, image_attribution, fred_series_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        story.id,
        story.headline,
        n(story.summary),
        slug,
        story.topic,
        story.source,
        n(story.source_url),
        "FRED",
        story.id.replace("fred-", "").split("-")[0],
      ).run();
    } catch (error) {
      console.error(`[FRED] Failed to store story:`, error);
    }
  }

  console.log(`[FRED] Complete: ${FRED_SERIES.length} series cached, ${stories.length} new data stories`);
  return stories;
}

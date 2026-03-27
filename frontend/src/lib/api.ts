const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://listening-post.tarikjmoody.workers.dev";

export async function fetchStories(options?: { topic?: string; all?: boolean }) {
  const params = new URLSearchParams();
  if (options?.topic) params.set("topic", options.topic);
  if (options?.all) params.set("all", "true");

  const res = await fetch(`${API_BASE}/api/stories?${params}`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.stories ?? [];
}

export async function fetchEpisodes(options?: { edition?: string }) {
  const params = new URLSearchParams();
  if (options?.edition) params.set("edition", options.edition);

  const res = await fetch(`${API_BASE}/api/episodes?${params}`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.episodes ?? [];
}

export async function fetchArticle(slug: string) {
  const res = await fetch(`${API_BASE}/api/article/${slug}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}

export async function fetchTopicData(topic: string) {
  const res = await fetch(`${API_BASE}/api/topic/${topic}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchFredData(topic: string) {
  const res = await fetch(`${API_BASE}/api/data/${topic}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchManifest(episodeId: string) {
  const res = await fetch(`${API_BASE}/api/episode/${episodeId}/manifest`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export function audioUrl(path: string): string {
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}

export function getTopicColor(topic: string): string {
  const colors: Record<string, string> = {
    housing: "var(--color-topic-housing)",
    education: "var(--color-topic-education)",
    transit: "var(--color-topic-transit)",
    safety: "var(--color-topic-safety)",
    economy: "var(--color-topic-economy)",
    health: "var(--color-topic-health)",
    environment: "var(--color-topic-environment)",
    sports: "var(--color-topic-sports)",
    culture: "var(--color-topic-culture)",
    politics: "var(--color-topic-politics)",
  };
  return colors[topic] ?? colors.economy;
}

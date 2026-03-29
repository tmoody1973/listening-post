import { fetchEpisodes, fetchManifest } from "@/lib/api";
import { StickyPlayer } from "./EditionPlayer";

export async function PlayerBar() {
  const episodes = await fetchEpisodes();

  // Parallel manifest fetch
  const manifests = await Promise.all(episodes.map((ep: any) => fetchManifest(ep.id)));
  const idx = manifests.findIndex((m: any) => m?.playlist);

  if (idx >= 0) {
    const ep = episodes[idx];
    const manifest = manifests[idx];
    return (
      <StickyPlayer
        episodeId={ep.id}
        edition={ep.edition}
        date={ep.date}
        playlist={manifest.playlist}
        totalDuration={manifest.totalDurationSeconds}
      />
    );
  }

  return null;
}

import { fetchEpisodes, fetchManifest } from "@/lib/api";
import { StickyPlayer } from "./EditionPlayer";

export async function PlayerBar() {
  const episodes = await fetchEpisodes();

  // Find first episode with a manifest
  for (const ep of episodes) {
    const manifest = await fetchManifest(ep.id);
    if (manifest?.playlist) {
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
  }

  return null;
}

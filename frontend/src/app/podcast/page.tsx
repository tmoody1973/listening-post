import { fetchEpisodes, fetchManifest } from "@/lib/api";
import { EditionPlayer } from "@/components/EditionPlayer";

export const revalidate = 30;

export default async function PodcastPage() {
  const episodes = await fetchEpisodes();

  // Load manifests for episodes that have them
  const episodesWithManifests = await Promise.all(
    episodes.map(async (ep: any) => {
      const manifest = await fetchManifest(ep.id);
      return { ...ep, manifest };
    })
  );

  const playableEpisodes = episodesWithManifests.filter((ep: any) => ep.manifest?.playlist);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[-0.02em] leading-none">
          Podcast
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Twice-daily Milwaukee news briefings. Three hosts, real sources, AI-produced.
        </p>
      </div>

      <div className="h-px bg-white/20 mb-8" />

      {/* About the show */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="border border-white/10 p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Hosts</h3>
          <p className="text-sm"><span className="font-bold">Marcus</span> — Anchor</p>
          <p className="text-sm"><span className="font-bold">Sarah</span> — Correspondent</p>
          <p className="text-sm"><span className="font-bold">Kesha</span> — Capitol Reporter</p>
        </div>
        <div className="border border-white/10 p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Schedule</h3>
          <p className="text-sm"><span className="font-bold">Morning Edition</span> — 6:00 AM CT</p>
          <p className="text-sm"><span className="font-bold">Evening Edition</span> — 5:00 PM CT</p>
        </div>
        <div className="border border-white/10 p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Format</h3>
          <p className="text-sm">Three acts per episode:</p>
          <p className="text-sm text-muted-foreground">The Briefing → The Deep Dive → The Outlook</p>
        </div>
      </div>

      <div className="h-px bg-white/20 mb-8" />

      {/* Episodes */}
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Episodes</h2>

      {playableEpisodes.length === 0 && episodes.length === 0 && (
        <p className="text-sm text-muted-foreground">No episodes yet. Check back after the morning edition.</p>
      )}

      <div className="space-y-8">
        {playableEpisodes.map((ep: any) => {
          const editionLabel = ep.edition === "morning" ? "Morning Edition" : "Evening Edition";
          const formattedDate = new Date(ep.date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });

          return (
            <div key={ep.id}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-coral)" }}>
                  {editionLabel}
                </span>
                <span className="text-xs text-muted-foreground">◆</span>
                <span className="text-xs text-muted-foreground">{formattedDate}</span>
              </div>
              <EditionPlayer
                episodeId={ep.id}
                edition={ep.edition}
                date={ep.date}
                playlist={ep.manifest.playlist}
                totalDuration={ep.manifest.totalDurationSeconds}
              />
            </div>
          );
        })}

        {/* Non-playable episodes (no manifest) */}
        {episodesWithManifests
          .filter((ep: any) => !ep.manifest?.playlist)
          .map((ep: any) => (
            <div key={ep.id} className="border border-white/10 p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-coral)" }}>
                  {ep.edition === "morning" ? "Morning Edition" : "Evening Edition"}
                </span>
                <span className="text-xs text-muted-foreground">◆</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(ep.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {ep.duration_seconds ? `${Math.floor(ep.duration_seconds / 60)} min` : ""} · {ep.segment_count ?? 3} segments
              </p>
            </div>
          ))}
      </div>

      {/* Back */}
      <div className="mt-12">
        <a href="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Today&apos;s News
        </a>
      </div>
    </div>
  );
}

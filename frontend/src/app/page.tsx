import { fetchStories, fetchEpisodes, fetchManifest, imageUrl, getSourceDisplay } from "@/lib/api";

export const revalidate = 30;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function hasImage(url: string | null): boolean {
  return !!url && url.length > 0;
}

export default async function HomePage() {
  const [stories, episodes] = await Promise.all([
    fetchStories({ all: true }),
    fetchEpisodes(),
  ]);

  // Find episode with manifest (parallel fetch)
  const manifests = await Promise.all(episodes.map((ep: any) => fetchManifest(ep.id)));
  const manifestIdx = manifests.findIndex((m: any) => m?.playlist);
  const latestEpisode = manifestIdx >= 0 ? episodes[manifestIdx] : null;
  const manifest = manifestIdx >= 0 ? manifests[manifestIdx] : null;

  // Separate "What Congress Did" stories from regular news
  const congressDigest = stories.filter((s: any) => s.headline?.startsWith("What Congress Did"));
  const newsStories = stories.filter((s: any) => !s.headline?.startsWith("What Congress Did"));

  // Lead with actual news, not congressional digest
  const leadStory = newsStories[0] ?? null;
  const sideStories = newsStories.slice(1, 4);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div>
      {/* Podcast info card (player is in the sticky bar) */}
      <section className="mb-10">
        <div className="border border-white/10 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-coral)" }}>
              {latestEpisode ? (latestEpisode.edition === "morning" ? "Morning Edition" : "Evening Edition") : "Podcast"}
            </span>
            {latestEpisode && (
              <>
                <span className="text-sm text-muted-foreground">◆</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(latestEpisode.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight mb-2">
            Your Milwaukee Briefing
          </h2>
          <p className="text-base text-muted-foreground mb-1">
            Marcus, Sarah & Kesha {manifest ? `◆ ${formatTime(manifest.totalDurationSeconds)} ◆ 3 acts` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            AI-produced from 8 data sources, every morning at 6 AM. Press play above ↑
          </p>
        </div>
      </section>

      {/* ─── TODAY'S NEWS ──────────────────────────────────── */}
      <div className="h-px bg-white/20 mb-6" />
      <h2 className="text-4xl md:text-5xl font-black uppercase tracking-[-0.03em] leading-none mb-1">
        Today&apos;s News
      </h2>
      <p className="text-sm text-muted-foreground uppercase tracking-[0.2em] mb-6">
        Milwaukee, Wisconsin ◆ {today}
      </p>
      <div className="h-px bg-white/20 mb-8" />

      {/* ─── LEAD + SIDEBAR (4 stories max) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
        {/* Lead story — 3 cols */}
        <div className="lg:col-span-3">
          {leadStory && (
            <a href={`/story/${leadStory.slug}`} className="group block">
              {hasImage(leadStory.image_url) && (
                <div className="relative p-1 border border-white/20 mb-5">
                  <div className="absolute inset-2 border border-white/10 pointer-events-none z-10" />
                  <img
                    src={imageUrl(leadStory.image_url) ?? ""}
                    alt=""
                    className="w-full aspect-[16/10] object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em]">
                <span className="font-bold" style={{ color: "var(--color-coral)" }}>
                  {leadStory.topic}
                </span>
                <span className="text-muted-foreground">◆</span>
                <span className="text-muted-foreground">{getSourceDisplay(leadStory)}</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight group-hover:text-[var(--color-coral)] transition-colors">
                {leadStory.headline}
              </h3>
              {leadStory.summary && (
                <p className="mt-3 text-base text-muted-foreground leading-relaxed line-clamp-3">
                  {leadStory.summary}
                </p>
              )}
              <span className="inline-block mt-3 text-sm text-[var(--color-coral)]">Read full story →</span>
            </a>
          )}
        </div>

        {/* Sidebar — 2 cols, 3 stories */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {sideStories.map((story: any, i: number) => (
              <a key={story.id} href={`/story/${story.slug}`} className="group block">
                {hasImage(story.image_url) && i === 0 && (
                  <div className="relative p-0.5 border border-white/20 mb-3">
                    <img
                      src={imageUrl(story.image_url) ?? ""}
                      alt=""
                      className="w-full aspect-[16/9] object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-[0.2em]">
                  <span className="font-bold" style={{ color: "var(--color-coral)" }}>
                    {story.topic}
                  </span>
                  <span className="text-muted-foreground">◆</span>
                  <span className="text-muted-foreground">{getSourceDisplay(story)}</span>
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {story.headline}
                </h3>
                {!hasImage(story.image_url) && story.summary && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{story.summary}</p>
                )}
                {i < sideStories.length - 1 && <div className="h-px bg-white/10 mt-6" />}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ─── WHAT CONGRESS DID ────────────────────────────── */}
      {congressDigest.length > 0 && (
        <>
          <div className="h-px bg-white/20 mb-6" />
          <h2 className="text-2xl font-black uppercase tracking-tight mb-6">What Congress Did</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-12">
            {congressDigest.slice(0, 3).map((story: any) => (
              <a key={story.id} href={`/story/${story.slug}`}
                 className="border border-white/10 p-5 hover:border-[var(--color-coral)]/50 transition-colors group">
                {hasImage(story.image_url) && (
                  <img
                    src={imageUrl(story.image_url) ?? ""}
                    alt=""
                    className="w-full aspect-[16/9] object-cover grayscale group-hover:grayscale-0 transition-all duration-500 mb-3"
                  />
                )}
                <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-[0.2em]">
                  <span className="font-bold" style={{ color: "var(--color-coral)" }}>{story.topic}</span>
                  <span className="text-muted-foreground">◆</span>
                  <span className="text-muted-foreground">{getSourceDisplay(story)}</span>
                </div>
                <h3 className="text-base font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {story.headline}
                </h3>
                {story.summary && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{story.summary}</p>
                )}
              </a>
            ))}
          </div>
        </>
      )}

      {/* ─── LATEST EPISODES ───────────────────────────────── */}
      <div className="h-px bg-white/20 mb-6" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black uppercase tracking-tight">Latest Episodes</h2>
        <a href="/podcast" className="text-sm uppercase tracking-[0.15em] text-[var(--color-coral)] hover:underline">
          All Episodes
        </a>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {episodes.slice(0, 3).map((ep: any) => {
          const edLabel = ep.edition === "morning" ? "Morning Edition" : "Evening Edition";
          const dur = ep.duration_seconds ? formatTime(ep.duration_seconds) : "~9:00";
          const dateStr = new Date(ep.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return (
            <a key={ep.id} href="/podcast"
               className="border border-white/10 p-5 flex items-center gap-4 hover:border-[var(--color-coral)]/50 transition-colors group">
              <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center shrink-0 group-hover:border-[var(--color-coral)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black uppercase tracking-tight">{edLabel}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{dateStr}</span>
                  <span className="text-xs text-muted-foreground">{dur}</span>
                </div>
              </div>
            </a>
          );
        })}
        {episodes.length === 0 && (
          <div className="border border-white/10 p-5 text-sm text-muted-foreground col-span-3 text-center">
            Episodes coming soon
          </div>
        )}
      </div>

      {/* ─── EXPLORE ───────────────────────────────────────── */}
      <div className="h-px bg-white/20 mb-6" />
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Explore</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <a href="/city-hall" className="border border-white/10 p-5 hover:border-[var(--color-coral)]/50 transition-colors group text-center">
          <h3 className="text-base font-black uppercase tracking-tight group-hover:text-[var(--color-coral)] transition-colors">City Hall</h3>
          <p className="text-xs text-muted-foreground mt-1">Civic digest</p>
        </a>
        <a href="/bills/house" className="border border-white/10 p-5 hover:border-[var(--color-coral)]/50 transition-colors group text-center">
          <h3 className="text-base font-black uppercase tracking-tight group-hover:text-[var(--color-coral)] transition-colors">Congress</h3>
          <p className="text-xs text-muted-foreground mt-1">Federal bills</p>
        </a>
        <a href="/bills/wisconsin" className="border border-white/10 p-5 hover:border-[var(--color-coral)]/50 transition-colors group text-center">
          <h3 className="text-base font-black uppercase tracking-tight group-hover:text-[var(--color-coral)] transition-colors">Wisconsin</h3>
          <p className="text-xs text-muted-foreground mt-1">State legislature</p>
        </a>
        <a href="/podcast" className="border border-white/10 p-5 hover:border-[var(--color-coral)]/50 transition-colors group text-center">
          <h3 className="text-base font-black uppercase tracking-tight group-hover:text-[var(--color-coral)] transition-colors">Podcast</h3>
          <p className="text-xs text-muted-foreground mt-1">All episodes</p>
        </a>
      </div>
    </div>
  );
}

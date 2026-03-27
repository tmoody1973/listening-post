import { fetchStories, fetchEpisodes, fetchManifest } from "@/lib/api";
import { EditionPlayer } from "@/components/EditionPlayer";

export const revalidate = 300;

export default async function HomePage() {
  const [stories, episodes] = await Promise.all([
    fetchStories({ all: true }),
    fetchEpisodes(),
  ]);

  const latestEpisode = episodes[0] ?? null;
  let manifest = null;
  if (latestEpisode) {
    manifest = await fetchManifest(latestEpisode.id);
  }

  // Split stories by role
  const leadStory = stories[0] ?? null;
  const sideStories = stories.slice(1, 4);
  const numberedStories = stories.slice(4, 8);
  const gridStories = stories.slice(8, 14);
  const moreStories = stories.slice(14, 24);

  // Group by topic for bottom sections
  const topicGroups: Record<string, any[]> = {};
  for (const story of stories) {
    const t = story.topic ?? "economy";
    if (!topicGroups[t]) topicGroups[t] = [];
    topicGroups[t].push(story);
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-white/10 pb-6 mb-8">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none">
          Today&apos;s News
        </h1>
        <p className="mt-2 text-sm text-muted-foreground uppercase tracking-widest">
          Milwaukee, Wisconsin — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Lead Story + Side Column */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
        {/* Lead — 3 cols */}
        <div className="lg:col-span-3">
          {leadStory && (
            <a href={`/story/${leadStory.slug}`} className="group block">
              {leadStory.image_url && (
                <div className="aspect-[16/10] overflow-hidden mb-4">
                  <img
                    src={leadStory.image_url}
                    alt=""
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-coral)]">
                  {leadStory.topic}
                </span>
                <span className="text-xs text-muted-foreground">
                  {leadStory.source}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight group-hover:text-[var(--color-coral)] transition-colors">
                {leadStory.headline}
              </h2>
              {leadStory.summary && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {leadStory.summary}
                </p>
              )}
            </a>
          )}

          {/* Numbered Popular Stories */}
          {numberedStories.length > 0 && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="space-y-4">
                {numberedStories.map((story: any, i: number) => (
                  <a
                    key={story.id}
                    href={`/story/${story.slug}`}
                    className="flex gap-4 group"
                  >
                    <span className="text-2xl font-black text-muted-foreground/30 w-8 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-coral)]">
                          {story.topic}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{story.source}</span>
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors line-clamp-2">
                        {story.headline}
                      </h3>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side column — 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {sideStories.map((story: any) => (
            <a
              key={story.id}
              href={`/story/${story.slug}`}
              className="group block"
            >
              {story.image_url && (
                <div className="aspect-[16/10] overflow-hidden mb-3">
                  <img
                    src={story.image_url}
                    alt=""
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-coral)]">
                  {story.topic}
                </span>
                <span className="text-[10px] text-muted-foreground">{story.source}</span>
              </div>
              <h3 className="text-sm font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                {story.headline}
              </h3>
            </a>
          ))}

          {/* Arrow link */}
          <div className="flex justify-end">
            <span className="text-muted-foreground text-xl">→</span>
          </div>
        </div>
      </div>

      {/* Edition Player — Podcast Section */}
      <div className="border-t border-white/10 pt-8 mb-12">
        <h2 className="text-2xl font-black uppercase tracking-tight mb-6">Latest Podcast</h2>
        {latestEpisode && manifest?.playlist ? (
          <EditionPlayer
            episodeId={latestEpisode.id}
            edition={latestEpisode.edition}
            date={latestEpisode.date}
            playlist={manifest.playlist}
            totalDuration={manifest.totalDurationSeconds}
          />
        ) : (
          <div className="rounded-lg border border-white/10 p-6 text-center text-sm text-muted-foreground">
            Next edition coming soon
          </div>
        )}
      </div>

      {/* Story Grid */}
      {gridStories.length > 0 && (
        <div className="border-t border-white/10 pt-8 mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {gridStories.map((story: any) => (
              <a
                key={story.id}
                href={`/story/${story.slug}`}
                className="group block"
              >
                {story.image_url && (
                  <div className="aspect-[16/10] overflow-hidden mb-3">
                    <img
                      src={story.image_url}
                      alt=""
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-coral)]">
                    {story.topic}
                  </span>
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors line-clamp-2">
                  {story.headline}
                </h3>
                {story.summary && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {story.summary}
                  </p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Topic Sections */}
      <div className="border-t border-white/10 pt-8 mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Object.entries(topicGroups).slice(0, 4).map(([topic, topicStories]) => (
            <div key={topic}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest">
                  {topic} <span className="text-muted-foreground font-normal">{topicStories.length}</span>
                </h3>
                <a href={`/topic/${topic}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
                  View all
                </a>
              </div>
              <div className="space-y-3">
                {topicStories.slice(0, 3).map((story: any) => (
                  <a
                    key={story.id}
                    href={`/story/${story.slug}`}
                    className="block group"
                  >
                    <h4 className="text-xs font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors line-clamp-2">
                      {story.headline}
                    </h4>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* More Stories — compact list */}
      {moreStories.length > 0 && (
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">More Stories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {moreStories.map((story: any) => (
              <a
                key={story.id}
                href={`/story/${story.slug}`}
                className="flex items-baseline gap-3 group py-2 border-b border-white/5"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-coral)] shrink-0 w-16">
                  {story.topic}
                </span>
                <h4 className="text-xs font-medium group-hover:text-[var(--color-coral)] transition-colors line-clamp-1">
                  {story.headline}
                </h4>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

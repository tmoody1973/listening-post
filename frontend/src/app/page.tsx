import { fetchStories, fetchEpisodes, fetchManifest, fetchFloorData, getTopicColor } from "@/lib/api";
import { EditionPlayer } from "@/components/EditionPlayer";

export const revalidate = 300;

export default async function HomePage() {
  const [stories, episodes, floorData] = await Promise.all([
    fetchStories({ all: true }),
    fetchEpisodes(),
    fetchFloorData(),
  ]);

  const latestEpisode = episodes[0] ?? null;
  let manifest = null;
  if (latestEpisode) {
    manifest = await fetchManifest(latestEpisode.id);
  }

  // Split stories
  const leadStory = stories[0] ?? null;
  const sideStories = stories.slice(1, 4);
  const latestStories = stories.slice(4, 8);

  // Group by topic
  const topicGroups: Record<string, any[]> = {};
  for (const story of stories) {
    const t = story.topic ?? "economy";
    if (!topicGroups[t]) topicGroups[t] = [];
    if (topicGroups[t].length < 3) topicGroups[t].push(story);
  }

  const federalBills = floorData?.federalBills ?? [];
  const stateBills = floorData?.stateBills ?? [];
  const presidentialActions = floorData?.presidentialActions ?? [];
  const congressionalRecord = floorData?.congressionalRecord ?? [];

  return (
    <div>
      {/* ─── EDITION PLAYER (Hero) ─────────────────────────── */}
      <section className="mb-8">
        {latestEpisode && manifest?.playlist ? (
          <EditionPlayer
            episodeId={latestEpisode.id}
            edition={latestEpisode.edition}
            date={latestEpisode.date}
            playlist={manifest.playlist}
            totalDuration={manifest.totalDurationSeconds}
          />
        ) : (
          <div className="border border-white/10 p-6 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Next edition coming soon
          </div>
        )}
      </section>

      {/* ─── TODAY'S NEWS ──────────────────────────────────── */}
      <div className="h-px bg-white/20 mb-6" />
      <h2 className="text-5xl md:text-6xl font-black uppercase tracking-[-0.03em] leading-none mb-1">
        Today&apos;s News
      </h2>
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-6">
        Milwaukee, Wisconsin ◆ {new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
      </p>
      <div className="h-px bg-white/20 mb-8" />

      {/* ─── LEAD + SIDEBAR ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-10">
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
              <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.2em]">
                <span className="font-bold" style={{ color: getTopicColor(leadStory.topic) }}>
                  {leadStory.topic}
                </span>
                <span className="text-muted-foreground">◆</span>
                <span className="text-muted-foreground">{leadStory.source}</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight group-hover:text-[var(--color-coral)] transition-colors">
                {leadStory.headline}
              </h3>
              {leadStory.summary && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {leadStory.summary}
                </p>
              )}
            </a>
          )}
        </div>

        {/* Sidebar — 2 cols */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {sideStories.map((story: any) => (
              <a key={story.id} href={`/story/${story.slug}`} className="group block">
                {story.image_url && (
                  <div className="aspect-[16/10] overflow-hidden mb-3">
                    <img
                      src={story.image_url}
                      alt=""
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1 text-[10px] uppercase tracking-[0.2em]">
                  <span className="font-bold" style={{ color: getTopicColor(story.topic) }}>
                    {story.topic}
                  </span>
                  <span className="text-muted-foreground">◆</span>
                  <span className="text-muted-foreground">{story.source}</span>
                </div>
                <h3 className="text-sm font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {story.headline}
                </h3>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ─── ON THE FLOOR ──────────────────────────────────── */}
      <div className="h-px bg-white/20 mb-8" />
      <h2 className="text-4xl md:text-5xl font-black uppercase tracking-[-0.02em] leading-none mb-8">On the Floor</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {/* Column 1: Congressional Record & Presidential Actions */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 pb-3 border-b border-white/10">
            Congressional Record & President
          </h3>
          <div className="space-y-5">
            {congressionalRecord.slice(0, 3).map((rec: any) => (
              <div key={rec.id}>
                <span className="text-xs text-muted-foreground">{rec.date}</span>
                <p className="text-base font-black uppercase tracking-tight leading-snug mt-1">
                  {rec.title}
                </p>
              </div>
            ))}
            {presidentialActions.slice(0, 3).map((action: any) => (
              <div key={action.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    action.status === "signed" ? "bg-green-900/50 text-green-400" :
                    action.status === "vetoed" ? "bg-red-900/50 text-red-400" :
                    "bg-amber-900/50 text-amber-400"
                  }`}>
                    {action.status}
                  </span>
                </div>
                <p className="text-base font-black uppercase tracking-tight leading-snug">
                  {action.bill_identifier}: {action.title?.slice(0, 60)}
                </p>
              </div>
            ))}
            {congressionalRecord.length === 0 && presidentialActions.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </div>
        </div>

        {/* Column 2: House & Senate Bills */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 pb-3 border-b border-white/10">
            House & Senate Bills
          </h3>
          <div className="space-y-5">
            {federalBills.slice(0, 6).map((bill: any) => (
              <a
                key={bill.id}
                href={bill.source_url ?? `/story/${bill.id}`}
                target={bill.source_url ? "_blank" : undefined}
                className="block group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-muted-foreground">{bill.identifier}</span>
                  {bill.status && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-900/50 text-blue-400">
                      {bill.status?.slice(0, 25)}
                    </span>
                  )}
                </div>
                <p className="text-base font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {bill.title?.slice(0, 80)}
                </p>
              </a>
            ))}
            {federalBills.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent bills</p>
            )}
          </div>
        </div>

        {/* Column 3: Wisconsin State Legislature */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 pb-3 border-b border-white/10">
            Wisconsin State Legislature
          </h3>
          <div className="space-y-5">
            {stateBills.slice(0, 6).map((bill: any) => (
              <a
                key={bill.id}
                href={bill.source_url ?? `/story/${bill.id}`}
                target={bill.source_url ? "_blank" : undefined}
                className="block group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-muted-foreground">{bill.identifier}</span>
                  {bill.last_action && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-900/50 text-amber-400">
                      {bill.last_action?.slice(0, 25)}
                    </span>
                  )}
                </div>
                <p className="text-base font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {bill.title?.slice(0, 80)}
                </p>
              </a>
            ))}
            {stateBills.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent bills</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── LATEST STORIES ────────────────────────────────── */}
      <div className="h-px bg-white/20 mb-6" />
      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Latest</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {latestStories.map((story: any) => (
          <a key={story.id} href={`/story/${story.slug}`} className="group block">
            {story.image_url && (
              <div className="aspect-[16/10] overflow-hidden mb-3">
                <img
                  src={story.image_url}
                  alt=""
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
              </div>
            )}
            <div className="flex items-center gap-2 mb-1 text-[10px] uppercase tracking-[0.2em]">
              <span className="font-bold" style={{ color: getTopicColor(story.topic) }}>
                {story.topic}
              </span>
              <span className="text-muted-foreground">◆</span>
              <span className="text-muted-foreground">{story.source}</span>
            </div>
            <h3 className="text-xs font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors line-clamp-3">
              {story.headline}
            </h3>
          </a>
        ))}
      </div>

      {/* ─── PODCAST (Section C repeat) ────────────────────── */}
      <div className="h-px bg-white/20 mb-6" />
      <h2 className="text-2xl font-black uppercase tracking-tight mb-6">Latest Podcast</h2>
      {latestEpisode && manifest?.playlist ? (
        <div className="mb-10">
          <EditionPlayer
            episodeId={latestEpisode.id}
            edition={latestEpisode.edition}
            date={latestEpisode.date}
            playlist={manifest.playlist}
            totalDuration={manifest.totalDurationSeconds}
          />
        </div>
      ) : null}

      {/* ─── TOPIC SECTIONS ────────────────────────────────── */}
      <div className="h-px bg-white/20 mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {Object.entries(topicGroups)
          .filter(([topic]) => !["culture", "sports"].includes(topic))
          .slice(0, 8)
          .map(([topic, topicStories]) => (
          <div key={topic}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <h3 className="text-sm font-black uppercase tracking-[0.15em]">
                {topic} <span className="text-muted-foreground font-normal">{topicStories.length}</span>
              </h3>
              <a href={`/topic/${topic}`} className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors">
                View all
              </a>
            </div>
            <div className="space-y-4">
              {topicStories.map((story: any) => (
                <a key={story.id} href={`/story/${story.slug}`} className="block group">
                  <h4 className="text-sm font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors line-clamp-2">
                    {story.headline}
                  </h4>
                  <span className="text-xs text-muted-foreground mt-1 block">{story.source}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

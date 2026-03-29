import { fetchTopicData, fetchFredData, getTopicColor, imageUrl, getSourceDisplay } from "@/lib/api";

export const revalidate = 30;

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  housing: "Zoning, rent, building permits, real estate, and homelessness in Milwaukee",
  economy: "Jobs, wages, taxes, budget, trade, and economic development",
  business: "Companies, hiring, startups, corporate news, and local business",
  education: "Schools, universities, MPS, UW system, and student issues",
  transit: "Roads, buses, MCTS, streetcar, highways, and infrastructure",
  safety: "Police, courts, criminal justice reform, and public safety policy",
  health: "Hospitals, insurance, mental health, Medicaid, and public health",
  environment: "Climate, water, pollution, parks, and energy policy",
  politics: "Elections, campaigns, voting, executive orders, and policy debates",
};

function hasImage(url: string | null): boolean {
  return !!url && url.length > 0;
}

export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;

  const [topicData, fredData] = await Promise.all([
    fetchTopicData(topic),
    fetchFredData(topic),
  ]);

  const stories = topicData?.stories ?? [];
  const bills = topicData?.bills ?? [];
  const fredSeries = fredData?.series ?? [];

  // Separate lead from grid
  const leadStory = stories[0] ?? null;
  const gridStories = stories.slice(1, 7);
  const moreStories = stories.slice(7);

  // Filter bills with readable titles (not "Relating to:")
  const cleanBills = bills.filter((b: any) =>
    b.title && !b.title.startsWith("Relating to:")
  ).slice(0, 6);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: getTopicColor(topic) }}>
          Topic
        </span>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-[-0.02em] leading-none mt-2">
          {topic}
        </h1>
        <p className="text-base text-muted-foreground mt-3">
          {TOPIC_DESCRIPTIONS[topic] ?? `Coverage of ${topic} in Milwaukee`}
        </p>
      </div>

      <div className="h-px bg-white/20 mb-8" />

      {/* FRED Stats */}
      {fredSeries.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Key Indicators</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {fredSeries.map((series: any) => (
              <div key={series.seriesId} className="border border-white/10 p-5">
                <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  {series.title}
                </span>
                <p className="text-2xl font-black mt-2">
                  {series.units === "$" && "$"}{series.units === "$/gal" && "$"}{series.latestValue?.toLocaleString()}{series.units === "%" && "%"}{series.units === "$/gal" && "/gal"}
                </p>
                {series.changePercent != null && (
                  <span className={`text-sm font-bold ${series.changePercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {series.changePercent >= 0 ? "+" : ""}{series.changePercent.toFixed(1)}%
                  </span>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {series.frequency} · {series.latestDate}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-px bg-white/20 mb-8" />

      {/* Lead story */}
      {leadStory && (
        <div className="mb-10">
          <a href={`/story/${leadStory.slug}`} className="group block">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {hasImage(leadStory.image_url) && (
                <div className="relative p-1 border border-white/20">
                  <div className="absolute inset-2 border border-white/10 pointer-events-none z-10" />
                  <img
                    src={imageUrl(leadStory.image_url) ?? ""}
                    alt=""
                    className="w-full aspect-[16/10] object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em]">
                  <span className="font-bold" style={{ color: getTopicColor(topic) }}>{topic}</span>
                  <span className="text-muted-foreground">◆</span>
                  <span className="text-muted-foreground">{getSourceDisplay(leadStory)}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight group-hover:text-[var(--color-coral)] transition-colors">
                  {leadStory.headline}
                </h2>
                {leadStory.summary && (
                  <p className="mt-3 text-base text-muted-foreground leading-relaxed line-clamp-4">
                    {leadStory.summary}
                  </p>
                )}
                <span className="inline-block mt-3 text-sm text-[var(--color-coral)]">Read full story →</span>
              </div>
            </div>
          </a>
        </div>
      )}

      {/* Story grid */}
      {gridStories.length > 0 && (
        <>
          <div className="h-px bg-white/20 mb-8" />
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Coverage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {gridStories.map((story: any) => (
              <a key={story.id} href={`/story/${story.slug}`} className="group block">
                {hasImage(story.image_url) && (
                  <div className="relative p-0.5 border border-white/20 mb-3">
                    <img
                      src={imageUrl(story.image_url) ?? ""}
                      alt=""
                      className="w-full aspect-[16/10] object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-[0.2em]">
                  <span className="font-bold" style={{ color: getTopicColor(topic) }}>{topic}</span>
                  <span className="text-muted-foreground">◆</span>
                  <span className="text-muted-foreground">{getSourceDisplay(story)}</span>
                </div>
                <h3 className="text-base font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {story.headline}
                </h3>
              </a>
            ))}
          </div>
        </>
      )}

      {/* Active Legislation */}
      {cleanBills.length > 0 && (
        <>
          <div className="h-px bg-white/20 mb-8" />
          <h2 className="text-2xl font-black uppercase tracking-tight mb-6">Active Legislation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {cleanBills.map((bill: any) => (
              <a key={bill.id} href={`/bill/${encodeURIComponent(bill.id)}`}
                 className="block border border-white/10 p-5 hover:border-[var(--color-coral)]/50 transition-colors group">
                <div className="flex items-center gap-2 mb-2">
                  {bill.identifier && <span className="text-xs font-bold text-muted-foreground">{bill.identifier}</span>}
                  {bill.status && (
                    <span className="inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide bg-blue-900/50 text-blue-400">
                      {bill.status?.slice(0, 25)}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {bill.title?.slice(0, 100)}
                </h3>
                {bill.sponsor_name && <p className="text-sm text-muted-foreground mt-1">{bill.sponsor_name}</p>}
              </a>
            ))}
          </div>
        </>
      )}

      {/* More stories list */}
      {moreStories.length > 0 && (
        <>
          <div className="h-px bg-white/20 mb-8" />
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">More</h2>
          <div className="space-y-3 mb-10">
            {moreStories.slice(0, 10).map((story: any) => (
              <a key={story.id} href={`/story/${story.slug}`} className="flex items-baseline gap-3 group py-2 border-b border-white/5">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground shrink-0">
                  {getSourceDisplay(story)}
                </span>
                <h4 className="text-sm font-bold group-hover:text-[var(--color-coral)] transition-colors">
                  {story.headline}
                </h4>
              </a>
            ))}
          </div>
        </>
      )}

      {stories.length === 0 && (
        <p className="text-base text-muted-foreground py-10">No stories yet for this topic. Check back after the next edition.</p>
      )}

      {/* Back */}
      <div className="mt-12">
        <a href="/" className="text-sm uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Today&apos;s News
        </a>
      </div>
    </div>
  );
}

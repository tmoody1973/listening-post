import { fetchTopicData, fetchFredData, getTopicColor, imageUrl, getSourceDisplay } from "@/lib/api";
import { Separator } from "@/components/ui/separator";

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

export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;

  const [topicData, fredData] = await Promise.all([
    fetchTopicData(topic),
    fetchFredData(topic),
  ]);

  const stories = topicData?.stories ?? [];
  const bills = topicData?.bills ?? [];
  const fredSeries = fredData?.series ?? [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <span
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: getTopicColor(topic) }}
        >
          Topic
        </span>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[-0.02em] leading-none mt-2">
          {topic}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {TOPIC_DESCRIPTIONS[topic] ?? `Coverage of ${topic} in Milwaukee`}
        </p>
      </div>

      <div className="h-px bg-white/20 mb-8" />

      {/* FRED Stats */}
      {fredSeries.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Key Indicators</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {fredSeries.map((series: any) => (
              <div key={series.seriesId} className="border border-white/10 p-4">
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {series.title}
                </span>
                <p className="text-2xl font-black mt-1">
                  {series.units === "$" && "$"}{series.latestValue?.toLocaleString()}{series.units === "%" && "%"}
                </p>
                {series.changePercent != null && (
                  <span className={`text-xs font-bold ${series.changePercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {series.changePercent >= 0 ? "+" : ""}{series.changePercent.toFixed(1)}%
                  </span>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {series.frequency} · {series.latestDate}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Bills */}
      {bills.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Active Legislation</h2>
          <div className="space-y-4">
            {bills.map((bill: any) => (
              <a
                key={bill.id}
                href={`/bill/${encodeURIComponent(bill.id)}`}
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
                  {bill.title?.slice(0, 100)}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="h-px bg-white/20 mb-8" />

      {/* Stories */}
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Coverage</h2>
      {stories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stories yet for this topic.</p>
      ) : (
        <div className="space-y-8">
          {stories.map((story: any) => (
            <a
              key={story.id}
              href={`/story/${story.slug}`}
              className="flex gap-6 group"
            >
              {story.image_url && (
                <div className="w-48 shrink-0">
                  <div className="relative p-0.5 border border-white/20">
                    <img
                      src={imageUrl(story.image_url) ?? ""}
                      alt=""
                      className="w-full aspect-[16/10] object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 text-[10px] uppercase tracking-[0.2em]">
                  <span className="font-bold" style={{ color: getTopicColor(topic) }}>
                    {topic}
                  </span>
                  <span className="text-muted-foreground">◆</span>
                  <span className="text-muted-foreground">{getSourceDisplay(story)}</span>
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {story.headline}
                </h3>
                {story.summary && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{story.summary}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Back */}
      <div className="mt-12">
        <a href="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Today&apos;s News
        </a>
      </div>
    </div>
  );
}

import { fetchArticle, imageUrl } from "@/lib/api";
import { TopicLabel } from "@/components/TopicLabel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const revalidate = 300;

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchArticle(slug);

  if (!data?.article) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Article not found
      </div>
    );
  }

  const article = data.article;
  const related = data.related ?? [];

  const sources = article.sources_json ? JSON.parse(article.sources_json) : [];
  const billData = article.bill_data_json ? JSON.parse(article.bill_data_json) : null;

  return (
    <article className="max-w-[680px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <TopicLabel topic={article.topic} />
        <h1
          className="mt-2 text-2xl font-medium leading-tight"
                 >
          {article.headline}
        </h1>
        {article.summary && (
          <p className="mt-3 text-muted-foreground leading-relaxed">
            {article.summary}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {article.edition && (
            <Badge variant="outline" className="text-xs">
              {article.edition === "morning" ? "Morning Edition" : "Evening Edition"}
            </Badge>
          )}
          <span>{new Date(article.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          <span>AI-generated</span>
        </div>
      </div>

      {/* Hero Image */}
      {article.image_url && (
        <div className="mb-6">
          <div className="aspect-[16/9] rounded-lg overflow-hidden bg-muted">
            <img src={imageUrl(article.image_url) ?? ""} alt="" className="w-full h-full object-cover" />
          </div>
          {article.image_attribution && (
            <p className="mt-1 text-xs text-muted-foreground italic">
              {article.image_attribution}
            </p>
          )}
        </div>
      )}

      {/* Article Body */}
      {article.body && (
        <div
          className="prose prose-sm max-w-none leading-relaxed"
          style={{ lineHeight: "1.7" }}
        >
          {article.body.split("\n\n").map((paragraph: string, i: number) => (
            <p key={i} className="mb-4 text-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {/* Bill Tracker */}
      {billData && (
        <>
          <Separator className="my-8" />
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Bill Tracker</h3>
            <div className="space-y-2 text-sm">
              {billData.identifier && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bill</span>
                  <span className="font-medium">{billData.identifier}</span>
                </div>
              )}
              {billData.status && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline">{billData.status}</Badge>
                </div>
              )}
              {billData.sponsor && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sponsor</span>
                  <span>{billData.sponsor}</span>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Source Attribution */}
      <Separator className="my-8" />
      <div className="border border-white/10 p-5">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Sources & Attribution</h3>
        <div className="space-y-3">
          {/* Original source — only show for Perigon/Congress/OpenStates (reliable URLs) */}
          {article.source_url && ["perigon", "congress", "openstates", "fred"].includes(article.source) && (
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-24 shrink-0 pt-0.5">Original</span>
              <a
                href={article.source_url}
                className="text-sm text-[var(--color-coral)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {article.image_attribution && !["perigon", "AI-generated illustration", "OpenStates", "Congress.gov", "FRED"].includes(article.image_attribution)
                  ? article.image_attribution
                  : article.source === "congress" ? "Congress.gov"
                  : article.source === "openstates" ? "Wisconsin Legislature"
                  : article.source === "fred" ? "Federal Reserve Economic Data"
                  : "Original source"
                } →
              </a>
            </div>
          )}
          {/* Data source */}
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-24 shrink-0 pt-0.5">Data</span>
            <span className="text-sm text-muted-foreground">
              {article.source === "congress" ? "Congress.gov API"
                : article.source === "openstates" ? "OpenStates API (Wisconsin)"
                : article.source === "fred" ? "Federal Reserve Economic Data (FRED)"
                : article.source === "perplexity" ? "Multiple news sources via web search"
                : "Perigon News API"
              }
            </span>
          </div>
          {/* AI attribution */}
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-24 shrink-0 pt-0.5">Analysis</span>
            <span className="text-sm text-muted-foreground">AI-generated article by The Listening Post</span>
          </div>
          {/* Additional parsed sources */}
          {sources.length > 0 && sources.map((source: any, i: number) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-24 shrink-0 pt-0.5">Ref {i + 1}</span>
              {source.url ? (
                <a href={source.url} className="text-sm text-[var(--color-coral)] hover:underline" target="_blank" rel="noopener noreferrer">
                  {source.name ?? source.url}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">{source.name ?? "Source"}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Related Stories */}
      {related.length > 0 && (
        <>
          <Separator className="my-8" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Related Coverage
          </h3>
          <div className="space-y-3">
            {related.map((r: any) => (
              <div key={r.id} className="text-sm">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: `var(--color-topic-${r.topic})` }}
                >
                  {r.topic}
                </span>
                <p className="font-medium leading-snug">
                  {r.headline}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

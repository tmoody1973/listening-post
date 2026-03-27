import { fetchArticle } from "@/lib/api";
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
            <img src={article.image_url} alt="" className="w-full h-full object-cover" />
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
      {(sources.length > 0 || article.source_url) && (
        <>
          <Separator className="my-8" />
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Sources</h3>
            <ol className="space-y-2 text-sm list-decimal list-inside text-muted-foreground">
              {sources.map((source: any, i: number) => (
                <li key={i}>
                  {source.url ? (
                    <a href={source.url} className="hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">
                      {source.name ?? source.url}
                    </a>
                  ) : (
                    <span>{source.name ?? "Source"}</span>
                  )}
                </li>
              ))}
              {article.source_url && sources.length === 0 && (
                <li>
                  <a href={article.source_url} className="hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">
                    {article.source} — original source
                  </a>
                </li>
              )}
            </ol>
          </Card>
        </>
      )}

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

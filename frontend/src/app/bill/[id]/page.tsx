import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getTopicColor, imageUrl } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://listening-post.tarikjmoody.workers.dev";

export const revalidate = 300;

async function fetchBill(id: string) {
  const res = await fetch(`${API_BASE}/api/bill/${encodeURIComponent(id)}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.json();
}

function getStatusColor(status: string | null): string {
  if (!status) return "bg-zinc-800 text-zinc-400";
  const s = status.toLowerCase();
  if (s.includes("passed") || s.includes("signed") || s.includes("enacted")) return "bg-green-900/60 text-green-400";
  if (s.includes("committee") || s.includes("referred")) return "bg-blue-900/60 text-blue-400";
  if (s.includes("introduced") || s.includes("read")) return "bg-amber-900/60 text-amber-400";
  if (s.includes("failed") || s.includes("vetoed")) return "bg-red-900/60 text-red-400";
  return "bg-zinc-800 text-zinc-400";
}

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchBill(id);

  if (!data?.bill) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Bill not found
      </div>
    );
  }

  const bill = data.bill;
  const story = data.story;
  const actions = bill.actions_json ? JSON.parse(bill.actions_json) : [];
  const isFederal = bill.source === "congress";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3 text-xs uppercase tracking-[0.2em]">
          <span className="font-bold" style={{ color: getTopicColor(bill.topic ?? "politics") }}>
            {bill.topic ?? "politics"}
          </span>
          <span className="text-muted-foreground">◆</span>
          <span className="text-muted-foreground">
            {isFederal ? "U.S. Congress" : "Wisconsin State Legislature"}
          </span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-black uppercase tracking-tight text-muted-foreground">
            {bill.identifier}
          </span>
          {bill.status && (
            <span className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-wide ${getStatusColor(bill.status)}`}>
              {bill.status}
            </span>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-tight">
          {bill.title}
        </h1>
      </div>

      <div className="h-px bg-white/20 mb-8" />

      {/* Bill Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        {/* Sponsor */}
        <Card className="p-5 bg-zinc-900/50 border-white/10">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">Sponsor</h3>
          <p className="text-lg font-bold">{bill.sponsor_name ?? "Not available"}</p>
        </Card>

        {/* Date */}
        <Card className="p-5 bg-zinc-900/50 border-white/10">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">Last Action Date</h3>
          <p className="text-lg font-bold">
            {bill.last_action_date
              ? new Date(bill.last_action_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
              : "Not available"}
          </p>
        </Card>

        {/* Source */}
        <Card className="p-5 bg-zinc-900/50 border-white/10">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">Source</h3>
          {bill.source_url ? (
            <a
              href={bill.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-bold text-[var(--color-coral)] hover:underline"
            >
              View on {isFederal ? "Congress.gov" : "OpenStates"} →
            </a>
          ) : (
            <p className="text-lg font-bold text-muted-foreground">Not available</p>
          )}
        </Card>
      </div>

      {/* Summary */}
      {bill.summary && (
        <>
          <h2 className="text-xl font-black uppercase tracking-tight mb-4">Summary</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-8">
            {bill.summary}
          </p>
        </>
      )}

      {/* AI-Generated Article */}
      {story?.body && (
        <>
          <div className="h-px bg-white/20 mb-8" />
          <h2 className="text-xl font-black uppercase tracking-tight mb-4">Analysis</h2>
          {story.image_url && (
            <div className="relative p-1 border border-white/20 mb-6">
              <div className="absolute inset-2 border border-white/10 pointer-events-none z-10" />
              <img
                src={imageUrl(story.image_url) ?? ""}
                alt=""
                className="w-full aspect-[16/9] object-cover"
              />
            </div>
          )}
          <div style={{ lineHeight: "1.7" }}>
            {story.body.split("\n\n").map((paragraph: string, i: number) => (
              <p key={i} className="mb-4 text-base text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </>
      )}

      {/* Latest Action */}
      {bill.last_action && (
        <>
          <div className="h-px bg-white/20 mb-8 mt-8" />
          <h2 className="text-xl font-black uppercase tracking-tight mb-4">Latest Action</h2>
          <div className="flex items-start gap-3">
            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mt-1 ${getStatusColor(bill.last_action)}`}>
              {bill.last_action_date
                ? new Date(bill.last_action_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : ""}
            </span>
            <p className="text-base font-bold uppercase tracking-tight">{bill.last_action}</p>
          </div>
        </>
      )}

      {/* Action History */}
      {actions.length > 0 && (
        <>
          <div className="h-px bg-white/20 mb-8 mt-8" />
          <h2 className="text-xl font-black uppercase tracking-tight mb-6">Action History</h2>
          <div className="space-y-4">
            {actions.map((action: any, i: number) => (
              <div key={i} className="flex items-start gap-4">
                <span className="text-xs text-muted-foreground whitespace-nowrap w-20 shrink-0 pt-0.5">
                  {action.date
                    ? new Date(action.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : ""}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold uppercase tracking-tight">
                    {action.description ?? action.text ?? String(action)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Back link */}
      <div className="mt-12">
        <a href="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Today&apos;s News
        </a>
      </div>
    </div>
  );
}

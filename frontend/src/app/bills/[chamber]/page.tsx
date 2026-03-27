import { getTopicColor } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://listening-post.tarikjmoody.workers.dev";

export const revalidate = 30;

const CHAMBER_INFO: Record<string, { title: string; description: string }> = {
  house: {
    title: "House Bills",
    description: "Legislation in the U.S. House of Representatives",
  },
  senate: {
    title: "Senate Bills",
    description: "Legislation in the U.S. Senate",
  },
  wisconsin: {
    title: "Wisconsin Legislature",
    description: "Bills in the Wisconsin State Senate and Assembly",
  },
};

function getStatusColor(status: string | null): string {
  if (!status) return "bg-zinc-800 text-zinc-400";
  const s = status.toLowerCase();
  if (s.includes("passed") || s.includes("signed") || s.includes("enacted")) return "bg-green-900/60 text-green-400";
  if (s.includes("committee") || s.includes("referred")) return "bg-blue-900/60 text-blue-400";
  if (s.includes("introduced") || s.includes("read")) return "bg-amber-900/60 text-amber-400";
  if (s.includes("failed") || s.includes("vetoed")) return "bg-red-900/60 text-red-400";
  return "bg-zinc-800 text-zinc-400";
}

async function fetchBills(chamber: string) {
  const res = await fetch(`${API_BASE}/api/bills/${chamber}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.bills ?? [];
}

export default async function BillsPage({ params }: { params: Promise<{ chamber: string }> }) {
  const { chamber } = await params;
  const bills = await fetchBills(chamber);
  const info = CHAMBER_INFO[chamber] ?? { title: chamber, description: "" };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-coral)" }}>
          Legislation
        </span>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[-0.02em] leading-none mt-2">
          {info.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">{info.description}</p>
      </div>

      <div className="h-px bg-white/20 mb-8" />

      {/* Chamber nav */}
      <div className="flex gap-4 mb-8">
        {Object.entries(CHAMBER_INFO).map(([key, val]) => (
          <a
            key={key}
            href={`/bills/${key}`}
            className={`text-xs font-bold uppercase tracking-[0.15em] px-3 py-1.5 border transition-colors ${
              key === chamber
                ? "border-[var(--color-coral)] text-[var(--color-coral)]"
                : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/30"
            }`}
          >
            {val.title}
          </a>
        ))}
      </div>

      {/* Bills list */}
      {bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bills found.</p>
      ) : (
        <div className="space-y-6">
          {bills.map((bill: any) => (
            <a
              key={bill.id}
              href={`/bill/${encodeURIComponent(bill.id)}`}
              className="block group"
            >
              <div className="flex items-start gap-4">
                <div className="w-24 shrink-0">
                  <span className="text-sm font-black text-muted-foreground">{bill.identifier}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {bill.status && (
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getStatusColor(bill.status)}`}>
                        {bill.status?.slice(0, 30)}
                      </span>
                    )}
                    {bill.topic && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: getTopicColor(bill.topic) }}>
                        {bill.topic}
                      </span>
                    )}
                    {bill.last_action_date && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(bill.last_action_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                    {bill.title}
                  </h3>
                  {bill.sponsor_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sponsor: {bill.sponsor_name}
                    </p>
                  )}
                  {bill.last_action && bill.last_action !== bill.status && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Latest: {bill.last_action.slice(0, 80)}
                    </p>
                  )}
                </div>
              </div>
              <div className="h-px bg-white/5 mt-6" />
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

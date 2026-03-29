// Removed unused getTopicColor import

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://listening-post.tarikjmoody.workers.dev";

export const revalidate = 30;

function getStatusColor(status: string | null): string {
  if (!status) return "bg-zinc-800 text-zinc-400";
  const s = status.toLowerCase();
  if (s.includes("adopted") || s.includes("passed") || s.includes("approved")) return "bg-green-900/60 text-green-400";
  if (s.includes("committee") || s.includes("referred") || s.includes("pending")) return "bg-blue-900/60 text-blue-400";
  if (s.includes("introduced") || s.includes("hearing")) return "bg-amber-900/60 text-amber-400";
  if (s.includes("failed") || s.includes("denied") || s.includes("withdrawn")) return "bg-red-900/60 text-red-400";
  return "bg-zinc-800 text-zinc-400";
}

export default async function LegislationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${API_BASE}/api/civic/${encodeURIComponent(id)}`, { cache: "no-store" });

  if (!res.ok) {
    return <div className="text-center py-20 text-muted-foreground">Item not found</div>;
  }

  const { item } = await res.json();

  const isLegislation = item.type === "legislation";
  const isPressRelease = item.type === "press_release";
  const isLicense = item.type === "license";
  const isMeeting = item.type === "meeting";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-coral)" }}>
            {item.type === "legislation" ? "Milwaukee Legislation" :
             item.type === "press_release" ? "Press Release" :
             item.type === "license" ? "License Application" :
             item.type === "meeting" ? "Meeting" : "Civic Item"}
          </span>
          {item.matter_type && (
            <>
              <span className="text-xs text-muted-foreground">◆</span>
              <span className="text-xs text-muted-foreground">{item.matter_type}</span>
            </>
          )}
        </div>

        {/* Matter file + Status */}
        {item.matter_file && (
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl font-black uppercase tracking-tight text-muted-foreground">
              {item.matter_file}
            </span>
            {item.matter_status && (
              <span className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-wide ${getStatusColor(item.matter_status)}`}>
                {item.matter_status}
              </span>
            )}
          </div>
        )}

        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">
          {item.title}
        </h1>

        <p className="text-sm text-muted-foreground mt-3">{item.date}</p>
      </div>

      <div className="h-px bg-white/20 mb-8" />

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {item.sponsor_name && (
          <div className="border border-white/10 p-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Sponsor</h3>
            <p className="text-base font-bold">{item.sponsor_name}</p>
          </div>
        )}
        {item.body_name && (
          <div className="border border-white/10 p-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">
              {isMeeting ? "Committee" : "Body"}
            </h3>
            <p className="text-base font-bold">{item.body_name}</p>
          </div>
        )}
        {item.address && (
          <div className="border border-white/10 p-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Location</h3>
            <p className="text-base font-bold">{item.address}</p>
          </div>
        )}
        {item.source_url && (
          <div className="border border-white/10 p-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Source</h3>
            <a href={item.source_url} target="_blank" rel="noopener noreferrer"
               className="text-base font-bold text-[var(--color-coral)] hover:underline">
              {isPressRelease ? "Read full release →" :
               isLicense ? "View application →" :
               isMeeting ? "View on Legistar →" :
               "View on Legistar →"}
            </a>
          </div>
        )}
      </div>

      {/* Summary / Body */}
      {item.body && (
        <div className="mb-8">
          <h2 className="text-xl font-black uppercase tracking-tight mb-4">Summary</h2>
          <div style={{ lineHeight: "1.7" }}>
            {item.body.split("\n\n").map((paragraph: string, i: number) => (
              <p key={i} className="mb-4 text-base text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {!item.body && item.summary && (
        <div className="mb-8">
          <p className="text-base text-muted-foreground leading-relaxed">{item.summary}</p>
        </div>
      )}

      {/* Meeting-specific: agenda/minutes/video links */}
      {isMeeting && (item.agenda_url || item.minutes_url || item.video_url) && (
        <div className="mb-8">
          <h2 className="text-xl font-black uppercase tracking-tight mb-4">Documents</h2>
          <div className="flex gap-4 flex-wrap">
            {item.agenda_url && (
              <a href={item.agenda_url} target="_blank" rel="noopener noreferrer"
                 className="border border-white/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.1em] hover:border-[var(--color-coral)]/50 transition-colors">
                Agenda PDF →
              </a>
            )}
            {item.minutes_url && (
              <a href={item.minutes_url} target="_blank" rel="noopener noreferrer"
                 className="border border-white/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.1em] hover:border-[var(--color-coral)]/50 transition-colors">
                Minutes PDF →
              </a>
            )}
            {item.video_url && (
              <a href={item.video_url} target="_blank" rel="noopener noreferrer"
                 className="border border-white/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.1em] hover:border-[var(--color-coral)]/50 transition-colors">
                Watch Video →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Back */}
      <div className="mt-12">
        <a href="/city-hall" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to City Hall
        </a>
      </div>
    </div>
  );
}

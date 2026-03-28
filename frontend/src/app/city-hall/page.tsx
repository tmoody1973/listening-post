import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://listening-post.tarikjmoody.workers.dev";

export const revalidate = 30;

async function fetchCityHall() {
  const res = await fetch(`${API_BASE}/api/city-hall`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function getStatusColor(status: string | null): string {
  if (!status) return "bg-zinc-800 text-zinc-400";
  const s = status.toLowerCase();
  if (s.includes("adopted") || s.includes("passed") || s.includes("approved")) return "bg-green-900/60 text-green-400";
  if (s.includes("committee") || s.includes("referred") || s.includes("pending")) return "bg-blue-900/60 text-blue-400";
  if (s.includes("introduced") || s.includes("hearing")) return "bg-amber-900/60 text-amber-400";
  if (s.includes("failed") || s.includes("denied") || s.includes("withdrawn")) return "bg-red-900/60 text-red-400";
  return "bg-zinc-800 text-zinc-400";
}

export default async function CityHallPage() {
  const data = await fetchCityHall();

  const meetings = data?.meetings ?? [];
  const legislation = data?.legislation ?? [];
  const permits = data?.permits ?? [];
  const licenses = data?.licenses ?? [];
  const pressReleases = data?.pressReleases ?? [];

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-coral)" }}>
          Milwaukee
        </span>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-[-0.02em] leading-none mt-2">
          City Hall
        </h1>
        <p className="text-base text-muted-foreground mt-3">
          What&apos;s happening at Milwaukee City Hall ◆ {today}
        </p>
      </div>

      <div className="h-px bg-white/20 mb-8" />

      {/* Main content + Meetings sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ─── Left column: Legislation + Permits + Press ─── */}
        <div className="lg:col-span-2">

          {/* LEGISLATION */}
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-6">New Legislation</h2>
          {legislation.length === 0 ? (
            <p className="text-base text-muted-foreground mb-8">No recent legislation</p>
          ) : (
            <div className="space-y-6 mb-10">
              {legislation.map((item: any) => (
                <a
                  key={item.id}
                  href={item.source_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {item.matter_file && (
                      <span className="text-sm font-bold text-muted-foreground">{item.matter_file}</span>
                    )}
                    {item.matter_type && (
                      <span className="inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wide bg-blue-900/50 text-blue-400">
                        {item.matter_type}
                      </span>
                    )}
                    {item.matter_status && (
                      <span className={`inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusColor(item.matter_status)}`}>
                        {item.matter_status}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                    {item.title?.slice(0, 150)}
                  </h3>
                  {item.sponsor_name && (
                    <p className="text-sm text-muted-foreground mt-1">Sponsor: {item.sponsor_name}</p>
                  )}
                  <div className="h-px bg-white/5 mt-6" />
                </a>
              ))}
            </div>
          )}

          <div className="h-px bg-white/20 mb-8" />

          {/* BUILDING PERMITS */}
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-6">Building Permits</h2>
          {permits.length === 0 ? (
            <p className="text-base text-muted-foreground mb-8">No recent permits</p>
          ) : (
            <div className="space-y-4 mb-10">
              {permits.map((permit: any) => (
                <div key={permit.id} className="border border-white/10 p-5">
                  <h3 className="text-base font-black uppercase tracking-tight leading-snug">
                    {permit.title}
                  </h3>
                  {permit.address && permit.address !== "Unknown location" && (
                    <p className="text-sm text-muted-foreground mt-1">{permit.address}</p>
                  )}
                  {permit.summary && (
                    <p className="text-sm text-muted-foreground mt-1">{permit.summary}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">{permit.date}</p>
                </div>
              ))}
            </div>
          )}

          {/* NEW RESTAURANTS */}
          {licenses.length > 0 && (
            <>
              <div className="h-px bg-white/20 mb-8" />
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-2">New Restaurants & Bars</h2>
              <p className="text-sm text-muted-foreground mb-6">Recent food dealer and tavern license applications in Milwaukee</p>
              <Accordion multiple className="space-y-2">
                {licenses.map((lic: any) => (
                  <AccordionItem key={lic.id} value={lic.id} className="border border-white/10 px-5">
                    <AccordionTrigger className="py-4 hover:no-underline">
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-green-900/60 text-green-400">
                            New
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {lic.date}
                          </span>
                        </div>
                        <h3 className="text-base font-black uppercase tracking-tight leading-snug mt-1">
                          {(lic.title ?? "").replace("New: ", "")}
                        </h3>
                        {lic.address && (
                          <p className="text-sm text-muted-foreground mt-0.5">{lic.address}</p>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      {lic.body ? (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                          {lic.body}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                          {lic.summary}
                        </p>
                      )}
                      <div className="flex gap-4 text-xs">
                        {lic.source_url && (
                          <a
                            href={lic.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--color-coral)] hover:underline"
                          >
                            View Application PDF →
                          </a>
                        )}
                        {lic.body_name && (
                          <span className="text-muted-foreground">{lic.body_name}</span>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}

          {/* PRESS RELEASES */}
          {pressReleases.length > 0 && (
            <>
              <div className="h-px bg-white/20 mb-8" />
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-6">Press Releases</h2>
              <div className="space-y-5 mb-10">
                {pressReleases.map((pr: any) => (
                  <a
                    key={pr.id}
                    href={pr.source_url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <h3 className="text-lg font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                      {pr.title}
                    </h3>
                    {pr.summary && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{pr.summary}</p>
                    )}
                    {pr.sponsor_name && (
                      <p className="text-xs text-muted-foreground mt-1">{pr.sponsor_name} ◆ {pr.date}</p>
                    )}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ─── Right sidebar: Meetings ───────────────────── */}
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight mb-4 pb-3 border-b border-white/10">
            Meetings
          </h2>
          {meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming meetings</p>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting: any) => (
                <a
                  key={meeting.id}
                  href={meeting.source_url ?? meeting.agenda_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border border-white/10 p-4 hover:border-[var(--color-coral)]/50 transition-colors group"
                >
                  {meeting.tier === 1 && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-900/60 text-amber-400 mb-2">
                      Key Committee
                    </span>
                  )}
                  <h3 className="text-sm font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                    {meeting.body_name ?? meeting.title}
                  </h3>
                  <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    <p>{meeting.date}</p>
                    {meeting.location && <p>{meeting.location}</p>}
                  </div>
                  <div className="flex gap-3 mt-2">
                    {meeting.agenda_url && <span className="text-xs text-[var(--color-coral)]">Agenda →</span>}
                    {meeting.minutes_url && <span className="text-xs text-[var(--color-coral)]">Minutes →</span>}
                    {meeting.video_url && <span className="text-xs text-[var(--color-coral)]">Video →</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Back */}
      <div className="mt-12">
        <a href="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Today&apos;s News
        </a>
      </div>
    </div>
  );
}

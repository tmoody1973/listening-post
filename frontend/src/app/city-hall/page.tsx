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
  const licenses = data?.licenses ?? [];
  const pressReleases = data?.pressReleases ?? [];

  // Group legislation by type
  const ordinances = legislation.filter((l: any) => l.matter_type === "Ordinance");
  const resolutions = legislation.filter((l: any) => l.matter_type === "Resolution");
  const communications = legislation.filter((l: any) => l.matter_type === "Communication");
  const other = legislation.filter((l: any) => !["Ordinance", "Resolution", "Communication"].includes(l.matter_type));

  // Separate key committee meetings
  const keyMeetings = meetings.filter((m: any) => m.tier === 1);
  const otherMeetings = meetings.filter((m: any) => m.tier !== 1);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div>
      {/* Hero header with Milwaukee image */}
      <div className="relative -mx-4 -mt-8 mb-8 overflow-hidden" style={{ height: "280px" }}>
        <img
          src="https://listening-post.tarikjmoody.workers.dev/images/milwaukee-city-hall.jpg"
          alt="Milwaukee City Hall"
          className="w-full h-full object-cover brightness-[0.3]"
        />
        <div className="absolute inset-0 flex flex-col justify-end p-8">
          <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "var(--color-coral)" }}>
            Milwaukee
          </span>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-[-0.02em] leading-none mt-2 text-white">
            City Hall
          </h1>
          <p className="text-base text-white/70 mt-2">
            Your daily civic digest ◆ {today}
          </p>
        </div>
      </div>

      {/* ─── NEW RESTAURANTS & BARS ────────────────────────── */}
      {licenses.length > 0 && (
        <section className="mb-12">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-2">
            New Restaurants & Bars
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Recent food dealer and tavern license applications
          </p>
          <Accordion multiple className="space-y-2">
            {licenses.map((lic: any) => (
              <AccordionItem key={lic.id} value={lic.id} className="border border-white/10 px-5">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide bg-green-900/60 text-green-400">
                        New
                      </span>
                      <span className="text-xs text-muted-foreground">{lic.date}</span>
                      {lic.body_name && (
                        <span className="text-xs text-muted-foreground">{lic.body_name}</span>
                      )}
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight leading-snug mt-1">
                      {(lic.title ?? "").replace("New: ", "")}
                    </h3>
                    {lic.address && (
                      <p className="text-sm text-muted-foreground mt-0.5">{lic.address}</p>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  {lic.body ? (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{lic.body}</p>
                  ) : lic.summary ? (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{lic.summary}</p>
                  ) : null}
                  {lic.source_url && (
                    <a href={lic.source_url} target="_blank" rel="noopener noreferrer"
                       className="text-sm text-[var(--color-coral)] hover:underline">
                      View Application →
                    </a>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      <div className="h-px bg-white/20 mb-10" />

      {/* ─── TWO COLUMN: WHAT'S CHANGING + MEETINGS ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">

        {/* Left: What's Changing (Legislation by type) — 2 cols */}
        <div className="lg:col-span-2">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-8">Legislation</h2>

          {/* Ordinances + Resolutions side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Ordinances */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4 pb-2 border-b border-white/10">
                Ordinances
              </h3>
              {ordinances.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent ordinances</p>
              ) : (
                <div className="space-y-4">
                  {ordinances.slice(0, 5).map((item: any) => (
                    <a key={item.id} href={item.source_url ?? "#"} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className="flex items-center gap-2 mb-1">
                        {item.matter_file && <span className="text-xs font-bold text-muted-foreground">{item.matter_file}</span>}
                        {item.matter_status && (
                          <span className={`inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${getStatusColor(item.matter_status)}`}>
                            {item.matter_status}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                        {item.title?.slice(0, 120)}
                      </p>
                      {item.sponsor_name && <p className="text-xs text-muted-foreground mt-1">{item.sponsor_name}</p>}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Resolutions */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4 pb-2 border-b border-white/10">
                Resolutions
              </h3>
              {resolutions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent resolutions</p>
              ) : (
                <div className="space-y-4">
                  {resolutions.slice(0, 5).map((item: any) => (
                    <a key={item.id} href={item.source_url ?? "#"} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className="flex items-center gap-2 mb-1">
                        {item.matter_file && <span className="text-xs font-bold text-muted-foreground">{item.matter_file}</span>}
                        {item.matter_status && (
                          <span className={`inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${getStatusColor(item.matter_status)}`}>
                            {item.matter_status}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                        {item.title?.slice(0, 120)}
                      </p>
                      {item.sponsor_name && <p className="text-xs text-muted-foreground mt-1">{item.sponsor_name}</p>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Communications */}
          {communications.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4 pb-2 border-b border-white/10">
                Communications
              </h3>
              <div className="space-y-3">
                {communications.slice(0, 5).map((item: any) => (
                  <a key={item.id} href={item.source_url ?? "#"} target="_blank" rel="noopener noreferrer" className="block group">
                    <p className="text-base font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                      {item.title?.slice(0, 120)}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Other legislation */}
          {other.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4 pb-2 border-b border-white/10">
                Other Items
              </h3>
              <div className="space-y-3">
                {other.slice(0, 5).map((item: any) => (
                  <a key={item.id} href={item.source_url ?? "#"} target="_blank" rel="noopener noreferrer" className="block group">
                    <div className="flex items-center gap-2 mb-1">
                      {item.matter_type && (
                        <span className="inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide bg-zinc-800 text-zinc-400">
                          {item.matter_type}
                        </span>
                      )}
                    </div>
                    <p className="text-base font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                      {item.title?.slice(0, 120)}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar: Meetings */}
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight mb-4 pb-3 border-b border-white/10">
            Meetings This Week
          </h2>

          {/* Key meetings first */}
          {keyMeetings.length > 0 && (
            <div className="space-y-3 mb-6">
              {keyMeetings.map((meeting: any) => (
                <a key={meeting.id} href={meeting.source_url ?? meeting.agenda_url ?? "#"}
                   target="_blank" rel="noopener noreferrer"
                   className="block border border-white/10 p-4 hover:border-[var(--color-coral)]/50 transition-colors group">
                  <span className="inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide bg-amber-900/60 text-amber-400 mb-2">
                    Key
                  </span>
                  <h3 className="text-sm font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                    {meeting.body_name ?? meeting.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{meeting.date}</p>
                  {meeting.location && <p className="text-xs text-muted-foreground">{meeting.location}</p>}
                  <div className="flex gap-3 mt-2">
                    {meeting.agenda_url && <span className="text-xs text-[var(--color-coral)]">Agenda →</span>}
                    {meeting.minutes_url && <span className="text-xs text-[var(--color-coral)]">Minutes →</span>}
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Other meetings */}
          {otherMeetings.length > 0 && (
            <div className="space-y-2">
              {otherMeetings.map((meeting: any) => (
                <a key={meeting.id} href={meeting.source_url ?? meeting.agenda_url ?? "#"}
                   target="_blank" rel="noopener noreferrer"
                   className="block py-2 group">
                  <h4 className="text-xs font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                    {meeting.body_name ?? meeting.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{meeting.date}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── FROM CITY HALL (Press Releases) ────────────────── */}
      {pressReleases.length > 0 && (
        <section className="mb-12">
          <div className="h-px bg-white/20 mb-8" />
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-6">From City Hall</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pressReleases.map((pr: any) => (
              <a key={pr.id} href={pr.source_url ?? "#"} target="_blank" rel="noopener noreferrer"
                 className="block border border-white/10 p-5 hover:border-[var(--color-coral)]/50 transition-colors group">
                <h3 className="text-base font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {pr.title}
                </h3>
                {pr.summary && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{pr.summary}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {pr.sponsor_name && `${pr.sponsor_name} ◆ `}{pr.date}
                </p>
              </a>
            ))}
          </div>
        </section>
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

import { RestaurantList } from "@/components/RestaurantList";
import { getTopicColor } from "@/lib/api";

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
  if (s.includes("adopted") || s.includes("passed") || s.includes("approved") || s.includes("recommended")) return "bg-green-900/60 text-green-400";
  if (s.includes("committee") || s.includes("referred") || s.includes("pending")) return "bg-blue-900/60 text-blue-400";
  if (s.includes("introduced") || s.includes("hearing")) return "bg-amber-900/60 text-amber-400";
  if (s.includes("failed") || s.includes("denied") || s.includes("withdrawn")) return "bg-red-900/60 text-red-400";
  return "bg-zinc-800 text-zinc-400";
}

function isZoningOrDevelopment(item: any): boolean {
  const title = (item.title ?? "").toLowerCase();
  return title.includes("zoning") || title.includes("tif") || title.includes("tax increment") ||
    title.includes("tid ") || title.includes("development agreement") || title.includes("deconstruction") ||
    title.includes("survey map") || title.includes("redevelopment") || title.includes("variance") ||
    title.includes("land use") || title.includes("rezoning") || title.includes("planned development");
}

export default async function CityHallPage() {
  const data = await fetchCityHall();

  const meetings = data?.meetings ?? [];
  const legislation = data?.legislation ?? [];
  const licenses = data?.licenses ?? [];
  const pressReleases = data?.pressReleases ?? [];

  // Separate zoning/development items
  const zoningItems = legislation.filter(isZoningOrDevelopment);
  const regularLegislation = legislation.filter((l: any) => !isZoningOrDevelopment(l));

  // Group regular legislation by type
  const ordinances = regularLegislation.filter((l: any) => l.matter_type === "Ordinance");
  const resolutions = regularLegislation.filter((l: any) => l.matter_type === "Resolution");
  const communications = regularLegislation.filter((l: any) => l.matter_type === "Communication");
  const otherLeg = regularLegislation.filter((l: any) => !["Ordinance", "Resolution", "Communication"].includes(l.matter_type));

  // Key meetings
  const keyMeetings = meetings.filter((m: any) => m.tier === 1);
  const otherMeetings = meetings.filter((m: any) => m.tier !== 1);

  // Top civic story — highest tier legislation or press release
  const topStory = legislation[0] ?? pressReleases[0] ?? null;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div>
      {/* ─── HERO HEADER ──────────────────────────────────── */}
      <div className="relative -mx-4 -mt-8 mb-10 overflow-hidden" style={{ height: "300px" }}>
        <img
          src="https://listening-post.tarikjmoody.workers.dev/images/milwaukee-city-hall.jpg"
          alt="Milwaukee City Hall"
          className="w-full h-full object-cover brightness-[0.25]"
        />
        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
          <span className="text-sm font-bold uppercase tracking-[0.3em]" style={{ color: "var(--color-coral)" }}>
            Milwaukee
          </span>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-[-0.02em] leading-none mt-2 text-white">
            City Hall
          </h1>
          <p className="text-base text-white/70 mt-3">
            Your daily civic digest ◆ {today}
          </p>
        </div>
      </div>

      {/* ─── TODAY'S TOP CIVIC STORY ───────────────────────── */}
      {topStory && (
        <section className="mb-10">
          <a href={`/legislation/${encodeURIComponent(topStory.id)}`} className="block group">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-bold uppercase tracking-[0.15em]" style={{ color: "var(--color-coral)" }}>
                Top Story
              </span>
              {topStory.matter_status && (
                <span className={`inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusColor(topStory.matter_status)}`}>
                  {topStory.matter_status}
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight group-hover:text-[var(--color-coral)] transition-colors">
              {topStory.title}
            </h2>
            {topStory.summary && (
              <p className="text-base text-muted-foreground mt-3 leading-relaxed line-clamp-3">
                {topStory.summary}
              </p>
            )}
            <span className="inline-block mt-3 text-sm text-[var(--color-coral)]">Read full explanation →</span>
          </a>
        </section>
      )}

      <div className="h-px bg-white/20 mb-10" />

      {/* ─── TWO COLUMN: PRESS RELEASES + NEW RESTAURANTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
        {/* Left: From City Hall */}
        <div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-6">From City Hall</h2>
          {pressReleases.length > 0 ? (
            <div className="space-y-4">
              {pressReleases.map((pr: any) => (
                <a key={pr.id} href={`/legislation/${encodeURIComponent(pr.id)}`}
                   className="block border border-white/10 p-5 hover:border-[var(--color-coral)]/50 transition-colors group">
                  <h3 className="text-base font-black uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                    {pr.title}
                  </h3>
                  {pr.summary && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{pr.summary}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {pr.sponsor_name && `${pr.sponsor_name} ◆ `}{pr.date}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-base text-muted-foreground">No recent press releases</p>
          )}
        </div>

        {/* Right: New Restaurants */}
        {licenses.length > 0 && (
          <div>
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2">
              New Restaurants & Bars
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Recent license applications</p>
            <RestaurantList licenses={licenses} />
          </div>
        )}
      </div>

      <div className="h-px bg-white/20 mb-10" />

      {/* ─── WHAT'S CHANGING (Zoning + Development) ─────── */}
      {zoningItems.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2">
            What&apos;s Changing
          </h2>
          <p className="text-sm text-muted-foreground mb-6">Zoning, development, and neighborhood changes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zoningItems.slice(0, 6).map((item: any) => (
              <a key={item.id} href={`/legislation/${encodeURIComponent(item.id)}`}
                 className="block border border-white/10 p-5 hover:border-[var(--color-coral)]/50 transition-colors group">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {item.matter_file && <span className="text-xs font-bold text-muted-foreground">{item.matter_file}</span>}
                  {item.matter_status && (
                    <span className={`inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${getStatusColor(item.matter_status)}`}>
                      {item.matter_status}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                  {item.title?.slice(0, 120)}
                </h3>
                {item.sponsor_name && <p className="text-sm text-muted-foreground mt-1">{item.sponsor_name}</p>}
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="h-px bg-white/20 mb-10" />

      {/* ─── MEETINGS + LEGISLATION (two column) ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-10">

        {/* Left: Legislation by type — 2 cols */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-8">Legislation</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Ordinances */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4 pb-2 border-b border-white/10">
                Ordinances
              </h3>
              {ordinances.length === 0 ? (
                <p className="text-sm text-muted-foreground">None recent</p>
              ) : (
                <div className="space-y-4">
                  {ordinances.slice(0, 5).map((item: any) => (
                    <a key={item.id} href={`/legislation/${encodeURIComponent(item.id)}`} className="block group">
                      <div className="flex items-center gap-2 mb-1">
                        {item.matter_file && <span className="text-xs font-bold text-muted-foreground">{item.matter_file}</span>}
                        {item.matter_status && (
                          <span className={`inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${getStatusColor(item.matter_status)}`}>
                            {item.matter_status}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                        {item.title?.slice(0, 100)}
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
                <p className="text-sm text-muted-foreground">None recent</p>
              ) : (
                <div className="space-y-4">
                  {resolutions.slice(0, 5).map((item: any) => (
                    <a key={item.id} href={`/legislation/${encodeURIComponent(item.id)}`} className="block group">
                      <div className="flex items-center gap-2 mb-1">
                        {item.matter_file && <span className="text-xs font-bold text-muted-foreground">{item.matter_file}</span>}
                        {item.matter_status && (
                          <span className={`inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${getStatusColor(item.matter_status)}`}>
                            {item.matter_status}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                        {item.title?.slice(0, 100)}
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
                  <a key={item.id} href={`/legislation/${encodeURIComponent(item.id)}`} className="block group">
                    <p className="text-base font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                      {item.title?.slice(0, 120)}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Other */}
          {otherLeg.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4 pb-2 border-b border-white/10">
                Other
              </h3>
              <div className="space-y-3">
                {otherLeg.slice(0, 5).map((item: any) => (
                  <a key={item.id} href={`/legislation/${encodeURIComponent(item.id)}`} className="block group">
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

        {/* Right: Meetings This Week */}
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight mb-4 pb-3 border-b border-white/10">
            Meetings This Week
          </h2>

          {keyMeetings.length > 0 && (
            <div className="space-y-3 mb-6">
              {keyMeetings.map((meeting: any) => (
                <a key={meeting.id} href={`/legislation/${encodeURIComponent(meeting.id)}`}
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
                    {meeting.agenda_url && (
                      <a href={meeting.agenda_url} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-[var(--color-coral)]" onClick={(e) => e.stopPropagation()}>
                        Agenda →
                      </a>
                    )}
                    {meeting.minutes_url && (
                      <a href={meeting.minutes_url} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-[var(--color-coral)]" onClick={(e) => e.stopPropagation()}>
                        Minutes →
                      </a>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}

          {otherMeetings.length > 0 && (
            <div className="space-y-2">
              {otherMeetings.map((meeting: any) => (
                <a key={meeting.id} href={`/legislation/${encodeURIComponent(meeting.id)}`}
                   className="block py-2 group">
                  <h4 className="text-sm font-bold uppercase tracking-tight leading-snug group-hover:text-[var(--color-coral)] transition-colors">
                    {meeting.body_name ?? meeting.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{meeting.date}</p>
                </a>
              ))}
            </div>
          )}

          {meetings.length === 0 && (
            <p className="text-sm text-muted-foreground">No meetings scheduled</p>
          )}
        </div>
      </div>

      {/* Back */}
      <div className="mt-12">
        <a href="/" className="text-sm uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Today&apos;s News
        </a>
      </div>
    </div>
  );
}

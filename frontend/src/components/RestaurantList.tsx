"use client";

import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface License {
  id: string;
  title: string;
  address: string | null;
  date: string;
  body: string | null;
  summary: string | null;
  source_url: string | null;
  body_name: string | null;
}

export function RestaurantList({ licenses }: { licenses: License[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? licenses : licenses.slice(0, 5);
  const remaining = licenses.length - 5;

  return (
    <>
      <Accordion multiple className="space-y-2">
        {visible.map((lic) => (
          <AccordionItem key={lic.id} value={lic.id} className="border border-white/10 px-5">
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex-1 text-left">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-block px-2 py-0.5 text-xs font-bold uppercase tracking-wide bg-green-900/60 text-green-400">
                    New
                  </span>
                  <span className="text-xs text-muted-foreground">{lic.date}</span>
                </div>
                <h3 className="text-base font-black uppercase tracking-tight leading-snug mt-1">
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

      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full py-3 border border-white/10 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground hover:border-[var(--color-coral)]/50 transition-colors"
        >
          Show {remaining} more application{remaining > 1 ? "s" : ""}
        </button>
      )}

      {showAll && licenses.length > 5 && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-4 w-full py-3 border border-white/10 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground hover:border-[var(--color-coral)]/50 transition-colors"
        >
          Show less
        </button>
      )}
    </>
  );
}

"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://listening-post.tarikjmoody.workers.dev";

interface VoiceAgentProps {
  slug: string;
  type: "story" | "civic";
  headline: string;
}

export function VoiceAgent({ slug, type, headline }: VoiceAgentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<{ agentId: string; signedUrl: string } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Load the ElevenLabs widget script
  useEffect(() => {
    if (!agentData) return;
    const id = "elevenlabs-convai-script";
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    script.async = true;
    document.body.appendChild(script);
  }, [agentData]);

  const startAgent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = type === "civic"
        ? `${API_BASE}/api/voice-agent/civic/${encodeURIComponent(slug)}`
        : `${API_BASE}/api/voice-agent/${encodeURIComponent(slug)}`;

      const res = await fetch(endpoint);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to start agent");
      }

      const data = await res.json();
      setAgentData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsLoading(false);
    }
  }, [slug, type]);

  if (agentData) {
    return (
      <div className="border border-[var(--color-coral)]/30 p-5 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.15em]" style={{ color: "var(--color-coral)" }}>
              Talking with Kesha
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ask questions about this story — interrupt anytime
            </p>
          </div>
          <button
            onClick={() => setAgentData(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.1em]"
          >
            Close
          </button>
        </div>
        <div ref={widgetRef}>
          {/* @ts-expect-error ElevenLabs web component */}
          <elevenlabs-convai
            agent-id={agentData.agentId}
            signed-url={agentData.signedUrl}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/10 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.15em]">Ask About This Story</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Talk to Kesha, our AI correspondent
          </p>
        </div>
        <button
          onClick={startAgent}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--color-coral)" }}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Connecting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              Talk to Kesha
            </>
          )}
        </button>
      </div>
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { audioUrl } from "@/lib/api";

interface PlaylistItem {
  r2Key: string;
  url: string;
  durationSeconds: number;
  type: string;
  title?: string;
}

interface EditionPlayerProps {
  episodeId: string;
  edition: string;
  date: string;
  playlist: PlaylistItem[];
  totalDuration: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EditionPlayer({ episodeId, edition, date, playlist, totalDuration }: EditionPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentItem = playlist[currentIndex];
  const currentAct = playlist.filter((p) => p.type === "act").find((_, i) => {
    const actIndex = playlist.findIndex((p, pi) => p.type === "act" && playlist.filter((x, xi) => xi <= pi && x.type === "act").length === i + 1);
    return currentIndex >= actIndex;
  });

  // Get current act name
  const actName = currentItem?.type === "act" ? currentItem.title :
    currentItem?.type === "music" ? (currentItem.title === "Intro" ? "Intro" : currentItem.title === "Outro" ? "Outro" : "Transition") : "";

  const elapsedBefore = playlist
    .slice(0, currentIndex)
    .reduce((sum, p) => sum + p.durationSeconds, 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (currentIndex < playlist.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentIndex, playlist.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentItem) return;

    audio.src = audioUrl(currentItem.url);
    audio.load();
    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentIndex, currentItem, isPlaying]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const skipBack = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime > 5) {
      audio.currentTime -= 15;
    } else if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime + 15 < (audio.duration || 0)) {
      audio.currentTime += 15;
    } else if (currentIndex < playlist.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const targetTime = percent * totalDuration;

    // Find which playlist item this falls into
    let accumulated = 0;
    for (let i = 0; i < playlist.length; i++) {
      if (accumulated + playlist[i].durationSeconds > targetTime) {
        setCurrentIndex(i);
        const audio = audioRef.current;
        if (audio) {
          setTimeout(() => {
            audio.currentTime = targetTime - accumulated;
          }, 100);
        }
        break;
      }
      accumulated += playlist[i].durationSeconds;
    }
  };

  const totalElapsed = elapsedBefore + currentTime;
  const progressPercent = totalDuration > 0 ? (totalElapsed / totalDuration) * 100 : 0;

  const editionLabel = edition === "morning" ? "Morning Edition" : "Evening Edition";
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="bg-zinc-900 border-b border-white/10">
      <audio ref={audioRef} preload="auto" />

      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Skip back 15s */}
          <button
            onClick={skipBack}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5V1L7 6l5 5V7a6 6 0 016 6 6 6 0 01-6 6 6 6 0 01-6-6H4a8 8 0 008 8 8 8 0 008-8 8 8 0 00-8-8z" />
              <text x="9" y="16" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">15</text>
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--color-coral)" }}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Skip forward 15s */}
          <button
            onClick={skipForward}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5V1l5 5-5 5V7a6 6 0 00-6 6 6 6 0 006 6 6 6 0 006-6h2a8 8 0 01-8 8 8 8 0 01-8-8 8 8 0 018-8z" />
              <text x="9" y="16" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">15</text>
            </svg>
          </button>
        </div>

        {/* Title + Progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: "var(--color-coral)" }}>
              {editionLabel} ◆ {dateLabel}
            </span>
            {actName && actName !== "Intro" && actName !== "Outro" && actName !== "Transition" && (
              <>
                <span className="text-xs text-muted-foreground">◆</span>
                <span className="text-xs text-muted-foreground truncate">{actName}</span>
              </>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">
              {formatTime(totalElapsed)}
            </span>
            <div
              className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer group"
              onClick={handleProgressClick}
            >
              <div
                className="h-full rounded-full transition-all duration-200 group-hover:h-2 group-hover:-mt-0.5"
                style={{ width: `${progressPercent}%`, backgroundColor: "var(--color-coral)" }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0 text-right">
              {formatTime(totalDuration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sticky wrapper for use in layouts
export function StickyPlayer(props: EditionPlayerProps) {
  return (
    <div className="sticky top-0 z-50">
      <EditionPlayer {...props} />
    </div>
  );
}

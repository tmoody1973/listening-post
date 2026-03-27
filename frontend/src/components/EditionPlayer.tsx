"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  const actsOnly = playlist.filter((p) => p.type === "act");

  // Calculate elapsed time across all previous items
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

  // Auto-play next item when index changes
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

  const jumpToAct = (actIndex: number) => {
    const playlistIndex = playlist.findIndex(
      (p) => p.type === "act" && playlist.filter((x) => x.type === "act").indexOf(p) === actIndex
    );
    if (playlistIndex >= 0) {
      setCurrentIndex(playlistIndex);
      setIsPlaying(true);
    }
  };

  const totalElapsed = elapsedBefore + currentTime;
  const progressPercent = totalDuration > 0 ? (totalElapsed / totalDuration) * 100 : 0;

  const editionLabel = edition === "morning" ? "Morning Edition" : "Evening Edition";
  const formattedDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className="p-6 bg-muted/50">
      <audio ref={audioRef} preload="auto" />

      <div className="flex items-center gap-3 mb-3">
        <Badge
          className="text-white text-xs font-medium px-2.5 py-0.5"
          style={{ backgroundColor: "var(--color-coral)" }}
        >
          {editionLabel}
        </Badge>
        <span className="text-sm text-muted-foreground">{formattedDate}</span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--color-coral)" }}
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <div className="flex-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%`, backgroundColor: "var(--color-coral)" }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>{formatTime(totalElapsed)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>
      </div>

      {currentItem && currentItem.type === "act" && (
        <p className="text-xs text-muted-foreground mb-3">
          Now playing: {currentItem.title}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {actsOnly.map((act, i) => {
          const isActive = currentItem?.url === act.url;
          return (
            <button
              key={act.url}
              onClick={() => jumpToAct(i)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? "border-[var(--color-coral)] text-[var(--color-coral)] bg-[var(--color-coral)]/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {act.title ?? `Act ${i + 1}`}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {formatTime(totalDuration)} · {actsOnly.length} segments · {edition === "morning" ? "6:00 AM" : "5:00 PM"} CT
      </p>
    </Card>
  );
}

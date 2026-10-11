"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** One Street View photo along the last stretch, with Claude's verdict on the right-hand curb. */
export type CurbFrame = {
  lat: number;
  lng: number;
  walkMin: number;
  heading: number;
  date: string;
  photoUrl: string;
  allowed: "yes" | "no" | "unsure";
  kind: string;
  reason: string;
  box: { x: number; y: number; w: number; h: number } | null;
};

const AUTOPLAY_MS = 2600;

const TONE = {
  yes: { border: "border-success", fill: "bg-success/20", chip: "bg-success text-black", title: "Street parking" },
  no: { border: "border-destructive", fill: "bg-destructive/15", chip: "bg-destructive text-white", title: "No parking" },
  unsure: { border: "border-amber-400", fill: "bg-amber-400/15", chip: "bg-amber-400 text-black", title: "Check the signs" },
} as const;

/** "2024-05" → "May 2024". */
function photoDate(date: string): string {
  const [y, m] = date.split("-").map(Number);
  if (!y) return "date unknown";
  return m ? new Date(y, m - 1).toLocaleDateString([], { month: "short", year: "numeric" }) : String(y);
}

/**
 * The drive as you'd see it (PRD S2): Street View photos along the last stretch, in driving order,
 * with the curb Claude judged outlined. Swipe or ◀ ▶; "Drive" plays it like a dashcam.
 */
export function StreetJourney({
  frames,
  index,
  onIndex,
  minimap,
}: {
  frames: CurbFrame[];
  index: number;
  onIndex: (i: number) => void;
  minimap?: React.ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  const touchX = useRef<number | null>(null);
  const frame = frames[index];
  const tone = TONE[frame.allowed];

  useEffect(() => {
    if (!playing) return;
    if (index >= frames.length - 1) {
      const stop = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(stop);
    }
    const next = setTimeout(() => onIndex(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(next);
  }, [playing, index, frames.length, onIndex]);

  const go = (i: number) => onIndex(Math.max(0, Math.min(frames.length - 1, i)));

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto bg-black"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      {/* The street, unobstructed: only the judged curb is drawn on it. */}
      <div className="relative w-full shrink-0" style={{ aspectRatio: "16 / 10" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- proxied Street View photo, sized by the frame */}
        <img key={frame.photoUrl} src={frame.photoUrl} alt={`Street View, ${tone.title.toLowerCase()}: ${frame.kind}`} className="absolute inset-0 h-full w-full object-cover" />
        {frame.box && (
          <div
            className={cn("absolute rounded-md border-4 border-dashed", tone.border, tone.fill)}
            style={{ left: `${frame.box.x * 100}%`, top: `${frame.box.y * 100}%`, width: `${frame.box.w * 100}%`, height: `${frame.box.h * 100}%` }}
          />
        )}
        <span className="absolute top-2 left-2 rounded-md bg-black/65 px-2 py-0.5 font-mono text-[11px] text-white/80">
          {index + 1}/{frames.length} · Street View {photoDate(frame.date)}
        </span>
        {minimap && (
          <div className="minimap absolute top-2 right-2 h-20 w-20 overflow-hidden rounded-lg border border-white/30 shadow-lg sm:h-32 sm:w-32">{minimap}</div>
        )}
      </div>

      {/* The verdict, under the photo, big enough to read at a glance */}
      <div className="flex flex-col gap-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-md px-2.5 py-0.5 text-sm font-bold", tone.chip)}>{tone.title}</span>
          <span className="text-base font-medium text-white">{frame.kind}</span>
          <span className="ml-auto text-lg font-bold whitespace-nowrap text-white">{frame.walkMin} min walk</span>
        </div>
        <p className="text-sm leading-snug text-white/70">{frame.reason}</p>

        <div className="flex items-center gap-2 pt-1.5">
          <button type="button" aria-label="Previous photo" onClick={() => go(index - 1)} disabled={index === 0} className="h-10 w-10 shrink-0 rounded-full bg-white/15 text-xl text-white disabled:opacity-30">
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              if (!playing && index >= frames.length - 1) onIndex(0);
              setPlaying(!playing);
            }}
            className="h-10 shrink-0 rounded-full bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground"
          >
            {playing ? "❚❚ Pause" : "▶ Drive"}
          </button>
          <button type="button" aria-label="Next photo" onClick={() => go(index + 1)} disabled={index === frames.length - 1} className="h-10 w-10 shrink-0 rounded-full bg-white/15 text-xl text-white disabled:opacity-30">
            ›
          </button>
          {/* Progress: one dot per photo, coloured by verdict */}
          <div className="ml-auto flex flex-wrap justify-end gap-1">
            {frames.map((f, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => go(i)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  f.allowed === "yes" ? "bg-success" : f.allowed === "no" ? "bg-destructive" : "bg-amber-400",
                  i === index ? "ring-2 ring-white" : "opacity-70",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

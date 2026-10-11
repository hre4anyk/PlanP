"use client";

import { cn } from "@/lib/utils";
import type { CurbFrame } from "@/components/street-journey";

const STATUS = {
  free_to_park: { bg: "bg-success", icon: "✓", title: "You can park here!" },
  cant_park: { bg: "bg-destructive", icon: "✕", title: "Can't park here" },
  occupied: { bg: "bg-amber-500", icon: "!", title: "Street parking full" },
} as const;

/** Overlay shown when the drive playback reaches the last photo (you've "arrived").
 *  If the curb verdict is red or occupied, it auto-advances to the next backup plan. */
export function ArrivalPopup({
  frame,
  nextPlanLabel,
}: {
  frame: CurbFrame;
  nextPlanLabel: string | null;
}) {
  const tone = STATUS[frame.status];
  const cantPark = frame.status !== "free_to_park";

  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4">
      <div className={cn("w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl", tone.bg)}>
        <div className="mb-2 text-5xl font-bold text-white">{tone.icon}</div>
        <h2 className="text-xl font-bold text-white">{tone.title}</h2>
        <p className="mt-1.5 text-sm font-medium text-white/90">{frame.kind}</p>
        <p className="mt-1 text-sm text-white/70">{frame.reason}</p>
        {cantPark && nextPlanLabel && (
          <div className="mt-4 flex items-center justify-center gap-2 text-base font-semibold text-white">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Going to Plan {nextPlanLabel}. Automatically loading…
          </div>
        )}
        {cantPark && !nextPlanLabel && (
          <p className="mt-4 text-base font-semibold text-white">
            No more backup plans. Look for street parking near the door.
          </p>
        )}
      </div>
    </div>
  );
}

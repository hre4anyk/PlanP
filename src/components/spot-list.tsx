"use client";

import { cn } from "@/lib/utils";
import type { LatLng } from "@/data/lots";
import { walkDistanceText } from "@/logic/geo";
import type { CurbFrame } from "@/components/street-journey";

const STATUS = {
  free_to_park: { dot: "bg-success", label: "Available" },
  cant_park: { dot: "bg-destructive", label: "Can't park" },
  occupied: { dot: "bg-amber-400", label: "Occupied" },
} as const;

/**
 * Shows the algorithm's verdict for the single Street View photo currently on screen:
 * the status, why Claude classified it that way, and the walk to the meeting.
 */
export function SpotList({ frame, destination }: { frame: CurbFrame; destination: LatLng | null }) {
  const tone = STATUS[frame.status];

  return (
    <div className="order-1 flex flex-col gap-1">
      <span className="eyebrow">Claude's verdict — photo {frame.walkMin} min walk</span>
      <div className="flex items-start gap-2 rounded-md bg-white/5 px-2 py-1.5">
        <span className={cn("mt-1 size-2 shrink-0 rounded-full", tone.dot)} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{tone.label} — {frame.kind}</span>
          {destination && frame.status === "free_to_park" && (
            <span className="text-xs font-semibold text-success">{walkDistanceText(frame, destination)}</span>
          )}
          <span className="text-xs leading-snug text-muted-foreground">{frame.reason}</span>
        </div>
      </div>
    </div>
  );
}

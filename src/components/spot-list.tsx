"use client";

import { cn } from "@/lib/utils";
import type { LatLng } from "@/data/lots";
import { walkDistanceText } from "@/logic/geo";
import type { CurbFrame } from "@/components/street-journey";
import { PARKING_ZONE_WALK_MIN } from "@/components/street-journey";

/**
 * A compact, scrollable list of the curb spots Claude analyzed along the drive.
 * Each spot shows why it got its status and, for available spots, the walk to the meeting.
 */
export function SpotList({ frames, destination }: { frames: CurbFrame[]; destination: LatLng | null }) {
  const inZone = frames.filter((f) => f.walkMin <= PARKING_ZONE_WALK_MIN);
  const free = inZone.filter((f) => f.status === "free_to_park");
  const blocked = inZone.filter((f) => f.status !== "free_to_park");

  return (
    <div className="order-1 flex flex-col gap-1.5">
      <span className="eyebrow">Street parking on your way</span>
      <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
        {free.length > 0 ? (
          free.map((f, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md bg-success/10 px-2 py-1.5">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-success" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{f.kind}</span>
                {destination && (
                  <span className="text-xs font-semibold text-success">{walkDistanceText(f, destination)}</span>
                )}
                <span className="text-xs leading-snug text-muted-foreground">{f.reason}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No free street parking within a {PARKING_ZONE_WALK_MIN}-minute walk.
          </p>
        )}
        {blocked.length > 0 && (
          <p className="px-2 pt-0.5 text-xs text-muted-foreground">
            {blocked.length} spot{blocked.length > 1 ? "s" : ""} unavailable — {blocked.map((f) => f.kind).join(", ")}.
          </p>
        )}
      </div>
    </div>
  );
}

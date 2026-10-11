"use client";

import { cn } from "@/lib/utils";
import type { ChainItem } from "@/logic/chain";
import type { Lot } from "@/data/lots";

/**
 * Top-left bar shown when a journey starts: "A · Union Square Garage | B · Sutter-Stockton | C · …"
 * so people see the generated backup plans at a glance.
 */
export function RoutePlanBar({
  chain,
  currentIndex,
  lots,
}: {
  chain: ChainItem[];
  currentIndex: number;
  lots: Map<string, Lot>;
}) {
  if (chain.length === 0) return null;

  return (
    <div className="absolute left-3 top-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5">
      {chain.map((item, i) => {
        const lot = lots.get(item.id);
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-md",
              isCurrent
                ? "bg-primary text-primary-foreground"
                : isPast
                  ? "bg-destructive/80 text-white"
                  : "bg-background/90 text-foreground",
            )}
          >
            <span className="font-heading text-sm font-bold">{item.label}</span>
            <span className="hidden sm:inline">·</span>
            <span className="whitespace-nowrap">{lot?.name ?? item.id}</span>
          </div>
        );
      })}
    </div>
  );
}

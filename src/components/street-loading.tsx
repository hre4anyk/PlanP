"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * While a street we haven't read yet loads (~10–25 s): what Plan P is doing, step by step.
 * The route step is real (photos known); the reading steps follow the clock, since Claude reads
 * all photos in one request.
 */
export function StreetLoading({ plan, photos, startedAt }: { plan: string; photos: number | null; startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, (now - startedAt) / 1000);

  const steps = [
    { label: "Planning the drive", done: photos !== null },
    { label: photos ? `Fetching ${photos} Street View photos along the way` : "Finding Street View photos along the way", done: photos !== null && s > 3 },
    { label: "Claude is reading the right-hand curb in each photo", done: false },
  ];
  const active = steps.findIndex((x) => !x.done);
  const progress = Math.min(95, photos === null ? s * 6 : 15 + (s / 18) * 80);

  return (
    <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-background/92 p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <p className="eyebrow">New street · reading it live</p>
          <h2 className="mt-1 text-xl leading-snug font-bold">Checking the curbs on the way to {plan}</h2>
        </div>
        <ol className="flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <li key={step.label} className={cn("flex items-center gap-3 text-sm", i > active && "text-subtle")}>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  step.done ? "bg-success text-black" : i === active ? "animate-pulse bg-primary text-primary-foreground" : "border border-input",
                )}
              >
                {step.done ? "✓" : i + 1}
              </span>
              {step.label}
            </li>
          ))}
        </ol>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-subtle">
          {Math.round(s)} s · Green: free to park · Red: can&apos;t park · Orange: occupied. Once read, this street is saved and loads instantly next time.
        </p>
      </div>
    </div>
  );
}

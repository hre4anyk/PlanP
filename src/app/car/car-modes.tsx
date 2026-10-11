"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CarApp } from "./car-app";
import { StreetFinder } from "./street-finder";

type Mode = "street" | "garages";

/** Park my car: street parking from the camera first, the garage backup chain when the street is full. */
export function CarModes() {
  const [mode, setMode] = useState<Mode>("street");
  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={cn(
        "h-9 flex-1 rounded-md text-sm font-medium transition-colors sm:flex-none sm:px-5",
        mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex shrink-0 gap-1 border-b border-border bg-background p-1.5">
        {tab("street", "Street spot (camera)")}
        {tab("garages", "Garage plan A·B·C")}
      </div>
      <div className="min-h-0 flex-1">
        {mode === "street" ? <StreetFinder onUseGarages={() => setMode("garages")} /> : <CarApp />}
      </div>
    </div>
  );
}

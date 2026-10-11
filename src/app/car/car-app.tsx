"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_START, LOTS, MEETING_PLACES, formatClearance, type LatLng } from "@/data/lots";
import { buildChain, type ChainItem } from "@/logic/chain";
import { cn } from "@/lib/utils";

// Leaflet touches `window`, so the map only renders in the browser.
const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

const lotById = new Map(LOTS.map((lot) => [lot.id, lot]));

export function CarApp() {
  const [destinationId, setDestinationId] = useState(MEETING_PLACES[0].id);
  const [destination, setDestination] = useState<LatLng>(MEETING_PLACES[0]);
  const [start, setStart] = useState<LatLng>(DEMO_START);
  const [startLabel, setStartLabel] = useState(DEMO_START.name);
  const [locating, setLocating] = useState(false);
  const [chain, setChain] = useState<ChainItem[] | null>(null);
  const [currentIndex] = useState(0);

  function chooseDestination(id: string, point: LatLng) {
    setDestinationId(id);
    setDestination(point);
    setChain(null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStartLabel("Your location");
        setChain(null);
        setLocating(false);
      },
      () => {
        setStartLabel(`${DEMO_START.name} (location unavailable)`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col lg:flex-row">
      <div className="relative min-h-0 flex-1">
        <MapView
          lots={LOTS}
          chain={chain ?? []}
          currentIndex={currentIndex}
          destination={destination}
          start={start}
          onPickDestination={(point) => chooseDestination("custom", point)}
        />
      </div>

      <aside className="max-h-[48dvh] shrink-0 overflow-y-auto border-t border-border bg-background lg:max-h-none lg:w-[400px] lg:border-t-0 lg:border-l">
        <div className="flex flex-col gap-6 p-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="destination" className="eyebrow">Where&apos;s your meeting?</label>
            <select
              id="destination"
              value={destinationId}
              onChange={(e) => {
                const place = MEETING_PLACES.find((p) => p.id === e.target.value);
                if (place) chooseDestination(place.id, place);
              }}
              className="h-12 rounded-lg border border-input bg-surface px-3 text-base text-foreground"
            >
              {MEETING_PLACES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {destinationId === "custom" && <option value="custom">Point on the map</option>}
            </select>
            <p className="text-sm text-subtle">Or tap anywhere on the map.</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="eyebrow">Starting from</span>
            <div className="flex items-center justify-between gap-3">
              <span className="text-base">{startLabel}</span>
              <Button variant="ghost" size="sm" onClick={useMyLocation} disabled={locating}>
                {locating ? "Locating…" : "Use my location"}
              </Button>
            </div>
          </div>

          <Button size="lg" className="h-14 text-lg" onClick={() => setChain(buildChain(destination, LOTS))}>
            Plan my parking
          </Button>

          {chain && chain.length === 0 && (
            <p className="text-muted-foreground">No open garages within a 15-minute walk. Try another meeting place.</p>
          )}

          {chain && chain.length > 0 && (
            <ol className="flex flex-col gap-3">
              {chain.map((item, i) => {
                const lot = lotById.get(item.lotId)!;
                const current = i === currentIndex;
                return (
                  <li
                    key={item.lotId}
                    className={cn(
                      "flex items-start gap-4 rounded-lg border p-4",
                      current ? "border-primary/60 bg-primary/5" : "border-border",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full font-heading text-lg font-bold",
                        current ? "bg-primary text-primary-foreground" : "border border-primary/40 text-primary/70",
                      )}
                    >
                      {item.label}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium">{lot.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.walkMin} min walk · ${lot.pricePerHour}/hr · {lot.hours}
                      </span>
                      <span className="text-xs text-subtle">
                        Clearance {formatClearance(lot.clearanceInches)}{lot.rule ? ` · ${lot.rule}` : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

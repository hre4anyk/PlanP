"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_START, LOTS, MEETING_PLACES, formatClearance, type LatLng } from "@/data/lots";
import { nearestOpenLot } from "@/logic/chain";
import { fetchRoute, type Route } from "@/logic/route";
import { markCurrentFull, startTrip, withFullLots, type Trip } from "@/logic/trip";
import { cn } from "@/lib/utils";

// Leaflet touches `window`, so the map only renders in the browser.
const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

const lotById = new Map(LOTS.map((lot) => [lot.id, lot]));

/** "Heading to Plan B: Sutter-Stockton Garage. 3 min drive, 4 min walk." */
function headingMessage(trip: Trip, route: Route | null, rerouted: boolean, destination: LatLng): string {
  if (trip.exhausted && trip.fullIds.length === 0) {
    const nearest = nearestOpenLot(destination, LOTS);
    return `No open garages within a 15-minute walk.${nearest ? ` The closest is ${nearest.lot.name}, about ${nearest.walkMin} min away.` : ""}`;
  }
  if (trip.exhausted) return "Every garage near your meeting is full. Try a meeting spot further out.";
  const item = trip.chain[trip.currentIndex];
  const lot = lotById.get(item.id)!;
  const drive = route?.legs[trip.currentIndex]?.driveMin;
  const times = [drive ? `${drive} min drive` : null, item.distance].filter(Boolean).join(", ");
  return `${rerouted ? "No problem. " : ""}Heading to Plan ${item.label}: ${lot.name}. ${times}.`;
}

export function CarApp() {
  const [destinationId, setDestinationId] = useState(MEETING_PLACES[0].id);
  const [destination, setDestination] = useState<LatLng>(MEETING_PLACES[0]);
  const [start, setStart] = useState<LatLng>(DEMO_START);
  const [startLabel, setStartLabel] = useState(DEMO_START.name);
  const [locating, setLocating] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [route, setRoute] = useState<Route | null>(null);

  const lots = useMemo(() => withFullLots(LOTS, trip?.fullIds ?? []), [trip?.fullIds]);

  // One driving route through Start → A → B → C…, refetched whenever the chain grows.
  const stopsKey = trip ? trip.chain.map((c) => c.id).join(",") : "";
  useEffect(() => {
    if (!stopsKey) return;
    let cancelled = false;
    const stops = [start, ...stopsKey.split(",").map((id) => lotById.get(id)!)];
    fetchRoute(stops).then((r) => {
      if (!cancelled) setRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [stopsKey, start]);

  function reset() {
    setTrip(null);
    setRoute(null);
  }

  function chooseDestination(id: string, point: LatLng) {
    setDestinationId(id);
    setDestination(point);
    reset();
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStartLabel("Your location");
        reset();
        setLocating(false);
      },
      () => {
        setStartLabel(`${DEMO_START.name} (location unavailable)`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const planning = trip !== null;
  const rerouted = (trip?.fullIds.length ?? 0) > 0;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col lg:flex-row">
      <div className="relative min-h-0 flex-1">
        <MapView
          lots={lots}
          chain={trip?.chain ?? []}
          currentIndex={trip?.currentIndex ?? 0}
          destination={destination}
          start={start}
          route={route}
          onPickDestination={(point) => chooseDestination("custom", point)}
        />
        {route?.approximate && (
          <span className="absolute top-3 left-3 z-[1000] rounded-md bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
            Approximate route
          </span>
        )}
      </div>

      <aside className="flex max-h-[52dvh] shrink-0 flex-col border-t border-border bg-background lg:max-h-none lg:w-[400px] lg:border-t-0 lg:border-l">
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5 sm:p-6">
          {trip && (
            <p
              role="status"
              aria-live="polite"
              className={cn(
                "rounded-lg p-4 text-lg leading-snug font-medium",
                trip.exhausted ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-foreground",
              )}
            >
              {headingMessage(trip, route, rerouted, destination)}
            </p>
          )}

          {!planning && (
            <>
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
                <span className="text-xs text-subtle">Used for your driving route. Garages are picked by walk to your meeting.</span>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base">{startLabel}</span>
                  <Button variant="ghost" size="sm" onClick={useMyLocation} disabled={locating}>
                    {locating ? "Locating…" : "Use my location"}
                  </Button>
                </div>
              </div>

              <Button size="lg" className="h-14 text-lg" onClick={() => setTrip(startTrip(destination, LOTS))}>
                Plan my parking
              </Button>
            </>
          )}

          {trip && trip.chain.length > 0 && (
            <ol className="flex flex-col gap-3">
              {trip.chain.map((item, i) => {
                const lot = lotById.get(item.id)!;
                const full = trip.fullIds.includes(item.id);
                const current = i === trip.currentIndex && !trip.exhausted;
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-start gap-4 rounded-lg border p-4",
                      current ? "border-primary/60 bg-primary/5" : "border-border",
                      full && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full font-heading text-lg font-bold",
                        full
                          ? "border border-destructive text-destructive"
                          : current
                            ? "bg-primary text-primary-foreground"
                            : "border border-primary/40 text-primary/70",
                      )}
                    >
                      {full ? "✕" : item.label}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={cn("font-medium", full && "line-through")}>
                        Plan {item.label}: {lot.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {full ? "Full" : `${item.distance} · $${lot.pricePerHour}/hr · ${lot.hours}`}
                      </span>
                      {!full && (
                        <span className="text-xs text-subtle">
                          Clearance {formatClearance(lot.clearanceInches)}{lot.rule ? ` · ${lot.rule}` : ""}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {trip && trip.chain.length > 0 && (
            <p className="text-xs text-subtle">Walk times are straight-line estimates.</p>
          )}

          {planning && (
            <Button variant="ghost" onClick={reset} className="self-start">
              Start over
            </Button>
          )}
        </div>

        {trip && !trip.exhausted && (
          <div className="border-t border-border p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setTrip(markCurrentFull(trip, destination, LOTS))}
              className="h-16 w-full rounded-xl bg-destructive text-xl font-bold text-white transition-transform active:scale-[0.98]"
            >
              Lot is full
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

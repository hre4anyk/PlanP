"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { StreetJourney, type CurbFrame } from "@/components/street-journey";
import { Button } from "@/components/ui/button";
import { DEMO_START, LOTS, MEETING_PLACES, formatClearance, type LatLng } from "@/data/lots";
import { nearestOpenLot } from "@/logic/chain";
import { arrival, clock, meetingAt, spareText } from "@/logic/eta";
import { walkMinutes } from "@/logic/geo";
import { fetchRoute, type Route } from "@/logic/route";
import { sampleStretch } from "@/logic/stretch";
import { markCurrentFull, startTrip, withFullLots, type Trip } from "@/logic/trip";
import { cn } from "@/lib/utils";

// Leaflet touches `window`, so the map only renders in the browser.
const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

const lotById = new Map(LOTS.map((lot) => [lot.id, lot]));

type Place = LatLng & { name: string };
type Journey =
  | { status: "idle" }
  | { status: "loading"; points: number }
  | { status: "ready"; frames: CurbFrame[]; route: Route; trace: { ms: number; photos: number; costUsd: number } }
  | { status: "unavailable"; message: string };
type StartState = "finding" | "gps" | "fallback";

/** "Heading to Plan B: Sutter-Stockton Garage. 3 min drive, 4 min walk." */
function headingMessage(trip: Trip, route: Route | null, rerouted: boolean, destination: Place): string {
  if (trip.exhausted && trip.fullIds.length === 0) {
    const nearest = nearestOpenLot(destination, LOTS);
    const drive = route?.legs[0]?.driveMin;
    return `No garage within a 15-minute walk${nearest ? ` (closest: ${nearest.lot.name}, ${nearest.walkMin} min)` : ""}. Driving straight to ${destination.name}${drive ? `, ${drive} min` : ""}.`;
  }
  if (trip.exhausted) return "Every garage near your meeting is full. Look for street parking near the door.";
  const item = trip.chain[trip.currentIndex];
  const lot = lotById.get(item.id)!;
  const drive = route?.legs[trip.currentIndex]?.driveMin;
  const times = [drive ? `${drive} min drive` : null, item.distance].filter(Boolean).join(", ");
  return `${rerouted ? "No problem. " : ""}Heading to Plan ${item.label}: ${lot.name}. ${times}.`;
}

export function CarApp() {
  const [destination, setDestination] = useState<Place | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [start, setStart] = useState<LatLng>(DEMO_START);
  const [startState, setStartState] = useState<StartState>("finding");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routedAt, setRoutedAt] = useState<Date | null>(null);
  const [journey, setJourney] = useState<Journey>({ status: "idle" });
  const [frameIndex, setFrameIndex] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  // Show the status card from the top whenever the plan changes.
  useEffect(() => panelRef.current?.scrollTo({ top: 0 }), [trip?.currentIndex, trip?.chain.length]);

  const lots = useMemo(() => withFullLots(LOTS, trip?.fullIds ?? []), [trip?.fullIds]);

  // Find the driver right away (PRD S1). iPhone asks for permission the first time.
  useEffect(() => {
    if (!navigator.geolocation) {
      void Promise.resolve().then(() => setStartState("fallback"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStartState("gps");
      },
      () => setStartState("fallback"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  // One driving route: Start → A → B → C… through the garage chain, or straight to the meeting
  // when no garage is in walking range. Refetched whenever the chain grows.
  const stopsKey = trip ? (trip.chain.length ? trip.chain.map((c) => c.id).join(",") : "direct") : "";
  useEffect(() => {
    if (!stopsKey || !destination) return;
    let cancelled = false;
    const stops = stopsKey === "direct" ? [start, destination] : [start, ...stopsKey.split(",").map((id) => lotById.get(id)!)];
    fetchRoute(stops).then((r) => {
      if (cancelled) return;
      setRoute(r);
      setRoutedAt(new Date());
    });
    return () => {
      cancelled = true;
    };
  }, [stopsKey, start, destination]);

  function reset() {
    setTrip(null);
    setRoute(null);
    setJourney({ status: "idle" });
    setFrameIndex(0);
  }

  /** S2: the drive straight to the meeting → Street View photos of its last stretch → Claude's verdicts. */
  async function planJourney(dest: Place) {
    const direct = await fetchRoute([start, dest]);
    const points = sampleStretch(direct.legs.flatMap((l) => l.path), dest);
    if (!points.length) {
      setJourney({ status: "unavailable", message: "You're already within a short walk of the meeting." });
      return;
    }
    setJourney({ status: "loading", points: points.length });
    try {
      const res = await fetch("/api/curb", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ points }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.frames.length) throw new Error("No Street View photos along this stretch.");
      setFrameIndex(0);
      setJourney({ status: "ready", frames: data.frames, route: direct, trace: data.trace });
    } catch (err) {
      setJourney({ status: "unavailable", message: err instanceof Error ? err.message : "Street View is unavailable." });
    }
  }

  function plan() {
    if (!destination) return;
    setTrip(startTrip(destination, LOTS));
    void planJourney(destination);
  }

  function chooseDestination(place: Place) {
    setDestination(place);
    setResults(null);
    setQuery(place.name);
    reset();
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results);
      if (data.results.length === 1) chooseDestination(data.results[0]);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Address search failed");
    } finally {
      setSearching(false);
    }
  }

  const planning = trip !== null;
  const rerouted = (trip?.fullIds.length ?? 0) > 0;

  // Arrival at the meeting door: drive to the current target, then walk.
  let arrivalLine = "";
  if (trip && destination && route && routedAt && !(trip.exhausted && trip.fullIds.length)) {
    const target = trip.chain[trip.currentIndex];
    const drive = route.legs[target ? trip.currentIndex : 0]?.driveMin ?? 0;
    const walk = target ? walkMinutes(lotById.get(target.id)!, destination) : 0;
    const a = arrival(routedAt, drive, walk, meetingAt(meetingTime, routedAt));
    arrivalLine = `At the door ${clock(a.atDoor)}${a.spareMin !== null ? `, ${spareText(a.spareMin)}` : ""}.`;
  }
  const late = arrivalLine.includes("late");

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col lg:flex-row">
      <div className="relative min-h-0 flex-1">
        {journey.status === "ready" ? (
          <StreetJourney
            frames={journey.frames}
            index={frameIndex}
            onIndex={setFrameIndex}
            minimap={
              <MapView
                lots={lots}
                chain={[]}
                currentIndex={0}
                destination={destination}
                start={start}
                route={journey.route}
                onPickDestination={() => {}}
                focus={journey.frames[frameIndex]}
              />
            }
          />
        ) : (
        <MapView
          lots={lots}
          chain={trip?.chain ?? []}
          currentIndex={trip?.currentIndex ?? 0}
          destination={destination}
          start={start}
          route={route}
          onPickDestination={(point) => chooseDestination({ ...point, name: "Point on the map" })}
        />
        )}
        {journey.status === "loading" && (
          <span className="absolute inset-x-4 top-4 z-[1000] rounded-lg bg-background/90 p-3 text-center text-base font-medium">
            Claude is reading {journey.points} Street View photos along your last 10 minutes…
          </span>
        )}
        {journey.status !== "ready" && route?.approximate && (
          <span className="absolute top-3 left-3 z-[1000] rounded-md bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
            Approximate route
          </span>
        )}
      </div>

      <aside className="flex max-h-[55dvh] shrink-0 flex-col border-t border-border bg-background lg:max-h-none lg:w-[400px] lg:border-t-0 lg:border-l">
        <div ref={panelRef} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
          {trip && destination && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "flex flex-col gap-1 rounded-lg p-4",
                trip.exhausted && trip.fullIds.length ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-foreground",
              )}
            >
              <p className="text-lg leading-snug font-medium">{headingMessage(trip, route, rerouted, destination)}</p>
              {arrivalLine && <p className={cn("text-base", late ? "font-semibold text-destructive" : "text-muted-foreground")}>{arrivalLine}</p>}
            </div>
          )}

          {journey.status === "ready" && (() => {
            const green = journey.frames.map((f, i) => ({ f, i })).filter(({ f }) => f.allowed === "yes");
            const closest = green.reduce<number | null>((m, { f }) => (m === null || f.walkMin < m ? f.walkMin : m), null);
            return (
              <div className="flex flex-col gap-2">
                <span className="eyebrow">Street parking on your way</span>
                <p className="text-base">
                  {green.length
                    ? `${green.length} of ${journey.frames.length} stretches allow parking${closest !== null ? `, the closest ${closest} min walk from the door` : ""}. Garage A is your backup.`
                    : `No legal street parking in ${journey.frames.length} photos. Head straight for Garage A.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {green.map(({ f, i }) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFrameIndex(i)}
                      className={cn("rounded-full border px-3 py-1.5 text-xs", i === frameIndex ? "border-success text-foreground" : "border-success/40 text-muted-foreground")}
                    >
                      {f.walkMin} min walk · {f.kind}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-xs text-subtle">
                  Claude + Street View · {journey.trace.photos} photos · {(journey.trace.ms / 1000).toFixed(1)} s · ${journey.trace.costUsd.toFixed(2)}
                </span>
              </div>
            );
          })()}
          {journey.status === "unavailable" && <p className="text-sm text-muted-foreground">Street View: {journey.message}</p>}

          {!planning && (
            <>
              <form onSubmit={search} className="flex flex-col gap-2">
                <label htmlFor="destination" className="eyebrow">Where&apos;s your meeting?</label>
                <div className="flex gap-2">
                  <input
                    id="destination"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Address or place in San Francisco"
                    autoComplete="street-address"
                    enterKeyHint="search"
                    className="h-12 min-w-0 flex-1 rounded-lg border border-input bg-surface px-3 text-base text-foreground placeholder:text-subtle"
                  />
                  <Button type="submit" size="lg" className="h-12" disabled={searching}>
                    {searching ? "…" : "Find"}
                  </Button>
                </div>
                {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                {results && results.length === 0 && <p className="text-sm text-muted-foreground">Nothing found in San Francisco. Try a street address.</p>}
                {results && results.length > 1 && (
                  <ul className="flex flex-col gap-1">
                    {results.map((r) => (
                      <li key={`${r.lat},${r.lng}`}>
                        <button type="button" onClick={() => chooseDestination(r)} className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white/5">
                          {r.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {MEETING_PLACES.slice(0, 2).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => chooseDestination(p)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs",
                        destination?.name === p.name ? "border-primary text-foreground" : "border-input text-muted-foreground",
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                {destination && <p className="text-sm">Meeting at: <span className="font-medium">{destination.name}</span></p>}
              </form>

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="meeting-time" className="eyebrow">Meeting time</label>
                <input
                  id="meeting-time"
                  type="time"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="h-11 rounded-lg border border-input bg-surface px-3 text-base text-foreground"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="eyebrow">Starting from</span>
                <span className="text-base">
                  {startState === "finding" ? "Finding you…" : startState === "gps" ? "Your location" : `${DEMO_START.name} (location unavailable)`}
                </span>
              </div>

              <Button
                size="lg"
                className="h-14 text-lg"
                disabled={!destination}
                onClick={plan}
              >
                {destination ? "Plan my parking" : "Choose where you're going"}
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

          {trip && trip.chain.length > 0 && <p className="text-xs text-subtle">Walk times are straight-line estimates.</p>}

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
              onClick={() => destination && setTrip(markCurrentFull(trip, destination, LOTS))}
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

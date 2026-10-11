"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { StreetJourney, type CurbFrame } from "@/components/street-journey";
import poc from "@/data/poc-route.json";
import { Button } from "@/components/ui/button";
import { LOTS, formatClearance, type LatLng } from "@/data/lots";
import { nearestOpenLot } from "@/logic/chain";
import { arrival, clock, meetingAt, spareText } from "@/logic/eta";
import { walkMinutes } from "@/logic/geo";
import { loadJourney, type JourneyTrace } from "@/logic/journey";
import { fetchRoute, type Route } from "@/logic/route";
import { markCurrentFull, startTrip, withFullLots, type Trip } from "@/logic/trip";
import { RoutePlanBar } from "@/components/route-plan-bar";
import { SpotList } from "@/components/spot-list";
import { ArrivalPopup } from "@/components/arrival-popup";
import { appleMapsUrl, googleMapsUrl } from "@/logic/maps";
import { cn } from "@/lib/utils";
import { PITCH_QUESTIONS } from "@/ai/questions";
import { VoiceCopilot, type CopilotState } from "@/voice/copilot";

// Leaflet touches `window`, so the map only renders in the browser.
const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

const lotById = new Map(LOTS.map((lot) => [lot.id, lot]));

type Place = LatLng & { name: string };
type Journey =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; frames: CurbFrame[]; route: Route; trace: JourneyTrace }
  | { status: "unavailable"; message: string };
type Line = { who: "you" | "copilot"; text: string };
type Pitch = { score: number; strong: string; fix: string; via: string } | { failed: true };

/** The demo meeting, however he says it: "2 South Park", "South Park Street", "2 S Park St"… */
const isDemoAddress = (address: string) => /south\s*park|\b2\s*s\.?\s*park/i.test(address);
const TONE_WORD = { free_to_park: "green, free to park", cant_park: "red, can't park", occupied: "orange, occupied" } as const;

// The demo route (PRD S2b): built once by scripts/build-poc-route.mts, instant and free to replay.
const POC_START: LatLng = { lat: poc.start.lat, lng: poc.start.lng };
const POC_MEETING: Place = { name: "2 S Park St · VC meeting", lat: poc.meeting.lat, lng: poc.meeting.lng };
const isPocTrip = (start: LatLng, dest: LatLng) =>
  start.lat === POC_START.lat && start.lng === POC_START.lng && dest.lat === POC_MEETING.lat && dest.lng === POC_MEETING.lng;

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
  const [meetingTime, setMeetingTime] = useState("");
  const start = POC_START;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routedAt, setRoutedAt] = useState<Date | null>(null);
  const [journey, setJourney] = useState<Journey>({ status: "idle" });
  const [frameIndex, setFrameIndex] = useState(0);
  const [parked, setParked] = useState(false);
  const [arrivalShown, setArrivalShown] = useState(false);

  // The voice copilot (hands-free): destination → "Let's go?" → drive → four questions → one score.
  const [copilotState, setCopilotState] = useState<CopilotState>("off");
  const [copilotDetail, setCopilotDetail] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [answered, setAnswered] = useState(0);
  const [scoring, setScoring] = useState(false);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const copilotRef = useRef<VoiceCopilot | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const tripRef = useRef("");
  const answersRef = useRef<string[]>([]);
  // Tool calls run long after the session started: they read the latest state from here.
  const live = useRef({ trip, destination });
  useEffect(() => {
    live.current = { trip, destination };
  });
  useEffect(() => () => copilotRef.current?.stop(), []);
  const voiceOn = copilotState !== "off" && copilotState !== "error";

  const journeyRequest = useRef<AbortController | null>(null);
  const occupiedRef = useRef<() => void>(() => {});
  const arrivalShownRef = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      journeyRequest.current?.abort();
      clearTimeout(advanceTimer.current);
    },
    [],
  );

  const panelRef = useRef<HTMLDivElement>(null);
  // Show the status card from the top whenever the plan changes.
  // Braces matter: Chrome's scrollTo returns a promise, and an effect may only return a cleanup function.
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [trip?.currentIndex, trip?.chain.length]);

  const lots = useMemo(() => withFullLots(LOTS, trip?.fullIds ?? []), [trip?.fullIds]);

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

  /** A new drive: no arrival popup, no pending switch to the next plan. */
  function clearArrival() {
    clearTimeout(advanceTimer.current);
    arrivalShownRef.current = false;
    setArrivalShown(false);
  }

  function reset() {
    journeyRequest.current?.abort();
    clearArrival();
    setTrip(null);
    setRoute(null);
    setJourney({ status: "idle" });
    setFrameIndex(0);
    setParked(false);
  }

  /** Each active parking plan gets its own drive photos and the same curb analysis. */
  async function planJourney(dest: Place, from: LatLng, target: LatLng, useDemo = false) {
    journeyRequest.current?.abort();
    const request = new AbortController();
    journeyRequest.current = request;
    setFrameIndex(0);
    clearArrival();
    if (useDemo && isPocTrip(from, dest)) {
      setJourney({
        status: "ready",
        frames: poc.frames as CurbFrame[],
        route: { legs: [{ path: poc.path, driveMin: poc.driveMin }], approximate: false },
        trace: { ms: 0, photos: poc.frames.length, costUsd: poc.buildCostUsd, precomputed: true },
      });
      return;
    }
    setJourney({ status: "loading" });
    try {
      const next = await loadJourney(from, target, dest, request.signal);
      if (!request.signal.aborted) setJourney({ status: "ready", ...next });
    } catch (err) {
      if (!request.signal.aborted) {
        setJourney({ status: "unavailable", message: err instanceof Error ? err.message : "Street View is unavailable." });
      }
    }
  }

  function occupied() {
    if (!trip || !destination || trip.exhausted) return;
    const from = lotById.get(trip.chain[trip.currentIndex].id)!;
    const next = markCurrentFull(trip, destination, LOTS);
    setTrip(next);
    setParked(false);
    if (next.exhausted) {
      journeyRequest.current?.abort();
      setJourney({ status: "idle" });
      return;
    }
    const target = lotById.get(next.chain[next.currentIndex].id)!;
    void planJourney(destination, from, target);
  }
  useEffect(() => {
    occupiedRef.current = occupied;
  });

  // When the drive reaches the last photo: the arrival popup, and the copilot hears the verdict.
  // Green → park here; red or orange → on to the next plan after 3.5 s.
  const lastFrame = journey.status === "ready" ? journey.frames[journey.frames.length - 1] : null;
  const nextPlanLabel = trip?.chain[trip.currentIndex + 1]?.label ?? null;

  function onFrame(i: number) {
    setFrameIndex(i);
    if (journey.status !== "ready" || !trip || !lastFrame) return;
    if (i !== journey.frames.length - 1 || arrivalShownRef.current) return;
    arrivalShownRef.current = true;
    setArrivalShown(true);
    const item = trip.chain[trip.currentIndex];
    const here = item ? `Plan ${item.label}, ${lotById.get(item.id)?.name}` : "the meeting";
    const next = trip.chain[trip.currentIndex + 1];
    copilotRef.current?.say(
      `[Plan P app] Arrived at ${here}. Last photo: ${TONE_WORD[lastFrame.status]} (${lastFrame.kind}: ${lastFrame.reason}).` +
        (lastFrame.status === "free_to_park"
          ? ` ${destination ? walkMinutes(lastFrame, destination) : lastFrame.walkMin} min walk to the meeting.`
          : next
            ? ` The app is taking him to Plan ${next.label}, ${lotById.get(next.id)?.name}, ${next.distance}.`
            : " No plans left: tell him to look for street parking near the door."),
    );
    if (lastFrame.status === "free_to_park") setParked(true);
    else if (next) advanceTimer.current = setTimeout(() => occupiedRef.current(), 3500);
  }

  function chooseDestination(place: Place) {
    setDestination(place);
    reset();
  }

  /**
   * Score the whole pitch: queue it for the Anbaric engine and poll for Claude's score (usually 5–8 s);
   * after 13 s without one, ask Claude directly (ARCHITECTURE S4). Every request stays short.
   */
  async function scoreViaEngine(answers: string[]) {
    const body = (direct: boolean) =>
      JSON.stringify({ tripRef: tripRef.current, direct, pitch: PITCH_QUESTIONS.map((question, i) => ({ question, answer: answers[i] || "(no answer)" })) });
    const post = (direct: boolean) => fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: body(direct) });
    const first = await post(false);
    const queued = first.ok ? await first.json() : null;
    if (queued && !queued.queued) return queued; // scored directly (no queue here)
    if (queued?.queued) {
      const deadline = Date.now() + 13000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 600));
        const poll = await fetch(`/api/coach/result?id=${queued.queued}`).catch(() => null);
        if (!poll?.ok) break;
        const result = await poll.json();
        if (!result.pending) return result;
      }
    }
    const fallback = await post(true);
    if (!fallback.ok) throw new Error("scoring failed");
    return fallback.json();
  }

  function planText(t: Trip) {
    const item = t.chain[t.currentIndex];
    return item ? `Plan ${item.label}, ${lotById.get(item.id)?.name}, ${item.distance}` : "straight to the meeting";
  }

  const tools = {
    set_destination: async (args: Record<string, unknown>) => {
      const address = String(args.address ?? "");
      const time = typeof args.meeting_time === "string" && /^\d{1,2}:\d{2}$/.test(args.meeting_time) ? args.meeting_time : "";
      let dest: Place;
      if (isDemoAddress(address)) dest = POC_MEETING;
      else {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
        const data = await res.json();
        if (!res.ok || !data.results?.length) return `I couldn't find "${address}" in San Francisco. Ask him to repeat the street and number.`;
        dest = data.results[0];
      }
      reset();
      const next = startTrip(dest, LOTS);
      setDestination(dest);
      setMeetingTime(time);
      setTrip(next);
      answersRef.current = [];
      setAnswered(0);
      setPitch(null);
      tripRef.current = crypto.randomUUID();
      void fetch("/api/trip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "start", tripRef: tripRef.current, destination: dest.name, meetingTime: time || undefined }),
      });
      if (!next.chain.length) return `Destination set: ${dest.name}. No garage within a 15-minute walk; we'll look for street parking near the door. Ask "Let's go?"`;
      const places = next.chain.map((c) => `Plan ${c.label}: ${lotById.get(c.id)?.name}, ${c.distance}`).join("; ");
      return `Destination set: ${dest.name}. Found ${next.chain.length} places to park: ${places}. Say you've found ${next.chain.length} places to park and ask "Let's go?"`;
    },
    start_drive: async () => {
      const { trip: t, destination: dest } = live.current;
      if (!t || !dest) return "No destination yet. Ask him where he's going first.";
      const target = lotById.get(t.chain[t.currentIndex]?.id) ?? dest;
      void planJourney(dest, start, target, true);
      return `Driving to ${planText(t)}. Ask Question 1 word for word: "${PITCH_QUESTIONS[0]}"`;
    },
    save_answer: async (args: Record<string, unknown>) => {
      const n = Math.max(1, Math.min(PITCH_QUESTIONS.length, Number(args.question_number) || answersRef.current.length + 1));
      answersRef.current[n - 1] = String(args.answer ?? "").trim();
      setAnswered(answersRef.current.filter(Boolean).length);
      if (n < PITCH_QUESTIONS.length) return `Saved. Ask Question ${n + 1} word for word: "${PITCH_QUESTIONS[n]}"`;

      setScoring(true);
      const driving = live.current.trip ? planText(live.current.trip) : "to the meeting";
      try {
        const data = await scoreViaEngine(answersRef.current);
        setPitch({ score: data.score, strong: data.strong, fix: data.fix, via: data.via });
        void fetch("/api/trip", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: "arrived", tripRef: tripRef.current, averageScore: data.score }),
        });
        return JSON.stringify({ pitch_score: data.score, strong: data.strong, fix: data.fix, now_driving_to: driving });
      } catch {
        setPitch({ failed: true });
        return `Scoring didn't work this time. Give him one honest sentence of feedback yourself, then tell him we're driving to ${driving}.`;
      } finally {
        setScoring(false);
      }
    },
    i_parked: async () => {
      setParked(true);
      return "Parked. Wish him luck.";
    },
  };

  async function startCopilot() {
    copilotRef.current?.stop();
    setLines([]);
    const copilot = new VoiceCopilot({
      onState: (state, detail) => {
        setCopilotState(state);
        setCopilotDetail(detail ?? "");
      },
      onTranscript: (who, text) => setLines((prev) => [...prev.slice(-3), { who, text }]),
      tools,
    });
    copilotRef.current = copilot;
    await copilot.start(audioRef.current!);
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
      <div key={journey.status === "ready" ? "journey" : "map"} className="relative min-h-0 flex-1">
        {journey.status === "ready" ? (
          <StreetJourney
            frames={journey.frames}
            index={frameIndex}
            onIndex={onFrame}
            destination={destination}
            autoStart
            paced={voiceOn}
            holdAt={voiceOn && !pitch && trip?.currentIndex === 0 ? Math.max(0, journey.frames.length - 2) : null}
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
        {/* Phase banner: what the drive and the conversation are doing right now */}
        {(() => {
          const plan = trip?.chain[trip.currentIndex];
          const to = plan ? `Plan ${plan.label}` : "the meeting";
          let text = "";
          if (parked) text = "Parked · good luck";
          else if (scoring) text = "Claude is scoring your pitch…";
          else if (pitch && "score" in pitch) text = `Pitch ${pitch.score}/10 · driving to ${to}`;
          else if (journey.status === "ready" && voiceOn) text = `Driving to ${to} · Question ${Math.min(answered + 1, PITCH_QUESTIONS.length)} of ${PITCH_QUESTIONS.length}`;
          else if (trip && journey.status === "idle" && voiceOn) text = `${trip.chain.length || "No"} places found · say "Let's go"`;
          else if (!trip && voiceOn) text = "Tell Plan P where you're going";
          if (!text || journey.status === "loading") return null;
          return (
            <div className="pointer-events-none absolute inset-x-2 top-9 z-[1000] flex justify-start pr-24 sm:top-12">
              <span className={cn("rounded-lg px-3 py-1.5 text-sm font-bold shadow-lg", parked || pitch ? "bg-success text-black" : "bg-primary text-primary-foreground")}>{text}</span>
            </div>
          );
        })()}
        {trip && trip.chain.length > 0 && journey.status !== "ready" && (
          <RoutePlanBar chain={trip.chain} currentIndex={trip.currentIndex} lots={lotById} />
        )}
        {journey.status === "loading" && (
          <span className="absolute inset-x-4 top-16 z-[1000] rounded-lg bg-background/90 p-3 text-center text-base font-medium">
            Loading Street View and parking analysis{trip?.chain[trip.currentIndex] ? ` for Plan ${trip.chain[trip.currentIndex].label}` : " along your drive"}…
          </span>
        )}
        {journey.status !== "ready" && route?.approximate && (
          <span className="absolute top-3 left-3 z-[1000] rounded-md bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
            Approximate route
          </span>
        )}
        {journey.status === "ready" && arrivalShown && lastFrame && (
          <ArrivalPopup frame={lastFrame} nextPlanLabel={nextPlanLabel} />
        )}
      </div>

      <aside
        className={cn(
          "flex shrink-0 flex-col border-t border-border bg-background lg:max-h-none lg:w-[400px] lg:border-t-0 lg:border-l",
          journey.status === "ready" ? "max-h-[30dvh]" : "max-h-[55dvh]",
        )}
      >
        <div ref={panelRef} className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", journey.status === "ready" ? "gap-3 p-4" : "gap-5 p-5 sm:p-6")}>
          {/* Hands-free: everything happens by voice */}
          <audio ref={audioRef} autoPlay playsInline className="hidden" />
          <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            {!voiceOn ? (
              <>
                <Button size="lg" className="h-16 text-lg" onClick={() => void startCopilot()}>
                  🎙 Talk to Plan P
                </Button>
                <p className="text-center text-xs leading-snug text-muted-foreground">
                  {copilotState === "error" ? <span className="text-destructive">{copilotDetail}</span> : "Hands-free: say where you're going, Plan P finds parking and preps your pitch on the drive."}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className={cn("size-2.5 rounded-full", copilotState === "live" ? "animate-pulse bg-success" : "bg-amber-400")} />
                    {copilotState === "connecting" ? "Connecting…" : scoring ? "Claude is scoring your pitch…" : copilotState === "working" ? "Working on it…" : "Listening"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => copilotRef.current?.stop()}>
                    End
                  </Button>
                </div>
                {lines.slice(-2).map((l, i) => (
                  <p key={i} className={cn("text-sm leading-snug", l.who === "you" ? "text-muted-foreground" : "text-foreground")}>
                    <span className="font-semibold">{l.who === "you" ? "You: " : "Plan P: "}</span>
                    {l.text}
                  </p>
                ))}
              </>
            )}
            {pitch && "score" in pitch && (
              <p className="text-sm leading-snug">
                <span className="font-bold">Pitch {pitch.score}/10.</span> {pitch.strong} <span className="text-primary">Fix: {pitch.fix}</span>
              </p>
            )}
          </div>
          {trip && trip.chain.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface p-2.5">
              {trip.chain.map((item, i) => {
                const lot = lotById.get(item.id);
                const isCurrent = i === trip.currentIndex;
                const isPast = i < trip.currentIndex;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isPast
                          ? "bg-destructive/20 text-destructive line-through"
                          : "bg-white/5 text-muted-foreground",
                    )}
                  >
                    <span className="font-heading font-bold">{item.label}</span>
                    <span className="whitespace-nowrap">{lot?.name ?? item.id}</span>
                  </div>
                );
              })}
            </div>
          )}
          {trip && destination && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "flex flex-col gap-1 rounded-lg",
                journey.status === "ready" ? "order-2 p-3" : "p-4",
                trip.exhausted && trip.fullIds.length ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-foreground",
              )}
            >
              {journey.status === "ready" && <span className="eyebrow">Garage backup — {trip.chain.length} plans</span>}
              <p className={cn("leading-snug font-medium", journey.status === "ready" ? "text-sm" : "text-lg")}>{headingMessage(trip, route, rerouted, destination)}</p>
              {arrivalLine && <p className={cn(journey.status === "ready" ? "text-sm" : "text-base", late ? "font-semibold text-destructive" : "text-muted-foreground")}>{arrivalLine}</p>}
              {journey.status === "ready" && !trip.exhausted && !parked && (() => {
                const target = trip.chain[trip.currentIndex] ? lotById.get(trip.chain[trip.currentIndex].id)! : destination;
                return target ? (
                  <div className="flex gap-3 pt-1.5">
                    <a href={appleMapsUrl(target)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                      Apple Maps →
                    </a>
                    <a href={googleMapsUrl(target)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                      Google Maps →
                    </a>
                  </div>
                ) : null;
              })()}
              {journey.status !== "ready" && !parked && (() => {
                const target = trip.chain[trip.currentIndex] ? lotById.get(trip.chain[trip.currentIndex].id)! : destination;
                if (!target) return null;
                return (
                  <div className="flex gap-3 pt-1">
                    <a href={appleMapsUrl(target)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                      Apple Maps →
                    </a>
                    <a href={googleMapsUrl(target)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                      Google Maps →
                    </a>
                  </div>
                );
              })()}
              {journey.status === "ready" && parked && (
                <p className="pt-1 text-sm font-semibold text-success">Parked! You&apos;re all set.</p>
              )}
            </div>
          )}

          {journey.status === "ready" && (
            <>
              <SpotList frame={journey.frames[frameIndex]} destination={destination} />
              <span className="font-mono text-xs text-subtle">
                Claude + Street View · {journey.trace.photos} photos ·{" "}
                {journey.trace.precomputed ? `read once, $${journey.trace.costUsd.toFixed(2)}` : `${(journey.trace.ms / 1000).toFixed(1)} s · $${journey.trace.costUsd.toFixed(2)}`}
              </span>
            </>
          )}
          {journey.status === "unavailable" && <p className="text-sm text-muted-foreground">Street View: {journey.message}</p>}

          {trip && trip.chain.length > 0 && journey.status !== "ready" && (
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

          {trip && trip.chain.length > 0 && <p className="order-3 text-xs text-subtle">Walk times are straight-line estimates.</p>}

          {planning && (
            <Button variant="ghost" onClick={reset} className="order-4 self-start">
              Start over
            </Button>
          )}
        </div>

        {trip && parked && (
          <div className="border-t border-border p-4 sm:p-5">
            <div className="flex h-16 items-center justify-center rounded-xl bg-success/15 text-lg font-bold text-success">
              ✓ Parked — you&apos;ve arrived!
            </div>
            {destination && (
              <div className="mt-3 flex gap-3">
                <a href={appleMapsUrl(destination, "walking")} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg border border-input py-2.5 text-center text-sm font-medium text-foreground hover:bg-white/5">
                  Walk to meeting in Maps
                </a>
                <a href={googleMapsUrl(destination, "walking")} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg border border-input py-2.5 text-center text-sm font-medium text-foreground hover:bg-white/5">
                  Google Maps walk
                </a>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

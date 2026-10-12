"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { StreetJourney, type CurbFrame } from "@/components/street-journey";
import poc from "@/data/poc-route.json";
import { Button } from "@/components/ui/button";
import { LOTS, type LatLng } from "@/data/lots";
import { nearestOpenLot } from "@/logic/chain";
import { arrival, clock, meetingAt, spareText } from "@/logic/eta";
import { walkMinutes } from "@/logic/geo";
import { loadJourney, type JourneyTrace } from "@/logic/journey";
import { fetchRoute, type Route } from "@/logic/route";
import { markCurrentFull, startTrip, withFullLots, type Trip } from "@/logic/trip";
import { RoutePlanBar } from "@/components/route-plan-bar";
import { ArrivalPopup } from "@/components/arrival-popup";
import { Fundy, feedFundy } from "@/components/fundy";
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
type Line = { id: number; who: "you" | "copilot"; text: string };
/**
 * The conversation's stages (founder's spec): where → confirm the place → "Let's go?" → four questions
 * → debrief (score, Fundy, next stop) → quiet until he asks. The tools enforce the order.
 */
type Stage = "where" | "confirm" | "ready" | "questions" | "debrief" | "quiet";
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
  const [stage, setStageState] = useState<Stage>("where");
  const [question, setQuestion] = useState<number | null>(null);
  const [quietFrom, setQuietFrom] = useState(0);
  const stageRef = useRef<Stage>("where");
  const lineId = useRef(0);
  const [scoring, setScoring] = useState(false);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [muted, setMuted] = useState(false);
  const copilotRef = useRef<VoiceCopilot | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const tripRef = useRef("");
  const answersRef = useRef<string[]>([]);
  function setStage(next: Stage) {
    stageRef.current = next;
    setStageState(next);
    if (next === "quiet") setQuietFrom(lineId.current);
  }
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
            : " No plans left: tell him to look for street parking near the door.") +
        " Say it in one or two short sentences, then stay quiet.",
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

  /** The first question he hasn't answered yet (0-based), or null when all four are in. */
  function nextQuestion(): number | null {
    const i = PITCH_QUESTIONS.findIndex((_, k) => !answersRef.current[k]);
    return i === -1 ? null : i;
  }

  const tools = {
    set_destination: async (args: Record<string, unknown>) => {
      if (stageRef.current !== "where" && stageRef.current !== "confirm" && stageRef.current !== "ready")
        return "The drive has started; the destination is set. Carry on where you were.";
      const address = String(args.address ?? "");
      const time = typeof args.meeting_time === "string" && /^\d{1,2}:\d{2}$/.test(args.meeting_time) ? args.meeting_time : "";
      let dest: Place;
      if (isDemoAddress(address)) dest = POC_MEETING;
      else {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
        const data = await res.json();
        if (!res.ok || !data.results?.length) return `Nothing found for "${address}" in San Francisco. Ask him to say the street number and street name again.`;
        dest = data.results[0];
      }
      reset();
      setDestination(dest);
      setMeetingTime(time);
      setStage("confirm");
      const spoken = dest === POC_MEETING ? "2 South Park Street, in SoMa, San Francisco" : dest.name;
      return `Found: ${spoken}. Read this address back to him in one short sentence and ask if that's the right place. Don't mention parking yet. If he says yes, call confirm_destination; if not, ask for the exact address and call set_destination again.`;
    },
    confirm_destination: async () => {
      const { destination: dest } = live.current;
      if (!dest || stageRef.current === "where") return "No destination yet. Ask him where he's going.";
      if (stageRef.current !== "confirm") return "Already confirmed. Carry on where you were.";
      const next = startTrip(dest, LOTS);
      setTrip(next);
      answersRef.current = [];
      setAnswered(0);
      setQuestion(null);
      setPitch(null);
      setStage("ready");
      tripRef.current = crypto.randomUUID();
      void fetch("/api/trip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "start", tripRef: tripRef.current, destination: dest.name, meetingTime: meetingTime || undefined }),
      });
      if (!next.chain.length) return `No garage within a 15-minute walk. Say you'll look for street parking right by the door, then ask exactly: "Let's go?"`;
      const a = next.chain[0];
      return `Say, in your own words but this content: "I found ${next.chain.length} places nearby to park. Plan A is ${lotById.get(a.id)?.name}, ${a.distance}, and I have ${next.chain.length - 1} backups in case Plan A doesn't work." Then ask exactly: "Let's go?" When he says yes, call start_drive.`;
    },
    start_drive: async () => {
      const { trip: t, destination: dest } = live.current;
      if (stageRef.current === "where" || stageRef.current === "confirm" || !t || !dest)
        return "Not yet: first confirm the address with him (confirm_destination), then ask \"Let's go?\".";
      if (stageRef.current !== "ready") return "The drive has already started. Don't repeat anything; carry on where you were.";
      const target = lotById.get(t.chain[t.currentIndex]?.id) ?? dest;
      void planJourney(dest, start, target, true);
      setStage("questions");
      setQuestion(0);
      return `Driving now. Say in one short sentence that you'll use the drive to prepare his pitch with four questions, then ask Question 1 word for word: "${PITCH_QUESTIONS[0]}"`;
    },
    save_answer: async (args: Record<string, unknown>) => {
      if (stageRef.current !== "questions") return "All four questions are done. Don't ask them again. Stay quiet unless he asks you something.";
      const asked = Number(args.question_number);
      const n = asked >= 1 && asked <= PITCH_QUESTIONS.length && answersRef.current[asked - 1] ? asked : (nextQuestion() ?? 0) + 1;
      answersRef.current[n - 1] = String(args.answer ?? "").trim() || "(no answer)";
      setAnswered(answersRef.current.filter(Boolean).length);
      const k = nextQuestion();
      if (k !== null) {
        setQuestion(k);
        return `Saved. Say only "Got it." and ask Question ${k + 1} word for word: "${PITCH_QUESTIONS[k]}". Never repeat a question he has already answered unless he asks you to.`;
      }

      setStage("debrief");
      setQuestion(null);
      setScoring(true);
      const t = live.current.trip;
      const plan = t?.chain[t.currentIndex];
      const nextStop = plan ? `Plan ${plan.label}, ${lotById.get(plan.id)?.name}, ${plan.distance} to the meeting` : "the meeting itself";
      const close = `Then say the next stop in one sentence: ${nextStop}. Then stop talking: from now on stay silent unless he asks you something or the app reports arriving at a stop.`;
      try {
        const data = await scoreViaEngine(answersRef.current);
        setPitch({ score: data.score, strong: data.strong, fix: data.fix, via: data.via });
        const fundy = feedFundy({ score: data.score, feedback: data.fix });
        void fetch("/api/trip", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: "arrived", tripRef: tripRef.current, averageScore: data.score }),
        });
        return JSON.stringify({
          say_in_order: [
            `Pitch score ${data.score} out of 10.`,
            `What was strong: ${data.strong}`,
            `One fix: ${data.fix}`,
            `Fundy the dino grew by ${fundy.grewBy} points to ${fundy.points}${fundy.evolved ? ` and evolved: ${fundy.evolved}` : `, still a ${fundy.stage}`} (${fundy.toNextStage}).`,
          ],
          then: close,
        });
      } catch {
        setPitch({ failed: true });
        return `Scoring didn't work this time. Give him one honest sentence of feedback yourself. ${close}`;
      } finally {
        setScoring(false);
        setStage("quiet");
      }
    },
    i_parked: async () => {
      setParked(true);
      setStage("quiet");
      return "Parked. Wish him luck in one sentence, then stay quiet.";
    },
  };

  async function startCopilot() {
    copilotRef.current?.stop();
    setLines([]);
    setMuted(false);
    setStage("where");
    setQuestion(null);
    const copilot = new VoiceCopilot({
      onState: (state, detail) => {
        setCopilotState(state);
        setCopilotDetail(detail ?? "");
      },
      onTranscript: (who, text) => {
        const id = ++lineId.current;
        setLines((prev) => [...prev.slice(-5), { id, who, text }]);
      },
      tools,
    });
    copilotRef.current = copilot;
    await copilot.start(audioRef.current!);
  }

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
          else if (!trip && voiceOn && stage === "confirm" && destination) text = `${destination.name.split(/[,·]/)[0].trim()}? · say "yes"`;
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
          journey.status === "ready" ? "max-h-[46dvh]" : "max-h-[50dvh]",
        )}
      >
        <div ref={panelRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          {/* Hands-free: everything happens by voice */}
          <audio ref={audioRef} autoPlay playsInline className="hidden" />
          <div className="flex flex-col gap-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={muted}
                    onClick={() => {
                      copilotRef.current?.setMuted(!muted);
                      setMuted(!muted);
                    }}
                    className={cn(
                      "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-base font-bold",
                      muted ? "bg-destructive text-white" : "border-2 border-success bg-success/10 text-success",
                    )}
                  >
                    {muted ? "🔇 Mic off · tap to talk" : "🎙 Mic on · tap to mute"}
                  </button>
                  <Button variant="ghost" size="sm" className="h-12" onClick={() => copilotRef.current?.stop()}>
                    End
                  </Button>
                </div>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", muted ? "bg-destructive" : copilotState === "live" ? "animate-pulse bg-success" : "bg-amber-400")} />
                  {copilotState === "connecting" ? "Connecting…" : muted ? "She can't hear you" : scoring ? "Claude is scoring your pitch…" : copilotState === "working" ? "Working on it…" : "Listening"}
                </span>
                {(() => {
                  const last = lines[lines.length - 1];
                  const answer = last?.who === "you" ? last.text : null;
                  // During the questions: the question and your answer, nothing else.
                  if (stage === "questions" && question !== null)
                    return (
                      <>
                        <p className="text-base leading-snug font-semibold">
                          <span className="text-primary">Q{question + 1}/{PITCH_QUESTIONS.length} </span>
                          {PITCH_QUESTIONS[question]}
                        </p>
                        {answer && <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">You: {answer}</p>}
                      </>
                    );
                  // After the pitch: only what you asked her since, if anything.
                  const shown = stage === "debrief" || stage === "quiet" ? lines.filter((l) => l.id > quietFrom).slice(-2) : lines.slice(-2);
                  return shown.map((l) => (
                    <p key={l.id} className={cn("line-clamp-3 text-sm leading-snug", l.who === "you" ? "text-muted-foreground" : "text-foreground")}>
                      <span className="font-semibold">{l.who === "you" ? "You: " : "Plan P: "}</span>
                      {l.text}
                    </p>
                  ));
                })()}
              </>
            )}
            {pitch && "score" in pitch && (
              <p className="line-clamp-3 text-sm leading-snug">
                <span className="font-bold">Pitch {pitch.score}/10.</span> <span className="text-primary">Fix: {pitch.fix}</span>
              </p>
            )}
          </div>

          {/* The trip in two lines: plans, then where you're heading */}
          {trip && destination && (
            <div role="status" aria-live="polite" className="flex flex-col gap-1.5 rounded-lg bg-surface p-2.5">
              {trip.chain.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {trip.chain.map((item, i) => (
                    <span
                      key={item.id}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-bold",
                        i === trip.currentIndex && !trip.exhausted
                          ? "bg-primary text-primary-foreground"
                          : i < trip.currentIndex
                            ? "bg-destructive/20 text-destructive line-through"
                            : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {item.label}
                    </span>
                  ))}
                  <span className="ml-1 truncate text-xs text-muted-foreground">{trip.chain.length} parking plans</span>
                </div>
              )}
              <p className={cn("text-sm leading-snug font-medium", trip.exhausted && trip.fullIds.length && "text-destructive")}>
                {headingMessage(trip, route, rerouted, destination)}
                {arrivalLine && <span className={cn("font-normal", late ? "text-destructive" : "text-muted-foreground")}> {arrivalLine}</span>}
              </p>
              {!parked && !trip.exhausted && (() => {
                const target = trip.chain[trip.currentIndex] ? lotById.get(trip.chain[trip.currentIndex].id)! : destination;
                return (
                  <div className="flex items-center gap-3 text-xs">
                    <a href={appleMapsUrl(target)} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                      Apple Maps →
                    </a>
                    <a href={googleMapsUrl(target)} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                      Google Maps →
                    </a>
                    {journey.status === "ready" && (
                      <span className="ml-auto font-mono text-[10px] text-subtle">
                        Claude · {journey.trace.photos} photos · ${journey.trace.costUsd.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          {journey.status === "unavailable" && <p className="text-sm text-muted-foreground">Street View: {journey.message}</p>}

          {journey.status === "ready" && <Fundy compact />}
        </div>

        {trip && parked && (
          <div className="border-t border-border p-3">
            <div className="flex h-10 items-center justify-center rounded-xl bg-success/15 text-base font-bold text-success">
              ✓ Parked — you&apos;ve arrived!
            </div>
            {destination && (
              <div className="mt-2 flex gap-3">
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

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { anchorFromBox, fovFor, project, snapAnchor, turnHint, type Anchor, type Fov } from "@/logic/anchors";
import type { ChainItem } from "@/logic/chain";
import { buildSeatChain, estimateSteps, mergeScan, personOnSeat, updateOccupancy, type Box, type SeatState } from "@/logic/seats";
import { Detector, type Delegate, type Frame } from "@/vision/detector";
import { markedSnapshot } from "@/vision/marks";
import { OrientationTracker } from "@/vision/orientation";
import { cn } from "@/lib/utils";

type Phase = "idle" | "starting" | "aiming" | "scanning" | "thinking" | "ready" | "guiding" | "checking" | "landed" | "full" | "error";

/** A seat pinned to a direction in the room, so it stays put while the phone moves. */
type PinnedSeat = { id: string; anchor: Anchor; state: SeatState; pendingSince: number | null; steps: number; note: string };
/** Where a pinned seat is on screen right now. */
type SeatView = { id: string; box: Box; inView: boolean; bearing: number; state: SeatState; steps: number; note: string };
type LookResult = {
  seats: { id: number; isSeat: boolean; taken: boolean; note: string }[];
  missed: { box: Box; taken: boolean; note: string }[];
  summary: string;
};

const SCAN_MS = 1500;
const UI_INTERVAL_MS = 50;

/** Spoken announcements. The browser voice for now; OpenAI Realtime takes over later. */
function announce(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

const pct = (box: Box) => ({ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` });
const centre = (box: Box) => ({ x: (box.x + box.w / 2) * 100, y: (box.y + box.h / 2) * 100 });

export function MeApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<Detector | null>(null);
  const orientationRef = useRef<OrientationTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const scanRef = useRef<{ started: number; frames: Box[][] }>({ started: 0, frames: [] });
  const seatsRef = useRef<PinnedSeat[]>([]);
  const liveRef = useRef<{ seats: Box[]; people: Box[] }>({ seats: [], people: [] });
  const fovRef = useRef<Fov>(fovFor(3 / 4));
  const aspectRef = useRef(3 / 4);
  const fpsRef = useRef({ frames: 0, since: 0 });
  const uiRef = useRef(0);
  /** The seat we're walking the person to, read by the frame handler. */
  const targetRef = useRef<ChainItem | null>(null);

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [startStatus, setStartStatus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [aspect, setAspect] = useState(3 / 4);
  const [view, setView] = useState<SeatView[]>([]);
  const [liveSeats, setLiveSeats] = useState<Box[]>([]);
  const [people, setPeople] = useState<Box[]>([]);
  const [fps, setFps] = useState(0);
  const [delegate, setDelegate] = useState<Delegate>("GPU");
  const [sensors, setSensors] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [claudeTrace, setClaudeTrace] = useState<{ ms: number; costUsd: number } | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [chain, setChain] = useState<ChainItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [takenIds, setTakenIds] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [landedAfter, setLandedAfter] = useState(0);

  function setPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      detectorRef.current?.stop();
      orientationRef.current?.stop();
    },
    [],
  );

  const camera = () => orientationRef.current?.current ?? { yaw: 0, pitch: 0 };

  /** Every animation frame: feed the detector, and redraw pinned seats from the phone's direction. */
  function loop(now: number) {
    const video = videoRef.current;
    if (video && detectorRef.current) detectorRef.current.push(video);
    if (now - uiRef.current >= UI_INTERVAL_MS) {
      uiRef.current = now;
      const cam = camera();
      setView(
        seatsRef.current.map((s) => {
          const p = project(s.anchor, cam, fovRef.current);
          return { id: s.id, box: p.box, inView: p.inView, bearing: p.bearing, state: s.state, steps: s.steps, note: s.note };
        }),
      );
      setLiveSeats(liveRef.current.seats);
      setPeople(liveRef.current.people);
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function handleFrame(frame: Frame) {
    const now = frame.timestamp;
    liveRef.current = { seats: frame.seats, people: frame.people };

    const fpsState = fpsRef.current;
    if (!fpsState.since) fpsState.since = now;
    fpsState.frames += 1;
    if (now - fpsState.since >= 500) {
      setFps(Math.round((fpsState.frames * 1000) / (now - fpsState.since)));
      fpsRef.current = { frames: 0, since: now };
    }

    if (phaseRef.current === "scanning") {
      const scan = scanRef.current;
      scan.frames.push(frame.seats);
      const progress = Math.min(1, (now - scan.started) / SCAN_MS);
      setScanProgress(progress);
      if (progress >= 1) void finishScan();
      return;
    }

    if (!seatsRef.current.length) return;
    const cam = camera();
    const fov = fovRef.current;
    seatsRef.current = seatsRef.current.map((seat) => {
      // Re-centre on the live detector when it sees this chair; this corrects drift as you walk.
      const { anchor, matched } = snapAnchor(seat.anchor, frame.seats, cam, fov);
      const next = { ...seat, anchor, steps: matched ? estimateSteps(matched, aspectRef.current) : seat.steps };
      const p = project(anchor, cam, fov);
      if (!p.inView) return next;
      const [u] = updateOccupancy(
        [{ id: seat.id, box: p.box, state: seat.state, steps: next.steps, direction: "ahead", pendingSince: seat.pendingSince }],
        frame.people,
        now,
      );
      return { ...next, state: u.state, pendingSince: u.pendingSince };
    });

    const target = targetRef.current;
    if (phaseRef.current === "guiding" && target && seatsRef.current.find((s) => s.id === target.id)?.state === "taken") {
      setPhase("checking");
      announce(`Someone just sat in Plan ${target.label}. Was that you?`);
    }
  }

  async function startCamera() {
    setError("");
    setNotice("");
    setPhase("starting");
    // iPhone only allows speech and motion sensors from a tap, so unlock both here.
    announce("Starting the camera.");
    const orientation = orientationRef.current ?? new OrientationTracker();
    orientationRef.current = orientation;
    const motion = orientation.start();
    try {
      setStartStatus("Asking for camera access…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setStreaming(true);
      const video = videoRef.current!;
      // Safari only plays inline, muted video without another tap; React doesn't apply `muted`
      // to server-rendered markup, so set both directly.
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        throw new Error("The camera started but the video couldn't play. Tap Start camera again.");
      }
      const videoAspect = video.videoWidth / video.videoHeight || 3 / 4;
      setAspect(videoAspect);
      aspectRef.current = videoAspect;
      fovRef.current = fovFor(videoAspect);

      if (!detectorRef.current) {
        setStartStatus("Loading the detector (about 20 MB the first time)…");
        const detector = await Detector.start();
        detector.onFrame = handleFrame;
        detector.onError = (message) => {
          setError(`The detector stopped: ${message}.`);
          setPhase("error");
        };
        detectorRef.current = detector;
        setDelegate(detector.delegate);
      }
      setSensors(await motion);
      await (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<unknown> } }).wakeLock
        ?.request("screen")
        .catch(() => {});
      setStartStatus("");
      fpsRef.current = { frames: 0, since: 0 };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
      resetPlan();
      setPhase("aiming");
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStreaming(false);
      setStartStatus("");
      setPhase("error");
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError("Camera access was blocked. On iPhone: tap aA in the address bar → Website Settings → Camera → Allow, then try again.");
      } else if (e instanceof DOMException && e.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else if (!window.isSecureContext) {
        setError("The camera only works on a secure (https) link.");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't start the camera.");
      }
    }
  }

  function resetPlan() {
    targetRef.current = null;
    seatsRef.current = [];
    setView([]);
    setChain([]);
    setTakenIds([]);
    setCurrentIndex(0);
    setClaudeTrace(null);
  }

  function scan() {
    resetPlan();
    setNotice("");
    setError("");
    scanRef.current = { started: performance.now(), frames: [] };
    setScanProgress(0);
    setPhase("scanning");
  }

  /** Detector candidates → Claude decides which are real seats and which are taken → pin them. */
  async function finishScan() {
    const video = videoRef.current;
    if (!video || phaseRef.current !== "scanning") return;
    setPhase("thinking");
    const cam = camera();
    const fov = fovRef.current;
    const candidates = mergeScan(scanRef.current.frames);
    const people = liveRef.current.people;
    let found: { box: Box; taken: boolean; note: string }[];
    let summary = "";
    try {
      const res = await fetch("/api/look", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "seats", image: markedSnapshot(video, candidates), boxes: candidates.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const result = data.result as LookResult;
      found = [
        ...result.seats
          .filter((s) => s.isSeat && candidates[s.id - 1])
          .map((s) => ({ box: candidates[s.id - 1], taken: s.taken, note: s.note })),
        ...result.missed,
      ];
      summary = result.summary;
      setClaudeTrace(data.trace);
    } catch {
      // Claude unavailable: fall back to the phone's own detector (ARCHITECTURE §5).
      found = candidates.map((box) => ({ box, taken: personOnSeat(box, people), note: "" }));
      setNotice("Claude couldn't check this scan, so these are the phone's own guesses.");
    }
    // The person may have tapped Rescan while Claude was thinking.
    if ((phaseRef.current as Phase) !== "thinking") return;
    seatsRef.current = found.map((s, i) => ({
      id: `S${i + 1}`,
      anchor: anchorFromBox(s.box, cam, fov),
      state: s.taken ? "taken" : "free",
      pendingSince: null,
      steps: estimateSteps(s.box, aspectRef.current),
      note: s.note,
    }));
    if (!found.length) {
      setError("No seats found. Point the camera at the chairs and scan again.");
      setPhase("aiming");
      return;
    }
    const free = found.filter((s) => !s.taken).length;
    setPhase("ready");
    announce(summary || `I can see ${found.length} seats, ${free} free.`);
  }

  function seatsForChain() {
    return seatsRef.current.map((s) => ({ id: s.id, box: { x: 0, y: 0, w: 0, h: 0 }, state: s.state, steps: s.steps, direction: "ahead" as const, pendingSince: null }));
  }

  function hintFor(item: ChainItem) {
    const v = view.find((s) => s.id === item.id);
    const steps = v?.steps ?? 1;
    return `about ${steps} step${steps === 1 ? "" : "s"}, ${v ? turnHint(v.bearing) : "straight ahead"}`;
  }

  function findSpot() {
    const next = buildSeatChain(seatsForChain());
    setChain(next);
    setCurrentIndex(0);
    setTakenIds([]);
    setStartedAt(Date.now());
    if (!next.length) {
      targetRef.current = null;
      setPhase("full");
      announce("Every seat is taken. This lot is full. Plan B is the room next door.");
      return;
    }
    targetRef.current = next[0];
    setPhase("guiding");
    announce(`Plan A: ${hintFor(next[0])}.`);
  }

  function itWasMe() {
    targetRef.current = null;
    setLandedAfter(Math.round((Date.now() - startedAt) / 1000));
    setPhase("landed");
    announce("Great landing. You're parked.");
  }

  function someoneElse() {
    const lost = chain[currentIndex];
    const taken = [...takenIds, lost.id];
    const done = chain.slice(0, currentIndex + 1);
    const rest = buildSeatChain(seatsForChain(), [...taken, ...done.map((c) => c.id)], 3, currentIndex + 1);
    setTakenIds(taken);
    setChain([...done, ...rest]);
    if (!rest.length) {
      targetRef.current = null;
      setPhase("full");
      announce("Every seat is taken. This lot is full. Plan B is the room next door.");
      return;
    }
    setCurrentIndex(currentIndex + 1);
    targetRef.current = rest[0];
    setPhase("guiding");
    announce(`Plan ${lost.label} just got taken. Heading to Plan ${rest[0].label}, ${hintFor(rest[0])}.`);
  }

  const target = chain[currentIndex];
  const guiding = phase === "guiding" || phase === "checking";
  const labelFor = new Map(chain.map((c, i) => [c.id, { item: c, index: i }]));
  const targetView = target ? view.find((v) => v.id === target.id) : undefined;
  const nextItem = chain[currentIndex + 1];
  const nextView = nextItem ? view.find((v) => v.id === nextItem.id) : undefined;
  const cameraOn = streaming && phase !== "idle" && phase !== "starting";
  const tc = targetView ? centre(targetView.box) : null;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-black">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" style={{ containerType: "size" }}>
        {/* Largest box with the camera's aspect ratio that fits, so the picture is never stretched. */}
        <div className="relative" style={{ aspectRatio: aspect, width: `min(100cqw, calc(100cqh * ${aspect}))` }}>
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full" />

          {/* While aiming: what the fast detector sees right now */}
          {(phase === "aiming" || phase === "scanning") &&
            liveSeats.map((b, i) => <div key={`l${i}`} className="absolute rounded-md border-2 border-white/60" style={pct(b)} />)}
          {cameraOn &&
            people.map((p, i) => <div key={`p${i}`} className="absolute rounded-md border border-dashed border-white/30" style={pct(p)} />)}

          {/* Snake path: from you (bottom centre) to the target, then faded on to the backup */}
          {guiding && targetView?.inView && tc && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {nextView?.inView && (
                <line
                  x1={tc.x} y1={tc.y} x2={centre(nextView.box).x} y2={centre(nextView.box).y}
                  stroke="var(--primary)" strokeOpacity="0.35" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                />
              )}
              <path d={`M 50 100 Q 50 ${(100 + tc.y) / 2} ${tc.x} ${tc.y}`} fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path
                d={`M 50 100 Q 50 ${(100 + tc.y) / 2} ${tc.x} ${tc.y}`}
                fill="none" stroke="#0a0a0f" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="6 12" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" className="route-flow"
              />
            </svg>
          )}

          {/* Pinned seats */}
          {view.map((seat) => {
            if (!seat.inView) return null;
            const plan = labelFor.get(seat.id);
            const isTarget = plan && plan.index === currentIndex && guiding;
            const crossed = takenIds.includes(seat.id);
            return (
              <div
                key={seat.id}
                className={cn(
                  "absolute rounded-lg border-[3px] transition-[left,top,width,height] duration-100",
                  seat.state === "taken" ? "border-destructive bg-destructive/15" : "border-success bg-success/10",
                  isTarget && "border-primary bg-primary/20 shadow-[0_0_0_4px_rgba(255,77,46,0.35)]",
                )}
                style={pct(seat.box)}
              >
                {(plan || crossed) && (
                  <span
                    className={cn(
                      "absolute -top-5 left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-full font-heading text-xl font-bold",
                      crossed ? "bg-destructive text-white" : isTarget ? "bg-primary text-primary-foreground" : "border-2 border-primary bg-black/70 text-primary",
                    )}
                  >
                    {crossed ? "✕" : plan!.item.label}
                  </span>
                )}
              </div>
            );
          })}

          {/* Edge arrow when the target is off screen */}
          {guiding && target && targetView && !targetView.inView && (
            <div
              className={cn(
                "absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 rounded-xl bg-primary px-3 py-3 text-primary-foreground shadow-lg",
                targetView.bearing < 0 ? "left-2" : "right-2",
              )}
            >
              <span className="text-4xl leading-none font-bold">{Math.abs(targetView.bearing) > 120 ? "↺" : targetView.bearing < 0 ? "←" : "→"}</span>
              <span className="font-heading text-lg font-bold">Plan {target.label}</span>
            </div>
          )}
        </div>

        {cameraOn && (
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1 font-mono text-xs text-white/70">
            <span className="rounded-md bg-black/60 px-2 py-1">on-device · {delegate} · {fps} fps · $0</span>
            {claudeTrace && (
              <span className="rounded-md bg-black/60 px-2 py-1">
                Claude · {(claudeTrace.ms / 1000).toFixed(1)} s · ${claudeTrace.costUsd.toFixed(3)}
              </span>
            )}
            {!sensors && <span className="rounded-md bg-black/60 px-2 py-1">motion sensors off · hold still</span>}
          </div>
        )}

        {phase === "scanning" && (
          <div className="absolute inset-x-6 bottom-6 flex flex-col gap-2">
            <span className="text-center text-lg font-medium text-white">Hold still…</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${scanProgress * 100}%` }} />
            </div>
          </div>
        )}
        {phase === "thinking" && (
          <span className="absolute inset-x-6 bottom-6 rounded-lg bg-black/70 p-3 text-center text-lg font-medium text-white">
            Claude is checking which seats are real and free…
          </span>
        )}

        {(phase === "idle" || phase === "starting" || (phase === "error" && !cameraOn)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
            <p className="eyebrow">Park me</p>
            <h1 className="max-w-md text-3xl leading-tight font-bold sm:text-4xl">Find a free seat, with a backup ready.</h1>
            <p className="max-w-sm text-muted-foreground">
              Point your phone at the room and scan. Plan P pins Plan A and B and walks you there, even as you move.
            </p>
            {error && <p className="max-w-sm text-destructive">{error}</p>}
            <Button size="lg" className="h-14 px-8 text-lg" onClick={startCamera} disabled={phase === "starting"}>
              {phase === "starting" ? startStatus || "Starting…" : "Start camera"}
            </Button>
            {phase === "error" && (
              <Link href="/car" className={buttonVariants({ variant: "ghost" })}>
                Use Park my car instead
              </Link>
            )}
          </div>
        )}
      </div>

      {cameraOn && (
        <div className="flex flex-col gap-3 border-t border-border bg-background p-4 sm:p-5">
          {error && <p className="text-destructive">{error}</p>}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

          {phase === "aiming" && !error && <p className="text-lg">Point at the chairs, hold still, and tap Scan.</p>}

          {phase === "ready" && (
            <p className="text-lg">
              {view.filter((s) => s.state === "free").length} free of {view.length} seats. They stay pinned as you move.
            </p>
          )}

          {guiding && target && (
            <p role="status" aria-live="polite" className="rounded-lg bg-primary/10 p-3 text-lg leading-snug font-medium">
              {phase === "checking"
                ? `Someone just sat in Plan ${target.label}. Was that you?`
                : `${takenIds.length ? `Plan ${chain[currentIndex - 1].label} got taken. ` : ""}Plan ${target.label}: ${hintFor(target)}.`}
            </p>
          )}

          {phase === "landed" && (
            <p role="status" className="rounded-lg bg-success/10 p-3 text-xl font-bold text-success">
              Great landing. You&apos;re parked{landedAfter ? ` in ${landedAfter} s` : ""}.
            </p>
          )}

          {phase === "full" && (
            <p role="status" className="rounded-lg bg-destructive/10 p-3 text-lg font-medium text-destructive">
              Every seat is taken. This lot is full. Plan B is the room next door.
            </p>
          )}

          <div className="flex gap-3">
            {phase === "checking" ? (
              <>
                <Button size="lg" className="h-16 flex-1 text-lg" onClick={itWasMe}>
                  That&apos;s me
                </Button>
                <button type="button" onClick={someoneElse} className="h-16 flex-1 rounded-xl bg-destructive text-lg font-bold text-white active:scale-[0.98]">
                  Someone else
                </button>
              </>
            ) : phase === "guiding" ? (
              <>
                <Button size="lg" className="h-16 flex-1 text-lg" onClick={itWasMe}>
                  I&apos;m seated
                </Button>
                <button type="button" onClick={someoneElse} className="h-16 flex-1 rounded-xl bg-destructive text-lg font-bold text-white active:scale-[0.98]">
                  It&apos;s taken
                </button>
              </>
            ) : (
              <>
                {phase === "aiming" && (
                  <Button size="lg" className="h-16 flex-1 text-lg" onClick={scan}>
                    Scan
                  </Button>
                )}
                {(phase === "ready" || phase === "landed" || phase === "full") && (
                  <>
                    <Button size="lg" className="h-16 flex-1 text-lg" onClick={findSpot}>
                      Find me a spot
                    </Button>
                    <Button variant="outline" size="lg" className="h-16" onClick={scan}>
                      Rescan
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { findGaps, isParked, updateSpots, updateTracks, type Spot, type SpotEvent, type Track } from "@/logic/curb";
import type { Box } from "@/logic/seats";
import { cameraErrorMessage, startRearCamera } from "@/vision/camera";
import { Detector, type Delegate, type Frame } from "@/vision/detector";
import { markedSnapshot } from "@/vision/marks";
import { cn } from "@/lib/utils";

type View = "drive" | "spotter";
type Phase = "idle" | "starting" | "looking" | "parked" | "error";
type ClaudeSpot = { label: string; legal: "yes" | "no" | "unsure"; side: "left" | "right"; box: Box | null; reason: string };
type StreetResult = { parkedIds: number[]; spots: ClaudeSpot[]; signs: string[]; summary: string };
/** A space Claude found that the phone's gap measurement didn't. */
type ExtraSpot = { box: Box; side: "left" | "right"; reason: string };

/** Claude looks again at least this often while vehicles are in view (also on every new gap). */
const HEARTBEAT_MS: Record<View, number> = { drive: 8000, spotter: 15000 };
const MIN_CHECK_GAP_MS = 2500;
const UI_INTERVAL_MS = 100;

function announce(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

const pct = (box: Box) => ({ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` });

/**
 * Street parking from the camera (ARCHITECTURE §6.2). The phone tracks vehicles and measures the gaps
 * in front of and behind parked cars, instantly and for free; Claude confirms which gaps are legal.
 * Spots form a chain like the rest of Plan P: Spot A, B, C, and "Spot A just got taken".
 */
export function StreetFinder({ onUseGarages }: { onUseGarages: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<Detector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const viewRef = useRef<View>("drive");
  const aspectRef = useRef(3 / 4);
  const tracksRef = useRef<Track[]>([]);
  const trackIdRef = useRef({ value: 1 });
  const spotsRef = useRef<Spot[]>([]);
  const spotKeyRef = useRef({ value: 1 });
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);
  /** A new gap appeared: look as soon as the minimum spacing allows. */
  const wantCheckRef = useRef(false);
  const uiRef = useRef(0);
  const fpsRef = useRef({ frames: 0, since: 0 });

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [view, setView] = useState<View>("drive");
  const [startStatus, setStartStatus] = useState("");
  const [error, setError] = useState("");
  const [aspect, setAspect] = useState(3 / 4);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [extra, setExtra] = useState<ExtraSpot[]>([]);
  const [fps, setFps] = useState(0);
  const [delegate, setDelegate] = useState<Delegate>("GPU");
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState({ count: 0, costUsd: 0, lastMs: 0 });
  const [signs, setSigns] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [claudeError, setClaudeError] = useState("");

  function setPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      detectorRef.current?.stop();
    },
    [],
  );

  const sideWords = (side: "left" | "right") => (viewRef.current === "drive" ? `on your ${side}` : `on the ${side}`);

  function speakEvents(events: SpotEvent[], all: Spot[]) {
    const best = all.filter((s) => s.shown && s.label).sort((a, b) => a.label.localeCompare(b.label));
    for (const e of events) {
      if (e.type === "taken") {
        const next = best.find((s) => s.key !== e.spot.key);
        const text = `Spot ${e.spot.label} just got taken.${next ? ` Head to Spot ${next.label}, ${sideWords(next.side)}.` : " Still looking."}`;
        setMessage(text);
        announce(text);
      } else if (e.type === "new" && e.spot.label === "A") {
        const text = `Possible spot ${sideWords(e.spot.side)}. Checking it.`;
        setMessage(text);
        announce(text);
      }
    }
  }

  function handleFrame(frame: Frame) {
    const now = frame.timestamp;
    const fixed = viewRef.current === "spotter";
    tracksRef.current = updateTracks(tracksRef.current, frame.vehicles, now, trackIdRef.current);
    const parked = tracksRef.current.filter((t) => isParked(t, now, fixed)).map((t) => t.box);
    const gaps = findGaps(parked, tracksRef.current.map((t) => t.box), aspectRef.current);
    const mySide = viewRef.current === "drive" ? "right" : null;
    const { spots: next, events } = updateSpots(spotsRef.current, gaps, frame.vehicles, now, mySide, spotKeyRef.current);
    spotsRef.current = next;
    if (events.length) speakEvents(events, next);
    // A new gap is worth a look from Claude right away.
    if (events.some((e) => e.type === "new")) wantCheckRef.current = true;

    const state = fpsRef.current;
    if (!state.since) state.since = now;
    state.frames += 1;
    if (now - state.since >= 500) {
      setFps(Math.round((state.frames * 1000) / (now - state.since)));
      fpsRef.current = { frames: 0, since: now };
    }
  }

  function loop(now: number) {
    const video = videoRef.current;
    if (video && detectorRef.current) detectorRef.current.push(video);
    if (now - uiRef.current >= UI_INTERVAL_MS) {
      uiRef.current = now;
      setTracks(tracksRef.current);
      setSpots(spotsRef.current);
    }
    const sinceLast = now - lastCheckRef.current;
    const due = (wantCheckRef.current && sinceLast >= MIN_CHECK_GAP_MS) || sinceLast >= HEARTBEAT_MS[viewRef.current];
    if (phaseRef.current === "looking" && !checkingRef.current && due && tracksRef.current.length > 0) {
      void check();
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  async function start(chosen: View) {
    viewRef.current = chosen;
    setView(chosen);
    setError("");
    setPhase("starting");
    announce(chosen === "drive" ? "Looking for street parking." : "Watching the street for open spots.");
    try {
      setStartStatus("Asking for camera access…");
      const video = videoRef.current!;
      streamRef.current = await startRearCamera(video);
      const a = video.videoWidth / video.videoHeight || 3 / 4;
      setAspect(a);
      aspectRef.current = a;
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
      await (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<unknown> } }).wakeLock
        ?.request("screen")
        .catch(() => {});
      setStartStatus("");
      tracksRef.current = [];
      spotsRef.current = [];
      setExtra([]);
      setMessage("");
      // First look 1.5 s in, once the detector has seen the street.
      lastCheckRef.current = performance.now() - HEARTBEAT_MS[chosen] + 1500;
      wantCheckRef.current = false;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
      setPhase("looking");
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStartStatus("");
      setError(cameraErrorMessage(e));
      setPhase("error");
    }
  }

  /** Claude looks at the current frame: vehicles numbered, measured gaps lettered. */
  async function check() {
    const video = videoRef.current;
    if (!video || checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    wantCheckRef.current = false;
    lastCheckRef.current = performance.now();
    const sent = tracksRef.current.slice(0, 40);
    const lettered = spotsRef.current.filter((s) => s.shown && s.label);
    try {
      const res = await fetch("/api/look", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "street",
          image: markedSnapshot(video, sent.map((t) => t.box), lettered.map((s) => ({ label: s.label, box: s.box }))),
          boxes: sent.length,
          gaps: lettered.map((s) => s.label),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const r = data.result as StreetResult;
      setClaudeError("");
      setChecks((c) => ({ count: c.count + 1, costUsd: c.costUsd + data.trace.costUsd, lastMs: data.trace.ms }));
      setSigns(r.signs);

      // Parked flags follow the cars (by track id), so they survive the car moving in the picture.
      const parkedIds = new Set(r.parkedIds.map((n) => sent[n - 1]?.id).filter(Boolean));
      tracksRef.current = tracksRef.current.map((t) => (sent.some((s) => s.id === t.id) ? { ...t, claudeParked: parkedIds.has(t.id) } : t));

      // Verdicts on the lettered gaps (spots may have moved on since; match by key).
      const byLabel = new Map(lettered.map((s) => [s.label, s.key]));
      const verdicts = new Map(r.spots.filter((s) => s.label !== "new").map((s) => [byLabel.get(s.label), s]));
      spotsRef.current = spotsRef.current.map((s) => {
        const v = verdicts.get(s.key);
        if (!v) return s;
        return { ...s, status: v.legal === "no" ? "illegal" : v.legal === "yes" ? "legal" : "possible", reason: v.reason };
      });
      setExtra(r.spots.filter((s) => s.label === "new" && s.box && s.legal !== "no").map((s) => ({ box: s.box!, side: s.side, reason: s.reason })));

      const bestLegal = spotsRef.current.find((s) => s.shown && s.label === "A" && s.status === "legal");
      const lost = spotsRef.current.find((s) => s.shown && verdicts.get(s.key)?.legal === "no");
      if (bestLegal) {
        const text = `Spot A is good: ${bestLegal.reason}.`;
        setMessage(text);
        announce(text);
      } else if (lost) {
        setMessage(`Not Spot ${lost.label}: ${lost.reason}.`);
      } else if (r.summary) {
        setMessage(r.summary);
      }
    } catch (e) {
      setClaudeError(e instanceof Error ? e.message : "Claude couldn't check the street.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }

  function takenNext() {
    const a = spotsRef.current.find((s) => s.label === "A");
    if (!a) return;
    spotsRef.current = spotsRef.current.map((s) => (s.key === a.key ? { ...s, status: "illegal", reason: "taken" } : s));
    const next = spotsRef.current.filter((s) => s.shown && s.label && s.key !== a.key).sort((x, y) => x.label.localeCompare(y.label))[0];
    const text = next ? `Okay. Head to Spot ${next.label}, ${sideWords(next.side)}.` : "Okay, still looking.";
    setMessage(text);
    announce(text);
  }

  function parkHere() {
    setPhase("parked");
    announce("Great landing. You're parked.");
  }

  function lookAgain() {
    wantCheckRef.current = true;
    setMessage("");
    setPhase("looking");
  }

  const cameraOn = phase === "looking" || phase === "parked";
  const shownSpots = spots.filter((s) => s.shown && s.label);
  const best = shownSpots.find((s) => s.label === "A");
  const parkedCount = tracks.filter((t) => t.claudeParked || (view === "spotter" && t.stillSince !== null)).length;

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" style={{ containerType: "size" }}>
        <div className="relative" style={{ aspectRatio: aspect, width: `min(100cqw, calc(100cqh * ${aspect}))` }}>
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full" />

          {cameraOn &&
            tracks.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "absolute rounded-md border-2",
                  t.claudeParked ? "border-destructive bg-destructive/15" : "border-dashed border-white/50",
                )}
                style={pct(t.box)}
              >
                {t.claudeParked && <span className="absolute -top-2 -left-2 rounded bg-destructive px-1 text-[10px] font-bold text-white">P</span>}
              </div>
            ))}

          {cameraOn &&
            shownSpots.map((s) => (
              <div
                key={s.key}
                className={cn(
                  "absolute flex items-center justify-center rounded-lg border-4 border-dashed",
                  s.status === "legal" ? "border-success bg-success/25" : "border-amber-400 bg-amber-400/20",
                  s.label === "A" && "shadow-[0_0_0_4px_rgba(255,77,46,0.35)]",
                )}
                style={pct(s.box)}
              >
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-heading text-lg font-bold",
                    s.status === "legal" ? "bg-success text-black" : "bg-amber-400 text-black",
                  )}
                >
                  {s.label}
                  {s.status === "legal" ? " ✓" : "?"}
                </span>
              </div>
            ))}

          {cameraOn &&
            extra.map((s, i) => (
              <div key={`x${i}`} className="absolute rounded-lg border-4 border-dashed border-success bg-success/20" style={pct(s.box)}>
                <span className="absolute -top-6 left-0 rounded bg-success px-1.5 text-xs font-bold whitespace-nowrap text-black">Claude: open</span>
              </div>
            ))}
        </div>

        {cameraOn && (
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1 font-mono text-xs text-white/70">
            <span className="rounded-md bg-black/60 px-2 py-1">on-device · {delegate} · {fps} fps · $0</span>
            {checks.count > 0 && (
              <span className="rounded-md bg-black/60 px-2 py-1">
                Claude · {checks.count} look{checks.count === 1 ? "" : "s"} · {(checks.lastMs / 1000).toFixed(1)} s · ${checks.costUsd.toFixed(3)}
              </span>
            )}
            {checking && <span className="rounded-md bg-primary/80 px-2 py-1 text-primary-foreground">Claude is checking…</span>}
          </div>
        )}

        {(phase === "idle" || phase === "starting" || phase === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background p-6 text-center">
            <p className="eyebrow">Street parking</p>
            <h1 className="max-w-md text-3xl leading-tight font-bold sm:text-4xl">Spot the gap before someone else does.</h1>
            <p className="max-w-sm text-muted-foreground">
              Plan P measures the space in front of and behind every parked car, instantly. Claude checks it&apos;s legal.
            </p>
            {error && <p className="max-w-sm text-destructive">{error}</p>}
            {phase === "starting" ? (
              <Button size="lg" className="h-14 px-8 text-lg" disabled>
                {startStatus || "Starting…"}
              </Button>
            ) : (
              <div className="flex w-full max-w-sm flex-col gap-3">
                <Button size="lg" className="h-14 text-lg" onClick={() => start("drive")}>
                  On the dashboard (driving)
                </Button>
                <Button variant="outline" size="lg" className="h-14 text-lg" onClick={() => start("spotter")}>
                  At a window (watching a street)
                </Button>
              </div>
            )}
            <Button variant="ghost" onClick={onUseGarages}>
              Plan with garages instead
            </Button>
          </div>
        )}
      </div>

      {cameraOn && (
        <div className="flex flex-col gap-3 border-t border-border bg-background p-4 sm:p-5">
          {claudeError && <p className="text-sm text-destructive">Claude couldn&apos;t check the street: {claudeError}</p>}

          {phase === "looking" && (
            <p
              role="status"
              aria-live="polite"
              className={cn("rounded-lg p-3 text-lg leading-snug font-medium", best?.status === "legal" ? "bg-success/10" : best ? "bg-amber-400/10" : "bg-white/5")}
            >
              {message ||
                (best
                  ? `Spot A ${sideWords(best.side)}: ${best.status === "legal" ? best.reason || "legal" : "checking…"}`
                  : `${parkedCount} parked car${parkedCount === 1 ? "" : "s"}. Looking for a gap in front of or behind them…`)}
            </p>
          )}

          {signs.length > 0 && phase === "looking" && <p className="text-sm text-muted-foreground">Rules seen: {signs.join(" · ")}</p>}

          {phase === "parked" && (
            <p role="status" className="rounded-lg bg-success/10 p-3 text-xl font-bold text-success">
              Great landing. You&apos;re parked.
            </p>
          )}

          <div className="flex gap-3">
            {phase === "looking" && best ? (
              <>
                <Button size="lg" className="h-16 flex-1 text-lg" onClick={parkHere}>
                  Park in {best.label}
                </Button>
                <button type="button" onClick={takenNext} className="h-16 flex-1 rounded-xl bg-destructive text-lg font-bold text-white active:scale-[0.98]">
                  Taken, next
                </button>
              </>
            ) : phase === "looking" ? (
              <>
                <Button size="lg" className="h-16 flex-1 text-lg" onClick={() => void check()} disabled={checking}>
                  {checking ? "Checking…" : "Check now"}
                </Button>
                <Button variant="outline" size="lg" className="h-16" onClick={onUseGarages}>
                  Garage plan
                </Button>
              </>
            ) : (
              <Button variant="outline" size="lg" className="h-16 flex-1" onClick={lookAgain}>
                Look again
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

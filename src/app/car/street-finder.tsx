"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Box } from "@/logic/seats";
import { cameraErrorMessage, startRearCamera } from "@/vision/camera";
import { Detector, type Delegate, type Frame } from "@/vision/detector";
import { markedSnapshot } from "@/vision/marks";
import { cn } from "@/lib/utils";

type Phase = "idle" | "starting" | "looking" | "found" | "parked" | "error";
type Spot = {
  found: boolean;
  side: "right" | "left" | "none";
  box: Box | null;
  metersAhead: number | null;
  legal: "yes" | "no" | "unsure";
  reason: string;
};
type StreetResult = { spot: Spot; parkedIds: number[]; signs: string[] };

/** How often Claude looks at the street while driving (only when no check is in flight). */
const CHECK_EVERY_MS = 6000;

function announce(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

const pct = (box: Box) => ({ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` });

/**
 * Street parking from the dashboard (PRD, Park my car): the on-device detector marks vehicles live;
 * every few seconds Claude looks at one frame and says whether there's an open, legal curb space.
 */
export function StreetFinder({ onUseGarages }: { onUseGarages: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<Detector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const vehiclesRef = useRef<Box[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);
  const fpsRef = useRef({ frames: 0, since: 0 });

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [startStatus, setStartStatus] = useState("");
  const [error, setError] = useState("");
  const [aspect, setAspect] = useState(3 / 4);
  const [vehicles, setVehicles] = useState<Box[]>([]);
  const [fps, setFps] = useState(0);
  const [delegate, setDelegate] = useState<Delegate>("GPU");
  const [checking, setChecking] = useState(false);
  /** Vehicles as they were in the frame Claude saw, with which ones it called parked. */
  const [checked, setChecked] = useState<{ boxes: Box[]; parked: Set<number> } | null>(null);
  const [result, setResult] = useState<StreetResult | null>(null);
  const [checks, setChecks] = useState({ count: 0, costUsd: 0, lastMs: 0 });
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

  function handleFrame(frame: Frame) {
    vehiclesRef.current = frame.vehicles;
    const state = fpsRef.current;
    if (!state.since) state.since = frame.timestamp;
    state.frames += 1;
    if (frame.timestamp - state.since >= 500) {
      setFps(Math.round((state.frames * 1000) / (frame.timestamp - state.since)));
      setVehicles(frame.vehicles);
      fpsRef.current = { frames: 0, since: frame.timestamp };
    }
  }

  function loop(now: number) {
    const video = videoRef.current;
    if (video && detectorRef.current) detectorRef.current.push(video);
    if (phaseRef.current === "looking" && !checkingRef.current && now - lastCheckRef.current >= CHECK_EVERY_MS) {
      void check();
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  async function start() {
    setError("");
    setPhase("starting");
    announce("Looking for street parking.");
    try {
      setStartStatus("Asking for camera access…");
      const video = videoRef.current!;
      streamRef.current = await startRearCamera(video);
      setAspect(video.videoWidth / video.videoHeight || 3 / 4);
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
      // First look 1.5 s in, once the detector has numbered the cars it sees.
      lastCheckRef.current = performance.now() - CHECK_EVERY_MS + 1500;
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

  /** One look by Claude at the current frame, with the detected vehicles numbered. */
  async function check() {
    const video = videoRef.current;
    if (!video || checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    lastCheckRef.current = performance.now();
    const boxes = vehiclesRef.current;
    try {
      const res = await fetch("/api/look", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "street", image: markedSnapshot(video, boxes), boxes: boxes.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const r = data.result as StreetResult;
      setClaudeError("");
      setResult(r);
      setChecked({ boxes, parked: new Set(r.parkedIds) });
      setChecks((c) => ({ count: c.count + 1, costUsd: c.costUsd + data.trace.costUsd, lastMs: data.trace.ms }));
      if (phaseRef.current === "looking" && r.spot.found && r.spot.legal !== "no") {
        setPhase("found");
        const where = r.spot.side === "none" ? "ahead" : `on your ${r.spot.side}`;
        const dist = r.spot.metersAhead ? `, about ${Math.round(r.spot.metersAhead)} metres` : "";
        announce(r.spot.legal === "yes" ? `Open spot ${where}${dist}.` : `Possible spot ${where}${dist}. Check the signs.`);
      }
    } catch (e) {
      setClaudeError(e instanceof Error ? e.message : "Claude couldn't check the street.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }

  function keepLooking() {
    setResult(null);
    setChecked(null);
    lastCheckRef.current = performance.now();
    setPhase("looking");
    announce("Okay, still looking.");
  }

  function parkHere() {
    setPhase("parked");
    announce("Great landing. You're parked.");
  }

  const cameraOn = phase === "looking" || phase === "found" || phase === "parked";
  const spot = result?.spot;
  const showSpot = phase === "found" && spot?.box;

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" style={{ containerType: "size" }}>
        <div className="relative" style={{ aspectRatio: aspect, width: `min(100cqw, calc(100cqh * ${aspect}))` }}>
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full" />

          {/* Live: every vehicle the phone sees. Claude's verdict colours the ones it checked. */}
          {cameraOn &&
            vehicles.map((v, i) => (
              <div key={`v${i}`} className="absolute rounded-md border-2 border-destructive/80 bg-destructive/10" style={pct(v)} />
            ))}
          {checked &&
            phase !== "parked" &&
            checked.boxes.map((b, i) =>
              checked.parked.has(i + 1) ? (
                <span key={`c${i}`} className="absolute rounded bg-destructive px-1.5 py-0.5 text-xs font-bold text-white" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%` }}>
                  Parked
                </span>
              ) : null,
            )}
          {showSpot && (
            <div
              className={cn(
                "absolute rounded-lg border-4 border-dashed",
                spot!.legal === "yes" ? "border-success bg-success/20" : "border-primary bg-primary/20",
              )}
              style={pct(spot!.box!)}
            >
              <span className={cn("absolute -top-7 left-0 rounded px-2 py-0.5 text-sm font-bold whitespace-nowrap", spot!.legal === "yes" ? "bg-success text-black" : "bg-primary text-primary-foreground")}>
                {spot!.legal === "yes" ? "Open spot" : "Possible spot"}
              </span>
            </div>
          )}
        </div>

        {cameraOn && (
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1 font-mono text-xs text-white/70">
            <span className="rounded-md bg-black/60 px-2 py-1">on-device · {delegate} · {fps} fps · $0</span>
            {checks.count > 0 && (
              <span className="rounded-md bg-black/60 px-2 py-1">
                Claude · {checks.count} look{checks.count === 1 ? "" : "s"} · {(checks.lastMs / 1000).toFixed(1)} s · ${checks.costUsd.toFixed(3)}
              </span>
            )}
            {checking && <span className="rounded-md bg-primary/80 px-2 py-1 text-primary-foreground">Claude is looking…</span>}
          </div>
        )}

        {(phase === "idle" || phase === "starting" || phase === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
            <p className="eyebrow">Street parking</p>
            <h1 className="max-w-md text-3xl leading-tight font-bold sm:text-4xl">Put your phone on the dashboard.</h1>
            <p className="max-w-sm text-muted-foreground">
              Plan P marks parked cars as you drive and tells you when it sees an open, legal spot on the curb.
            </p>
            {error && <p className="max-w-sm text-destructive">{error}</p>}
            <Button size="lg" className="h-14 px-8 text-lg" onClick={start} disabled={phase === "starting"}>
              {phase === "starting" ? startStatus || "Starting…" : "Start looking"}
            </Button>
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
            <p role="status" aria-live="polite" className="text-lg">
              {result
                ? `${result.parkedIds.length} parked car${result.parkedIds.length === 1 ? "" : "s"} seen. No open spot yet: ${result.spot.reason}`
                : "Looking for an open spot on the curb…"}
            </p>
          )}

          {phase === "found" && spot && (
            <p role="status" aria-live="polite" className={cn("rounded-lg p-3 text-lg leading-snug font-medium", spot.legal === "yes" ? "bg-success/10" : "bg-primary/10")}>
              {spot.legal === "yes" ? "Open spot" : "Possible spot"} {spot.side === "none" ? "ahead" : `on your ${spot.side}`}
              {spot.metersAhead ? `, about ${Math.round(spot.metersAhead)} m` : ""}. {spot.reason}
            </p>
          )}

          {result && result.signs.length > 0 && phase !== "parked" && (
            <p className="text-sm text-muted-foreground">Rules seen: {result.signs.join(" · ")}</p>
          )}

          {phase === "parked" && (
            <p role="status" className="rounded-lg bg-success/10 p-3 text-xl font-bold text-success">
              Great landing. You&apos;re parked.
            </p>
          )}

          <div className="flex gap-3">
            {phase === "found" ? (
              <>
                <Button size="lg" className="h-16 flex-1 text-lg" onClick={parkHere}>
                  Park here
                </Button>
                <button type="button" onClick={keepLooking} className="h-16 flex-1 rounded-xl bg-destructive text-lg font-bold text-white active:scale-[0.98]">
                  Taken, keep looking
                </button>
              </>
            ) : phase === "looking" ? (
              <>
                <Button size="lg" className="h-16 flex-1 text-lg" onClick={() => void check()} disabled={checking}>
                  {checking ? "Looking…" : "Check now"}
                </Button>
                <Button variant="outline" size="lg" className="h-16" onClick={onUseGarages}>
                  Garage plan
                </Button>
              </>
            ) : (
              <Button variant="outline" size="lg" className="h-16 flex-1" onClick={keepLooking}>
                Look again
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

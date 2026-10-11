"use client";

import type { ObjectDetector } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChainItem } from "@/logic/chain";
import { buildSeatChain, mergeScan, seatsFromScan, updateOccupancy, type Box, type Seat } from "@/logic/seats";
import { detectFrame, loadDetector } from "@/vision/detector";
import { cn } from "@/lib/utils";

type Phase = "idle" | "starting" | "scanning" | "ready" | "guiding" | "checking" | "landed" | "full" | "error";

const SCAN_MS = 2000;
const UI_INTERVAL_MS = 80; // ~12 UI updates a second; detection runs every frame

/** Spoken announcements. The browser voice for now; OpenAI Realtime takes over in batch 6. */
function announce(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function pct(box: Box) {
  return { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` };
}

export function MeApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const scanRef = useRef<{ started: number; frames: Box[][] }>({ started: 0, frames: [] });
  const seatsRef = useRef<Seat[]>([]);
  const fpsRef = useRef({ frames: 0, since: 0 });
  /** The seat we're walking the driver to, read by the camera loop. */
  const targetRef = useRef<ChainItem | null>(null);

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [aspect, setAspect] = useState(16 / 9);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [people, setPeople] = useState<Box[]>([]);
  const [fps, setFps] = useState(0);
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

  // Stop the camera and the loop when leaving the page.
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      detectorRef.current?.close();
    },
    [],
  );

  function loop() {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (video && detector && video.readyState >= 2) {
      const now = performance.now();
      const frame = detectFrame(detector, video, now);

      const fpsState = fpsRef.current;
      fpsState.frames += 1;
      const uiDue = now - fpsState.since >= UI_INTERVAL_MS;

      if (phaseRef.current === "scanning") {
        const scan = scanRef.current;
        scan.frames.push(frame.seats);
        const progress = Math.min(1, (now - scan.started) / SCAN_MS);
        if (progress >= 1) {
          const found = seatsFromScan(mergeScan(scan.frames), video.videoWidth / video.videoHeight);
          seatsRef.current = found;
          setSeats(found);
          setPhase(found.length ? "ready" : "error");
          if (!found.length) setError("No chairs found. Point the camera at the room and rescan.");
          else announce(`I can see ${found.length} seat${found.length === 1 ? "" : "s"}.`);
        } else if (uiDue) {
          setScanProgress(progress);
          setSeats(seatsFromScan(mergeScan(scan.frames, 0), video.videoWidth / video.videoHeight));
        }
      } else if (seatsRef.current.length) {
        seatsRef.current = updateOccupancy(seatsRef.current, frame.people, now);
        // The target seat just got taken: ask who it was (Claude answers this in batch 5).
        const target = targetRef.current;
        if (phaseRef.current === "guiding" && target && seatsRef.current.find((s) => s.id === target.id)?.state === "taken") {
          setSeats(seatsRef.current);
          setPhase("checking");
          announce(`Someone just sat in Plan ${target.label}. Was that you?`);
        }
      }

      if (uiDue) {
        if (phaseRef.current !== "scanning" && seatsRef.current.length) setSeats(seatsRef.current);
        setPeople(frame.people);
        setFps(Math.round((fpsState.frames * 1000) / (now - fpsState.since)));
        fpsRef.current = { frames: 0, since: now };
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  async function startCamera() {
    setError("");
    setPhase("starting");
    try {
      const [stream, detector] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
        detectorRef.current ? Promise.resolve(detectorRef.current) : loadDetector(),
      ]);
      streamRef.current = stream;
      detectorRef.current = detector;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setAspect(video.videoWidth / video.videoHeight || 16 / 9);
      // Keep the screen awake on the stand during the demo.
      await (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<unknown> } }).wakeLock
        ?.request("screen")
        .catch(() => {});
      fpsRef.current = { frames: 0, since: performance.now() };
      rafRef.current = requestAnimationFrame(loop);
      scan();
    } catch (e) {
      setPhase("error");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera access was blocked. Allow it in the browser settings and try again."
          : "Couldn't start the camera. Plan P needs a secure (https) link and a browser camera.",
      );
    }
  }

  function scan() {
    targetRef.current = null;
    scanRef.current = { started: performance.now(), frames: [] };
    seatsRef.current = [];
    setSeats([]);
    setChain([]);
    setTakenIds([]);
    setCurrentIndex(0);
    setScanProgress(0);
    setPhase("scanning");
  }

  function findSpot() {
    const next = buildSeatChain(seatsRef.current);
    setChain(next);
    setCurrentIndex(0);
    setTakenIds([]);
    setStartedAt(Date.now());
    if (!next.length) {
      setPhase("full");
      announce("Every seat is taken. This lot is full. Plan B is the room next door.");
      return;
    }
    targetRef.current = next[0];
    setPhase("guiding");
    announce(`Plan A: ${next[0].distance}.`);
  }

  const target = chain[currentIndex];

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
    // Re-plan the rest from what's free right now, so seats taken meanwhile are skipped.
    const rest = buildSeatChain(seatsRef.current, [...taken, ...done.map((c) => c.id)], 3, currentIndex + 1);
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
    announce(`Plan ${lost.label} just got taken. Heading to Plan ${rest[0].label}, ${rest[0].distance}.`);
  }

  const labelFor = new Map(chain.map((c, i) => [c.id, { item: c, index: i }]));
  const cameraOn = !["idle", "starting", "error"].includes(phase) || (phase === "error" && !!streamRef.current);

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-black">
      {/* Camera + overlay */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" style={{ containerType: "size" }}>
        {/* Largest box with the camera's aspect ratio that fits, so the picture is never stretched. */}
        <div className="relative" style={{ aspectRatio: aspect, width: `min(100cqw, calc(100cqh * ${aspect}))` }}>
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full" />

          {people.map((p, i) => (
            <div key={`p${i}`} className="absolute rounded-md border border-dashed border-white/40" style={pct(p)} />
          ))}

          {seats.map((seat) => {
            const plan = labelFor.get(seat.id);
            const isTarget = plan && plan.index === currentIndex && ["guiding", "checking"].includes(phase);
            const crossed = takenIds.includes(seat.id);
            return (
              <div
                key={seat.id}
                className={cn(
                  "absolute rounded-lg border-[3px] transition-colors",
                  phase === "scanning"
                    ? "border-white/70"
                    : seat.state === "taken"
                      ? "border-destructive bg-destructive/15"
                      : "border-success bg-success/10",
                  isTarget && "border-primary bg-primary/20 shadow-[0_0_0_4px_rgba(255,77,46,0.35)]",
                )}
                style={pct(seat.box)}
              >
                {(plan || crossed) && (
                  <span
                    className={cn(
                      "absolute -top-5 left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-full font-heading text-xl font-bold",
                      crossed
                        ? "bg-destructive text-white"
                        : isTarget
                          ? "bg-primary text-primary-foreground"
                          : "border-2 border-primary bg-black/70 text-primary",
                    )}
                  >
                    {crossed ? "✕" : plan!.item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {cameraOn && (
          <span className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-white/70">
            on-device detector · {fps} fps · $0
          </span>
        )}

        {phase === "scanning" && (
          <div className="absolute inset-x-6 bottom-6 flex flex-col gap-2">
            <span className="text-center text-lg font-medium text-white">Scanning the room…</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${scanProgress * 100}%` }} />
            </div>
          </div>
        )}

        {(phase === "idle" || phase === "starting" || (phase === "error" && !cameraOn)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
            <p className="eyebrow">Park me</p>
            <h1 className="max-w-md text-3xl leading-tight font-bold sm:text-4xl">
              Put your phone on a stand, facing the room.
            </h1>
            <p className="max-w-sm text-muted-foreground">
              Plan P finds every chair, sees which are taken, and walks you to a free one.
            </p>
            {error && <p className="max-w-sm text-destructive">{error}</p>}
            <Button size="lg" className="h-14 px-8 text-lg" onClick={startCamera} disabled={phase === "starting"}>
              {phase === "starting" ? "Starting camera…" : "Start camera"}
            </Button>
          </div>
        )}
      </div>

      {/* Controls */}
      {cameraOn && (
        <div className="flex flex-col gap-3 border-t border-border bg-background p-4 sm:p-5">
          {phase === "error" && <p className="text-destructive">{error}</p>}

          {phase === "ready" && (
            <p className="text-lg">
              {seats.filter((s) => s.state === "free").length} free of {seats.length} seats.
            </p>
          )}

          {(phase === "guiding" || phase === "checking") && target && (
            <p role="status" aria-live="polite" className="rounded-lg bg-primary/10 p-3 text-lg leading-snug font-medium">
              {phase === "checking"
                ? `Someone just sat in Plan ${target.label}. Was that you?`
                : `${takenIds.length ? "Plan " + chain[currentIndex - 1].label + " got taken. " : ""}Plan ${target.label}: ${target.distance}.`}
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
                <button
                  type="button"
                  onClick={someoneElse}
                  className="h-16 flex-1 rounded-xl bg-destructive text-lg font-bold text-white active:scale-[0.98]"
                >
                  Someone else
                </button>
              </>
            ) : (
              <>
                {(phase === "ready" || phase === "landed" || phase === "full") && (
                  <Button size="lg" className="h-16 flex-1 text-lg" onClick={findSpot}>
                    Find me a spot
                  </Button>
                )}
                {phase !== "scanning" && (
                  <Button variant="outline" size="lg" className="h-16" onClick={scan}>
                    Rescan
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  DinoSprite,
  EggSprite,
  Ground,
  FoodSprite,
} from "./fundy-sprites";

const STAGES = [
  { name: "Egg", min: 0, scale: 3 },
  { name: "Hatchling", min: 50, scale: 2 },
  { name: "Juvenile", min: 150, scale: 3 },
  { name: "Adult", min: 400, scale: 4 },
] as const;

const FED_EVENT = "fundy:fed";
type Fed = { score: number; feedback: string };
type FedEvent = Fed & { total: number };

/**
 * Feed Fundy a pitch score (10 points per point of score). Storage is the source of truth, so this
 * works whether or not Fundy is on screen; returns the growth so the voice copilot can say it.
 */
export function feedFundy(fed: Fed) {
  const before = savedScore();
  const total = before + fed.score * 10;
  try {
    localStorage.setItem("fundy-score", String(total));
  } catch {}
  window.dispatchEvent(
    new CustomEvent<FedEvent>(FED_EVENT, { detail: { ...fed, total } }),
  );
  const from = getStage(before);
  const to = getStage(total);
  const next = STAGES.find((s) => s.min > total);
  return {
    grewBy: total - before,
    points: total,
    stage: to.name,
    evolved: from.name !== to.name ? `${from.name} → ${to.name}` : null,
    toNextStage: next
      ? `${next.min - total} points to ${next.name}`
      : "fully grown",
  };
}

function savedScore() {
  try {
    return Number(localStorage.getItem("fundy-score") ?? "0") || 0;
  } catch {
    return 0;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(FED_EVENT, onChange);
  return () => window.removeEventListener(FED_EVENT, onChange);
}

function getStage(score: number) {
  return STAGES.reduce((acc, s) => (score >= s.min ? s : acc), STAGES[0]);
}

/** Fundy — a pixel dino mascot that grows when you practice your pitch.
 *  The voice copilot's pitch score feeds it (feedFundy); it never asks you to type. */
export function Fundy() {
  // Points live in storage (shown from the first screen, 0 while the page is server-rendered).
  const score = useSyncExternalStore(subscribe, savedScore, () => 0);
  const [result, setResult] = useState<{
    score: number;
    feedback: string;
  } | null>(null);
  const [tick, setTick] = useState(0);
  const [fed, setFed] = useState(false);

  useEffect(() => {
    const onFed = (e: Event) => {
      const data = (e as CustomEvent<FedEvent>).detail;
      setResult(data);
      setFed(true);
      setTimeout(() => setFed(false), 1500);
    };
    window.addEventListener(FED_EVENT, onFed);
    return () => window.removeEventListener(FED_EVENT, onFed);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);

  const stage = getStage(score);
  const nextStage = STAGES.find((s) => s.min > score);
  const progress = nextStage
    ? ((score - stage.min) / (nextStage.min - stage.min)) * 100
    : 100;

  const blink = tick % 35 < 2;
  const hopPhase = tick % 70;
  const hopping = hopPhase < 6 && !fed;
  const hopY = hopping ? Math.sin((hopPhase / 6) * Math.PI) * 4 : 0;
  const fedY = fed ? Math.abs(Math.sin(((tick % 15) / 15) * Math.PI)) * 6 : 0;

  const sprite = (scale: number) => (
    <div
      className="relative"
      style={{ transform: `translateY(${-Math.max(hopY, fedY)}px)` }}
    >
      {stage.name === "Egg" ? (
        <EggSprite scale={scale} />
      ) : (
        <DinoSprite
          scale={scale}
          blink={blink}
          pose={hopping ? "walkA" : "stand"}
        />
      )}
    </div>
  );

  // In the car: one row, no typing.
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface p-2">
      <div className="relative flex h-14 w-20 shrink-0 items-end justify-center overflow-hidden rounded-md bg-[#0e0e14]">
        {fed && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 animate-bounce">
            <FoodSprite className="h-3" />
          </div>
        )}
        {sprite(Math.min(stage.scale, 2))}
        <Ground className="absolute right-0 bottom-0 left-0" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-bold">🦖 Fundy · {stage.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {score} pts{result ? ` (+${result.score * 10})` : ""}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-subtle">
          {nextStage
            ? `${nextStage.min - score} pts to ${nextStage.name} · grows with your pitch score`
            : "Fully grown"}
        </span>
      </div>
    </div>
  );
}

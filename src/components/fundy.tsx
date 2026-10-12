"use client";

import { useEffect, useState } from "react";
import { DinoSprite, EggSprite, Ground, CloudSprite, FoodSprite } from "./fundy-sprites";

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
  window.dispatchEvent(new CustomEvent<FedEvent>(FED_EVENT, { detail: { ...fed, total } }));
  const from = getStage(before);
  const to = getStage(total);
  const next = STAGES.find((s) => s.min > total);
  return {
    grewBy: total - before,
    points: total,
    stage: to.name,
    evolved: from.name !== to.name ? `${from.name} → ${to.name}` : null,
    toNextStage: next ? `${next.min - total} points to ${next.name}` : "fully grown",
  };
}

function savedScore() {
  try {
    return Number(localStorage.getItem("fundy-score") ?? "0") || 0;
  } catch {
    return 0;
  }
}

function getStage(score: number) {
  return STAGES.reduce((acc, s) => (score >= s.min ? s : acc), STAGES[0]);
}

/** Fundy — a pixel dino mascot that grows when you practice your pitch.
 *  Type a pitch, Claude scores it, the score feeds Fundy and it grows. */
export function Fundy({ compact = false }: { compact?: boolean }) {
  // Fundy only appears once a drive has started (after the page loaded), so reading storage here is safe.
  const [score, setScore] = useState(savedScore);
  const [pitch, setPitch] = useState("");
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<{ score: number; feedback: string } | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [fed, setFed] = useState(false);

  useEffect(() => {
    const onFed = (e: Event) => {
      const { total, ...data } = (e as CustomEvent<FedEvent>).detail;
      setResult(data);
      setScore(total);
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
  const progress = nextStage ? ((score - stage.min) / (nextStage.min - stage.min)) * 100 : 100;

  const blink = tick % 35 < 2;
  const hopPhase = tick % 70;
  const hopping = hopPhase < 6 && !fed;
  const hopY = hopping ? Math.sin((hopPhase / 6) * Math.PI) * 4 : 0;
  const fedY = fed ? Math.abs(Math.sin(((tick % 15) / 15) * Math.PI)) * 6 : 0;

  async function submitPitch() {
    if (!pitch.trim() || scoring) return;
    setScoring(true);
    setError("");
    try {
      const res = await fetch("/api/pitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pitch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scoring failed");
      feedFundy(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  }

  const sprite = (scale: number) => (
    <div className="relative" style={{ transform: `translateY(${-Math.max(hopY, fedY)}px)` }}>
      {stage.name === "Egg" ? <EggSprite scale={scale} /> : <DinoSprite scale={scale} blink={blink} pose={hopping ? "walkA" : "stand"} />}
    </div>
  );

  // In the car: one row, no typing.
  if (compact) {
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
            <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-subtle">{nextStage ? `${nextStage.min - score} pts to ${nextStage.name} · grows with your pitch score` : "Fully grown"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="order-2 flex flex-col gap-2 rounded-lg bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="eyebrow">🦖 Fundy</span>
        <span className="text-sm font-bold text-foreground">
          {stage.name} · {score} pts
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-success transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {nextStage && (
        <span className="text-xs text-subtle">
          {nextStage.min - score} pts to {nextStage.name}
        </span>
      )}

      <div
        className="relative flex items-end justify-center overflow-hidden rounded-md bg-[#0e0e14]"
        style={{ height: 90 }}
      >
        <CloudSprite className="absolute top-1 left-2 h-2.5 opacity-40" />
        <CloudSprite className="absolute top-3 right-3 h-2 opacity-25" />
        {fed && (
          <div className="absolute left-1/2 top-0 -translate-x-1/2 animate-bounce">
            <FoodSprite className="h-4" />
          </div>
        )}
        {sprite(stage.scale)}
        <Ground className="absolute bottom-0 left-0 right-0" />
      </div>

      <textarea
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        placeholder="Type your pitch for PlanP…"
        rows={3}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        onClick={submitPitch}
        disabled={scoring || !pitch.trim()}
        className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {scoring ? "Scoring…" : "Score my pitch"}
      </button>

      {result && (
        <div className="flex flex-col gap-1 rounded-md bg-success/10 p-2">
          <span className="text-sm font-bold text-success">
            Score: {result.score}/10 · +{result.score * 10} pts
          </span>
          <p className="text-xs text-muted-foreground">{result.feedback}</p>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

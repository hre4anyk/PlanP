import { planLabel } from "./chain";
import { iou, type Box } from "./seats";

// Street spots from the camera (ARCHITECTURE §6.2): track vehicles, decide which are parked,
// and measure the gaps in front of and behind each parked car. A gap of at least
// MIN_GAP_CARS car lengths becomes a candidate spot instantly; Claude confirms legality after.

export const MIN_GAP_CARS = 1.3;
export const MAX_GAP_CARS = 4;
const TRACK_IOU = 0.3;
const TRACK_TTL_MS = 1200;
const STILL_MOVE = 0.012;
export const STILL_FOR_MS = 1500;
const SPOT_MATCH_IOU = 0.25;
const SPOT_SHOW_AFTER_MS = 400;
const SPOT_DROP_AFTER_MS = 1500;
const TAKEN_COVER = 0.4;
/** A car must sit in the gap this long (passing traffic doesn't count). */
const TAKEN_AFTER_MS = 800;

export type Track = {
  id: number;
  box: Box;
  lastSeen: number;
  /** Since when the car hasn't moved (null while moving). */
  stillSince: number | null;
  /** Claude called it parked at the curb. */
  claudeParked: boolean;
};

const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;

/** Match this frame's vehicles to known tracks (greedy IoU), so each car keeps its identity. */
export function updateTracks(tracks: Track[], boxes: Box[], now: number, nextId: { value: number }): Track[] {
  const pairs: { t: number; b: number; score: number }[] = [];
  tracks.forEach((t, ti) => boxes.forEach((b, bi) => {
    const score = iou(t.box, b);
    if (score >= TRACK_IOU) pairs.push({ t: ti, b: bi, score });
  }));
  pairs.sort((a, b) => b.score - a.score);
  const usedT = new Set<number>();
  const usedB = new Set<number>();
  const next: Track[] = [];
  for (const p of pairs) {
    if (usedT.has(p.t) || usedB.has(p.b)) continue;
    usedT.add(p.t);
    usedB.add(p.b);
    const t = tracks[p.t];
    const b = boxes[p.b];
    const moved = Math.hypot(cx(b) - cx(t.box), cy(b) - cy(t.box)) > STILL_MOVE;
    next.push({ ...t, box: b, lastSeen: now, stillSince: moved ? null : (t.stillSince ?? now) });
  }
  tracks.forEach((t, ti) => {
    if (!usedT.has(ti) && now - t.lastSeen <= TRACK_TTL_MS) next.push(t);
  });
  boxes.forEach((b, bi) => {
    if (!usedB.has(bi)) next.push({ id: nextId.value++, box: b, lastSeen: now, stillSince: now, claudeParked: false });
  });
  return next;
}

/** Parked = Claude said so, or (spotter mode, fixed camera) it hasn't moved for a while. */
export function isParked(t: Track, now: number, fixedCamera: boolean): boolean {
  return t.claudeParked || (fixedCamera && t.stillSince !== null && now - t.stillSince >= STILL_FOR_MS);
}

export type Gap = { box: Box; side: "left" | "right" };

/**
 * Gaps between neighbouring parked cars along a curb, measured in car lengths so it works at any
 * distance and angle (neighbours are at a similar scale). `aspect` = frame width / height.
 */
export function findGaps(parked: Box[], vehicles: Box[], aspect: number): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 0; i < parked.length; i++) {
    for (let j = i + 1; j < parked.length; j++) {
      const a = parked[i];
      const b = parked[j];
      // Direction between the cars, in square (aspect-corrected) units.
      const dx = (cx(b) - cx(a)) * aspect;
      const dy = cy(b) - cy(a);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) continue;
      const [ux, uy] = [dx / dist, dy / dist];
      // A box's length along the curb, and its thickness across it.
      const along = (k: Box) => Math.abs(ux) * k.w * aspect + Math.abs(uy) * k.h;
      const carLen = (along(a) + along(b)) / 2;
      const gap = dist - along(a) / 2 - along(b) / 2;
      const ratio = gap / carLen;
      if (ratio < MIN_GAP_CARS || ratio > MAX_GAP_CARS) continue;
      if (!sameCurb(a, b, ux, uy, aspect)) continue;
      const region = gapRegion(a, b);
      // Neighbours only: no other parked car between them, and nothing already in the gap.
      const blocked = vehicles.some((v) => v !== a && v !== b && overlapShare(region, v) > 0.25);
      if (blocked) continue;
      gaps.push({ box: region, side: cx(region) < 0.5 ? "left" : "right" });
    }
  }
  return gaps;
}

const MAX_ROW_ANGLE = 40;

/**
 * Two cars are on the same curb when they're a similar size (neighbours sit at a similar distance)
 * and, if their boxes are clearly long, the line between them runs along that long side.
 */
function sameCurb(a: Box, b: Box, ux: number, uy: number, aspect: number): boolean {
  const areaRatio = (a.w * a.h) / (b.w * b.h);
  if (areaRatio < 0.4 || areaRatio > 2.5) return false;
  const shape = ((a.w + b.w) * aspect) / (a.h + b.h);
  const angleFromHorizontal = (Math.atan2(Math.abs(uy), Math.abs(ux)) * 180) / Math.PI;
  if (shape > 1.3) return angleFromHorizontal <= MAX_ROW_ANGLE; // side-on cars: curb runs across
  if (shape < 1 / 1.3) return angleFromHorizontal >= 90 - MAX_ROW_ANGLE; // nose-on: curb runs up
  return true;
}

/** The empty stretch between two cars, as a box. */
function gapRegion(a: Box, b: Box): Box {
  const horizontal = Math.abs(cx(b) - cx(a)) >= Math.abs(cy(b) - cy(a));
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x + a.w, b.x + b.w);
  if (horizontal) {
    const [l, r] = cx(a) < cx(b) ? [a, b] : [b, a];
    return { x: l.x + l.w, y: top, w: Math.max(0.005, r.x - (l.x + l.w)), h: bottom - top };
  }
  const [t, u] = cy(a) < cy(b) ? [a, b] : [b, a];
  return { x: left, y: t.y + t.h, w: right - left, h: Math.max(0.005, u.y - (t.y + t.h)) };
}

/** Share of `region` covered by `box`. */
export function overlapShare(region: Box, box: Box): number {
  const w = Math.min(region.x + region.w, box.x + box.w) - Math.max(region.x, box.x);
  const h = Math.min(region.y + region.h, box.y + box.h) - Math.max(region.y, box.y);
  const area = region.w * region.h;
  return w > 0 && h > 0 && area > 0 ? (w * h) / area : 0;
}

export type SpotStatus = "possible" | "legal" | "illegal";
export type Spot = {
  key: number;
  label: string;
  box: Box;
  side: "left" | "right";
  status: SpotStatus;
  reason: string;
  firstSeen: number;
  lastSeen: number;
  /** Shown to the driver (survived the short debounce). */
  shown: boolean;
};

export type SpotEvent = { type: "new"; spot: Spot } | { type: "taken"; spot: Spot } | { type: "gone"; spot: Spot };

/**
 * Keep spot identities stable across frames (so "Spot A" stays Spot A), debounce flicker,
 * and notice when a car pulls into a spot. Labels go to the best spots: your side first, then nearest.
 */
export function updateSpots(
  spots: Spot[],
  gaps: Gap[],
  vehicles: Box[],
  now: number,
  mySide: "left" | "right" | null,
  nextKey: { value: number },
): { spots: Spot[]; events: SpotEvent[] } {
  const events: SpotEvent[] = [];
  const matched = new Set<number>();
  let next: Spot[] = spots.map((s) => {
    let best = -1;
    let bestScore = SPOT_MATCH_IOU;
    gaps.forEach((g, gi) => {
      const score = iou(s.box, g.box);
      if (!matched.has(gi) && score >= bestScore) {
        best = gi;
        bestScore = score;
      }
    });
    if (best < 0) return s;
    matched.add(best);
    return { ...s, box: gaps[best].box, side: gaps[best].side, lastSeen: now };
  });
  gaps.forEach((g, gi) => {
    if (!matched.has(gi)) {
      next.push({ key: nextKey.value++, label: "", box: g.box, side: g.side, status: "possible", reason: "", firstSeen: now, lastSeen: now, shown: false });
    }
  });

  const kept: Spot[] = [];
  for (const s of next) {
    const takenBy = s.shown && now - s.lastSeen >= TAKEN_AFTER_MS && vehicles.some((v) => overlapShare(s.box, v) >= TAKEN_COVER);
    if (takenBy) {
      events.push({ type: "taken", spot: s });
      continue;
    }
    if (now - s.lastSeen > SPOT_DROP_AFTER_MS) {
      if (s.shown) events.push({ type: "gone", spot: s });
      continue;
    }
    if (!s.shown && now - s.firstSeen >= SPOT_SHOW_AFTER_MS && s.status !== "illegal") {
      kept.push({ ...s, shown: true });
      continue;
    }
    kept.push(s);
  }
  next = kept;

  // Labels: legal and possible spots shown to the driver, your side first, then nearest (lower in frame).
  const ranked = next
    .filter((s) => s.shown && s.status !== "illegal")
    .sort((a, b) => Number(mySide !== null && b.side === mySide) - Number(mySide !== null && a.side === mySide) || b.box.y + b.box.h - (a.box.y + a.box.h));
  const labels = new Map(ranked.map((s, i) => [s.key, planLabel(i)]));
  next = next.map((s) => ({ ...s, label: labels.get(s.key) ?? "" }));
  for (const s of next) {
    const before = spots.find((p) => p.key === s.key);
    if (s.shown && !before?.shown) events.push({ type: "new", spot: s });
  }
  return { spots: next, events };
}

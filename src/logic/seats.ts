import { planLabel, type ChainItem } from "./chain";

/** Box in normalised image coordinates (0–1), top-left origin. */
export type Box = { x: number; y: number; w: number; h: number };
export type SeatState = "free" | "taken";
export type Direction = "left" | "ahead" | "right";

export type Seat = {
  id: string;
  box: Box;
  state: SeatState;
  steps: number;
  direction: Direction;
  /** When the current evidence (a person on it, or nobody) started; drives the debounce. */
  pendingSince: number | null;
};

// Tunables from ARCHITECTURE §6.1.
export const SAME_SEAT_IOU = 0.3;
export const MIN_SCAN_SHARE = 0.4;
export const SEAT_OVERLAP = 0.3;
export const TAKEN_AFTER_MS = 1000;
export const FREE_AFTER_MS = 2000;
const CHAIR_HEIGHT_M = 0.85;
const STEP_M = 0.75;
const HFOV_DEG = 65;

function area(b: Box) {
  return Math.max(0, b.w) * Math.max(0, b.h);
}

function intersection(a: Box, b: Box) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function iou(a: Box, b: Box) {
  const i = intersection(a, b);
  return i === 0 ? 0 : i / (area(a) + area(b) - i);
}

/**
 * Room scan: chair boxes from ~2 s of frames, merged into stable seats.
 * A seat must show up in at least MIN_SCAN_SHARE of frames, which drops one-off false detections.
 */
export function mergeScan(frames: Box[][], minShare = MIN_SCAN_SHARE): Box[] {
  const clusters: { sum: Box; count: number; frames: Set<number> }[] = [];
  frames.forEach((boxes, f) => {
    for (const box of boxes) {
      const match = clusters.find((c) => iou(averaged(c), box) >= SAME_SEAT_IOU);
      if (match) {
        match.sum = { x: match.sum.x + box.x, y: match.sum.y + box.y, w: match.sum.w + box.w, h: match.sum.h + box.h };
        match.count += 1;
        match.frames.add(f);
      } else {
        clusters.push({ sum: { ...box }, count: 1, frames: new Set([f]) });
      }
    }
  });
  const needed = Math.max(1, Math.ceil(frames.length * minShare));
  return clusters
    .filter((c) => c.frames.size >= needed)
    .map(averaged)
    .sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
}

function averaged(c: { sum: Box; count: number }): Box {
  return { x: c.sum.x / c.count, y: c.sum.y / c.count, w: c.sum.w / c.count, h: c.sum.h / c.count };
}

/**
 * Rough distance from the camera, from how tall the chair looks (pinhole model, PRD F3).
 * `aspect` is the video's width / height.
 */
export function estimateSteps(box: Box, aspect: number, hfovDeg = HFOV_DEG): number {
  const focalOverHeight = aspect / 2 / Math.tan(((hfovDeg / 2) * Math.PI) / 180);
  const metres = (CHAIR_HEIGHT_M * focalOverHeight) / Math.max(box.h, 0.01);
  return Math.max(1, Math.round(metres / STEP_M));
}

export function directionOf(box: Box): Direction {
  const cx = box.x + box.w / 2;
  return cx < 0.4 ? "left" : cx > 0.6 ? "right" : "ahead";
}

export function seatsFromScan(boxes: Box[], aspect: number): Seat[] {
  return boxes.map((box, i) => ({
    id: `S${i + 1}`,
    box,
    state: "free",
    steps: estimateSteps(box, aspect),
    direction: directionOf(box),
    pendingSince: null,
  }));
}

/** The part of a chair a sitting person covers. */
function seatArea(box: Box): Box {
  return { x: box.x, y: box.y + box.h / 2, w: box.w, h: box.h / 2 };
}

export function personOnSeat(seat: Box, people: Box[]): boolean {
  const target = seatArea(seat);
  const a = area(target);
  return a > 0 && people.some((p) => intersection(p, target) / a >= SEAT_OVERLAP);
}

/**
 * Debounced occupancy (PRD F1): taken after a person covers the seat for TAKEN_AFTER_MS,
 * free again after FREE_AFTER_MS without one. Stops boxes flickering as people move.
 */
export function updateOccupancy(seats: Seat[], people: Box[], now: number): Seat[] {
  return seats.map((seat) => {
    const covered = personOnSeat(seat.box, people);
    const evidence: SeatState = covered ? "taken" : "free";
    if (evidence === seat.state) return seat.pendingSince === null ? seat : { ...seat, pendingSince: null };
    const since = seat.pendingSince ?? now;
    const wait = evidence === "taken" ? TAKEN_AFTER_MS : FREE_AFTER_MS;
    if (now - since >= wait) return { ...seat, state: evidence, pendingSince: null };
    return seat.pendingSince === null ? { ...seat, pendingSince: now } : seat;
  });
}

const SIDE: Record<Direction, string> = { left: "on your left", ahead: "straight ahead", right: "on your right" };

export function seatDistance(seat: Seat): string {
  return `about ${seat.steps} step${seat.steps === 1 ? "" : "s"}, ${SIDE[seat.direction]}`;
}

/** Closest free seats first: the planner's input and its fallback (ARCHITECTURE D12). */
export function buildSeatChain(seats: Seat[], excludeIds: Iterable<string> = [], size = 3, startIndex = 0): ChainItem[] {
  const excluded = new Set(excludeIds);
  return seats
    .filter((s) => s.state === "free" && !excluded.has(s.id))
    .sort((a, b) => a.steps - b.steps)
    .slice(0, size)
    .map((seat, i) => ({
      id: seat.id,
      label: planLabel(startIndex + i),
      distance: seatDistance(seat),
      reason: startIndex + i === 0 ? "Closest free seat" : "Backup: next closest free seat",
    }));
}

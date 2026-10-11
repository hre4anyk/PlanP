import { describe, expect, it } from "vitest";
import {
  buildSeatChain,
  directionOf,
  estimateSteps,
  FREE_AFTER_MS,
  iou,
  mergeScan,
  personOnSeat,
  seatsFromScan,
  TAKEN_AFTER_MS,
  updateOccupancy,
  type Box,
  type Seat,
} from "./seats";

const left: Box = { x: 0.1, y: 0.5, w: 0.15, h: 0.3 };
const middle: Box = { x: 0.45, y: 0.45, w: 0.1, h: 0.2 };
const right: Box = { x: 0.75, y: 0.4, w: 0.08, h: 0.12 };
const jitter = (b: Box, d: number): Box => ({ ...b, x: b.x + d, y: b.y - d });

describe("iou", () => {
  it("is 1 for the same box and 0 for disjoint boxes", () => {
    expect(iou(left, left)).toBeCloseTo(1);
    expect(iou(left, right)).toBe(0);
  });
});

describe("mergeScan", () => {
  it("merges jittery detections of the same chair into one seat, left to right", () => {
    const frames = [
      [right, left, middle],
      [jitter(left, 0.01), jitter(middle, 0.01), jitter(right, -0.01)],
      [jitter(left, -0.01), middle],
    ];
    const seats = mergeScan(frames);
    expect(seats).toHaveLength(3);
    expect(seats[0].x).toBeCloseTo(0.1, 2);
    expect(seats.map((s) => directionOf(s))).toEqual(["left", "ahead", "right"]);
  });

  it("drops one-off false detections", () => {
    const ghost: Box = { x: 0.6, y: 0.1, w: 0.05, h: 0.05 };
    const frames = [[left, ghost], [left], [left], [left], [left]];
    expect(mergeScan(frames)).toHaveLength(1);
  });
});

describe("estimateSteps", () => {
  it("gives more steps for chairs that look smaller", () => {
    const near = estimateSteps({ x: 0, y: 0, w: 0.2, h: 0.5 }, 16 / 9);
    const far = estimateSteps({ x: 0, y: 0, w: 0.05, h: 0.1 }, 16 / 9);
    expect(far).toBeGreaterThan(near);
    expect(near).toBeGreaterThanOrEqual(1);
  });

  it("puts a chair filling a fifth of a 16:9 frame around 6 steps away", () => {
    // 0.85 m × (16/9 / 2 / tan 32.5°) / 0.2 ≈ 5.9 m ≈ 8 steps; a quarter of the frame ≈ 6 steps
    expect(estimateSteps({ x: 0, y: 0, w: 0.1, h: 0.25 }, 16 / 9)).toBe(6);
  });
});

describe("personOnSeat", () => {
  it("needs the person to cover the seat part of the chair", () => {
    const sitter: Box = { x: 0.08, y: 0.4, w: 0.2, h: 0.45 };
    const passerBy: Box = { x: 0.2, y: 0.1, w: 0.1, h: 0.4 }; // above the seat, barely overlapping
    expect(personOnSeat(left, [sitter])).toBe(true);
    expect(personOnSeat(left, [passerBy])).toBe(false);
    expect(personOnSeat(left, [])).toBe(false);
  });
});

describe("updateOccupancy", () => {
  const sitter: Box = { x: 0.08, y: 0.4, w: 0.2, h: 0.45 };

  it("marks a seat taken only after a person stays on it", () => {
    let seats = seatsFromScan([left], 16 / 9);
    seats = updateOccupancy(seats, [sitter], 0);
    expect(seats[0].state).toBe("free");
    seats = updateOccupancy(seats, [sitter], TAKEN_AFTER_MS - 1);
    expect(seats[0].state).toBe("free");
    seats = updateOccupancy(seats, [sitter], TAKEN_AFTER_MS);
    expect(seats[0].state).toBe("taken");
  });

  it("ignores a brief flicker and frees the seat only after they leave for a while", () => {
    let seats: Seat[] = seatsFromScan([left], 16 / 9).map((s) => ({ ...s, state: "taken" }));
    seats = updateOccupancy(seats, [], 0); // detector missed them for a frame
    seats = updateOccupancy(seats, [sitter], 500); // back again: flicker forgotten
    expect(seats[0]).toMatchObject({ state: "taken", pendingSince: null });
    seats = updateOccupancy(seats, [], 1000);
    seats = updateOccupancy(seats, [], 1000 + FREE_AFTER_MS);
    expect(seats[0].state).toBe("free");
  });
});

describe("buildSeatChain", () => {
  it("labels the closest free seats A, B, C with steps and side", () => {
    const seats = seatsFromScan([left, middle, right], 16 / 9);
    seats[0] = { ...seats[0], state: "taken" };
    const chain = buildSeatChain(seats);
    expect(chain.map((c) => c.label)).toEqual(["A", "B"]);
    expect(chain[0].id).toBe("S2"); // middle chair is closer than the small right one
    expect(chain[0].distance).toMatch(/^about \d+ steps?, straight ahead$/);
  });

  it("continues labelling after excluded seats", () => {
    const seats = seatsFromScan([left, middle, right], 16 / 9);
    const chain = buildSeatChain(seats, ["S1"], 3, 1);
    expect(chain.map((c) => c.label)).toEqual(["B", "C"]);
  });
});

import { describe, expect, it } from "vitest";
import { findGaps, isParked, STILL_FOR_MS, updateSpots, updateTracks, type Spot, type Track } from "./curb";
import type { Box } from "./seats";

// A curb seen from a window: cars in a row across the frame, each 0.15 wide.
const car = (x: number, y = 0.6): Box => ({ x, y, w: 0.15, h: 0.1 });
const aspect = 4 / 3;

describe("findGaps", () => {
  it("finds a car-sized gap between two parked cars", () => {
    const row = [car(0.1), car(0.5)]; // gap 0.25 wide ≈ 1.7 car lengths
    const gaps = findGaps(row, row, aspect);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].box.x).toBeCloseTo(0.25);
    expect(gaps[0].box.w).toBeCloseTo(0.25);
  });

  it("ignores gaps too small for a car", () => {
    const row = [car(0.1), car(0.3)]; // gap 0.05 ≈ 0.3 car lengths
    expect(findGaps(row, row, aspect)).toHaveLength(0);
  });

  it("ignores cars on different curbs", () => {
    const row = [car(0.1, 0.2), car(0.5, 0.8)];
    expect(findGaps(row, row, aspect)).toHaveLength(0);
  });

  it("only pairs neighbours: a car in between blocks the outer pair", () => {
    const row = [car(0.05), car(0.3), car(0.7)];
    const gaps = findGaps(row, row, aspect);
    expect(gaps).toHaveLength(1); // only 0.3 ↔ 0.7; 0.05 ↔ 0.3 is too tight, 0.05 ↔ 0.7 is blocked
    expect(gaps[0].box.x).toBeCloseTo(0.45);
  });

  it("works for a curb running up the picture (driver's view)", () => {
    const column: Box[] = [{ x: 0.7, y: 0.1, w: 0.1, h: 0.12 }, { x: 0.7, y: 0.5, w: 0.1, h: 0.12 }];
    const gaps = findGaps(column, column, aspect);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].side).toBe("right");
  });
});

describe("tracks", () => {
  it("keeps identity across frames and marks a still car parked in spotter mode", () => {
    const id = { value: 1 };
    let tracks: Track[] = updateTracks([], [car(0.1)], 0, id);
    tracks = updateTracks(tracks, [car(0.101)], 1000, id);
    tracks = updateTracks(tracks, [car(0.1)], STILL_FOR_MS, id);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe(1);
    expect(isParked(tracks[0], STILL_FOR_MS, true)).toBe(true);
    expect(isParked(tracks[0], STILL_FOR_MS, false)).toBe(false); // driving: only Claude decides
  });

  it("a moving car isn't parked", () => {
    const id = { value: 1 };
    let tracks = updateTracks([], [car(0.1)], 0, id);
    tracks = updateTracks(tracks, [car(0.13)], 500, id);
    tracks = updateTracks(tracks, [car(0.16)], 2000, id);
    expect(isParked(tracks[0], 2000, true)).toBe(false);
  });
});

describe("updateSpots", () => {
  const key = () => ({ value: 1 });
  const gap = { box: { x: 0.25, y: 0.6, w: 0.25, h: 0.1 }, side: "right" as const };

  it("shows a spot after a short debounce and labels it Spot A", () => {
    const k = key();
    let r = updateSpots([], [gap], [], 0, "right", k);
    expect(r.spots[0].shown).toBe(false);
    r = updateSpots(r.spots, [gap], [], 500, "right", k);
    expect(r.spots[0]).toMatchObject({ shown: true, label: "A", status: "possible" });
    expect(r.events.map((e) => e.type)).toEqual(["new"]);
  });

  it("says 'taken' when a car pulls into the spot and stays", () => {
    const k = key();
    let spots: Spot[] = updateSpots(updateSpots([], [gap], [], 0, "right", k).spots, [gap], [], 500, "right", k).spots;
    const parker = { x: 0.28, y: 0.6, w: 0.15, h: 0.1 };
    let r = updateSpots(spots, [], [parker], 900, "right", k); // just pulled in: not yet
    expect(r.events).toEqual([]);
    spots = r.spots;
    r = updateSpots(spots, [], [parker], 1400, "right", k);
    expect(r.events.map((e) => e.type)).toEqual(["taken"]);
    expect(r.spots).toHaveLength(0);
  });

  it("ranks your side first", () => {
    const k = key();
    const left = { box: { x: 0.05, y: 0.8, w: 0.2, h: 0.1 }, side: "left" as const };
    let r = updateSpots([], [left, gap], [], 0, "right", k);
    r = updateSpots(r.spots, [left, gap], [], 500, "right", k);
    const byLabel = Object.fromEntries(r.spots.map((s) => [s.label, s.side]));
    expect(byLabel).toEqual({ A: "right", B: "left" });
  });

  it("drops spots Claude called illegal from the labels", () => {
    const k = key();
    let r = updateSpots([], [gap], [], 0, "right", k);
    r = updateSpots(r.spots, [gap], [], 500, "right", k);
    const illegal = r.spots.map((s) => ({ ...s, status: "illegal" as const }));
    r = updateSpots(illegal, [gap], [], 600, "right", k);
    expect(r.spots[0].label).toBe("");
  });
});

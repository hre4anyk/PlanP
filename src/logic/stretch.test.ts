import { describe, expect, it } from "vitest";
import { distanceMetres } from "./geo";
import { bearing, sampleStretch } from "./stretch";

const dest = { lat: 37.7936, lng: -122.3941 };
// A straight drive due north ending at the meeting, ~1.7 km long.
const path = [{ lat: 37.7786, lng: -122.3941 }, { lat: 37.7936, lng: -122.3941 }];

describe("bearing", () => {
  it("points north, east, south", () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0);
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90);
    expect(bearing({ lat: 1, lng: 0 }, { lat: 0, lng: 0 })).toBeCloseTo(180);
  });
});

describe("sampleStretch", () => {
  it("samples about every 50 m, facing the way you drive", () => {
    const pts = sampleStretch(path, dest, { maxPoints: 100 });
    expect(pts.length).toBeGreaterThan(10);
    expect(distanceMetres(pts[0], pts[1])).toBeCloseTo(50, 0);
    expect(pts.every((p) => Math.abs(p.bearing) < 1)).toBe(true);
  });

  it("only keeps points within a 10-minute walk of the meeting", () => {
    const pts = sampleStretch(path, dest, { maxPoints: 100 });
    expect(pts.every((p) => p.walkMin <= 10)).toBe(true);
    expect(distanceMetres(pts[0], dest)).toBeLessThan(10 * 80 + 50);
  });

  it("keeps the points nearest the meeting, in driving order", () => {
    const pts = sampleStretch(path, dest, { maxPoints: 5 });
    expect(pts).toHaveLength(5);
    expect(pts[4].walkMin).toBeLessThanOrEqual(pts[0].walkMin);
    expect(distanceMetres(pts[4], dest)).toBeLessThan(60);
  });

  it("carries spacing across path vertices", () => {
    const zig = [{ lat: 37.79, lng: -122.4 }, { lat: 37.7903, lng: -122.4 }, { lat: 37.7903, lng: -122.3995 }];
    const pts = sampleStretch(zig, { lat: 37.7903, lng: -122.3995 }, { spacingM: 20, maxPoints: 100 });
    for (let i = 1; i < pts.length; i++) expect(distanceMetres(pts[i - 1], pts[i])).toBeLessThan(21);
  });
});

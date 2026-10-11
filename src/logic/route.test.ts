import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRoute, parseOsrm, straightLegs } from "./route";

const A = { lat: 37.7765, lng: -122.42 };
const B = { lat: 37.7835, lng: -122.4055 };
const C = { lat: 37.7856, lng: -122.407 };

const osrm = {
  code: "Ok",
  routes: [
    {
      legs: [
        { duration: 315, steps: [{ geometry: { coordinates: [[-122.42, 37.7765], [-122.41, 37.78]] as [number, number][] } }] },
        { duration: 20, steps: [{ geometry: { coordinates: [[-122.4055, 37.7835], [-122.407, 37.7856]] as [number, number][] } }] },
      ],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("parseOsrm", () => {
  it("returns one path per leg with drive minutes", () => {
    const legs = parseOsrm(osrm, 3)!;
    expect(legs).toHaveLength(2);
    expect(legs[0].path[0]).toEqual({ lat: 37.7765, lng: -122.42 }); // OSRM is [lng, lat]
    expect(legs.map((l) => l.driveMin)).toEqual([5, 1]); // at least 1 minute
  });

  it("rejects responses that don't match the stops", () => {
    expect(parseOsrm(osrm, 4)).toBeNull();
    expect(parseOsrm({ code: "NoRoute" }, 3)).toBeNull();
  });
});

describe("straightLegs", () => {
  it("draws a straight line per leg", () => {
    const legs = straightLegs([A, B, C]);
    expect(legs.map((l) => l.path)).toEqual([[A, B], [B, C]]);
    expect(legs.every((l) => l.driveMin >= 1)).toBe(true);
  });
});

describe("fetchRoute", () => {
  it("uses OSRM when it answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(osrm))));
    const route = await fetchRoute([A, B, C]);
    expect(route.approximate).toBe(false);
    expect(route.legs).toHaveLength(2);
  });

  it("falls back to straight lines when OSRM fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const route = await fetchRoute([A, B, C]);
    expect(route.approximate).toBe(true);
    expect(route.legs.map((l) => l.path)).toEqual([[A, B], [B, C]]);
  });

  it("falls back when OSRM is too slow", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("timeout"))))));
    const route = await fetchRoute([A, B], 20);
    expect(route.approximate).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { LOTS, type LatLng } from "../data/lots";
import { distanceMetres, walkMinutes } from "./geo";
import { loadJourney } from "./journey";
import { startTrip, markCurrentFull } from "./trip";

const destination = { lat: 37.7824242, lng: -122.3932435 };

function mockJourney() {
  let parkingTarget: LatLng = destination;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("https://router.project-osrm.org")) {
      const coordinates = new URL(url).pathname.split("/").at(-1)!.split(";").map((point) => point.split(",").map(Number));
      parkingTarget = { lat: coordinates.at(-1)![1], lng: coordinates.at(-1)![0] };
      return Response.json({ code: "Ok", routes: [{ legs: [{ duration: 120, steps: [{ geometry: { coordinates } }] }] }] });
    }
    expect(init?.method).toBe("POST");
    return Response.json({
      frames: [{ ...parkingTarget, walkMin: 99, status: "free_to_park", kind: "parking lane", reason: "An open curb.", box: null, heading: 70, date: "2025-02", photoUrl: "/api/streetview/photo?pano=test&heading=70" }],
      trace: { ms: 1, photos: 1, costUsd: 0 },
    });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("loadJourney", () => {
  it("loads a fresh A-to-B drive and curb analysis, then B-to-C, keeping the meeting fixed", async () => {
    const fetch = mockJourney();
    const destination = { lat: 37.7897, lng: -122.3972 }; // Three or more garages in walking range.
    let trip = startTrip(destination, LOTS);
    for (const label of ["B", "C"]) {
      const from = LOTS.find((lot) => lot.id === trip.chain[trip.currentIndex].id)!;
      trip = markCurrentFull(trip, destination, LOTS);
      const target = LOTS.find((lot) => lot.id === trip.chain[trip.currentIndex].id)!;
      expect(trip.chain[trip.currentIndex].label).toBe(label);
      const journey = await loadJourney(from, target, destination, new AbortController().signal);
      expect(journey.route.legs[0].path[0].lat).toBeCloseTo(from.lat, 5);
      expect(journey.route.legs[0].path.at(-1)!.lng).toBeCloseTo(target.lng, 5);
      expect(journey.frames[0].status).toBe("free_to_park");
      expect(journey.frames[0].walkMin).toBe(walkMinutes(target, destination));
      const lastCall = fetch.mock.calls.at(-1)!;
      expect(lastCall[0]).toBe("/api/curb");
      const points = JSON.parse(lastCall[1]!.body as string).points as (LatLng & { walkMin: number })[];
      expect(points.length).toBeGreaterThan(0);
      expect(points.every((point) => point.walkMin === walkMinutes(point, destination))).toBe(true);
    }
    expect(fetch.mock.calls.filter(([url]) => url === "/api/curb")).toHaveLength(2);
  });

  it("still analyzes routes to backups more than 10 minutes from the meeting", async () => {
    const fetch = mockJourney();
    const from = { lat: 37.7824, lng: -122.407 };
    const target = { lat: 37.7835, lng: -122.4055 };
    await loadJourney(from, target, destination, new AbortController().signal);
    const points = JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string).points;
    expect(points.length).toBeGreaterThan(0);
    expect(points.every((point: { walkMin: number }) => point.walkMin > 10)).toBe(true);
  });

  it("gets a target photo even when the backup is less than 50 metres away", async () => {
    const fetch = mockJourney();
    const target = { lat: destination.lat + 0.0001, lng: destination.lng };
    expect(distanceMetres(destination, target)).toBeLessThan(50);
    await loadJourney(destination, target, destination, new AbortController().signal);
    const points = JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string).points;
    expect(points).toHaveLength(1);
    expect(points[0].lat).toBe(target.lat);
  });

  it("doesn't launch analysis after a reset cancels the drive request", async () => {
    const fetch = mockJourney();
    const request = new AbortController();
    request.abort();
    await expect(loadJourney(LOTS[0], LOTS[1], destination, request.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch.mock.calls.some(([url]) => url === "/api/curb")).toBe(false);
  });

  it("reports an unavailable photo service rather than showing the old analysis", async () => {
    const fetch = mockJourney();
    fetch.mockImplementationOnce(async () => Response.json({ code: "NoRoute" }));
    fetch.mockImplementationOnce(async () => Response.json({ error: "Street View isn't set up" }, { status: 503 }));
    await expect(loadJourney(LOTS[0], LOTS[1], destination, new AbortController().signal)).rejects.toThrow("Street View isn't set up");
  });
});

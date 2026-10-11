import { describe, expect, it } from "vitest";
import { LOTS, MEETING_PLACES } from "../data/lots";
import { markCurrentFull, startTrip, withFullLots } from "./trip";

const salesforce = MEETING_PLACES.find((p) => p.id === "salesforce")!; // 8 lots in range
const frontier = MEETING_PLACES.find((p) => p.id === "frontier")!; // 6 lots in range

describe("markCurrentFull", () => {
  it("moves the snake head from Plan A to Plan B", () => {
    const trip = startTrip(salesforce, LOTS);
    const next = markCurrentFull(trip, salesforce, LOTS);
    expect(next.currentIndex).toBe(1);
    expect(next.fullIds).toEqual([trip.chain[0].id]);
    expect(next.chain.slice(0, 3)).toEqual(trip.chain);
  });

  it("grows the chain with D, E, F before backups run out", () => {
    let trip = startTrip(salesforce, LOTS);
    trip = markCurrentFull(trip, salesforce, LOTS); // A full → B
    expect(trip.chain).toHaveLength(3); // B and C still ahead
    trip = markCurrentFull(trip, salesforce, LOTS); // B full → C, only C ahead
    expect(trip.chain.map((c) => c.label)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(trip.chain[trip.currentIndex].label).toBe("C");
  });

  it("walks A → B → C → D… without repeating a lot, until every lot is full", () => {
    let trip = startTrip(frontier, LOTS);
    const visited: string[] = [];
    for (let i = 0; i < 20 && !trip.exhausted; i++) {
      visited.push(trip.chain[trip.currentIndex].id);
      trip = markCurrentFull(trip, frontier, LOTS);
    }
    expect(trip.exhausted).toBe(true);
    expect(new Set(visited).size).toBe(visited.length);
    expect(visited).toHaveLength(6); // every open lot within walking range of Frontier Tower
  });

  it("does nothing once exhausted", () => {
    const empty = startTrip({ lat: 0, lng: 0 }, LOTS);
    expect(empty.exhausted).toBe(true);
    expect(markCurrentFull(empty, { lat: 0, lng: 0 }, LOTS)).toBe(empty);
  });
});

describe("withFullLots", () => {
  it("marks found-full lots as full for the map", () => {
    const lots = withFullLots(LOTS, ["L4"]);
    expect(lots.find((l) => l.id === "L4")!.status).toBe("full");
    expect(LOTS.find((l) => l.id === "L4")!.status).toBe("open"); // demo data untouched
  });
});

import { describe, expect, it } from "vitest";
import { LOTS, MEETING_PLACES, type Lot } from "../data/lots";
import { buildChain, extendChain, MAX_WALK_MIN, nearestOpenLot, planLabel, rankLots } from "./chain";
import { distanceMetres, walkMinutes } from "./geo";

const frontier = MEETING_PLACES.find((p) => p.id === "frontier")!;
const salesforce = MEETING_PLACES.find((p) => p.id === "salesforce")!; // 8 lots in range

describe("geo", () => {
  it("measures about 111 km per degree of latitude", () => {
    expect(distanceMetres({ lat: 37, lng: -122 }, { lat: 38, lng: -122 })).toBeCloseTo(111_195, -2);
  });

  it("rounds walking time to whole minutes, at least 1", () => {
    expect(walkMinutes(frontier, frontier)).toBe(1);
    expect(walkMinutes({ lat: 0, lng: 0 }, { lat: 0.0072, lng: 0 })).toBe(10); // ~800 m at 80 m/min
  });
});

describe("rankLots", () => {
  const ranked = rankLots(frontier, LOTS);

  it("sorts by shortest walk", () => {
    const metres = ranked.map((r) => r.metres);
    expect(metres).toEqual([...metres].sort((a, b) => a - b));
    expect(ranked[0].lot.id).toBe("L4"); // Fifth & Mission is the closest to Frontier Tower
  });

  it("skips lots that are full or too far to walk", () => {
    const ids = ranked.map((r) => r.lot.id);
    expect(ids).not.toContain("L7"); // full in the data
    expect(ids).not.toContain("L12"); // Mission-Bartlett is ~3 km away
    expect(ranked.every((r) => r.walkMin <= MAX_WALK_MIN)).toBe(true);
  });

  it("breaks distance ties on price", () => {
    const twin = (id: string, pricePerHour: number): Lot => ({
      id, name: id, lat: 37.783, lng: -122.41, pricePerHour, hours: "24h", clearanceInches: 80, status: "open",
    });
    expect(rankLots(frontier, [twin("pricey", 9), twin("cheap", 3)]).map((r) => r.lot.id)).toEqual(["cheap", "pricey"]);
  });
});

describe("buildChain", () => {
  it("labels the three best lots Plan A, B, C", () => {
    const chain = buildChain(frontier, LOTS);
    expect(chain.map((c) => c.label)).toEqual(["A", "B", "C"]);
    expect(chain.map((c) => c.id)).toEqual(rankLots(frontier, LOTS).slice(0, 3).map((r) => r.lot.id));
    expect(chain[0].distance).toBe(`${rankLots(frontier, LOTS)[0].walkMin} min walk`);
  });

  it("returns fewer lots when fewer are in range", () => {
    expect(buildChain({ lat: 0, lng: 0 }, LOTS)).toEqual([]);
  });
});

describe("extendChain", () => {
  it("adds Plan D, E, F without repeating lots or using full ones", () => {
    const chain = buildChain(salesforce, LOTS);
    const fourth = rankLots(salesforce, LOTS)[3].lot.id;
    const grown = extendChain(chain, salesforce, LOTS, [fourth]);
    expect(grown.slice(3).map((c) => c.label)).toEqual(["D", "E", "F"]);
    const ids = grown.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(fourth);
  });

  it("keeps the chain unchanged when nothing is left", () => {
    const everything = extendChain([], frontier, LOTS, [], 100);
    expect(extendChain(everything, frontier, LOTS)).toEqual(everything);
  });
});

describe("nearestOpenLot", () => {
  it("names the closest open lot even beyond walking range", () => {
    const far = { lat: 37.73, lng: -122.45 }; // Glen Park, ~4 km from the nearest garage
    expect(buildChain(far, LOTS)).toEqual([]);
    expect(nearestOpenLot(far, LOTS)!.lot.id).toBe("L12");
  });
});

describe("planLabel", () => {
  it("goes A…Z then AA", () => {
    expect([0, 1, 25, 26, 27].map(planLabel)).toEqual(["A", "B", "Z", "AA", "AB"]);
  });
});

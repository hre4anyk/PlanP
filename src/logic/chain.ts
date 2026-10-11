import type { LatLng, Lot } from "../data/lots";
import { distanceMetres, walkMinutes } from "./geo";

/** Lots more than this many minutes' walk from the meeting are ignored (PRD F8). */
export const MAX_WALK_MIN = 15;
export const CHAIN_SIZE = 3;

export type RankedLot = { lot: Lot; walkMin: number; metres: number };
/** Shared with Park me and the Anbaric engine (ARCHITECTURE §3). `distance` is display text: "5 min walk". */
export type ChainItem = { id: string; label: string; distance: string; reason: string };

/** Plan A, B, … Z, then AA, AB … so the chain can keep growing. */
export function planLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * Deterministic core of the backup chain: open lots within walking range,
 * shortest walk first (exact distance, ties broken by price). This is the planner's input and its fallback.
 */
export function rankLots(destination: LatLng, lots: Lot[], excludeIds: Iterable<string> = []): RankedLot[] {
  const excluded = new Set(excludeIds);
  return lots
    .filter((lot) => lot.status === "open" && !excluded.has(lot.id))
    .map((lot) => ({ lot, walkMin: walkMinutes(lot, destination), metres: distanceMetres(lot, destination) }))
    .filter((r) => r.walkMin <= MAX_WALK_MIN)
    .sort((a, b) => a.metres - b.metres || a.lot.pricePerHour - b.lot.pricePerHour);
}

function toItem(r: RankedLot, index: number): ChainItem {
  return {
    id: r.lot.id,
    label: planLabel(index),
    distance: `${r.walkMin} min walk`,
    reason: index === 0 ? "Shortest walk to your meeting" : "Backup: next shortest walk",
  };
}

/** Plan A, B, C: the top of the ranking. */
export function buildChain(destination: LatLng, lots: Lot[], size = CHAIN_SIZE): ChainItem[] {
  return rankLots(destination, lots).slice(0, size).map(toItem);
}

/**
 * Grow the chain when it runs out (PRD F10): the next best lots not already in it
 * and not known to be full, labelled after the last one (D, E, F…).
 */
export function extendChain(
  chain: ChainItem[],
  destination: LatLng,
  lots: Lot[],
  fullIds: Iterable<string> = [],
  size = CHAIN_SIZE,
): ChainItem[] {
  const used = [...chain.map((c) => c.id), ...fullIds];
  const next = rankLots(destination, lots, used)
    .slice(0, size)
    .map((r, i) => toItem(r, chain.length + i));
  return [...chain, ...next];
}

/** The closest open lot regardless of walking range, so an empty chain can still say what's nearest. */
export function nearestOpenLot(destination: LatLng, lots: Lot[]): RankedLot | undefined {
  return lots
    .filter((lot) => lot.status === "open")
    .map((lot) => ({ lot, walkMin: walkMinutes(lot, destination), metres: distanceMetres(lot, destination) }))
    .sort((a, b) => a.metres - b.metres)[0];
}

import type { LatLng, Lot } from "../data/lots";
import { buildChain, extendChain, type ChainItem } from "./chain";

export type Trip = {
  chain: ChainItem[];
  currentIndex: number;
  fullIds: string[];
  /** True when every lot in walking range is full. */
  exhausted: boolean;
};

export function startTrip(destination: LatLng, lots: Lot[]): Trip {
  const chain = buildChain(destination, lots);
  return { chain, currentIndex: 0, fullIds: [], exhausted: chain.length === 0 };
}

/**
 * "Lot is full" (PRD F10): mark the current lot full and move the snake head to the next plan.
 * When fewer than two plans are left ahead, the chain grows (D, E, F…) so there is always a backup.
 */
export function markCurrentFull(trip: Trip, destination: LatLng, lots: Lot[]): Trip {
  const current = trip.chain[trip.currentIndex];
  if (!current || trip.exhausted) return trip;

  const fullIds = [...trip.fullIds, current.id];
  const currentIndex = trip.currentIndex + 1;
  const ahead = trip.chain.length - currentIndex;
  const chain = ahead < 2 ? extendChain(trip.chain, destination, lots, fullIds) : trip.chain;

  return { chain, currentIndex, fullIds, exhausted: currentIndex >= chain.length };
}

/** Lots as the map should show them: the demo data plus whatever the driver found full. */
export function withFullLots(lots: Lot[], fullIds: string[]): Lot[] {
  if (fullIds.length === 0) return lots;
  const full = new Set(fullIds);
  return lots.map((lot) => (full.has(lot.id) ? { ...lot, status: "full" } : lot));
}

import type { LatLng } from "../data/lots";

/** Walking speed from the PRD (F8): 80 metres per minute. */
export const WALK_METRES_PER_MIN = 80;

/** Straight-line distance in metres (haversine). */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Whole walking minutes, at least 1. */
export function walkMinutes(a: LatLng, b: LatLng): number {
  return Math.max(1, Math.round(distanceMetres(a, b) / WALK_METRES_PER_MIN));
}

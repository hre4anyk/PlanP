import type { LatLng } from "../data/lots";
import { distanceMetres, walkMinutes } from "./geo";

/** A place along the route to look at in Street View, facing the way you drive. */
export type StretchPoint = LatLng & { bearing: number; walkMin: number };

/** Compass bearing from a to b, degrees 0–360 (0 = north). */
export function bearing(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * The last stretch of the drive, where street parking is useful: points every `spacingM` metres
 * along the route, only within `maxWalkMin` of the meeting, in driving order, at most `maxPoints`.
 */
export function sampleStretch(
  path: LatLng[],
  destination: LatLng,
  { spacingM = 50, maxWalkMin = 10, maxPoints = 16 } = {},
): StretchPoint[] {
  const points: StretchPoint[] = [];
  let carried = 0; // metres since the last sample
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = distanceMetres(a, b);
    if (seg === 0) continue;
    const dir = bearing(a, b);
    let at = spacingM - carried;
    while (at <= seg) {
      const t = at / seg;
      const p = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
      const walkMin = walkMinutes(p, destination);
      if (walkMin <= maxWalkMin) points.push({ ...p, bearing: dir, walkMin });
      at += spacingM;
    }
    carried = (carried + seg) % spacingM;
  }
  // Keep the points nearest the meeting (the end of the drive), still in driving order.
  return points.slice(-maxPoints);
}

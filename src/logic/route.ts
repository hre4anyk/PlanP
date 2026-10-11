import type { LatLng } from "../data/lots";
import { distanceMetres } from "./geo";

/** One leg of the snake: from one stop to the next. */
export type Leg = { path: LatLng[]; driveMin: number };
export type Route = { legs: Leg[]; approximate: boolean };

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
export const ROUTE_TIMEOUT_MS = 5000;
/** Straight-line fallback assumes slow downtown driving. */
const FALLBACK_KMH = 18;

type OsrmResponse = {
  code: string;
  routes?: { legs: { duration: number; steps: { geometry: { coordinates: [number, number][] } }[] }[] }[];
};

/** Turn an OSRM response into one path per leg. Returns null if it isn't usable. */
export function parseOsrm(data: OsrmResponse, stopCount: number): Leg[] | null {
  const legs = data.code === "Ok" ? data.routes?.[0]?.legs : undefined;
  if (!legs || legs.length !== stopCount - 1) return null;
  return legs.map((leg) => ({
    path: leg.steps.flatMap((step) => step.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))),
    driveMin: Math.max(1, Math.round(leg.duration / 60)),
  }));
}

/** Straight lines between stops, used when OSRM is slow or down (PRD F9). */
export function straightLegs(stops: LatLng[]): Leg[] {
  return stops.slice(1).map((to, i) => {
    const from = stops[i];
    const km = distanceMetres(from, to) / 1000;
    return { path: [from, to], driveMin: Math.max(1, Math.round((km / FALLBACK_KMH) * 60)) };
  });
}

/** One driving route through every stop in order: Start → A → B → C … */
export async function fetchRoute(stops: LatLng[], timeoutMs = ROUTE_TIMEOUT_MS): Promise<Route> {
  if (stops.length < 2) return { legs: [], approximate: false };
  const coords = stops.map((s) => `${s.lng.toFixed(6)},${s.lat.toFixed(6)}`).join(";");
  try {
    const res = await fetch(`${OSRM_URL}/${coords}?overview=false&steps=true&geometries=geojson`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const legs = res.ok ? parseOsrm(await res.json(), stops.length) : null;
    if (legs) return { legs, approximate: false };
  } catch {
    // timeout or network error: fall through to straight lines
  }
  return { legs: straightLegs(stops), approximate: true };
}

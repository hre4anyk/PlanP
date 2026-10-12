import type { CurbFrame } from "../components/street-journey";
import type { LatLng } from "../data/lots";
import { walkMinutes } from "./geo";
import { fetchRoute } from "./route";
import { bearing, sampleStretch } from "./stretch";

export type JourneyTrace = { ms: number; photos: number; costUsd: number; precomputed?: boolean };

/** Photograph the active drive, but always measure the walk to the original meeting. */
export async function loadJourney(
  from: LatLng,
  target: LatLng,
  destination: LatLng,
  signal: AbortSignal,
  onProgress?: (step: { photos: number }) => void,
) {
  const route = await fetchRoute([from, target]);
  signal.throwIfAborted();
  // Backups can be up to 15 minutes from the meeting. Don't lose their Street View at 10 minutes.
  const points = sampleStretch(route.legs.flatMap((leg) => leg.path), destination, { maxWalkMin: Infinity, maxPoints: 20 });
  // Even a drive shorter than the sample spacing needs a photo at its parking target.
  if (!points.length) points.push({ ...target, bearing: bearing(from, target), walkMin: walkMinutes(target, destination) });
  onProgress?.({ photos: points.length });
  const res = await fetch("/api/curb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ points }),
    signal,
  });
  const data = await res.json();
  signal.throwIfAborted();
  if (!res.ok) throw new Error(data.error || "Street View is unavailable.");
  if (!data.frames?.length) throw new Error("No Street View photos along this stretch.");
  // Google may snap the sampled location to a nearby panorama; use its actual coordinates.
  const frames = (data.frames as CurbFrame[]).map((frame) => ({ ...frame, walkMin: walkMinutes(frame, destination) }));
  return { route, frames, trace: data.trace as JourneyTrace };
}

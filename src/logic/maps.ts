import type { LatLng } from "@/data/lots";

/** Apple Maps driving-directions URL. */
export function appleMapsUrl(dest: LatLng, mode: "driving" | "walking" = "driving"): string {
  const params = new URLSearchParams({
    daddr: `${dest.lat},${dest.lng}`,
    dirflg: mode === "walking" ? "w" : "d",
  });
  return `https://maps.apple.com/?${params}`;
}

/** Google Maps directions URL. */
export function googleMapsUrl(dest: LatLng, mode: "driving" | "walking" = "driving"): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${dest.lat},${dest.lng}`,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

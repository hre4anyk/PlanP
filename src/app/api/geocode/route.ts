// Address search for the meeting place, limited to San Francisco.
// Google Geocoding first (exact street addresses, e.g. the right "2 S Park St"); OpenStreetMap's
// Nominatim as the free fallback. Nominatim asks for an identifying User-Agent and ≤ 1 request a second.

const SF_VIEWBOX = "-122.52,37.83,-122.35,37.70";
const inSf = (lat: number, lng: number) => lat > 37.7 && lat < 37.83 && lng > -122.52 && lng < -122.35;

type Place = { name: string; lat: number; lng: number };
type GoogleResult = { formatted_address: string; geometry: { location: { lat: number; lng: number } } };
type NominatimResult = { display_name: string; lat: string; lon: string };

async function google(q: string): Promise<Place[] | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.search = new URLSearchParams({ address: q, components: "locality:San Francisco|country:US", bounds: "37.70,-122.52|37.83,-122.35", key }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { status: string; results: GoogleResult[] };
  if (data.status !== "OK") return data.status === "ZERO_RESULTS" ? [] : null;
  return data.results
    .map((r) => ({ name: r.formatted_address.replace(/, USA$/, ""), ...r.geometry.location }))
    .filter((p) => inSf(p.lat, p.lng));
}

async function nominatim(q: string): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ format: "jsonv2", q, viewbox: SF_VIEWBOX, bounded: "1", limit: "5" }).toString();
  const res = await fetch(url, {
    headers: { "User-Agent": "PlanP/1.0 (https://getplanp.netlify.app)", "Accept-Language": "en" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error("nominatim");
  const data = (await res.json()) as NominatimResult[];
  // "1, Market Street, Financial District, San Francisco, …" → first three parts read well.
  return data.map((r) => ({ name: r.display_name.split(", ").slice(0, 3).join(", "), lat: Number(r.lat), lng: Number(r.lon) }));
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) return Response.json({ results: [] });
  try {
    const results = (await google(q).catch(() => null)) ?? (await nominatim(q));
    return Response.json({ results: results.slice(0, 5) });
  } catch {
    return Response.json({ error: "Address search is unavailable right now" }, { status: 502 });
  }
}

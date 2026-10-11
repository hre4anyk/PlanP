// Address search for the meeting place, limited to San Francisco (PRD S1).
// OpenStreetMap's Nominatim: free, no key. Its usage policy asks for an identifying User-Agent
// and at most one request a second, which a person typing an address never exceeds.

const SF_VIEWBOX = "-122.52,37.83,-122.35,37.70";

type NominatimResult = { display_name: string; lat: string; lon: string; name?: string };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) return Response.json({ results: [] });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ format: "jsonv2", q, viewbox: SF_VIEWBOX, bounded: "1", limit: "5" }).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PlanP/1.0 (https://getplanp.netlify.app)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return Response.json({ error: "Address search is unavailable right now" }, { status: 502 });
    const data = (await res.json()) as NominatimResult[];
    return Response.json({
      results: data.map((r) => {
        // "1, Market Street, Financial District, San Francisco, …" → first three parts read well.
        const parts = r.display_name.split(", ");
        return { name: parts.slice(0, 3).join(", "), lat: Number(r.lat), lng: Number(r.lon) };
      }),
    });
  } catch {
    return Response.json({ error: "Address search is unavailable right now" }, { status: 502 });
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { BRAIN_MODEL } from "@/ai/models";

// Where is he going? (founder: "use Claude to figure out what the user said"). Google Places finds
// the candidates in San Francisco ("Blue Bottle Coffee" → 8 cafés); Claude reads what he said
// against them and decides: one clear match, or ask which one, naming each so it's easy to answer
// by voice. Falls back to the plain address search when Places or Claude is unavailable.

const client = new Anthropic();
const SF = {
  low: { latitude: 37.7, longitude: -122.52 },
  high: { latitude: 37.83, longitude: -122.35 },
};

type Candidate = {
  name: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
};
type GooglePlace = {
  displayName?: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  addressComponents?: { shortText: string; types: string[] }[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "best", "options"],
  properties: {
    decision: {
      type: "string",
      enum: ["one", "choose", "none"],
      description: "one: a single place clearly matches; choose: several plausible places, ask him; none: nothing matches",
    },
    best: {
      type: "integer",
      description: "Index of the matching place when decision is one, else -1",
    },
    options: {
      type: "array",
      description: "When decision is choose: up to 4 places to offer, most likely first",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "label"],
        properties: {
          index: { type: "integer" },
          label: {
            type: "string",
            description: "Short spoken label that tells them apart, e.g. 'the Ferry Building one' or 'on Mint Plaza in SoMa'",
          },
        },
      },
    },
  },
} as const;

async function searchPlaces(q: string): Promise<Candidate[] | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: q,
      locationRestriction: { rectangle: SF },
      pageSize: 8,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { places?: GooglePlace[] };
  return (data.places ?? []).map((p) => ({
    name: p.displayName?.text ?? p.formattedAddress,
    address: p.formattedAddress.replace(/, San Francisco, CA \d{5}, USA$/, "").replace(/, USA$/, ""),
    area: p.addressComponents?.find((c) => c.types.includes("neighborhood"))?.shortText ?? "",
    lat: p.location.latitude,
    lng: p.location.longitude,
  }));
}

async function resolve(said: string, candidates: Candidate[]) {
  const list = candidates.map((c, i) => `${i}. ${c.name}, ${c.address}${c.area ? ` (${c.area})` : ""}`).join("\n");
  const response = await client.messages.create({
    model: BRAIN_MODEL,
    max_tokens: 1000,
    system:
      "A driver in San Francisco told his voice copilot where he's going (transcribed from speech, so expect small errors). " +
      "Match it against the search results. If he named a specific address or a place with one location, or added a street or neighbourhood that singles one out, decide one. " +
      "If several results fit (a chain like a coffee shop with many branches), decide choose and offer the likeliest few with short spoken labels. If nothing fits, decide none.",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [
      {
        role: "user",
        content: `He said: "${said}"\n\nSearch results:\n${list}`,
      },
    ],
  });
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return JSON.parse(text) as {
    decision: "one" | "choose" | "none";
    best: number;
    options: { index: number; label: string }[];
  };
}

const place = (c: Candidate) => ({
  name: c.name === c.address ? c.address : `${c.name}, ${c.address}`,
  area: c.area,
  lat: c.lat,
  lng: c.lng,
});

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) return Response.json({ decision: "none", options: [] });

  const candidates = await searchPlaces(q).catch(() => null);
  if (!candidates) {
    // No Places: the plain address search (Google Geocoding, then OpenStreetMap).
    const res = await fetch(new URL(`/api/geocode?q=${encodeURIComponent(q)}`, req.url)).catch(() => null);
    const data = res?.ok ? await res.json() : { results: [] };
    return Response.json(data.results?.length ? { decision: "one", place: data.results[0], via: "geocode" } : { decision: "none", options: [] });
  }
  if (candidates.length === 0) return Response.json({ decision: "none", options: [] });
  if (candidates.length === 1)
    return Response.json({
      decision: "one",
      place: place(candidates[0]),
      via: "places",
    });

  try {
    const r = await resolve(q, candidates);
    if (r.decision === "one" && candidates[r.best])
      return Response.json({
        decision: "one",
        place: place(candidates[r.best]),
        via: "claude",
      });
    if (r.decision === "choose") {
      const options = r.options
        .filter((o) => candidates[o.index])
        .slice(0, 4)
        .map((o) => ({ label: o.label, ...place(candidates[o.index]) }));
      if (options.length > 1) return Response.json({ decision: "choose", options, via: "claude" });
      if (options.length === 1)
        return Response.json({
          decision: "one",
          place: options[0],
          via: "claude",
        });
    }
    return Response.json({ decision: "none", options: [] });
  } catch (e) {
    console.error("place: Claude failed", e instanceof Error ? e.message : e);
    // Claude unavailable: same name everywhere means a chain, so ask; otherwise take the top result.
    const sameName = candidates.every((c) => c.name === candidates[0].name);
    return sameName
      ? Response.json({
          decision: "choose",
          options: candidates.slice(0, 4).map((c) => ({ label: c.area || c.address, ...place(c) })),
          via: "places",
        })
      : Response.json({
          decision: "one",
          place: place(candidates[0]),
          via: "places",
        });
  }
}

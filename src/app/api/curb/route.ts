import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BRAIN_MODEL, STREET_VIEW_USD_PER_PHOTO, costUsd } from "@/ai/models";

// S2: Street View photos along the last stretch → Claude reads each for parking rules on the
// right-hand curb (ARCHITECTURE §5). Street View isn't live: this says where parking is allowed,
// not whether a space is free right now.

const client = new Anthropic();
const BATCH = 6;
/** Look a little right of straight ahead, the way a driver glances at the curb. */
const CURB_GLANCE_DEG = 25;

const Point = z.object({ lat: z.number(), lng: z.number(), bearing: z.number(), walkMin: z.number() });
const Body = z.object({ points: z.array(Point).min(1).max(20) });

const Verdicts = z.object({
  photos: z.array(
    z.object({
      photo: z.number().describe("The photo number, 1-based"),
      status: z.enum(["free_to_park", "cant_park", "occupied"]).describe(
        "free_to_park = parking is allowed AND the curb space is empty (no cars parked there). " +
        "cant_park = parking is NOT allowed (red curb, fire hydrant, driveway, bus stop, no parking sign, etc.). " +
        "occupied = parking is allowed but every space along this curb is taken by parked cars."
      ),
      kind: z.string().describe("Two to four words: 'metered parking', '2-hour zone', 'free parking', 'red curb', 'driveway', 'bus stop', 'no curb visible'"),
      reason: z.string().describe("One short sentence on what you see that decides it"),
      box: z
        .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
        .nullable()
        .describe("The stretch of right-hand curb you judged, in 0-1 image coordinates; null if no curb is visible"),
    }),
  ),
});

const PROMPT = `You are the eyes of Plan P, which helps a stressed driver find street parking near a meeting in San Francisco.
Each photo is Google Street View, taken from the road looking ahead and slightly right. Look at the RIGHT-hand curb only.
For each photo, classify the right-hand curb into exactly one of three states:

1. "free_to_park" — Parking is allowed here (parking lane, meters, time-limit zone, unpainted curb with no restrictions) AND the curb space is empty or has room for a car to park. No cars are currently parked there, or there is visible open space.
2. "cant_park" — Parking is NOT allowed here. Red curb, fire hydrant, driveway, bus stop, crosswalk, loading zone (yellow), tow-away signs, "no parking" signs, or no curb visible.
3. "occupied" — Parking IS allowed here (it's a legal parking zone) but every space along this curb is taken by parked cars. There is no room for another car.

Look carefully at whether cars are actually parked along the curb to distinguish "free_to_park" from "occupied".
These photos may be months or years old; judge what you see in each photo.`;

type Meta = { status: string; pano_id?: string; date?: string; copyright?: string; location?: { lat: number; lng: number } };

/** Google's own street-car imagery; photos uploaded by the public are often sideways, indoors or off-road. */
const isGoogleCar = (m: Meta) => (m.copyright ?? "").includes("Google");

async function metadata(p: { lat: number; lng: number }, key: string): Promise<Meta> {
  const url = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
  url.search = new URLSearchParams({ location: `${p.lat},${p.lng}`, radius: "25", source: "outdoor", key }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  return res.ok ? res.json() : { status: "ERROR" };
}

async function photo(pano: string, heading: number, key: string): Promise<string | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/streetview");
  url.search = new URLSearchParams({ size: "640x400", pano, heading: String(Math.round(heading)), fov: "90", pitch: "-5", return_error_code: "true", key }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return res.ok ? Buffer.from(await res.arrayBuffer()).toString("base64") : null;
}

export async function POST(req: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return Response.json({ error: "Street View isn't set up (GOOGLE_MAPS_API_KEY missing)" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const started = Date.now();

  // 1. Which points have a Street View photo (metadata is free), one per panorama.
  const metas = await Promise.all(parsed.data.points.map((p) => metadata(p, key).catch(() => ({ status: "ERROR" }) as Meta)));
  const seen = new Set<string>();
  const frames = parsed.data.points
    .map((p, i) => ({ point: p, meta: metas[i] }))
    .filter(({ meta }) => meta.status === "OK" && isGoogleCar(meta) && meta.pano_id && !seen.has(meta.pano_id) && seen.add(meta.pano_id))
    .map(({ point, meta }) => ({
      lat: meta.location?.lat ?? point.lat,
      lng: meta.location?.lng ?? point.lng,
      walkMin: point.walkMin,
      heading: (point.bearing + CURB_GLANCE_DEG) % 360,
      panoId: meta.pano_id!,
      date: meta.date ?? "",
    }));
  if (!frames.length) return Response.json({ frames: [], trace: { ms: Date.now() - started, costUsd: 0, photos: 0 } });

  // 2. The photos themselves, then Claude reads them in small batches, in parallel.
  const images = await Promise.all(frames.map((f) => photo(f.panoId, f.heading, key).catch(() => null)));
  const usable = frames.map((f, i) => ({ ...f, image: images[i] })).filter((f) => f.image);
  let tokensIn = 0;
  let tokensOut = 0;
  const batches: (typeof usable)[] = [];
  for (let i = 0; i < usable.length; i += BATCH) batches.push(usable.slice(i, i + BATCH));

  const verdicts = await Promise.all(
    batches.map(async (batch) => {
      try {
        const response = await client.beta.messages.parse({
          model: BRAIN_MODEL,
          max_tokens: 4000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low", format: betaZodOutputFormat(Verdicts) },
          system: PROMPT,
          messages: [
            {
              role: "user",
              content: batch.flatMap((f, i) => [
                { type: "text" as const, text: `Photo ${i + 1}:` },
                { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: f.image! } },
              ]),
            },
          ],
        });
        tokensIn += response.usage.input_tokens;
        tokensOut += response.usage.output_tokens;
        return response.parsed_output?.photos ?? [];
      } catch {
        return [];
      }
    }),
  );

  const result = usable.map((f, i) => {
    const batch = Math.floor(i / BATCH);
    const v = verdicts[batch].find((p) => p.photo === (i % BATCH) + 1);
    return {
      lat: f.lat,
      lng: f.lng,
      walkMin: f.walkMin,
      heading: f.heading,
      date: f.date,
      photoUrl: `/api/streetview/photo?pano=${encodeURIComponent(f.panoId)}&heading=${Math.round(f.heading)}`,
      status: v?.status ?? "cant_park",
      kind: v?.kind ?? "not checked",
      reason: v?.reason ?? "Claude couldn't read this photo.",
      box: v?.box ?? null,
    };
  });

  return Response.json({
    frames: result,
    trace: {
      ms: Date.now() - started,
      photos: usable.length,
      costUsd: costUsd(BRAIN_MODEL, tokensIn, tokensOut) + usable.length * STREET_VIEW_USD_PER_PHOTO,
    },
  });
}

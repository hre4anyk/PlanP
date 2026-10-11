// Street View photo proxy, so the Google key never reaches the browser (ARCHITECTURE §7).

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const pano = params.get("pano") ?? "";
  const heading = Number(params.get("heading"));
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !/^[\w-]{10,100}$/.test(pano) || !Number.isFinite(heading)) {
    return new Response("Bad request", { status: 400 });
  }
  const url = new URL("https://maps.googleapis.com/maps/api/streetview");
  url.search = new URLSearchParams({
    size: "640x400",
    pano,
    heading: String(Math.round(heading)),
    fov: "90",
    pitch: "-5",
    return_error_code: "true",
    key,
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return new Response("No photo", { status: 404 });
  return new Response(res.body, {
    headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400, immutable" },
  });
}

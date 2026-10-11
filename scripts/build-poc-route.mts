// Builds the demo route once (PRD S2b): 995 Market St → 2 S Park St.
// Driving route (OSRM) → a point every 40 m along the whole drive → Street View + Claude verdicts via
// the running app's /api/curb → src/data/poc-route.json. Photo IDs and verdicts are saved; the photos
// themselves are always loaded live through /api/streetview/photo (Google doesn't allow storing them).
// Run with the dev server up:  npx tsx scripts/build-poc-route.mts
import { writeFileSync } from "node:fs";
import { fetchRoute } from "../src/logic/route";
import { sampleStretch } from "../src/logic/stretch";

const START = { name: "995 Market St (Frontier Tower)", lat: 37.7822426, lng: -122.4099718 };
const MEETING = { name: "2 S Park St (VC meeting)", lat: 37.7824242, lng: -122.3932435 };
const APP = process.env.APP_URL ?? "http://localhost:3000";

const route = await fetchRoute([START, MEETING], 15000);
if (route.approximate) throw new Error("OSRM didn't answer; try again");
const path = route.legs.flatMap((l) => l.path);
const points = sampleStretch(path, MEETING, { spacingM: 40, maxWalkMin: 999, maxPoints: 80 });
console.log(`route: ${route.legs[0].driveMin} min, ${path.length} path points, ${points.length} samples`);

const frames: { photoUrl: string; status: string }[] = [];
let cost = 0;
for (let i = 0; i < points.length; i += 20) {
  const res = await fetch(`${APP}/api/curb`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ points: points.slice(i, i + 20) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  frames.push(...data.frames);
  cost += data.trace.costUsd;
  console.log(`  batch ${i / 20 + 1}: ${data.frames.length} photos, ${(data.trace.ms / 1000).toFixed(1)} s`);
}
// Batches can overlap at their edges: one frame per photo.
const unique = frames.filter((f, i) => frames.findIndex((g) => g.photoUrl === f.photoUrl) === i);

writeFileSync(
  "src/data/poc-route.json",
  JSON.stringify({ start: START, meeting: MEETING, driveMin: route.legs[0].driveMin, path, frames: unique, builtAt: new Date().toISOString(), buildCostUsd: Number(cost.toFixed(3)) }, null, 1),
);
const tally = (k: string) => unique.filter((f) => f.status === k).length;
console.log(`saved ${unique.length} frames: ${tally("free_to_park")} free to park, ${tally("cant_park")} can't park, ${tally("occupied")} occupied; cost $${cost.toFixed(2)}`);

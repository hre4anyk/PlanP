import { SecretStoreFactory, SystemActor } from "anbaric";
import { appActor, persistence, reviews, trips } from "./machines.js";

// Anbaric apps sit behind Anbaric's login, so the Plan P website can't call this engine directly.
// Instead the engine calls out: it polls each site's queue (/api/engine/queue), runs the work as
// audited Anbaric jobs, and posts the results back (/api/engine/result).

type Item = { id: string; kind: "trip_start" | "trip_arrived" | "answer"; payload: Record<string, unknown> };

const secrets = SecretStoreFactory.instance();
const token = await secrets.retrieve("engine-token", SystemActor.actor);
const sites = (await secrets.retrieve("site-urls", SystemActor.actor)).split(",").map((s) => s.trim()).filter(Boolean);
const POLL_MS = 500;
const SCORE_TIMEOUT_MS = 25_000;

/** tripRef (from the website) → Anbaric job id. */
const tripJobs = new Map<string, string>();

async function waitForScore(jobId: string) {
  const deadline = Date.now() + SCORE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const job = await persistence.retrieve(jobId, SystemActor.actor);
    if (job.state === "scored") {
      return { score: await job.properties.get("score"), strong: await job.properties.get("strong"), fix: await job.properties.get("fix"), jobId };
    }
    if (job.status === "Failed") throw new Error("Scoring failed");
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Scoring took too long");
}

async function handle(item: Item): Promise<unknown> {
  const p = item.payload;
  if (item.kind === "trip_start") {
    const props = new Map<string, unknown>([["destination", String(p.destination ?? "unknown")]]);
    if (p.tripRef) props.set("tripRef", String(p.tripRef));
    if (p.meetingTime) props.set("meetingTime", String(p.meetingTime));
    const job = await trips.startJob(props, appActor);
    if (p.tripRef) tripJobs.set(String(p.tripRef), job.id);
    return { jobId: job.id };
  }
  if (item.kind === "trip_arrived") {
    const jobId = tripJobs.get(String(p.tripRef ?? ""));
    if (!jobId) return { error: "unknown trip" };
    const props = new Map<string, unknown>([["arrived", true]]);
    if (typeof p.averageScore === "number") props.set("averageScore", p.averageScore);
    await trips.updateJob(jobId, props, appActor);
    return { ok: true };
  }
  const props = new Map<string, unknown>([
    ["questionNumber", Number(p.questionNumber)],
    ["question", String(p.question ?? "")],
    ["answer", String(p.answer ?? "")],
  ]);
  const tripId = tripJobs.get(String(p.tripRef ?? ""));
  if (tripId) props.set("tripId", tripId);
  const job = await reviews.startJob(props, appActor);
  return waitForScore(job.id);
}

async function pollSite(site: string) {
  const res = await fetch(`${site}/api/engine/queue`, { headers: { "x-planp-token": token }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return;
  const { items } = (await res.json()) as { items: Item[] };
  await Promise.all(
    items.map(async (item) => {
      let result: unknown;
      try {
        result = await handle(item);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : "engine error" };
      }
      await fetch(`${site}/api/engine/result`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-planp-token": token },
        body: JSON.stringify({ id: item.id, result }),
      }).catch(() => {});
    }),
  );
}

export function startRelay() {
  console.log(`relay polling ${sites.length} site(s): ${sites.join(", ")}`);
  for (const site of sites) {
    const loop = async () => {
      try {
        await pollSite(site);
      } catch {
        // site unreachable for a moment; keep polling
      }
      setTimeout(loop, POLL_MS);
    };
    void loop();
  }
}

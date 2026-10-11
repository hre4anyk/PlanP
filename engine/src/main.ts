import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SecretStoreFactory, SystemActor } from "anbaric";
import { appActor, persistence, reviews, trips } from "./machines.js";
import { startRelay } from "./relay.js";

// HTTP endpoints (usable from inside the Anbaric tenant; the public website reaches the engine
// through the relay in relay.ts, because Anbaric apps sit behind Anbaric's login).
//   GET  /health
//   POST /trips                {destination, meetingTime?}            → {id}
//   POST /trips/:id/arrived    {averageScore?}                         → {ok}
//   POST /answers              {tripId?, questionNumber, question, answer} → {score, strong, fix, jobId}

const token = await SecretStoreFactory.instance().retrieve("engine-token", SystemActor.actor);
const SCORE_TIMEOUT_MS = 25_000;

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/** Wait for Claude's scoring action to move the review to "scored". */
async function waitForScore(jobId: string) {
  const deadline = Date.now() + SCORE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const job = await persistence.retrieve(jobId, SystemActor.actor);
    if (job.state === "scored") {
      return {
        score: await job.properties.get("score"),
        strong: await job.properties.get("strong"),
        fix: await job.properties.get("fix"),
        jobId,
      };
    }
    if (job.status === "Failed") throw new Error("Scoring failed");
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Scoring took too long");
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://engine");
  try {
    if (url.pathname === "/health") return send(res, 200, { ok: true });
    if (req.headers["x-planp-token"] !== token) return send(res, 401, { error: "unauthorised" });
    if (req.method !== "POST") return send(res, 405, { error: "POST only" });
    const body = await readJson(req);

    if (url.pathname === "/trips") {
      const props = new Map<string, unknown>([["destination", String(body.destination ?? "")]]);
      if (body.meetingTime) props.set("meetingTime", String(body.meetingTime));
      const job = await trips.startJob(props, appActor);
      return send(res, 200, { id: job.id });
    }

    const arrived = url.pathname.match(/^\/trips\/([\w-]+)\/arrived$/);
    if (arrived) {
      const props = new Map<string, unknown>([["arrived", true]]);
      if (typeof body.averageScore === "number") props.set("averageScore", body.averageScore);
      await trips.updateJob(arrived[1], props, appActor);
      return send(res, 200, { ok: true });
    }

    if (url.pathname === "/answers") {
      const props = new Map<string, unknown>([
        ["questionNumber", Number(body.questionNumber)],
        ["question", String(body.question ?? "")],
        ["answer", String(body.answer ?? "")],
      ]);
      if (body.tripId) props.set("tripId", String(body.tripId));
      const job = await reviews.startJob(props, appActor);
      return send(res, 200, await waitForScore(job.id));
    }

    return send(res, 404, { error: "not found" });
  } catch (e) {
    return send(res, 500, { error: e instanceof Error ? e.message : "engine error" });
  }
}).listen(Number(process.env.PORT ?? 3000));

console.log(`planp-engine listening on ${process.env.PORT ?? 3000}`);
startRelay();

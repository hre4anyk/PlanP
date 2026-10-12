import {
  Agent, Code, JobPersistenceFactory, PropertyDefinition, RemoteLLMAgenticAction, SecretStoreFactory,
  State, StateMachine, SystemActor, Terminal, Transition,
} from "anbaric";
import { ClaudeClient } from "./claude.js";

// Plan P's trip engine on Anbaric (ARCHITECTURE §5 S4): every drive and every scored pitch answer is
// an audited job, so the console shows each question, answer, score and which model decided it.

export const persistence = JobPersistenceFactory.instance();

const prop = (id: string, required = false, validation?: (v: unknown) => boolean) => {
  const p = new PropertyDefinition(id);
  p.required = required;
  if (validation) p.validation = validation;
  return p;
};
const isText = (v: unknown) => typeof v === "string" && v.length > 0 && v.length < 5000;
const isNumber = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** trip: driving → arrived. The app marks arrival when the drive reaches the meeting. */
export const trips = new StateMachine(
  "trip",
  [
    new State("driving", [], [new Transition("arrived", async (job) => (await job.properties.get("arrived")) === true)]),
    new Terminal("arrived", Terminal.Outcome.SUCCESS),
  ],
  "driving",
  [
    prop("tripRef", false, isText),
    prop("destination", true, isText),
    prop("meetingTime"),
    prop("arrived", false, (v) => typeof v === "boolean"),
    prop("averageScore", false, isNumber),
  ],
  persistence,
);

// The key lives in Anbaric's secret store (locally: ANTHROPIC_KEY in the environment).
const secrets = SecretStoreFactory.instance();
const apiKey = await secrets.retrieve("anthropic-key", SystemActor.actor);
const coach = new Agent("claude-coach", "pitch-coach", new ClaudeClient(apiKey));

const SCORE = new RemoteLLMAgenticAction(
  "Score the pitch answer",
  coach,
  [
    {
      role: "system",
      content: `You are a partner with 20 years of venture experience coaching a defense-tech founder minutes before an investor meeting.
Score his spoken answer to the question (it was transcribed from speech, so ignore filler words) on clarity, proof and confidence.
Be direct and specific to what he said. "strong" and "fix" are each one short sentence the voice copilot will say aloud.`,
    },
  ],
  {
    type: "object",
    additionalProperties: false,
    required: ["score", "strong", "fix"],
    properties: {
      score: { type: "integer", description: "1 to 10" },
      strong: { type: "string", description: "What landed, one short sentence" },
      fix: { type: "string", description: "The one change that would make it land harder, one short sentence" },
    },
  },
);

/** answer-review: submitted → (Claude scores it) → scored. */
export const reviews = new StateMachine(
  "answer-review",
  [
    new State("submitted", [SCORE], [new Transition("scored", async (job) => await job.properties.has("score"))]),
    new Terminal("scored", Terminal.Outcome.SUCCESS),
  ],
  "submitted",
  [
    prop("tripId"),
    prop("questionNumber", true, isNumber),
    prop("question", true, isText),
    prop("answer", true, isText),
    prop("score", false, isNumber),
    prop("strong", false, isText),
    prop("fix", false, isText),
  ],
  persistence,
);

export const appActor = new Code("plan-p-app");

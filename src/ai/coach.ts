import { FOUNDER_CONTEXT } from "./founder";

// The pitch coach's scoring rubric, shared by the Anbaric engine path and the direct fallback.

export const COACH_SYSTEM = `You are a partner with 20 years of venture experience coaching a defense-tech founder minutes before an investor meeting.
Score his spoken pitch (transcribed from speech, so ignore filler words) on clarity, proof and confidence, 1 to 10.
Be direct and specific to what he said. "strong" and "fix" are each one short sentence the voice copilot will say aloud while he drives.

${FOUNDER_CONTEXT}`;

export const COACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "strong", "fix"],
  properties: {
    score: { type: "integer", description: "1 to 10" },
    strong: { type: "string", description: "What landed, one short sentence" },
    fix: { type: "string", description: "The one change that would make it land harder, one short sentence" },
  },
} as const;

export type CoachScore = { score: number; strong: string; fix: string };

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BRAIN_MODEL, costUsd } from "@/ai/models";
import { COACH_SCHEMA, COACH_SYSTEM, type CoachScore } from "@/ai/coach";
import { PITCH_QUESTIONS } from "@/ai/questions";
import { enqueue, waitResult } from "@/lib/engine-queue";

// S4: score one spoken pitch answer. First choice: the Anbaric engine (Claude as an audited Anbaric
// agent); if it doesn't answer in time, Claude directly, so the conversation never stalls.

const client = new Anthropic();
const ENGINE_WAIT_MS = 9000;
const Body = z.object({
  tripRef: z.string().max(100).optional(),
  questionNumber: z.number().int().min(1).max(PITCH_QUESTIONS.length),
  answer: z.string().min(1).max(4000),
});

async function scoreDirect(question: string, answer: string) {
  const response = await client.messages.create({
    model: BRAIN_MODEL,
    max_tokens: 2000,
    system: COACH_SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: COACH_SCHEMA as unknown as Record<string, unknown> } },
    messages: [{ role: "user", content: `Question: ${question}\n\nHis answer: ${answer}` }],
  });
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { ...(JSON.parse(text) as CoachScore), costUsd: costUsd(BRAIN_MODEL, response.usage.input_tokens, response.usage.output_tokens) };
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { tripRef, questionNumber, answer } = parsed.data;
  const question = PITCH_QUESTIONS[questionNumber - 1];
  const started = Date.now();

  const queued = await enqueue("answer", { tripRef, questionNumber, question, answer });
  if (queued) {
    const viaEngine = await waitResult<CoachScore & { jobId?: string; error?: string }>(queued, ENGINE_WAIT_MS);
    if (viaEngine && !viaEngine.error) {
      return Response.json({ ...viaEngine, question, via: "anbaric", ms: Date.now() - started });
    }
  }
  try {
    const direct = await scoreDirect(question, answer);
    return Response.json({ ...direct, question, via: "claude-direct", ms: Date.now() - started });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Scoring failed" }, { status: 502 });
  }
}

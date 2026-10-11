import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BRAIN_MODEL, costUsd } from "@/ai/models";
import { COACH_SCHEMA, COACH_SYSTEM, type CoachScore } from "@/ai/coach";
import { enqueue } from "@/lib/engine-queue";

// Score the founder's pitch once, after the four questions (PRD S5). First choice: queue it for the
// Anbaric engine (Claude as an audited Anbaric agent) and return at once; the browser polls
// /api/coach/result. With `direct` (or when there's no queue) Claude scores it here.

const client = new Anthropic();
const Body = z.object({
  direct: z.boolean().optional(),
  tripRef: z.string().max(100).optional(),
  pitch: z.array(z.object({ question: z.string().min(1).max(300), answer: z.string().min(1).max(1500) })).min(1).max(6),
});

const transcript = (pitch: { question: string; answer: string }[]) =>
  pitch.map((p, i) => `Q${i + 1}: ${p.question}\nHis answer: ${p.answer}`).join("\n\n");

async function scoreDirect(text: string) {
  const response = await client.messages.create({
    model: BRAIN_MODEL,
    max_tokens: 2000,
    system: COACH_SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: COACH_SCHEMA as unknown as Record<string, unknown> } },
    messages: [{ role: "user", content: `His pitch, answering four questions:\n\n${text}` }],
  });
  const out = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { ...(JSON.parse(out) as CoachScore), costUsd: costUsd(BRAIN_MODEL, response.usage.input_tokens, response.usage.output_tokens) };
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { tripRef, pitch, direct } = parsed.data;
  const text = transcript(pitch);
  const started = Date.now();

  if (!direct) {
    // The engine's answer-review job takes one question/answer pair: the whole pitch is "question 0".
    const queued = await enqueue("answer", { tripRef, questionNumber: 0, question: `The full pitch (${pitch.length} questions)`, answer: text.slice(0, 4800) });
    if (queued) return Response.json({ queued });
  }
  try {
    const scored = await scoreDirect(text);
    return Response.json({ ...scored, via: "claude-direct", ms: Date.now() - started });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Scoring failed" }, { status: 502 });
  }
}

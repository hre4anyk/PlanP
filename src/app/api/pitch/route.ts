import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BRAIN_MODEL } from "@/ai/models";

const client = new Anthropic();

const Result = z.object({
  score: z.number().int().min(1).max(10).describe("Overall pitch score, 1-10"),
  feedback: z.string().describe("One sentence of specific, actionable advice"),
});

const PROMPT = `You are a pitch coach at a startup competition. The user is pitching PlanP, an AI-powered parking navigation app that uses Google Street View and Claude AI to find and score street parking in San Francisco.

Score their pitch on a scale of 1-10 based on:
- Clarity: Is the problem and solution clear?
- Persuasion: Does it make you want to invest?
- Conciseness: Is it concise and to the point?

Return a score (integer 1-10) and one sentence of specific, actionable feedback.`;

export async function POST(req: Request) {
  const { pitch } = await req.json().catch(() => ({}));
  if (!pitch || pitch.trim().length < 10) {
    return Response.json({ error: "Pitch is too short" }, { status: 400 });
  }
  try {
    const response = await client.beta.messages.parse({
      model: BRAIN_MODEL,
      max_tokens: 200,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Result) },
      system: PROMPT,
      messages: [{ role: "user", content: pitch }],
    });
    return Response.json(response.parsed_output);
  } catch {
    return Response.json({ error: "Pitch scoring failed" }, { status: 500 });
  }
}

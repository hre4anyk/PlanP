import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BRAIN_MODEL, costUsd } from "@/ai/models";
import { FOUNDER_CONTEXT } from "@/ai/founder";

// S3: the investor-research agent. Claude searches the web for the investor the driver is about to
// meet and turns it into a short brief and the questions that investor is most likely to ask.

const client = new Anthropic();
const Body = z.object({ name: z.string().min(2).max(120), firm: z.string().max(120).optional() });

const Brief = z.object({
  who: z.string(),
  focus: z.string(),
  angle: z.string(),
  questions: z.array(z.string()).min(1).max(6),
  watchOut: z.string(),
});

const SYSTEM = `You prepare a founder for an investor meeting in the next few minutes. Use web search to find who the investor is,
their firm, what they invest in, notable portfolio companies and any public views on defense, dual-use or drones. Be fast: 3 searches at most.

${FOUNDER_CONTEXT}

Answer with ONLY a JSON object, no prose before or after:
{"who": "one sentence: who they are and their firm (say clearly if you couldn't find them)",
 "focus": "one sentence: what they invest in and at what stage",
 "angle": "one sentence: how Nazar's story connects to what they care about",
 "questions": ["the 5 toughest questions THIS investor is likely to ask Nazar, most likely first, each under 20 words"],
 "watchOut": "one sentence: the trap or objection to prepare for"}`;

/** The last JSON object in Claude's answer. */
function parseBrief(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = Brief.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Who are you meeting?" }, { status: 400 });
  const { name, firm } = body.data;
  const started = Date.now();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `I'm meeting ${name}${firm ? ` from ${firm}` : ""} in a few minutes. Research them and prepare me.` },
  ];
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    // Server-side web search can pause a long turn; resume it a couple of times at most.
    for (let turn = 0; turn < 3; turn++) {
      const response = await client.messages.create({
        model: BRAIN_MODEL,
        max_tokens: 4000,
        output_config: { effort: "low" },
        system: SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
        messages,
      });
      tokensIn += response.usage.input_tokens;
      tokensOut += response.usage.output_tokens;
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
      const brief = parseBrief(text);
      if (!brief) return Response.json({ error: "Couldn't put a brief together" }, { status: 502 });
      return Response.json({ brief, trace: { ms: Date.now() - started, costUsd: costUsd(BRAIN_MODEL, tokensIn, tokensOut) } });
    }
    return Response.json({ error: "Research took too long" }, { status: 504 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Research failed" }, { status: 502 });
  }
}

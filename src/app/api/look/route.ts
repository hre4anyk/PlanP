import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BRAIN_MODEL, costUsd } from "@/ai/models";

// Claude's eyes (ARCHITECTURE §4): the phone's fast detector proposes numbered boxes,
// Claude looks at the photo once and decides what they really are. Keys stay on the server.

const client = new Anthropic();

const Box = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

const SeatsResult = z.object({
  seats: z.array(
    z.object({
      id: z.number().describe("The number drawn on the box"),
      isSeat: z.boolean().describe("A real chair, stool, bench or sofa a person could sit on"),
      taken: z.boolean().describe("Someone sits there, or belongings (bag, laptop, coat) occupy it"),
      note: z.string().describe("Two to five words, e.g. 'laptop on seat' or 'free office chair'"),
    }),
  ),
  missed: z
    .array(z.object({ box: Box, taken: z.boolean(), note: z.string() }))
    .describe("Clearly visible seats with no numbered box; box in 0-1 image coordinates"),
  summary: z.string().describe("One short sentence a voice assistant can read out"),
});

const StreetResult = z.object({
  parkedIds: z.array(z.number()).describe("Numbers of vehicle boxes that are parked at a curb"),
  spots: z
    .array(
      z.object({
        label: z.string().describe("The letter of a marked gap (A, B…), or 'new' for a space you found that has no letter"),
        legal: z.enum(["yes", "no", "unsure"]),
        side: z.enum(["left", "right"]).describe("Which side of the picture the space is on"),
        box: Box.nullable().describe("For 'new' spaces: where it is, in 0-1 image coordinates"),
        reason: z.string().describe("Short: e.g. '2-hour zone, long enough' or 'fire hydrant' or 'driveway'"),
      }),
    )
    .describe("Every lettered gap, plus any other open curb space long enough for a car"),
  signs: z.array(z.string()).describe("Parking rules visible: signs, curb colours, hydrants, driveways"),
  summary: z.string().describe("One short sentence a voice assistant can read to the driver"),
});

const PROMPTS = {
  seats: `You are the eyes of Plan P, which guides a person to a free seat. The photo comes from their phone camera.
A fast on-device detector drew numbered boxes on things it thinks are seats; it often mistakes bags, laptops, tables and people for chairs.
For every number, decide whether it is really a seat and whether it is taken (a person on it, or belongings occupying it).
If you clearly see seats with no box, add them to "missed". Be strict: when unsure that a box is a seat, say it is not.`,
  street: `You are the eyes of Plan P, which helps a driver in San Francisco find street parking. The photo comes from a phone camera:
on a car dashboard, or held at a window or on the sidewalk looking at a street. Judge the street either way.
Numbered boxes (yellow) mark vehicles a fast detector found. Lettered boxes (cyan, A, B…) mark gaps between parked cars that the
phone measured as long enough for a car. Look closely at the space directly in front of and behind every parked car, on both curbs:
that is where open spots are. For each lettered gap say whether a car can legally park there right now (fire hydrants, driveways,
red/yellow/white/blue curbs, bus stops, crosswalks, signs). Add other open curb spaces as label "new" with a box.
Be quick and practical: a driver is waiting.`,
} as const;

const Request = z.object({
  mode: z.enum(["seats", "street"]),
  /** JPEG, base64 without the data: prefix, ≤ 768 px on the long side, numbered boxes already drawn on it. */
  image: z.string().min(100).max(2_000_000),
  boxes: z.number().int().min(0).max(60),
  /** Lettered gap regions drawn on the image (street mode). */
  gaps: z.array(z.string().max(3)).max(12).default([]),
});

export async function POST(req: Request) {
  const parsed = Request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { mode, image, boxes, gaps } = parsed.data;

  const started = Date.now();
  try {
    const schema = mode === "seats" ? SeatsResult : StreetResult;
    const response = await client.beta.messages.parse({
      model: BRAIN_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system: PROMPTS[mode],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            {
              type: "text",
              text: `There are ${boxes} numbered boxes in this photo.${gaps.length ? ` Lettered gaps: ${gaps.join(", ")}.` : ""}`,
            },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Claude couldn't read this photo" }, { status: 502 });
    }
    const { input_tokens, output_tokens } = response.usage;
    return Response.json({
      result: response.parsed_output,
      trace: {
        model: response.model,
        ms: Date.now() - started,
        costUsd: costUsd(BRAIN_MODEL, input_tokens, output_tokens),
      },
    });
  } catch (e) {
    const status = e instanceof Anthropic.APIError && e.status ? e.status : 500;
    return Response.json({ error: e instanceof Error ? e.message : "Claude request failed" }, { status: status >= 500 ? 502 : status });
  }
}

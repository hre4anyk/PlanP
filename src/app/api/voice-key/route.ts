import { VOICE_MODEL } from "@/ai/models";
import { FOUNDER_CONTEXT } from "@/ai/founder";
import { PITCH_QUESTIONS } from "@/ai/questions";

// S4: a short-lived key for the browser's voice session (OpenAI Realtime over WebRTC). The real
// OpenAI key never leaves the server; the session's instructions and tools are fixed here.
// The conversation is the clock: every scored answer moves the car one stretch (PRD S4).

const INSTRUCTIONS = `You are Plan P, a calm, warm voice copilot in the car with a stressed founder driving to an investor meeting in San Francisco.
Your job: set his route, then use the drive to sharpen his pitch with the six questions every fund asks.
He is driving: keep replies short (two sentences, under 40 words). Never read lists aloud. Be encouraging but honest.

Flow, in order:
1. Greet him in one sentence and ask where the meeting is and what time. When you have it, call set_destination. If he isn't sure, use 2 South Park Street.
2. Tell him the drive time from the tool result in one sentence, say parking near the meeting is marked on his screen, and that you'll use the drive for six questions investors always ask. Then ask Question 1.
3. After he answers, call score_answer with the question number and his answer in his own words. The car moves forward when you do.
4. From the tool result say the score out of 10 and one sentence combining what was strong and the fix. Then ask the next question it gives you, word for word.
5. After the sixth answer, the tool result says he has arrived: give his average score, one final tip for the meeting, mention the closest free parking from the result, and wish him luck.
6. If he says he parked, call i_parked.
Ask only these questions, in this order, one at a time:
${PITCH_QUESTIONS.map((q, i) => `Question ${i + 1}: ${q}`).join("\n")}

Don't invent scores or parking: use the tools.

${FOUNDER_CONTEXT}`;

const TOOLS = [
  {
    type: "function",
    name: "set_destination",
    description: "Set the meeting address (and time if known); plans the route and the street parking near the meeting.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Meeting address or place in San Francisco, e.g. '2 South Park Street'" },
        meeting_time: { type: "string", description: "24-hour time HH:MM if he said one, e.g. '17:30'" },
      },
      required: ["address"],
    },
  },
  {
    type: "function",
    name: "score_answer",
    description: "Score his answer to a pitch question (Claude does it, ~3 s). Moves the car one stretch and returns the next question.",
    parameters: {
      type: "object",
      properties: {
        question_number: { type: "integer", description: `1 to ${PITCH_QUESTIONS.length}` },
        answer: { type: "string", description: "His answer, in his own words" },
      },
      required: ["question_number", "answer"],
    },
  },
  {
    type: "function",
    name: "i_parked",
    description: "He has parked. Marks the trip done.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

export async function POST() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "Voice isn't set up (OPENAI_API_KEY missing)" }, { status: 503 });
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: VOICE_MODEL,
        instructions: INSTRUCTIONS,
        audio: {
          input: { transcription: { model: "gpt-4o-mini-transcribe" } },
          output: { voice: "marin" },
        },
        tools: TOOLS,
        tool_choice: "auto",
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (!res.ok) return Response.json({ error: data.error?.message ?? "Couldn't start the voice session" }, { status: 502 });
  return Response.json({ key: data.value, model: VOICE_MODEL });
}

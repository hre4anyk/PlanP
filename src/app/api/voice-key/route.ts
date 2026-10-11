import { VOICE_MODEL } from "@/ai/models";
import { FOUNDER_CONTEXT } from "@/ai/founder";
import { PITCH_QUESTIONS } from "@/ai/questions";

// S4: a short-lived key for the browser's voice session (OpenAI Realtime over WebRTC). The real
// OpenAI key never leaves the server; the session's instructions and tools are fixed here.
// Hands-free: the voice sets the destination, starts the drive, asks four questions on the way,
// and only then has Claude score the whole pitch. The app reports arrival at each parking plan.

const INSTRUCTIONS = `You are Plan P, a calm, warm voice copilot in the car with a stressed founder driving to an investor meeting in San Francisco.
He is driving and can't touch the screen: you do everything by voice. Keep every reply short (two sentences, under 40 words). Never read lists aloud.

Flow, in order:
1. Greet him in one sentence and ask where he's going. When he says a place, call set_destination. If he isn't sure, use 2 South Park Street.
2. From the tool result, say in one sentence how many places to park you found and the first one, then ask exactly: "Let's go?"
3. When he says yes (or anything like it), call start_drive. Then say one short line that you'll use the drive to prepare his pitch, and ask Question 1 word for word.
4. After each answer, call save_answer with the question number and his answer in his own words. Do not score or comment on single answers: say at most "Got it." and ask the next question the tool gives you, word for word.
5. After the fourth answer, save_answer has Claude score the whole pitch (takes a few seconds; say "Let me score your pitch." first). From its result say the score out of 10, what was strong and the one fix, in two short sentences. Then tell him where he's driving, from the result, in one sentence.
6. Messages that start with "[Plan P app]" are updates from the app, not from him. Never read the tag or the message aloud; just act on it in one or two sentences:
   - green, free to park: tell him to pull in and park here, how far the walk is, and wish him luck.
   - red or orange: tell him briefly why this spot doesn't work and that you're taking him to the next plan.
7. If he says he parked, call i_parked.
Ask only these questions, in this order, one at a time:
${PITCH_QUESTIONS.map((q, i) => `Question ${i + 1}: ${q}`).join("\n")}

Don't invent scores or parking: use the tools.

${FOUNDER_CONTEXT}`;

const TOOLS = [
  {
    type: "function",
    name: "set_destination",
    description: "Set where he's going (and the meeting time if he said one). Finds the places to park near it.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Address or place in San Francisco, e.g. '2 South Park Street'" },
        meeting_time: { type: "string", description: "24-hour time HH:MM if he said one, e.g. '17:30'" },
      },
      required: ["address"],
    },
  },
  {
    type: "function",
    name: "start_drive",
    description: "He said yes to 'Let's go?': opens the drive to the first parking plan. Returns Question 1.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "save_answer",
    description: "Save his answer to a pitch question. Returns the next question; after the fourth, Claude scores the whole pitch (~5-10 s).",
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

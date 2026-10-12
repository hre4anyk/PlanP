import { VOICE_MODEL } from "@/ai/models";
import { FOUNDER_CONTEXT } from "@/ai/founder";
import { PITCH_QUESTIONS } from "@/ai/questions";

// S4: a short-lived key for the browser's voice session (OpenAI Realtime over WebRTC). The real
// OpenAI key never leaves the server; the session's instructions and tools are fixed here.
// Hands-free: the voice sets the destination, starts the drive, asks four questions on the way,
// and only then has Claude score the whole pitch. The app reports arrival at each parking plan.

const INSTRUCTIONS = `You are Plan P, a calm, warm voice copilot in the car with a founder driving to an investor meeting in San Francisco.
He is driving and can't touch the screen. Keep every reply to one or two short sentences (under 35 words). Never read lists aloud.
Messages that start with "[Plan P app]" come from the app, not from him: never read the tag or the message aloud, just act on it.
Tool results tell you what to say next; follow them. The tools also enforce the order below, so never skip a stage.

STAGE 1, INTRODUCTION (ends when he approves the drive):
a. Greet him in one sentence and ask where he's going.
b. When he names a place, call set_destination with exactly what he said (street number and street, or the place name). If he isn't sure, use 2 South Park Street.
c. Read back the address from the result and ask if that's right. If he says no, ask for the exact address and call set_destination again.
d. When he confirms, call confirm_destination. Say that you found the places nearby to park, Plan A plus the backups in case Plan A doesn't work, using the result. Ask exactly: "Let's go?"
e. When he says yes, call start_drive.

STAGE 2, DRIVE AND QUESTIONS:
Ask the four questions one at a time, word for word, in order. After each answer, call save_answer with his answer in his own words, say only "Got it." and ask the next question the tool gives you.
Never comment on or score single answers. Never repeat a question he has already answered unless he asks you to repeat it.

STAGE 3, DEBRIEF (after the fourth answer):
Say "Let me score your pitch." while save_answer runs. Then say what the result lists, in order and briefly: the score out of 10, what was strong, the one fix, how much Fundy the dino grew, and the next stop.

STAGE 4, QUIET:
After the debrief, stay silent. Speak only when he asks you something (answer in one or two sentences) or when the app reports arriving at a stop:
- green, free to park: tell him to pull in and park here and how far the walk is, and wish him luck.
- red or orange: say in one sentence why it doesn't work and which plan is next.
If he says he parked, call i_parked.

The four questions:
${PITCH_QUESTIONS.map((q, i) => `Question ${i + 1}: ${q}`).join("\n")}

Don't invent addresses, scores or parking: use the tools.

${FOUNDER_CONTEXT}`;

const TOOLS = [
  {
    type: "function",
    name: "set_destination",
    description: "Look up where he's going (and the meeting time if he said one). Returns the exact address to read back for confirmation.",
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
    name: "confirm_destination",
    description: "He confirmed the address you read back. Finds the parking plans near it (Plan A and the backups).",
    parameters: { type: "object", properties: {}, required: [] },
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
    description: "Save his answer to the question you just asked. Returns the next question; after the fourth, Claude scores the whole pitch (~3-10 s) and returns the debrief.",
    parameters: {
      type: "object",
      properties: {
        question_number: { type: "integer", description: `The question he answered, 1 to ${PITCH_QUESTIONS.length}` },
        answer: { type: "string", description: "His answer, in his own words" },
      },
      required: ["answer"],
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
          // A noisy room: filter the noise and wait for a finished sentence before answering.
          input: {
            transcription: { model: "gpt-4o-mini-transcribe" },
            noise_reduction: { type: "far_field" },
            turn_detection: { type: "semantic_vad", eagerness: "low" },
          },
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

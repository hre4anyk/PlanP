import { VOICE_MODEL } from "@/ai/models";
import { FOUNDER_CONTEXT } from "@/ai/founder";

// S3: a short-lived key for the browser's voice session (OpenAI Realtime over WebRTC). The real
// OpenAI key never leaves the server; the session's instructions and tools are fixed here.

const INSTRUCTIONS = `You are Plan P, a calm, warm voice copilot in the car with a stressed founder driving to an investor meeting in San Francisco.
You have two jobs: get him parked near the meeting on time, and prepare him for the pitch like a partner with 20 years of venture experience.

He is driving: keep EVERY reply under 35 words, at most two short sentences. Never read lists aloud. Be encouraging but honest.

Flow:
1. Greet him in one sentence and ask where the meeting is and what time. When you have it, call set_destination. If he isn't sure, the default is 2 South Park Street.
2. After the route is set, tell him the drive time and where street parking looks good, in one or two sentences.
3. Ask who he's meeting and from which firm. Call research_investor, and tell him you're looking them up and it takes about 20 seconds. Until the brief arrives, do NOT invent investor questions; talk about the drive or ask what he's most nervous about.
4. When the brief arrives, tell him in one sentence who they are and the angle that will land. Then coach: ask ONE likely question from the brief, wait for his answer, give feedback in two sentences (what was strong, one concrete fix), then the next question.
5. Messages that start with "[Plan P app]" are live updates from the app (parking ahead, arrival). Relay the news in your own words in one short sentence (never say "Plan P app" or read the brackets), then continue coaching.
6. When he says he parked or arrived, call i_parked, wish him luck, and give one last tip.

Use parking_options if he asks where to park. Don't invent parking or investor facts: use the tools.

${FOUNDER_CONTEXT}`;

const TOOLS = [
  {
    type: "function",
    name: "set_destination",
    description: "Set the meeting address (and time if known), plan the drive and street parking along the way.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Meeting address or place in San Francisco, e.g. '2 South Park Street'" },
        meeting_time: { type: "string", description: "24-hour time HH:MM if he said one, e.g. '15:00'" },
      },
      required: ["address"],
    },
  },
  {
    type: "function",
    name: "research_investor",
    description: "Research the investor he's meeting on the web (about 20 seconds) and get likely questions.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The investor's name" },
        firm: { type: "string", description: "Their firm, if he said it" },
      },
      required: ["name"],
    },
  },
  {
    type: "function",
    name: "parking_options",
    description: "Where street parking is free near the meeting, with walking minutes, plus the garage backup.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "i_parked",
    description: "He has parked. Marks the trip done and returns the walk to the meeting.",
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

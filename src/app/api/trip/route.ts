import { z } from "zod";
import { enqueue } from "@/lib/engine-queue";

// S4: record the trip on the Anbaric engine (start, arrival). Fire and forget: the drive never waits.
const Body = z.object({
  event: z.enum(["start", "arrived"]),
  tripRef: z.string().min(4).max(100),
  destination: z.string().max(200).optional(),
  meetingTime: z.string().max(10).optional(),
  averageScore: z.number().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { event, ...payload } = parsed.data;
  const id = await enqueue(event === "start" ? "trip_start" : "trip_arrived", payload);
  return Response.json({ queued: !!id });
}

import type { CoachScore } from "@/ai/coach";
import { readResult } from "@/lib/engine-queue";

// The browser polls this for the Anbaric engine's score of a queued answer.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[\w-]{10,60}$/.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const result = await readResult<CoachScore & { jobId?: string; error?: string }>(id);
  if (!result) return Response.json({ pending: true });
  if (result.error) return Response.json({ error: result.error }, { status: 502 });
  return Response.json({ ...result, via: "anbaric" });
}

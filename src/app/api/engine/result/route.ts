import { complete, engineAuthorised } from "@/lib/engine-queue";

// The Anbaric engine posts each finished item here (e.g. Claude's score, with the Anbaric job id).
export async function POST(req: Request) {
  if (!engineAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: string; result?: unknown } | null;
  if (!body?.id) return Response.json({ error: "id required" }, { status: 400 });
  await complete(body.id, body.result ?? null);
  return Response.json({ ok: true });
}

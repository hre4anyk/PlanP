import { claimPending, engineAuthorised } from "@/lib/engine-queue";

// The Anbaric engine polls this for new work (trip events, pitch answers to score).
export async function GET(req: Request) {
  if (!engineAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  return Response.json({ items: await claimPending() });
}

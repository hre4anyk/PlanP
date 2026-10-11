import { getStore } from "@netlify/blobs";

// The bridge to the Anbaric trip engine (ARCHITECTURE §5 S4). Anbaric apps sit behind Anbaric's login,
// so the engine can't be called from outside; instead it polls this queue (Netlify Blobs) and posts
// results back. Outside Netlify (local dev) there's no store, and callers fall back to Claude directly.

export type QueueKind = "trip_start" | "trip_arrived" | "answer";
export type QueueItem = { id: string; kind: QueueKind; payload: Record<string, unknown>; createdAt: number };

function store() {
  try {
    return getStore({ name: "planp-engine", consistency: "strong" });
  } catch {
    return null;
  }
}

export async function enqueue(kind: QueueKind, payload: Record<string, unknown>): Promise<string | null> {
  const s = store();
  if (!s || !process.env.ENGINE_TOKEN) return null;
  const item: QueueItem = { id: crypto.randomUUID(), kind, payload, createdAt: Date.now() };
  try {
    await s.setJSON(`pending/${item.id}`, item);
    return item.id;
  } catch {
    return null;
  }
}

/** For the engine: take everything waiting (oldest first) and mark it claimed. */
export async function claimPending(max = 10): Promise<QueueItem[]> {
  const s = store();
  if (!s) return [];
  const { blobs } = await s.list({ prefix: "pending/" });
  const items: QueueItem[] = [];
  for (const blob of blobs.slice(0, max)) {
    const item = (await s.get(blob.key, { type: "json" })) as QueueItem | null;
    await s.delete(blob.key);
    if (item) items.push(item);
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function complete(id: string, result: unknown) {
  await store()?.setJSON(`result/${id}`, { result, at: Date.now() });
}

/** Wait for the engine's result for an item, or null after the timeout. */
export async function waitResult<T>(id: string, timeoutMs: number): Promise<T | null> {
  const s = store();
  if (!s) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = (await s.get(`result/${id}`, { type: "json" })) as { result: T } | null;
    if (found) {
      await s.delete(`result/${id}`);
      return found.result;
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  return null;
}

export function engineAuthorised(req: Request): boolean {
  const token = process.env.ENGINE_TOKEN;
  return !!token && req.headers.get("x-planp-token") === token;
}

import "server-only";
import { scoreFrom } from "@/lib/score";
import { supabase, type LibraryCard } from "@/lib/supabase";

// Returns only the public card fields — never the CV or AI work contents.
export async function getLibraryCards(): Promise<LibraryCard[]> {
  const [profiles, sessions] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, first_name, location, superpower, access_price")
      .not("cv_summary", "is", null),
    supabase.from("contributions").select("user_id, weight"),
  ]);
  if (profiles.error) throw profiles.error;
  if (sessions.error) throw sessions.error;

  const weightsByUser = new Map<string, number[]>();
  for (const c of sessions.data) {
    weightsByUser.set(c.user_id, [...(weightsByUser.get(c.user_id) ?? []), c.weight]);
  }

  return profiles.data
    .map((p) => ({
      user_id: p.user_id,
      name: p.first_name?.trim().split(/\s+/)[0] || "Anonymous",
      location: p.location?.trim().split(/\s+/)[0] || null,
      superpower: p.superpower,
      score: scoreFrom(true, weightsByUser.get(p.user_id) ?? []),
      price: Number(p.access_price ?? 10),
    }))
    .sort((a, b) => b.score - a.score);
}

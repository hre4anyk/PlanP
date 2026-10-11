import "server-only";
import { logAgentAction } from "@/lib/agent";
import { matchProfiles } from "@/lib/ai";
import { getLibraryCards } from "@/lib/library";
import { supabase, type LibraryCard } from "@/lib/supabase";

export type SearchResult = { card: LibraryCard; percent: number; reason: string };

const MAX_CANDIDATE_CHARS = 4000;
const MAX_RESULTS = 10;

// The agent reads each full profile to judge fit, but only public card fields plus a
// deliberately general reason ever leave the server.
export async function searchProfiles(viewerId: string, query: string): Promise<SearchResult[]> {
  const cards = (await getLibraryCards()).filter((c) => c.user_id !== viewerId);
  if (cards.length === 0) return [];
  const ids = cards.map((c) => c.user_id);

  const [profiles, contributions, sessions] = await Promise.all([
    supabase.from("profiles").select("user_id, headline, cv_summary, superpower, location").in("user_id", ids),
    supabase.from("contributions").select("user_id, title").in("user_id", ids),
    supabase.from("ai_sessions").select("user_id, title, summary").in("user_id", ids),
  ]);
  if (profiles.error) throw profiles.error;

  const candidates = cards.map((card, i) => {
    const p = profiles.data.find((x) => x.user_id === card.user_id);
    const built = (contributions.data ?? []).filter((c) => c.user_id === card.user_id).map((c) => `- ${c.title}`);
    const work = (sessions.data ?? []).filter((s) => s.user_id === card.user_id).map((s) => `- ${s.title}: ${s.summary}`);
    const text = [
      `Location: ${p?.location ?? "unknown"}`,
      `Headline: ${p?.headline ?? ""}`,
      `Superpower: ${p?.superpower ?? ""}`,
      `CV summary: ${p?.cv_summary ?? ""}`,
      built.length ? `Built with AI:\n${built.join("\n")}` : "",
      work.length ? `AI work:\n${work.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_CANDIDATE_CHARS);
    return { n: i + 1, text };
  });

  const matches = await matchProfiles(query, candidates);
  const results = matches
    .filter((m) => cards[m.candidate - 1])
    .slice(0, MAX_RESULTS)
    .map((m) => ({ card: cards[m.candidate - 1], percent: m.match, reason: m.reason }));

  await logAgentAction(viewerId, {
    kind: "searched",
    note: `Searched for "${query.slice(0, 80)}" — ${results.length} match${results.length === 1 ? "" : "es"} in ${cards.length} profiles.`,
  });
  return results;
}

import "server-only";
import { generateSuperpower } from "@/lib/ai";
import { getAiSessions, getProfile, supabase } from "@/lib/supabase";

// Best-effort: the Library card keeps its previous superpower if this fails.
export async function refreshSuperpower(userId: string): Promise<string | null> {
  try {
    const [profile, sessions] = await Promise.all([getProfile(userId), getAiSessions(userId)]);
    if (!profile?.cv_summary) return null;
    const superpower = await generateSuperpower(
      profile.cv_summary,
      sessions.map((s) => s.summary).filter((s): s is string => Boolean(s)),
    );
    const { error } = await supabase.from("profiles").update({ superpower }).eq("user_id", userId);
    if (error) throw error;
    return superpower;
  } catch (e) {
    console.error("refreshSuperpower failed", e);
    return null;
  }
}

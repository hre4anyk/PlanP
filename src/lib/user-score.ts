import "server-only";
import { scoreFrom } from "@/lib/score";
import { getContributions, getProfile } from "@/lib/supabase";

export async function getUserScore(userId: string) {
  const [profile, contributions] = await Promise.all([getProfile(userId), getContributions(userId)]);
  return {
    score: scoreFrom(Boolean(profile?.cv_summary), contributions.map((c) => c.weight)),
    profile,
    contributions,
  };
}

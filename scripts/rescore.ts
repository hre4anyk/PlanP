// One-time re-rating of all past AI-work uploads under contribution-based scoring.
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/rescore.ts [--dry]
import { summarizeAiSession, type AiSessionContribution } from "@/lib/ai";
import { creditContributions } from "@/lib/contributions";
import { syncProfileNft } from "@/lib/nft";
import { refreshSuperpower } from "@/lib/superpower";
import { scoreFrom } from "@/lib/score";
import { getProfile, supabase } from "@/lib/supabase";
import { getUserScore } from "@/lib/user-score";

const dry = process.argv.includes("--dry");

// Every file ever stored for the user, oldest first — including early uploads
// that predate history tracking and aren't referenced by any database row.
async function uploadsFor(userId: string) {
  const { data, error } = await supabase.storage
    .from("ai-sessions")
    .list(userId, { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
  if (error) throw error;
  return (data ?? []).filter((f) => f.name.match(/\.(txt|md)$/)).map((f) => `${userId}/${f.name}`);
}

async function rescoreUser(userId: string) {
  const { data: lastEvent } = await supabase
    .from("score_events")
    .select("score_after")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const oldScore = lastEvent?.score_after ?? 0;

  const paths = await uploadsFor(userId);
  console.log(`\nUser ${userId}: ${paths.length} upload(s) to re-rate, old score ${oldScore}`);
  if (!dry) await supabase.from("contributions").delete().eq("user_id", userId);

  const credited: AiSessionContribution[] = [];
  for (const path of paths) {
    const { data: blob } = await supabase.storage.from("ai-sessions").download(path);
    if (!blob) {
      console.log(`  - ${path}: file missing, skipped`);
      continue;
    }
    const result = await summarizeAiSession(await blob.text(), credited.map((c) => c.title));
    console.log(`  - ${path}: +${result.contributions.length} new, ${result.already_credited.length} already counted`);
    for (const c of result.contributions) console.log(`      [${c.weight}] ${c.title}`);
    if (!dry) await creditContributions(userId, result.contributions, path);
    credited.push(...result.contributions);
  }

  if (dry) {
    const profile = await getProfile(userId);
    const newScore = scoreFrom(Boolean(profile?.cv_summary), credited.map((c) => c.weight));
    console.log(`  => would be ${newScore} (was ${oldScore}), ${credited.length} distinct items`);
    return;
  }

  const { score } = await getUserScore(userId);
  const { data: event } = await supabase
    .from("score_events")
    .insert({
      user_id: userId,
      event: "Scoring updated",
      detail: `Re-rated ${paths.length} upload(s): ${credited.length} distinct features credited`,
      reason:
        "New, stricter scoring: points now come from each distinct feature, tool or integration you built, counted once — re-uploading the same work adds nothing, and points get harder to earn near 100. See “What’s counted” on your profile.",
      score_before: oldScore,
      score_after: score,
    })
    .select("id")
    .single();
  const nftTx = await syncProfileNft(userId);
  if (nftTx && event) await supabase.from("score_events").update({ nft_tx: nftTx }).eq("id", event.id);
  await refreshSuperpower(userId);
  console.log(`  => new score ${score} (was ${oldScore})${nftTx ? `, NFT updated ${nftTx}` : ""}`);
}

async function main() {
  const { data: profiles, error } = await supabase.from("profiles").select("user_id");
  if (error) throw error;
  for (const p of profiles) await rescoreUser(p.user_id);
  console.log(dry ? "\nDry run — nothing was saved." : "\nDone.");
}

main().catch((e) => {
  console.error("Rescore failed:", e?.message ?? e);
  process.exit(1);
});

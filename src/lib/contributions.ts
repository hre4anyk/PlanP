import "server-only";
import type { AiSessionContribution } from "@/lib/ai";
import { supabase } from "@/lib/supabase";

const WEIGHT_LABEL: Record<number, string> = { 1: "routine", 2: "standard", 3: "hard" };

export async function creditContributions(
  userId: string,
  items: AiSessionContribution[],
  filePath: string,
) {
  if (items.length === 0) return;
  const { error } = await supabase
    .from("contributions")
    .insert(items.map((c) => ({ user_id: userId, ...c, file_path: filePath })));
  if (error) throw error;
}

// Plain-language "why" for a score history row.
export function describeCredit(items: AiSessionContribution[], alreadyCredited: string[]): string {
  const parts: string[] = [];
  if (items.length > 0) {
    parts.push(
      `Credited ${items.length} new: ${items
        .map((c) => `${c.title} (${WEIGHT_LABEL[c.weight]})`)
        .join("; ")}.`,
    );
  } else {
    parts.push("Nothing new was credited — no new feature, tool or integration found in this file.");
  }
  if (alreadyCredited.length > 0) {
    parts.push(`Already counted before, not added again: ${alreadyCredited.join("; ")}.`);
  }
  return parts.join(" ");
}

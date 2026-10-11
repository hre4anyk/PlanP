"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { saveAgentSettings } from "@/lib/agent";

export type AgentFormState = { error?: string; ok?: boolean };

const MAX_DAILY_LIMIT = 10_000;

export async function updateAgentSettings(
  _prev: AgentFormState,
  formData: FormData,
): Promise<AgentFormState> {
  const { userId } = await auth.protect();
  const enabled = formData.get("enabled") === "on";
  const limit = Number(formData.get("daily_limit"));
  if (!Number.isFinite(limit) || limit < 0 || limit > MAX_DAILY_LIMIT) {
    return { error: `Daily limit must be a number between 0 and ${MAX_DAILY_LIMIT}.` };
  }
  try {
    await saveAgentSettings(userId, { enabled, daily_limit: Math.round(limit * 100) / 100 });
  } catch (e) {
    console.error("updateAgentSettings failed", e);
    return { error: "Couldn't save. Please try again." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

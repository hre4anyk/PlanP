"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestAccess } from "@/lib/access";
import { searchProfiles, type SearchResult } from "@/lib/search";

export type SearchState = { query?: string; results?: SearchResult[]; error?: string };

const MAX_QUERY = 300;

export async function searchAction(_prev: SearchState, formData: FormData): Promise<SearchState> {
  const { userId } = await auth.protect();
  const query = String(formData.get("q") ?? "").trim();
  if (query.length < 3) return { error: "Describe who you're looking for (a few words at least)." };
  if (query.length > MAX_QUERY) return { query, error: `Keep it under ${MAX_QUERY} characters.` };
  try {
    return { query, results: await searchProfiles(userId, query) };
  } catch (e) {
    console.error("searchAction failed", e);
    return { query, error: "The agent couldn't search right now. Please try again." };
  }
}

export type UnlockState = { error?: string };

export async function unlockProfile(ownerId: string): Promise<UnlockState> {
  const { userId } = await auth.protect();
  let result;
  try {
    result = await requestAccess(userId, ownerId);
  } catch (e) {
    console.error("unlockProfile failed", e);
    return { error: "Something went wrong. Please try again." };
  }
  if (!result.ok) return { error: result.error };
  revalidatePath("/library");
  revalidatePath("/dashboard");
  redirect(`/profile/${ownerId}`);
}

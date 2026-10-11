"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { syncProfileNft } from "@/lib/nft";
import { claimTokens, ensureWallet } from "@/lib/stellar";

export async function activateWallet(): Promise<void> {
  const { userId } = await auth.protect();
  try {
    await ensureWallet(userId);
  } catch (e) {
    console.error("activateWallet failed", e);
  }
  revalidatePath("/dashboard");
}

export type MintState = { error?: string };

export async function mintProfileNft(): Promise<MintState> {
  const { userId } = await auth.protect();
  try {
    const tx = await syncProfileNft(userId);
    if (!tx) return { error: "Upload your CV first — the NFT is built from your profile." };
  } catch (e) {
    console.error("mintProfileNft failed", e);
    return { error: "The Stellar network didn't accept it. Please try again." };
  }
  revalidatePath("/dashboard");
  return {};
}

export type ClaimState = { error?: string };

export async function claimAcdc(): Promise<ClaimState> {
  const { userId } = await auth.protect();
  let result;
  try {
    result = await claimTokens(userId);
  } catch (e) {
    console.error("claimAcdc failed", e);
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath("/dashboard");
  return result.ok ? {} : { error: result.error };
}

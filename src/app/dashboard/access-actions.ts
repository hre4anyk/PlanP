"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { MAX_ACCESS_PRICE, setAccessPrice } from "@/lib/access";

export type PriceState = { error?: string; ok?: boolean };

export async function updateAccessPrice(_prev: PriceState, formData: FormData): Promise<PriceState> {
  const { userId } = await auth.protect();
  const price = Number(formData.get("price"));
  if (!Number.isFinite(price) || price < 0 || price > MAX_ACCESS_PRICE) {
    return { error: `Price must be between 0 and ${MAX_ACCESS_PRICE} ACDC.` };
  }
  try {
    await setAccessPrice(userId, Math.round(price * 100) / 100);
  } catch (e) {
    console.error("updateAccessPrice failed", e);
    return { error: "Couldn't save. Upload your CV first, then set a price." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/library");
  return { ok: true };
}

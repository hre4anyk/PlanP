import "server-only";
import { canAgentSpend, logAgentAction } from "@/lib/agent";
import { acdcBalance, ensureWallet, payAcdc } from "@/lib/stellar";
import { getProfile, supabase } from "@/lib/supabase";

export type AccessGrant = {
  owner_id: string;
  requester_id: string;
  price: number;
  tx_hash: string | null;
  created_at: string;
};

export const DEFAULT_ACCESS_PRICE = 10;
export const MAX_ACCESS_PRICE = 1000;

export async function getAccessPrice(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("access_price")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.access_price) : DEFAULT_ACCESS_PRICE;
}

export async function setAccessPrice(userId: string, price: number) {
  const { error } = await supabase.from("profiles").update({ access_price: price }).eq("user_id", userId);
  if (error) throw error;
}

// A grant only counts once its payment landed (tx_hash set) or the profile was free.
export async function hasAccess(viewerId: string, ownerId: string): Promise<AccessGrant | "owner" | null> {
  if (viewerId === ownerId) return "owner";
  const { data, error } = await supabase
    .from("access_grants")
    .select("owner_id, requester_id, price, tx_hash, created_at")
    .eq("owner_id", ownerId)
    .eq("requester_id", viewerId)
    .maybeSingle();
  if (error) throw error;
  if (!data || (data.tx_hash === null && Number(data.price) > 0)) return null;
  return { ...data, price: Number(data.price) };
}

export async function getUnlockedOwnerIds(viewerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("access_grants")
    .select("owner_id, tx_hash, price")
    .eq("requester_id", viewerId);
  if (error) throw error;
  return new Set(
    (data ?? []).filter((g) => g.tx_hash !== null || Number(g.price) === 0).map((g) => g.owner_id),
  );
}

export async function getGrantsForOwner(ownerId: string): Promise<AccessGrant[]> {
  const { data, error } = await supabase
    .from("access_grants")
    .select("owner_id, requester_id, price, tx_hash, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((g) => g.tx_hash !== null || Number(g.price) === 0)
    .map((g) => ({ ...g, price: Number(g.price) }));
}

export type AccessResult = { ok: true } | { ok: false; error: string };

/**
 * The requester's agent pays the owner the access price in ACDC, on-chain, then access is
 * granted permanently. Blocked (and logged) if the agent is off or over its daily limit.
 */
export async function requestAccess(requesterId: string, ownerId: string): Promise<AccessResult> {
  if (requesterId === ownerId) return { ok: false, error: "That's your own profile." };
  if (await hasAccess(requesterId, ownerId)) return { ok: true };

  const [owner, requester] = await Promise.all([getProfile(ownerId), getProfile(requesterId)]);
  if (!owner?.cv_summary) return { ok: false, error: "This profile isn't available." };
  const price = Number(owner.access_price ?? DEFAULT_ACCESS_PRICE);
  const ownerName = owner.first_name?.split(/\s+/)[0] ?? "this person";
  const requesterName = requester?.first_name?.split(/\s+/)[0] ?? "Someone";

  if (price > 0) {
    const gate = await canAgentSpend(requesterId, price);
    if (!gate.ok) {
      await logAgentAction(requesterId, {
        kind: "payment_blocked",
        amount: price,
        counterparty: ownerId,
        note: `Didn't unlock ${ownerName}'s profile: ${gate.reason}`,
      });
      return { ok: false, error: gate.reason };
    }
    const [fromWallet] = await Promise.all([ensureWallet(requesterId), ensureWallet(ownerId)]);
    const balance = await acdcBalance(fromWallet.public_key);
    if (balance < price) {
      return {
        ok: false,
        error: `You need ${price} ACDC but have ${balance}. Claim your free 100 ACDC on your profile first.`,
      };
    }
  }

  // Reserve first: the unique (owner, requester) pair stops a double-click paying twice.
  const { error: reserveError } = await supabase
    .from("access_grants")
    .insert({ owner_id: ownerId, requester_id: requesterId, price });
  if (reserveError) {
    return reserveError.code === "23505"
      ? { ok: false, error: "A payment for this profile is already in progress." }
      : { ok: false, error: "Couldn't start the unlock. Please try again." };
  }

  if (price === 0) return { ok: true };

  let txHash: string;
  try {
    txHash = await payAcdc(requesterId, ownerId, price, "ACDC profile access");
  } catch (e) {
    console.error("payAcdc failed", e);
    await supabase.from("access_grants").delete().eq("owner_id", ownerId).eq("requester_id", requesterId);
    return { ok: false, error: "The Stellar network didn't accept the payment. Please try again." };
  }

  await supabase
    .from("access_grants")
    .update({ tx_hash: txHash })
    .eq("owner_id", ownerId)
    .eq("requester_id", requesterId);
  await Promise.all([
    logAgentAction(requesterId, {
      kind: "payment_sent",
      amount: price,
      counterparty: ownerId,
      tx_hash: txHash,
      note: `Paid ${ownerName} to unlock their full profile.`,
    }),
    logAgentAction(ownerId, {
      kind: "payment_received",
      amount: price,
      counterparty: requesterId,
      tx_hash: txHash,
      note: `${requesterName} paid to unlock your full profile.`,
    }),
  ]);
  return { ok: true };
}

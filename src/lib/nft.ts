import "server-only";
import { createHash } from "node:crypto";
import { Asset, BASE_FEE, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { logAgentAction } from "@/lib/agent";
import {
  NETWORK_PASSPHRASE,
  ensureWallet,
  getWalletKeypair,
  horizon,
  issuerKeypair,
} from "@/lib/stellar";
import { supabase } from "@/lib/supabase";
import { getUserScore } from "@/lib/user-score";

// Smallest unit on Stellar: exactly one indivisible unit ever exists.
export const NFT_AMOUNT = "0.0000001";

export type ProfileNft = {
  asset_code: string;
  mint_tx: string | null;
  last_tx: string | null;
  onchain_score: number | null;
  content_hash: string | null;
  updated_at: string;
};

export function nftAssetCode(userId: string): string {
  return `PRF${createHash("sha256").update(userId).digest("hex").slice(0, 9).toUpperCase()}`;
}

export function nftAsset(userId: string): Asset {
  return new Asset(nftAssetCode(userId), issuerKeypair().publicKey());
}

export async function getProfileNft(userId: string): Promise<ProfileNft | null> {
  const { data, error } = await supabase
    .from("profile_nfts")
    .select("asset_code, mint_tx, last_tx, onchain_score, content_hash, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Fingerprint of the profile content — lets anyone verify later that it wasn't altered.
function contentHash(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/**
 * Mints the profile NFT on first call, then writes the current score + content hash
 * on-chain (as data entries on the issuer account) whenever they change.
 * Returns the transaction hash, or null if nothing needed to change.
 */
export async function syncProfileNft(userId: string): Promise<string | null> {
  const [{ score, profile, contributions }, existing] = await Promise.all([
    getUserScore(userId),
    getProfileNft(userId),
  ]);
  if (!profile?.cv_summary) return null;

  const hash = contentHash({
    cv: profile.cv_summary,
    work: contributions.map((c) => [c.title, c.weight]),
  });
  const minted = Boolean(existing?.mint_tx);
  if (minted && existing?.onchain_score === score && existing.content_hash === hash) return null;

  const wallet = await ensureWallet(userId);
  if (!wallet.funded) return null;

  const issuer = issuerKeypair();
  const code = nftAssetCode(userId);
  const asset = nftAsset(userId);
  const builder = new TransactionBuilder(await horizon.loadAccount(issuer.publicKey()), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (!minted) {
    builder
      .addOperation(Operation.changeTrust({ asset, limit: NFT_AMOUNT, source: wallet.public_key }))
      .addOperation(Operation.payment({ destination: wallet.public_key, asset, amount: NFT_AMOUNT }));
  }
  builder
    .addOperation(Operation.manageData({ name: `${code}.score`, value: String(score) }))
    .addOperation(Operation.manageData({ name: `${code}.hash`, value: hash }))
    .addOperation(
      Operation.manageData({ name: `${code}.updated`, value: new Date().toISOString().slice(0, 19) }),
    );

  const tx = builder.setTimeout(60).build();
  tx.sign(issuer);
  if (!minted) tx.sign(await getWalletKeypair(userId));
  const { hash: txHash } = await horizon.submitTransaction(tx);

  const now = new Date().toISOString();
  await supabase.from("profile_nfts").upsert({
    user_id: userId,
    asset_code: code,
    mint_tx: existing?.mint_tx ?? txHash,
    last_tx: txHash,
    onchain_score: score,
    content_hash: hash,
    updated_at: now,
  });

  await logAgentAction(userId, {
    kind: minted ? "nft_updated" : "nft_minted",
    tx_hash: txHash,
    note: minted
      ? `Updated your profile NFT ${code} on-chain: score ${existing?.onchain_score ?? "—"} → ${score}.`
      : `Minted your 1-of-1 profile NFT ${code} with score ${score}.`,
  });

  return txHash;
}

import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { supabase } from "@/lib/supabase";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const EXPLORER_URL = "https://stellar.expert/explorer/testnet";
const FRIENDBOT_URL = "https://friendbot.stellar.org";

export const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

export type Wallet = { user_id: string; public_key: string; funded: boolean };
export type Balance = { asset: string; amount: string };

function encryptionKey() {
  const key = Buffer.from(process.env.WALLET_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("WALLET_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

async function getWallet(userId: string): Promise<Wallet | null> {
  const { data, error } = await supabase
    .from("wallets")
    .select("user_id, public_key, funded")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getWalletKeypair(userId: string): Promise<Keypair> {
  const { data, error } = await supabase
    .from("wallets")
    .select("secret_enc")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return Keypair.fromSecret(decrypt(data.secret_enc));
}

async function accountExists(publicKey: string): Promise<boolean> {
  try {
    await horizon.loadAccount(publicKey);
    return true;
  } catch {
    return false;
  }
}

// Testnet accounts only exist on-chain once funded; Friendbot gives 10,000 test XLM for fees.
export async function fundWallet(wallet: Wallet): Promise<Wallet> {
  if (!(await accountExists(wallet.public_key))) {
    await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(wallet.public_key)}`);
    if (!(await accountExists(wallet.public_key))) return wallet;
  }
  await supabase.from("wallets").update({ funded: true }).eq("user_id", wallet.user_id);
  return { ...wallet, funded: true };
}

export async function ensureWallet(userId: string): Promise<Wallet> {
  let wallet = await getWallet(userId);
  if (!wallet) {
    const kp = Keypair.random();
    // ignoreDuplicates: if two requests race, the first insert wins and both read it back.
    const { error } = await supabase
      .from("wallets")
      .upsert(
        { user_id: userId, public_key: kp.publicKey(), secret_enc: encrypt(kp.secret()) },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    if (error) throw error;
    wallet = await getWallet(userId);
    if (!wallet) throw new Error("Wallet creation failed");
  }
  return wallet.funded ? wallet : fundWallet(wallet);
}

export const CLAIM_AMOUNT = "100";

export function issuerKeypair() {
  const secret = process.env.ACDC_ISSUER_SECRET;
  if (!secret) throw new Error("ACDC_ISSUER_SECRET is not set");
  return Keypair.fromSecret(secret);
}

export function acdcAsset() {
  return new Asset("ACDC", issuerKeypair().publicKey());
}

export async function getClaim(userId: string): Promise<{ tx_hash: string | null } | null> {
  const { data, error } = await supabase
    .from("token_claims")
    .select("tx_hash")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// One transaction, paid by the issuer: opens the user's ACDC trustline (a Stellar account
// must opt in before holding a token) and sends them 100 ACDC. Signed by both parties.
async function sendClaim(userId: string): Promise<string> {
  const issuer = issuerKeypair();
  const user = await getWalletKeypair(userId);
  const asset = acdcAsset();

  const [issuerAccount, userAccount] = await Promise.all([
    horizon.loadAccount(issuer.publicKey()),
    horizon.loadAccount(user.publicKey()),
  ]);
  const hasTrustline = userAccount.balances.some(
    (b) => "asset_code" in b && b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );

  const builder = new TransactionBuilder(issuerAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (!hasTrustline) builder.addOperation(Operation.changeTrust({ asset, source: user.publicKey() }));
  const tx = builder
    .addOperation(Operation.payment({ destination: user.publicKey(), asset, amount: CLAIM_AMOUNT }))
    .setTimeout(60)
    .build();
  tx.sign(issuer, user);

  const result = await horizon.submitTransaction(tx);
  return result.hash;
}

export type ClaimResult = { ok: true; txHash: string } | { ok: false; error: string };

export async function claimTokens(userId: string): Promise<ClaimResult> {
  const wallet = await ensureWallet(userId);
  if (!wallet.funded) return { ok: false, error: "Activate your wallet first." };

  // Reserve the claim first so double-clicks or parallel requests can't pay twice.
  const { error: reserveError } = await supabase.from("token_claims").insert({ user_id: userId });
  if (reserveError) {
    return reserveError.code === "23505"
      ? { ok: false, error: "You've already claimed your 100 ACDC." }
      : { ok: false, error: "Couldn't start the claim. Please try again." };
  }

  try {
    const txHash = await sendClaim(userId);
    await supabase.from("token_claims").update({ tx_hash: txHash }).eq("user_id", userId);
    return { ok: true, txHash };
  } catch (e) {
    console.error("claimTokens failed", e);
    await supabase.from("token_claims").delete().eq("user_id", userId);
    return { ok: false, error: "The Stellar network didn't accept the transfer. Please try again." };
  }
}

export async function acdcBalance(publicKey: string): Promise<number> {
  const account = await horizon.loadAccount(publicKey);
  const asset = acdcAsset();
  const line = account.balances.find(
    (b) => "asset_code" in b && b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );
  return line ? Number(line.balance) : 0;
}

// Sends ACDC between two app-managed wallets. If the receiver has never held ACDC,
// their trustline is opened in the same transaction (we hold their key, so we can co-sign).
export async function payAcdc(fromUserId: string, toUserId: string, amount: number, memo: string) {
  const [from, to] = await Promise.all([getWalletKeypair(fromUserId), getWalletKeypair(toUserId)]);
  const asset = acdcAsset();
  const [fromAccount, toAccount] = await Promise.all([
    horizon.loadAccount(from.publicKey()),
    horizon.loadAccount(to.publicKey()),
  ]);
  const receiverHasTrustline = toAccount.balances.some(
    (b) => "asset_code" in b && b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );

  const builder = new TransactionBuilder(fromAccount, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE });
  if (!receiverHasTrustline) {
    builder.addOperation(Operation.changeTrust({ asset, source: to.publicKey() }));
  }
  const tx = builder
    .addOperation(
      Operation.payment({ destination: to.publicKey(), asset, amount: amount.toFixed(7) }),
    )
    .addMemo(Memo.text(memo.slice(0, 28)))
    .setTimeout(60)
    .build();
  tx.sign(from);
  if (!receiverHasTrustline) tx.sign(to);
  const result = await horizon.submitTransaction(tx);
  return result.hash;
}

export async function getBalances(publicKey: string): Promise<Balance[]> {
  const account = await horizon.loadAccount(publicKey);
  return account.balances.map((b) => ({
    asset: b.asset_type === "native" ? "XLM" : "asset_code" in b ? b.asset_code : b.asset_type,
    amount: b.balance,
  }));
}

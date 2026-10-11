import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EXPLORER_URL,
  ensureWallet,
  getBalances,
  getClaim,
  type Balance,
  type Wallet,
} from "@/lib/stellar";
import { ClaimButton } from "./claim-button";
import { CopyButton } from "./copy-button";
import { activateWallet } from "./wallet-actions";

function formatAmount(amount: string) {
  return Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export async function WalletCard({ userId }: { userId: string }) {
  let wallet: Wallet | null = null;
  let balances: Balance[] = [];
  let claim: { tx_hash: string | null } | null = null;
  try {
    wallet = await ensureWallet(userId);
    [balances, claim] = await Promise.all([
      wallet.funded ? getBalances(wallet.public_key) : Promise.resolve([]),
      getClaim(userId),
    ]);
  } catch (e) {
    console.error("WalletCard failed", e);
  }
  balances.sort((a, b) => (a.asset === "ACDC" ? -1 : b.asset === "ACDC" ? 1 : 0));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Stellar wallet</CardTitle>
          <Badge variant="outline">Testnet</Badge>
        </div>
        <CardDescription>Created and funded for you. Test network — no real money.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!wallet ? (
          <form action={activateWallet} className="flex flex-col items-start gap-2">
            <p className="text-sm text-destructive">Couldn&apos;t set up your wallet right now.</p>
            <Button type="submit" size="sm">Try again</Button>
          </form>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Address</span>
              <div className="flex items-center gap-2">
                <code className="truncate rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground" title={wallet.public_key}>
                  {wallet.public_key.slice(0, 6)}…{wallet.public_key.slice(-6)}
                </code>
                <CopyButton text={wallet.public_key} />
              </div>
            </div>

            {wallet.funded ? (
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <div className="flex flex-col">
                  <span className="font-heading text-4xl leading-none font-bold tabular-nums">
                    {formatAmount(balances.find((b) => b.asset === "ACDC")?.amount ?? "0")}
                  </span>
                  <span className="mt-1.5 text-xs text-subtle">ACDC</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-base tabular-nums text-muted-foreground">
                    {formatAmount(balances.find((b) => b.asset === "XLM")?.amount ?? "0")}
                  </span>
                  <span className="mt-1 text-xs text-subtle">XLM · pays network fees</span>
                </div>
              </div>
            ) : (
              <form action={activateWallet} className="flex flex-col items-start gap-2">
                <p className="text-sm text-muted-foreground">
                  Your wallet isn&apos;t activated on the test network yet.
                </p>
                <Button type="submit" size="sm">Activate wallet</Button>
              </form>
            )}

            {wallet.funded &&
              (claim?.tx_hash ? (
                <p className="text-sm text-muted-foreground">
                  <span className="text-success">100 ACDC claimed ✓</span>{" "}
                  <a
                    href={`${EXPLORER_URL}/tx/${claim.tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    View transaction ↗
                  </a>
                </p>
              ) : (
                <ClaimButton />
              ))}

            <a
              href={`${EXPLORER_URL}/account/${wallet.public_key}`}
              target="_blank"
              rel="noreferrer"
              className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              View on public explorer ↗
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}

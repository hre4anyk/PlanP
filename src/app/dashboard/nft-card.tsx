import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfileNft } from "@/lib/nft";
import { EXPLORER_URL, issuerKeypair } from "@/lib/stellar";
import { MintButton } from "./mint-button";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">
      {children}
    </a>
  );
}

export async function NftCard({ userId }: { userId: string }) {
  const nft = await getProfileNft(userId).catch(() => null);
  const issuer = issuerKeypair().publicKey();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Profile NFT</CardTitle>
          <Badge variant="outline">Testnet</Badge>
        </div>
        <CardDescription>
          A 1-of-1 token in your wallet. Your agent rewrites it on-chain every time your score moves — anyone can verify it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!nft?.mint_tx ? (
          <>
            <p className="text-sm text-muted-foreground">
              Not minted yet. Your agent mints it on your next upload — or do it now.
            </p>
            <MintButton />
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-8">
              <div className="flex flex-col">
                <span className="font-mono text-base text-foreground">{nft.asset_code}</span>
                <span className="text-xs text-muted-foreground">Token (1 of 1)</span>
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-2xl leading-none font-bold tabular-nums">{nft.onchain_score}</span>
                <span className="text-xs text-muted-foreground">Score on-chain</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold">
                  {new Date(nft.updated_at).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs text-muted-foreground">Last updated</span>
              </div>
            </div>
            {nft.content_hash && (
              <p className="text-xs text-muted-foreground">
                Profile fingerprint:{" "}
                <code className="break-all">{nft.content_hash.slice(0, 16)}…</code>
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <ExternalLink href={`${EXPLORER_URL}/asset/${nft.asset_code}-${issuer}`}>View NFT ↗</ExternalLink>
              <ExternalLink href={`${EXPLORER_URL}/tx/${nft.mint_tx}`}>Mint transaction ↗</ExternalLink>
              {nft.last_tx && nft.last_tx !== nft.mint_tx && (
                <ExternalLink href={`${EXPLORER_URL}/tx/${nft.last_tx}`}>Latest update ↗</ExternalLink>
              )}
              <ExternalLink href={`${EXPLORER_URL}/account/${issuer}`}>On-chain data ↗</ExternalLink>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

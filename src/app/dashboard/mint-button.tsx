"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { mintProfileNft, type MintState } from "./wallet-actions";

export function MintButton() {
  const [state, formAction, pending] = useActionState<MintState>(mintProfileNft, {});
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <Button type="submit" disabled={pending}>
        {pending ? "Minting on Stellar… (~5 sec)" : "Mint my profile NFT"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

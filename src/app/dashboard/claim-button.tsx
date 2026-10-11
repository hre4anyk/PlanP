"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { claimAcdc, type ClaimState } from "./wallet-actions";

export function ClaimButton() {
  const [state, formAction, pending] = useActionState<ClaimState>(claimAcdc, {});
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <Button type="submit" disabled={pending}>
        {pending ? "Sending on Stellar… (~5 sec)" : "Claim 100 ACDC"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { unlockProfile, type UnlockState } from "./actions";

export function UnlockButton({ ownerId, price, primary = false }: { ownerId: string; price: number; primary?: boolean }) {
  const [state, formAction, pending] = useActionState<UnlockState>(
    unlockProfile.bind(null, ownerId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button
        type="submit"
        size={primary ? "lg" : "sm"}
        variant={primary ? "default" : "outline"}
        disabled={pending}
        className={primary ? "self-start" : "self-start hover:border-primary hover:bg-primary hover:text-primary-foreground"}
      >
        {pending ? "Your agent is paying…" : price > 0 ? `Unlock for ${price} ACDC` : "Unlock for free"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

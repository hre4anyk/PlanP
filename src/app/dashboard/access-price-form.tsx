"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAccessPrice, type PriceState } from "./access-actions";

export function AccessPriceForm({ price }: { price: number }) {
  const [state, formAction, pending] = useActionState<PriceState, FormData>(updateAccessPrice, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="access-price" className="text-xs text-muted-foreground">
            Price to unlock my full profile (ACDC)
          </Label>
          <Input
            id="access-price"
            name="price"
            type="number"
            min={0}
            step="any"
            defaultValue={price}
            disabled={pending}
            className="w-32"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && !pending && <p className="text-sm text-muted-foreground">Saved.</p>}
    </form>
  );
}

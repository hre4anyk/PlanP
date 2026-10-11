"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateAgentSettings, type AgentFormState } from "./agent-actions";

export function AgentSettingsForm({ enabled, dailyLimit }: { enabled: boolean; dailyLimit: number }) {
  const [state, formAction, pending] = useActionState<AgentFormState, FormData>(updateAgentSettings, {});
  const [on, setOn] = useState(enabled);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Switch id="agent-enabled" name="enabled" checked={on} onCheckedChange={setOn} disabled={pending} />
        <Label htmlFor="agent-enabled" className="text-sm">
          {on ? "Agent can spend my ACDC" : "Agent can't spend my ACDC"}
        </Label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="daily-limit" className="text-xs text-muted-foreground">
            Daily spending limit (ACDC)
          </Label>
          <Input
            id="daily-limit"
            name="daily_limit"
            type="number"
            min={0}
            step="any"
            defaultValue={dailyLimit}
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

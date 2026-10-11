"use client";

import { useActionState, useState } from "react";
import { AgentCharacter, type AgentState } from "@/components/agent-character";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchAction, type SearchState } from "./actions";
import { ProfileCard } from "./profile-card";

export function AgentSearch({ viewerId, unlockedIds }: { viewerId: string; unlockedIds: string[] }) {
  const [state, formAction, pending] = useActionState<SearchState, FormData>(searchAction, {});
  const unlocked = new Set(unlockedIds);
  const [focused, setFocused] = useState(false);
  // Results the user has already "seen" (acknowledged by focusing the box again) don't re-trigger a celebration.
  const [seenKey, setSeenKey] = useState("");
  const resultsKey = state.results ? `${state.query}|${state.results.map((r) => r.card.user_id).join(",")}` : "";

  const agentState: AgentState = pending
    ? "speaking"
    : focused
      ? "listening"
      : state.results?.length && resultsKey !== seenKey
        ? "congratz"
        : "idle";

  return (
    <section className="mt-10 flex flex-col gap-4">
      <div className="flex items-center gap-3 sm:gap-5">
      <AgentCharacter state={agentState} label="Your search agent" className="size-24 shrink-0 sm:size-32" />
      <form
        action={formAction}
        onSubmit={() => (document.activeElement as HTMLElement | null)?.blur()}
        className="flex flex-1 flex-col gap-2 sm:flex-row"
      >
        <Input
          onFocus={() => {
            setFocused(true);
            setSeenKey(resultsKey);
          }}
          onBlur={() => setFocused(false)}
          name="q"
          defaultValue={state.query}
          placeholder="Who are you looking for? e.g. a founder who ships AI products and can raise money"
          maxLength={300}
          disabled={pending}
          className="h-12 flex-1 px-4 text-base md:text-base"
        />
        <Button type="submit" disabled={pending} className="h-12 px-6 text-base">
          {pending ? "Agent is reading profiles…" : "Ask the agent"}
        </Button>
      </form>
      </div>
      <p className="text-xs text-subtle">
        Reasons stay general — company names, numbers and projects stay private until you unlock.
      </p>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state.results && !pending && (
        <div className="flex flex-col gap-3">
          <h2 className="mt-6 text-xl font-bold">
            {state.results.length
              ? `Best matches for “${state.query}”`
              : `No good matches for “${state.query}” yet`}
          </h2>
          {state.results.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {state.results.map((r) => (
                <ProfileCard
                  key={r.card.user_id}
                  card={r.card}
                  isMe={r.card.user_id === viewerId}
                  unlocked={unlocked.has(r.card.user_id)}
                  match={{ percent: r.percent, reason: r.reason }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

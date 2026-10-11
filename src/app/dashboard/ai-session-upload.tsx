"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadAiSession, type UploadState } from "./actions";

export function AiSessionUpload({ full }: { full: boolean }) {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(uploadAiSession, {});

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <Input
          name="session"
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          required
          disabled={pending}
          className="max-w-xs"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Summarizing…" : "Add AI work"}
        </Button>
      </form>
      {full && !state.error && (
        <p className="text-xs text-muted-foreground">
          Your oldest upload will leave your full profile to make room — its credit and history stay.
        </p>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}

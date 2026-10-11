"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadCv, type UploadState } from "./actions";

export function CvUpload({ hasCv }: { hasCv: boolean }) {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(uploadCv, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Input name="cv" type="file" accept="application/pdf" required disabled={pending} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Reading your CV… (~15 sec)" : hasCv ? "Replace CV" : "Upload CV"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && !pending && <p className="text-sm text-muted-foreground">Done — summary updated.</p>}
    </form>
  );
}

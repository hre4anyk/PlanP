import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { buttonVariants } from "@/components/ui/button";
import { getScoreEvent, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Turn = { role: "You" | "Assistant"; text: string };

// Parses our export format ("You:" / "Assistant:" on their own line).
// Returns null for files in any other format, which are shown as plain text.
function parseTranscript(raw: string): { meta: string[]; turns: Turn[] } | null {
  const meta: string[] = [];
  const turns: Turn[] = [];
  let current: Turn | null = null;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "You:" || trimmed === "Assistant:") {
      if (current) turns.push(current);
      current = { role: trimmed.slice(0, -1) as Turn["role"], text: "" };
    } else if (current) {
      current.text += `${line}\n`;
    } else if (trimmed) {
      meta.push(trimmed);
    }
  }
  if (current) turns.push(current);
  if (turns.length === 0) return null;

  // Claude Code splits one reply into many entries; merge consecutive same-speaker turns.
  const merged: Turn[] = [];
  for (const t of turns) {
    const text = t.text.trim();
    if (!text) continue;
    const last = merged[merged.length - 1];
    if (last?.role === t.role) last.text += `\n\n${text}`;
    else merged.push({ role: t.role, text });
  }
  return { meta, turns: merged };
}

export default async function HistoryFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const event = Number.isInteger(Number(id)) ? await getScoreEvent(userId, Number(id)) : null;
  if (!event?.bucket || !event.file_path) notFound();

  const header = (
    <div className="flex flex-col gap-2">
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start")}>
        ← Back to profile
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{event.event}</h1>
      {event.detail && <p className="text-muted-foreground">{event.detail}</p>}
      <p className="text-sm text-muted-foreground">
        Score {event.score_before} → {event.score_after}
        {event.reason && <> · {event.reason}</>}
      </p>
    </div>
  );

  if (event.file_path.endsWith(".pdf")) {
    const { data } = await supabase.storage.from(event.bucket).createSignedUrl(event.file_path, 300);
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12">
        {header}
        {data?.signedUrl ? (
          <>
            <a href={data.signedUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants(), "self-start")}>
              Open PDF in new tab
            </a>
            <iframe src={data.signedUrl} title="CV" className="h-[80vh] w-full rounded-lg border" />
          </>
        ) : (
          <p className="text-sm text-destructive">This file is no longer available.</p>
        )}
      </div>
    );
  }

  const { data: blob } = await supabase.storage.from(event.bucket).download(event.file_path);
  const raw = blob ? await blob.text() : null;
  const parsed = raw ? parseTranscript(raw) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      {header}
      {!raw && <p className="text-sm text-destructive">This file is no longer available.</p>}
      {parsed && (
        <>
          {parsed.meta.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {parsed.meta.map((m, i) => (
                <p key={i}>{m}</p>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-3">
            {parsed.turns.map((t, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-4 py-3 text-sm",
                  t.role === "You" ? "self-end border border-input bg-secondary text-foreground" : "self-start bg-muted text-muted-foreground",
                )}
              >
                <p className="mb-1 text-xs font-medium opacity-70">{t.role}</p>
                {t.text}
              </div>
            ))}
          </div>
        </>
      )}
      {raw && !parsed && (
        <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted p-4 text-sm">{raw}</pre>
      )}
    </div>
  );
}

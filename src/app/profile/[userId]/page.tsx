import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasAccess } from "@/lib/access";
import { EXPLORER_URL } from "@/lib/stellar";
import { getAiSessions, getScoreEvents } from "@/lib/supabase";
import { getUserScore } from "@/lib/user-score";
import { UnlockButton } from "../../library/unlock-button";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function FullProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: viewerId } = await auth.protect();
  const { userId: ownerId } = await params;

  const [{ score, profile, contributions }, access] = await Promise.all([
    getUserScore(ownerId),
    hasAccess(viewerId, ownerId),
  ]);
  if (!profile?.cv_summary) notFound();

  const name = profile.first_name?.split(/\s+/)[0] ?? "Anonymous";
  const location = profile.location?.split(/\s+/)[0];
  const price = Number(profile.access_price ?? 10);

  const header = (
    <div className="flex items-end justify-between gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/library" className="self-start text-sm text-muted-foreground hover:text-foreground">
          ← Library
        </Link>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {location && <Badge variant="secondary">{location}</Badge>}
          {profile.superpower && <span className="text-muted-foreground">{profile.superpower}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-heading text-6xl leading-none font-bold tabular-nums">{score}</span>
        <span className="mt-2 text-xs text-subtle">AI Leverage Score</span>
      </div>
    </div>
  );

  if (!access) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pt-12 pb-24 sm:px-6">
        {header}
        <Card>
          <CardHeader>
            <CardTitle>This profile is private</CardTitle>
            <CardDescription>
              Unlock it to see {name}&apos;s executive summary, AI work, everything credited to their
              score, and its history. Your agent pays {name} {price} ACDC on Stellar — access is
              permanent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnlockButton ownerId={ownerId} price={price} primary />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [sessions, events] = await Promise.all([getAiSessions(ownerId), getScoreEvents(ownerId)]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-12 pb-24 sm:px-6">
      {header}

      {access === "owner" ? (
        <p className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
          This is how your profile looks to people who unlock it. Raw files (CV PDF, chats) are never shown.
        </p>
      ) : (
        access.tx_hash && (
          <p className="text-sm text-muted-foreground">
            Unlocked on {formatDate(access.created_at)} for {access.price} ACDC ·{" "}
            <a href={`${EXPLORER_URL}/tx/${access.tx_hash}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              payment on Stellar ↗
            </a>
          </p>
        )
      )}

      <Card>
        <CardHeader>
          <CardTitle>Executive summary</CardTitle>
          {profile.headline && <CardDescription className="text-foreground">{profile.headline}</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          {profile.cv_summary.split(/\n\s*\n/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </CardContent>
      </Card>

      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent AI work</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sessions.map((s) => (
              <div key={s.slot} className="flex flex-col gap-1">
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {contributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s credited ({contributions.length})</CardTitle>
            <CardDescription>Distinct features, tools and integrations built with AI — each counted once.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {contributions.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="flex flex-col">
                    <span>{c.title}</span>
                    {c.evidence && <span className="text-xs text-muted-foreground">{c.evidence}</span>}
                  </div>
                  <Badge variant={c.weight === 3 ? "default" : "secondary"} className="shrink-0">
                    {c.weight === 3 ? "hard" : c.weight === 2 ? "standard" : "routine"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Score history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {events.map((e) => {
                const delta = e.score_after - e.score_before;
                return (
                  <li key={e.id} className="flex flex-col gap-1 py-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {e.event} <span className="text-xs font-normal text-muted-foreground">{formatDate(e.created_at)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta} → {e.score_after}
                      </span>
                    </div>
                    {e.reason && <p className="text-xs text-muted-foreground">{e.reason}</p>}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

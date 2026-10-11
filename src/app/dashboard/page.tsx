import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getAgentSettings } from "@/lib/agent";
import { getClaim } from "@/lib/stellar";
import { getAiSessions, getScoreEvents } from "@/lib/supabase";
import { refreshSuperpower } from "@/lib/superpower";
import { getUserScore } from "@/lib/user-score";
import { cn } from "@/lib/utils";
import { AccessCard } from "./access-card";
import { AgentCard } from "./agent-card";
import { AiSessionUpload } from "./ai-session-upload";
import { CvUpload } from "./cv-upload";
import { ExportInstructions } from "./export-instructions";
import { NftCard } from "./nft-card";
import { ScoreHistory } from "./score-history";
import { WalletCard } from "./wallet-card";

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16">
      <div className="mb-6 flex flex-col gap-2">
        <p className="eyebrow">{label}</p>
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const { userId } = await auth.protect();
  const [user, { score, profile, contributions }, sessions, events, claim, agent] = await Promise.all([
    currentUser(),
    getUserScore(userId),
    getAiSessions(userId),
    getScoreEvents(userId).catch(() => []),
    getClaim(userId).catch(() => null),
    getAgentSettings(userId).catch(() => ({ enabled: false, daily_limit: 20 })),
  ]);
  if (profile?.cv_summary && !profile.superpower) {
    profile.superpower = await refreshSuperpower(userId);
  }
  const firstName = profile?.first_name || user?.firstName;

  const steps = [
    { label: "Upload your CV", done: Boolean(profile?.cv_summary), href: "#profile" },
    { label: "Add AI work", done: contributions.length > 0, href: "#profile" },
    { label: "Claim 100 ACDC", done: Boolean(claim?.tx_hash), href: "#money" },
    { label: "Switch on your agent", done: agent.enabled, href: "#money" },
  ];
  const nextStep = steps.findIndex((s) => !s.done);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">My profile</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{firstName ?? "Welcome"}</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            {profile?.headline ?? "Private until someone pays to read it. Start with your CV."}
          </p>
          {profile?.cv_summary && (
            <Link
              href={`/profile/${userId}`}
              className="mt-4 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Preview what buyers see →
            </Link>
          )}
        </div>
        <div className="w-full max-w-xs md:text-right">
          <div className="flex items-baseline gap-2 md:justify-end">
            <span className="font-heading text-6xl leading-none font-bold tabular-nums">{score}</span>
            <span className="text-sm text-subtle">/ 100</span>
          </div>
          <Progress value={score} className="mt-3" />
          <p className="mt-2 text-xs text-subtle">
            AI Leverage Score · {contributions.length} feature{contributions.length === 1 ? "" : "s"} credited
          </p>
        </div>
      </div>

      {/* Next steps */}
      {nextStep !== -1 && (
        <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.label} className="bg-background">
              <a
                href={s.href}
                className={cn(
                  "flex h-full items-center gap-3 px-4 py-4 text-sm transition-colors hover:bg-white/[0.03]",
                  i === nextStep ? "text-foreground" : s.done ? "text-subtle" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    s.done && "border-success/40 bg-success/10 text-success",
                    i === nextStep && "border-primary bg-primary text-primary-foreground",
                    !s.done && i !== nextStep && "border-input",
                  )}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className={cn(s.done && "line-through decoration-subtle")}>{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      {/* Profile */}
      <div id="profile" className="scroll-mt-24">
        <Section label="Profile" title="What recruiters read">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Executive summary</CardTitle>
                <CardDescription>
                  {profile?.cv_summary
                    ? "Written from your CV. The first thing a recruiter reads after unlocking."
                    : "Upload your CV as a PDF. You'll get a recruiter-grade summary in about 15 seconds."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {profile?.cv_summary && (
                  <div className="flex flex-col gap-3 border-l-2 border-input pl-4">
                    {profile.location && (
                      <Badge variant="secondary" className="self-start">
                        {profile.location}
                      </Badge>
                    )}
                    <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
                      {profile.cv_summary.split(/\n\s*\n/).map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  </div>
                )}
                <CvUpload hasCv={Boolean(profile?.cv_summary)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI work</CardTitle>
                <CardDescription>
                  Upload chat exports as you build. Each new feature, tool or integration is credited
                  once — repeats earn nothing.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <AiSessionUpload full={sessions.length >= 3} />
                <ExportInstructions />
                {contributions.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="eyebrow">Credited · {contributions.length}</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {contributions.map((c) => (
                        <li key={c.id}>
                          <Badge
                            variant={c.weight === 3 ? "default" : "secondary"}
                            title={c.evidence ?? undefined}
                            className="h-auto py-1 whitespace-normal"
                          >
                            {c.title}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-subtle">Orange = hard. Hover a tag to see the evidence.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </Section>
      </div>

      {/* Money & agent */}
      <div id="money" className="scroll-mt-24">
        <Section label="Money & agent" title="Your wallet and who can spend it">
          <div className="grid gap-4 lg:grid-cols-2">
            <WalletCard userId={userId} />
            <AgentCard userId={userId} />
          </div>
        </Section>
      </div>

      {/* Proof & access */}
      <Section label="Proof & access" title="On-chain proof, and your price to be read">
        <div className="grid gap-4 lg:grid-cols-2">
          <NftCard userId={userId} />
          <AccessCard userId={userId} />
        </div>
      </Section>

      {/* History */}
      <Section label="History" title="Every score change, and why">
        <Card>
          <CardContent>
            <ScoreHistory events={events} />
          </CardContent>
        </Card>
        <Link href="/library" className={cn(buttonVariants({ variant: "outline" }), "mt-8")}>
          Find people in the Library →
        </Link>
      </Section>
    </div>
  );
}

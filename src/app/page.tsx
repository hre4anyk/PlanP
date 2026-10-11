import Link from "next/link";
import { Show, SignUpButton } from "@clerk/nextjs";
import { Button, buttonVariants } from "@/components/ui/button";
import { AgentCharacter } from "@/components/agent-character";
import { cn } from "@/lib/utils";

const steps = [
  {
    n: "01",
    title: "Upload your CV",
    body: "A recruiter-grade summary in about 15 seconds. No buzzwords — only what's actually on the page.",
  },
  {
    n: "02",
    title: "Add the AI sessions you're proud of",
    body: "One command exports a Claude Code chat. Every feature, tool or integration you built is credited once. Re-uploading the same work earns nothing.",
  },
  {
    n: "03",
    title: "Get found. Get paid.",
    body: "Recruiters see a card: name, city, one-line superpower, score. To read the rest, their agent pays yours.",
  },
];

const onchain = [
  { title: "A wallet the moment you sign up", body: "Created and funded for you. No seed phrases, no extensions." },
  { title: "100 ACDC to start", body: "Claim once. Spend it unlocking the people you want to hire." },
  { title: "A 1-of-1 profile NFT", body: "Rewritten on-chain every time your score moves. Anyone can verify the history." },
  { title: "Paid to be read", body: "Set your price. Unlocks go straight to your wallet — your agent never spends past your limit." },
];

function PrimaryCta({ label }: { label: string }) {
  return (
    <>
      <Show when="signed-out">
        <SignUpButton mode="modal">
          <Button size="lg">{label}</Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
          Open my profile
        </Link>
      </Show>
    </>
  );
}

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 left-1/2 h-[600px] w-[800px] -translate-x-1/2"
          style={{ background: "radial-gradient(ellipse, rgba(255,77,46,0.15) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-4 px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
          <p className="eyebrow">For people who don&apos;t fit one job title</p>
          <h1 className="mt-6 max-w-4xl text-5xl leading-[1.02] font-bold sm:text-6xl lg:text-[4.25rem]">
            Your CV shows where you worked.{" "}
            <span className="text-primary">Your AI chats show how you work.</span>
          </h1>
          <p className="mt-8 hidden max-w-2xl text-lg leading-relaxed text-muted-foreground sm:block">
            ACDC AI reads the Claude and ChatGPT sessions you&apos;re proud of, credits every feature you
            actually built, and turns it into a profile a recruiter reads in 30 seconds.
          </p>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:hidden">
            Turn the AI sessions you&apos;re proud of into a profile recruiters read in 30 seconds.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <PrimaryCta label="Build my profile" />
            <a href="#how" className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}>
              How it works
            </a>
          </div>
          <p className="mt-6 text-sm text-subtle">Free. Private by default. You decide who reads the rest.</p>
          </div>
          <AgentCharacter
            interactive
            label="Your ACDC agent — click to say hi"
            className="mx-auto mt-6 size-[260px] sm:size-[320px] lg:mt-0 lg:h-[480px] lg:w-full"
          />
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:gap-16 md:py-20">
          <h2 className="text-3xl leading-tight font-bold sm:text-4xl">
            Recruiters screen logos and years. Not how you think.
          </h2>
          <div className="flex flex-col gap-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>
              Mixed careers, career switchers and people who ship with AI get filtered out before anyone
              sees the work.
            </p>
            <p className="text-foreground">The evidence already exists. It&apos;s sitting in your chat history.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-4 max-w-2xl text-3xl leading-tight font-bold sm:text-4xl">
          Three steps. The last one pays you.
        </h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-input pt-6">
              <span className="font-heading text-sm font-bold text-primary">{s.n}</span>
              <h3 className="mt-3 text-xl leading-snug font-bold">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* On-chain */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:gap-16">
            <div>
              <p className="eyebrow">On Stellar</p>
              <h2 className="mt-4 text-3xl leading-tight font-bold sm:text-4xl">Your agent handles the money.</h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Every payment and every profile update is a public transaction. Don&apos;t trust us — check it
                yourself.
              </p>
            </div>
            <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {onchain.map((f) => (
                <div key={f.title} className="border-l-2 border-primary/60 pl-5">
                  <dt className="font-medium text-foreground">{f.title}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-12 text-xs text-subtle">Runs on the Stellar test network. Test tokens have no cash value.</p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <h2 className="mx-auto max-w-3xl text-4xl leading-tight font-bold sm:text-5xl">
          Show the work. <span className="text-primary">Not the logo.</span>
        </h2>
        <div className="mt-10 flex justify-center">
          <PrimaryCta label="Build my profile — free" />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-xs text-subtle sm:px-6">
          <span>ACDC AI</span>
          <span>Built at AI Hacker House — Equinox Edition</span>
        </div>
      </footer>
    </div>
  );
}

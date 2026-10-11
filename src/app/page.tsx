import { buttonVariants } from "@/components/ui/button";
import { SnakeRoute } from "@/components/snake-route";

const steps = [
  {
    n: "01",
    title: "Pick your meeting",
    body: "Choose where you need to be. Plan P finds the garages within a short walk of the door.",
  },
  {
    n: "02",
    title: "Get your backup chain",
    body: "Plan A, B and C, ranked by shortest walk, drawn as one route. Your backups are planned before you leave.",
  },
  {
    n: "03",
    title: "Lot full? One tap.",
    body: "Hit the big button and keep driving. The route already continues to Plan B. No new search, no detour.",
  },
];

const calm = [
  { title: "One big button", body: "Sized for a thumb, not a fingertip. One action on screen at a time." },
  { title: "It talks to you", body: "“Plan A is full. Heading to Plan B.” You keep your eyes on the road." },
  { title: "Your maps app, your call", body: "Open turn-by-turn directions in Apple Maps or Google Maps at any point." },
  { title: "Never runs out", body: "If every lot is full, the chain grows. Plan D, E and F get added to the end." },
];

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="eyebrow">For drivers with somewhere to be</p>
            <h1 className="mt-6 max-w-3xl text-balance text-5xl leading-[1.02] font-bold sm:text-6xl lg:text-[4.25rem]">
              The lot is full. <span className="text-primary">You already have Plan B.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Plan P lines up backup parking before you leave. If your garage is full, tap once and keep
              driving to the next one.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a href="#how" className={buttonVariants({ size: "lg" })}>
                See how it works
              </a>
            </div>
            <p className="mt-6 text-sm text-subtle">Runs in your phone&apos;s browser. Nothing to install.</p>
          </div>
          <SnakeRoute className="mx-auto w-full max-w-[360px] lg:max-w-[440px]" />
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:gap-16 md:py-20">
          <h2 className="text-3xl leading-tight font-bold sm:text-4xl">
            Parking apps help you plan. Nothing helps when the plan fails.
          </h2>
          <div className="flex flex-col gap-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>
              You&apos;re five minutes from a meeting and the garage is full. You can&apos;t search while
              driving, so you circle. Every wrong turn makes you later.
            </p>
            <p>
              San Francisco drivers lose 83 hours a year looking for parking. More than 4 in 10 Americans
              have missed an appointment because they couldn&apos;t park.
            </p>
            <p className="text-xs text-subtle">Source: INRIX.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-4 max-w-2xl text-3xl leading-tight font-bold sm:text-4xl">
          Your backup is planned before you need it.
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

      {/* Built for the bad moment */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:gap-16">
            <div>
              <p className="eyebrow">Behind the wheel</p>
              <h2 className="mt-4 text-3xl leading-tight font-bold sm:text-4xl">Built for the stressful minute.</h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Big text, few words, one thing to do. Plan P stays calm so you can too.
              </p>
            </div>
            <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {calm.map((f) => (
                <div key={f.title} className="border-l-2 border-primary/60 pl-5">
                  <dt className="font-medium text-foreground">{f.title}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <h2 className="mx-auto max-w-3xl text-4xl leading-tight font-bold sm:text-5xl">
          Always have a <span className="text-primary">Plan P.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-muted-foreground">
          Launching first in downtown San Francisco.
        </p>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-xs text-subtle sm:px-6">
          <span>Plan P</span>
          <span>Parking data in this demo is simulated.</span>
        </div>
      </footer>
    </div>
  );
}

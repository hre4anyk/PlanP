import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { buttonVariants } from "@/components/ui/button";
import { getUnlockedOwnerIds } from "@/lib/access";
import { getLibraryCards } from "@/lib/library";
import { AgentSearch } from "./agent-search";
import { ProfileCard } from "./profile-card";

export default async function LibraryPage() {
  const { userId } = await auth.protect();
  const [cards, unlocked] = await Promise.all([getLibraryCards(), getUnlockedOwnerIds(userId)]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6">
      <p className="eyebrow">Library</p>
      <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-bold sm:text-5xl">
        Find the person, not the job title.
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Describe who you need. Your agent reads every full profile and tells you who fits — without
        giving away the private details. Unlock the ones worth it.
      </p>

      {cards.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-muted-foreground">No profiles yet. Be the first — upload your CV.</p>
          <Link href="/dashboard" className={buttonVariants()}>
            Build my profile
          </Link>
        </div>
      ) : (
        <>
          <AgentSearch viewerId={userId} unlockedIds={[...unlocked]} />
          <div className="mt-16 flex items-baseline justify-between gap-4">
            <p className="eyebrow">All profiles · {cards.length}</p>
            <p className="text-xs text-subtle">Sorted by AI Leverage Score</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <ProfileCard
                key={c.user_id}
                card={c}
                isMe={c.user_id === userId}
                unlocked={unlocked.has(c.user_id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

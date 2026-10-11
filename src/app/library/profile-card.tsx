import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LibraryCard } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { UnlockButton } from "./unlock-button";

export function ProfileCard({
  card,
  isMe,
  unlocked,
  match,
}: {
  card: LibraryCard;
  isMe: boolean;
  unlocked: boolean;
  match?: { percent: number; reason: string };
}) {
  return (
    <Card className={cn("flex flex-col", isMe && "border-primary/40")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <span className="truncate">{card.name}</span>
              {isMe && <Badge variant="outline">You</Badge>}
            </CardTitle>
            {card.location && (
              <Badge variant="secondary" className="self-start">
                {card.location}
              </Badge>
            )}
          </div>
          <span className="font-heading text-3xl leading-none font-bold tabular-nums" title="AI Leverage Score (out of 100)">
            {card.score}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-base leading-snug text-foreground">
            {card.superpower ?? <span className="text-muted-foreground">Superpower coming soon</span>}
          </p>
          {match && (
            <div className="border-l-2 border-primary pl-3 text-sm">
              <span className="font-medium text-primary">{match.percent}% match</span>
              <p className="mt-1 text-muted-foreground">{match.reason}</p>
            </div>
          )}
        </div>
        {isMe ? (
          <Link href={`/profile/${card.user_id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}>
            Preview my full profile
          </Link>
        ) : unlocked ? (
          <Link href={`/profile/${card.user_id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}>
            View full profile
          </Link>
        ) : (
          <UnlockButton ownerId={card.user_id} price={card.price} />
        )}
      </CardContent>
    </Card>
  );
}

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ScoreEvent } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Delta({ value }: { value: number }) {
  if (value === 0) return <Badge variant="outline">±0</Badge>;
  return (
    <Badge variant={value > 0 ? "success" : "destructive"}>
      {value > 0 ? `+${value}` : value}
    </Badge>
  );
}

export function ScoreHistory({ events }: { events: ScoreEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing yet. Your first upload starts the history.
      </p>
    );
  }

  return (
    <Accordion multiple className="w-full">
      {events.map((e) => (
        <AccordionItem key={e.id} value={e.id}>
          <AccordionTrigger className="items-center gap-3">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{e.event}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {formatDate(e.created_at)}
                </span>
              </span>
              {e.detail && (
                <span className="truncate text-xs font-normal text-muted-foreground">{e.detail}</span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Delta value={e.score_after - e.score_before} />
              <span className="w-14 text-right text-sm tabular-nums text-muted-foreground">
                {e.score_after}/100
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2 text-muted-foreground">
            {e.summary && <p>{e.summary}</p>}
            <p>
              <span className="font-medium text-foreground">Why: </span>
              {e.reason ?? "No explanation recorded."}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {e.file_path && (
                <Link
                  href={`/dashboard/history/${e.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}
                >
                  {e.file_path.endsWith(".pdf") ? "Open CV" : "Open conversation"}
                </Link>
              )}
              {e.nft_tx && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${e.nft_tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline underline-offset-4"
                >
                  NFT updated on-chain ↗
                </a>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

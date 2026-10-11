import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getAgentActions, getAgentSettings, spentLast24h, type AgentAction } from "@/lib/agent";
import { EXPLORER_URL } from "@/lib/stellar";
import { AgentSettingsForm } from "./agent-settings-form";

const KIND_LABEL: Record<AgentAction["kind"], string> = {
  enabled: "Turned on",
  disabled: "Turned off",
  limit_changed: "Limit changed",
  payment_sent: "Paid",
  payment_received: "Received",
  payment_blocked: "Blocked",
  nft_minted: "Minted NFT",
  nft_updated: "Updated NFT",
  searched: "Searched",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export async function AgentCard({ userId }: { userId: string }) {
  const [settings, spent, actions] = await Promise.all([
    getAgentSettings(userId),
    spentLast24h(userId),
    getAgentActions(userId, 8),
  ]);
  const usedPct = settings.daily_limit > 0 ? Math.min(100, (spent / settings.daily_limit) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Your AI agent</CardTitle>
          <Badge variant={settings.enabled ? "success" : "outline"}>{settings.enabled ? "On" : "Off"}</Badge>
        </div>
        <CardDescription>
          It pays for you — unlocking profiles, within a daily limit you set — and logs every move.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <AgentSettingsForm enabled={settings.enabled} dailyLimit={settings.daily_limit} />

        <div className="flex max-w-md flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Spent in the last 24h</span>
            <span className="tabular-nums">
              {spent} / {settings.daily_limit} ACDC
            </span>
          </div>
          <Progress value={usedPct} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="eyebrow">Activity</p>
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border border-t border-border">
              {actions.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{KIND_LABEL[a.kind]}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(a.created_at)}</span>
                    </span>
                    {a.note && <span className="text-muted-foreground">{a.note}</span>}
                    {a.tx_hash && (
                      <a
                        href={`${EXPLORER_URL}/tx/${a.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline underline-offset-4"
                      >
                        View transaction ↗
                      </a>
                    )}
                  </div>
                  {a.amount !== null && (
                    <span
                      className={`shrink-0 tabular-nums ${a.kind === "payment_received" ? "text-success" : ""}`}
                    >
                      {a.kind === "payment_received" ? "+" : a.kind === "payment_sent" ? "−" : ""}
                      {a.amount} ACDC
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

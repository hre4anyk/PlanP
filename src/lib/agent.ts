import "server-only";
import { supabase } from "@/lib/supabase";

export type AgentSettings = { enabled: boolean; daily_limit: number };

export type AgentActionKind =
  | "enabled"
  | "disabled"
  | "limit_changed"
  | "payment_sent"
  | "payment_received"
  | "payment_blocked"
  | "nft_minted"
  | "nft_updated"
  | "searched";

export type AgentAction = {
  id: number;
  created_at: string;
  kind: AgentActionKind;
  amount: number | null;
  counterparty: string | null;
  tx_hash: string | null;
  note: string | null;
};

const DEFAULT_SETTINGS: AgentSettings = { enabled: false, daily_limit: 20 };

export async function getAgentSettings(userId: string): Promise<AgentSettings> {
  const { data, error } = await supabase
    .from("agent_settings")
    .select("enabled, daily_limit")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { enabled: data.enabled, daily_limit: Number(data.daily_limit) } : DEFAULT_SETTINGS;
}

export async function saveAgentSettings(userId: string, next: AgentSettings) {
  const prev = await getAgentSettings(userId);
  const { error } = await supabase
    .from("agent_settings")
    .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() });
  if (error) throw error;

  if (prev.enabled !== next.enabled) {
    await logAgentAction(userId, {
      kind: next.enabled ? "enabled" : "disabled",
      note: next.enabled
        ? `You allowed your agent to spend up to ${next.daily_limit} ACDC per day.`
        : "You turned your agent off. It can't spend your ACDC.",
    });
  } else if (prev.daily_limit !== next.daily_limit) {
    await logAgentAction(userId, {
      kind: "limit_changed",
      note: `Daily limit changed from ${prev.daily_limit} to ${next.daily_limit} ACDC.`,
    });
  }
}

export async function logAgentAction(
  userId: string,
  action: Omit<AgentAction, "id" | "created_at" | "amount" | "counterparty" | "tx_hash"> &
    Partial<Pick<AgentAction, "amount" | "counterparty" | "tx_hash">>,
) {
  const { error } = await supabase.from("agent_actions").insert({ user_id: userId, ...action });
  if (error) console.error("logAgentAction failed", error);
}

export async function getAgentActions(userId: string, limit = 20): Promise<AgentAction[]> {
  const { data, error } = await supabase
    .from("agent_actions")
    .select("id, created_at, kind, amount, counterparty, tx_hash, note")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((a) => ({ ...a, amount: a.amount === null ? null : Number(a.amount) }));
}

export async function spentLast24h(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("agent_actions")
    .select("amount")
    .eq("user_id", userId)
    .eq("kind", "payment_sent")
    .gte("created_at", since);
  if (error) throw error;
  return (data ?? []).reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
}

// The single gate every agent payment must pass (used by access requests).
export async function canAgentSpend(
  userId: string,
  amount: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const settings = await getAgentSettings(userId);
  if (!settings.enabled) {
    return { ok: false, reason: "Your agent is turned off. Turn it on in your profile to let it pay." };
  }
  const spent = await spentLast24h(userId);
  const left = settings.daily_limit - spent;
  if (amount > left) {
    return {
      ok: false,
      reason: `This costs ${amount} ACDC but your agent only has ${Math.max(0, left)} ACDC left of its ${settings.daily_limit} ACDC daily limit.`,
    };
  }
  return { ok: true };
}

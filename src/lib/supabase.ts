import "server-only";
import { createClient } from "@supabase/supabase-js";

export type Profile = {
  user_id: string;
  first_name: string | null;
  location: string | null;
  headline: string | null;
  cv_summary: string | null;
  cv_path: string | null;
  cv_uploaded_at: string | null;
  superpower: string | null;
  access_price: number | null;
};

export type LibraryCard = {
  user_id: string;
  name: string;
  location: string | null;
  superpower: string | null;
  score: number;
  price: number;
};

export type AiSession = {
  user_id: string;
  slot: number;
  title: string | null;
  summary: string | null;
  rating: number | null;
  file_path: string | null;
  uploaded_at: string | null;
};

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ScoreEvent = {
  id: number;
  user_id: string;
  created_at: string;
  event: string;
  detail: string | null;
  summary: string | null;
  reason: string | null;
  score_before: number;
  score_after: number;
  bucket: string | null;
  file_path: string | null;
  nft_tx: string | null;
};

export async function getScoreEvent(userId: string, id: number): Promise<ScoreEvent | null> {
  const { data, error } = await supabase
    .from("score_events")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getScoreEvents(userId: string): Promise<ScoreEvent[]> {
  const { data, error } = await supabase
    .from("score_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type Contribution = {
  id: number;
  created_at: string;
  title: string;
  category: string | null;
  weight: number;
  evidence: string | null;
  file_path: string | null;
};

export async function getContributions(userId: string): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from("contributions")
    .select("id, created_at, title, category, weight, evidence, file_path")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getAiSessions(userId: string): Promise<AiSession[]> {
  const { data, error } = await supabase
    .from("ai_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("slot", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

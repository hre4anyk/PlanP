"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { extractText, getDocumentProxy } from "unpdf";
import { summarizeAiSession, summarizeCv } from "@/lib/ai";
import { creditContributions, describeCredit } from "@/lib/contributions";
import { syncProfileNft } from "@/lib/nft";
import { CV_POINTS } from "@/lib/score";
import { refreshSuperpower } from "@/lib/superpower";
import { getAiSessions, supabase } from "@/lib/supabase";
import { getUserScore } from "@/lib/user-score";

const currentScore = getUserScore;

// History is best-effort: a failed log must never fail the upload itself.
async function recordScoreChange(
  userId: string,
  scoreBefore: number,
  event: {
    event: string;
    detail?: string | null;
    summary?: string | null;
    reason: string;
    bucket: string;
    file_path: string;
  },
) {
  try {
    const { count } = await supabase
      .from("score_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (!count && scoreBefore > 0) {
      await supabase.from("score_events").insert({
        user_id: userId,
        event: "Starting score",
        reason: "Your score before history tracking began.",
        score_before: 0,
        score_after: scoreBefore,
      });
    }
    const { score: scoreAfter } = await currentScore(userId);
    const { data, error } = await supabase
      .from("score_events")
      .insert({ user_id: userId, ...event, score_before: scoreBefore, score_after: scoreAfter })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as number;
  } catch (e) {
    console.error("recordScoreChange failed", e);
    return null;
  }
}

// After an upload: the agent refreshes the public superpower and syncs the on-chain NFT.
// Best-effort — the upload itself already succeeded.
async function afterUpload(userId: string, eventId: number | null) {
  await refreshSuperpower(userId);
  try {
    const nftTx = await syncProfileNft(userId);
    if (nftTx && eventId) {
      await supabase.from("score_events").update({ nft_tx: nftTx }).eq("id", eventId);
    }
  } catch (e) {
    console.error("syncProfileNft failed", e);
  }
}

export type UploadState = { error?: string; ok?: boolean };

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_SESSION_BYTES = 2 * 1024 * 1024;
const TEXT_EXTENSIONS = [".txt", ".md"];

export async function uploadCv(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const { userId } = await auth.protect();

  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF file first." };
  if (file.type !== "application/pdf") return { error: "Only PDF files are supported." };
  if (file.size > MAX_BYTES) return { error: "PDF is too large (max 4 MB)." };

  const bytes = new Uint8Array(await file.arrayBuffer());

  let text: string;
  try {
    const pdf = await getDocumentProxy(bytes.slice());
    ({ text } = await extractText(pdf, { mergePages: true }));
  } catch {
    return { error: "Couldn't read this PDF. Try exporting it again from Word or Google Docs." };
  }
  if (text.trim().length < 200) {
    return { error: "This PDF has no readable text (probably a scanned image). Upload a text-based PDF." };
  }

  let summary;
  try {
    summary = await summarizeCv(text);
  } catch (e) {
    console.error("summarizeCv failed", e);
    return { error: "The AI couldn't summarize your CV right now. Please try again." };
  }

  const before = await currentScore(userId);
  const hadCv = Boolean(before.profile?.cv_summary);

  // Unique name per upload so older history entries can still open their file.
  const cvPath = `${userId}/${Date.now()}.pdf`;
  const { error: storageError } = await supabase.storage
    .from("cvs")
    .upload(cvPath, bytes, { contentType: "application/pdf", upsert: true });
  if (storageError) {
    console.error("CV storage failed", storageError);
    return { error: "Couldn't save your CV. Please try again." };
  }

  const now = new Date().toISOString();
  const { error: dbError } = await supabase.from("profiles").upsert({
    user_id: userId,
    first_name: summary.first_name || null,
    location: summary.location || null,
    headline: summary.headline,
    cv_summary: summary.summary,
    cv_path: cvPath,
    cv_uploaded_at: now,
    updated_at: now,
  });
  if (dbError) {
    console.error("Profile save failed", dbError);
    return { error: "Couldn't save your profile. Please try again." };
  }

  const eventId = await recordScoreChange(userId, before.score, {
    event: hadCv ? "Replaced CV" : "Uploaded CV",
    detail: summary.headline,
    summary: summary.summary,
    reason: hadCv
      ? "Your CV already counted, so replacing it doesn't change the score. It refreshes your executive summary."
      : `A CV adds a flat ${CV_POINTS} points. It's the baseline recruiters screen; the rest of the score comes from your AI work.`,
    bucket: "cvs",
    file_path: cvPath,
  });
  await afterUpload(userId, eventId);

  revalidatePath("/dashboard");
  revalidatePath("/library");
  return { ok: true };
}

const MAX_AI_SESSIONS = 3;

// Fills an empty slot first; once all are full, the oldest is replaced —
// history keeps every past upload regardless, so nothing is actually lost.
function pickTargetSlot(existing: { slot: number; uploaded_at: string | null }[]): number {
  const taken = new Set(existing.map((s) => s.slot));
  for (let slot = 1; slot <= MAX_AI_SESSIONS; slot++) {
    if (!taken.has(slot)) return slot;
  }
  return [...existing].sort((a, b) => (a.uploaded_at ?? "").localeCompare(b.uploaded_at ?? ""))[0].slot;
}

export async function uploadAiSession(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const { userId } = await auth.protect();

  const file = formData.get("session");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a text file first." };
  if (!TEXT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
    return { error: "Only .txt or .md files are supported." };
  }
  if (file.size > MAX_SESSION_BYTES) return { error: "File is too large (max 2 MB)." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (text.trim().length < 100) {
    return { error: "This file looks empty or too short. Export the full conversation and try again." };
  }

  const [before, sessions] = await Promise.all([currentScore(userId), getAiSessions(userId)]);

  let result;
  try {
    result = await summarizeAiSession(
      text,
      before.contributions.map((c) => c.title),
    );
  } catch (e) {
    console.error("summarizeAiSession failed", e);
    return { error: "The AI couldn't summarize this file right now. Please try again." };
  }

  const slot = pickTargetSlot(sessions);

  const ext = file.name.toLowerCase().endsWith(".md") ? "md" : "txt";
  // Unique name per upload so older history entries can still open their file.
  const filePath = `${userId}/${slot}-${Date.now()}.${ext}`;
  const { error: storageError } = await supabase.storage
    .from("ai-sessions")
    .upload(filePath, bytes, { contentType: "text/plain", upsert: true });
  if (storageError) {
    console.error("AI session storage failed", storageError);
    return { error: "Couldn't save this file. Please try again." };
  }

  const { error: dbError } = await supabase.from("ai_sessions").upsert({
    user_id: userId,
    slot,
    title: result.title,
    summary: result.summary,
    rating: null,
    file_path: filePath,
    uploaded_at: new Date().toISOString(),
  });
  if (dbError) {
    console.error("AI session save failed", dbError);
    return { error: "Couldn't save your profile. Please try again." };
  }

  try {
    await creditContributions(userId, result.contributions, filePath);
  } catch (e) {
    console.error("creditContributions failed", e);
    return { error: "Couldn't save your score. Please try again." };
  }

  const eventId = await recordScoreChange(userId, before.score, {
    event: "Added AI work",
    detail: result.title,
    summary: result.summary,
    reason: describeCredit(result.contributions, result.already_credited),
    bucket: "ai-sessions",
    file_path: filePath,
  });
  await afterUpload(userId, eventId);

  revalidatePath("/dashboard");
  revalidatePath("/library");
  return { ok: true };
}

// One place for model IDs and list prices (ARCHITECTURE §4), so a model can be swapped in one line
// and every call is priced the same way.

export const BRAIN_MODEL = "claude-opus-5-5";
export const VOICE_MODEL = "gpt-realtime-2.1-mini";

/** USD per million tokens, Anthropic list price (checked 2026-10-11). */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model];
  return price ? (inputTokens * price.input + outputTokens * price.output) / 1_000_000 : 0;
}

/** Google Street View Static API list price per image (checked 2026-10-11). */
export const STREET_VIEW_USD_PER_PHOTO = 0.007;

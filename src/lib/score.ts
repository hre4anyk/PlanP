export const CV_POINTS = 10;
const WORK_POINTS = 90;
// Higher = slower growth. ~6 standard features ≈ 30 pts, ~20 ≈ 65 pts, 90 is near-unreachable.
const CURVE = 30;

// Each credited contribution adds weight (1 routine, 2 standard, 3 hard) to a running total.
// The curve makes every new contribution count, with diminishing returns toward 100.
export function scoreFrom(hasCv: boolean, weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  const work = WORK_POINTS * (1 - Math.exp(-total / CURVE));
  return Math.round((hasCv ? CV_POINTS : 0) + work);
}

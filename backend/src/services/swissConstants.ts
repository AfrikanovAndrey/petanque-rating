/** Счёт автоматической победы (bye) в швейцарской системе. */
export const SWISS_BYE_SCORE_A = 13;
export const SWISS_BYE_SCORE_B = 7;

export function normalizeSwissByeScores(
  scoreA: number | null | undefined,
  scoreB: number | null | undefined,
): { score_a: number; score_b: number } {
  return {
    score_a: scoreA ?? SWISS_BYE_SCORE_A,
    score_b:
      scoreB == null || scoreB === 0 ? SWISS_BYE_SCORE_B : scoreB,
  };
}

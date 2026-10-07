/**
 * QA test mode for the outreach sequence: when SEQUENCE_STEP_GAP_MINUTES is set,
 * steps are spaced that many minutes apart instead of business days, so a test
 * can watch all three emails arrive. It is honoured everywhere except
 * production (VERCEL_ENV === "production"), where it is ignored whatever its
 * value — so a test setting left behind cannot change the live cadence
 * (2b fix 11). Self-contained so the tests can compile it alone.
 */
export function stepGapMinutes(env: Record<string, string | undefined>): number {
  if (env.VERCEL_ENV === "production") return 0
  const n = Number(env.SEQUENCE_STEP_GAP_MINUTES)
  return Number.isFinite(n) && n > 0 ? n : 0
}

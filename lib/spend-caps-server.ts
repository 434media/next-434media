/**
 * The server half of lib/spend-caps.ts: this month's spend for a path, read fresh from the cost records, and the cap
 * check every paid path runs before its model call. The read is the one the Ask panel uses (lib/ask/server.ts
 * readAskMonthSpend): one range query on `at` from the month's first instant, summed by kind.
 */
import { capDecision, monthStartOf, monthlyCapUsd, spendOf, type CapDecision, type SpendCapId } from "./spend-caps"

/** The path's spend since the month began. Throws when the records cannot be read; callers fail closed. */
export async function readMonthSpend(id: SpendCapId, now = new Date().toISOString()): Promise<number> {
  const { readCallCostsSince } = await import("./engine/cost-ledger")
  const since = monthStartOf(now)
  return spendOf(await readCallCostsSince(since), id, since)
}

/** The month's figure for a meter: `spentUsd` is null when it could not be read. */
export async function monthStatus(id: SpendCapId, now = new Date().toISOString()): Promise<{ spentUsd: number | null; capUsd: number }> {
  const capUsd = monthlyCapUsd(id)
  try {
    return { spentUsd: await readMonthSpend(id, now), capUsd }
  } catch (e) {
    console.error(`[spend-caps] ${id}: this month's spend could not be read:`, e instanceof Error ? e.message : e)
    return { spentUsd: null, capUsd }
  }
}

/** The check before a paid call: refuses at or over the cap, and when the spend cannot be read. */
export async function checkMonthCap(id: SpendCapId, now = new Date().toISOString()): Promise<CapDecision> {
  const { spentUsd, capUsd } = await monthStatus(id, now)
  return capDecision(id, spentUsd, capUsd)
}

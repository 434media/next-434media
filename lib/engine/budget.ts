/**
 * The caps in code (434 build sequence V1 item 2, Foundation A: "a hard Gateway budget as a backstop to the caps in
 * code: daily, per property and global"). These are the caps in code; the backstop is the Gateway's own team budget,
 * a founder setting in the Vercel dashboard, which stops calls even if this code is wrong.
 *
 * Pure: the decision only. The guard (lib/engine/guard.ts) reads the day's spend from the ledger
 * (lib/engine/cost-ledger.ts) and asks here before every call.
 *
 * Sizing (Gateway usage, team-wide, 2026-10-12 to 2026-11-11): $36.23 in 30 days; the largest day $18.08
 * (2026-10-19, the content pipeline's replay run), most days under $1. The defaults sit above that largest day so
 * today's work never trips them, and low enough that a runaway loop stops within a day's normal order of magnitude.
 * AI_DAILY_CAP_USD and AI_PROPERTY_DAILY_CAP_USD override them (whole dollars); a value that is not a positive number is
 * ignored and the default holds, so a typo cannot lift the cap.
 */
export const DEFAULT_DAILY_CAP_USD = 25
export const DEFAULT_PROPERTY_DAILY_CAP_USD = 20

export interface Caps { dailyUsd: number; propertyDailyUsd: number }

function positive(v: string | undefined, fallback: number): number {
  const n = Number(v)
  return v !== undefined && v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : fallback
}

export function capsFromEnv(env: Record<string, string | undefined> = process.env): Caps {
  return {
    dailyUsd: positive(env.AI_DAILY_CAP_USD, DEFAULT_DAILY_CAP_USD),
    propertyDailyUsd: positive(env.AI_PROPERTY_DAILY_CAP_USD, DEFAULT_PROPERTY_DAILY_CAP_USD),
  }
}

/** Property keys go into a Firestore field path; anything but letters, digits, `-` and `_` is replaced. */
export const propertyKey = (p: string) => p.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64) || "_"

export interface DaySpend { totalUsd: number; byProperty: Record<string, number> }

export class BudgetExceededError extends Error {
  constructor(readonly scope: "global" | "property", readonly spentUsd: number, readonly capUsd: number, readonly property?: string) {
    super(
      scope === "global"
        ? `Daily AI budget reached: $${spentUsd.toFixed(2)} spent today against a $${capUsd} cap; the call was not made`
        : `Daily AI budget for ${property} reached: $${spentUsd.toFixed(2)} spent today against a $${capUsd} cap; the call was not made`,
    )
    this.name = "BudgetExceededError"
  }
}

/** Throws when today's spend has reached a cap. A call already under way is not stopped; the next one is. */
export function assertWithinBudget(spend: DaySpend, caps: Caps, property: string | undefined): void {
  if (spend.totalUsd >= caps.dailyUsd) throw new BudgetExceededError("global", spend.totalUsd, caps.dailyUsd)
  if (property) {
    const p = spend.byProperty[property] ?? 0
    if (p >= caps.propertyDailyUsd) throw new BudgetExceededError("property", p, caps.propertyDailyUsd, property)
  }
}

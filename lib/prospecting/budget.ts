import { getCreditUsage } from "./credit-log"

/**
 * Stage 7 — Apollo budget governance.
 *
 * Per-user daily and monthly caps prevent runaway prompting from burning
 * the team's plan allotment in one afternoon. Both env-configurable so
 * defaults can scale with the active Apollo plan tier.
 *
 * Defaults are sized for the Free plan (900 credits/seat/year ≈ 75/mo):
 *   - Daily 50 — single rep can't burn most of a month in one day
 *   - Monthly 70 — leaves a 5-credit buffer below Free's plan ceiling
 *
 * When upgraded to Basic ($49/seat/mo, 30K credits/year ≈ 2,500/mo):
 *   APOLLO_DAILY_CAP=200 APOLLO_MONTHLY_CAP=2000
 *
 * Caps are PER USER. For 434media at 1 seat (Jesse), this is effectively
 * the team cap. As the team grows, per-user caps prevent one rep from
 * monopolizing the team's monthly allotment.
 */

const DAILY_CAP_DEFAULT = 50
const MONTHLY_CAP_DEFAULT = 70

export const APOLLO_DAILY_CAP =
  Number(process.env.APOLLO_DAILY_CAP) || DAILY_CAP_DEFAULT
export const APOLLO_MONTHLY_CAP =
  Number(process.env.APOLLO_MONTHLY_CAP) || MONTHLY_CAP_DEFAULT

export interface BudgetCheck {
  /** True when the call can proceed under both daily and monthly caps */
  ok: boolean
  /** Set when ok=false — human-readable reason for the rep */
  reason?: string
  today: number
  thisMonth: number
  thisMonthTeamWide: number
  dailyCap: number
  monthlyCap: number
  /** Credits remaining before hitting either cap (lower of the two) */
  remaining: number
}

/**
 * Pre-flight budget check — call before any Apollo API call.
 *
 * `willUse` is a pessimistic estimate of the credits the call will charge:
 *   - For search: pass filters.per_page (worst case = full page returns)
 *   - For enrich: pass 1
 *
 * Returns ok=false with a clear reason when the call would exceed either
 * cap. Caller should throw a "budget-exceeded" ApolloError so the UI can
 * surface the message + suggest upgrading or waiting for reset.
 */
export async function checkBudget(
  userEmail: string,
  willUse = 1,
): Promise<BudgetCheck> {
  const { today, thisMonth, thisMonthTeamWide } = await getCreditUsage(userEmail)

  const dailyRemaining = Math.max(0, APOLLO_DAILY_CAP - today)
  const monthlyRemaining = Math.max(0, APOLLO_MONTHLY_CAP - thisMonth)
  const remaining = Math.min(dailyRemaining, monthlyRemaining)

  if (today + willUse > APOLLO_DAILY_CAP) {
    return {
      ok: false,
      reason: `Daily Apollo budget reached (${today}/${APOLLO_DAILY_CAP}). Resets at midnight server time.`,
      today,
      thisMonth,
      thisMonthTeamWide,
      dailyCap: APOLLO_DAILY_CAP,
      monthlyCap: APOLLO_MONTHLY_CAP,
      remaining,
    }
  }
  if (thisMonth + willUse > APOLLO_MONTHLY_CAP) {
    return {
      ok: false,
      reason: `Monthly Apollo budget reached (${thisMonth}/${APOLLO_MONTHLY_CAP}). Resets on the 1st of next month, or upgrade your Apollo plan to lift the cap.`,
      today,
      thisMonth,
      thisMonthTeamWide,
      dailyCap: APOLLO_DAILY_CAP,
      monthlyCap: APOLLO_MONTHLY_CAP,
      remaining,
    }
  }

  return {
    ok: true,
    today,
    thisMonth,
    thisMonthTeamWide,
    dailyCap: APOLLO_DAILY_CAP,
    monthlyCap: APOLLO_MONTHLY_CAP,
    remaining,
  }
}

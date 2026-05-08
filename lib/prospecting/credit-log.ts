import { getDb } from "../firebase-admin"

/**
 * Stage 7 — persistent Apollo credit usage log.
 *
 * Replaces the process-local counter from Stage 1 (which reset on every
 * server restart) with an append-only Firestore log. Every Apollo call
 * writes one entry; usage queries roll them up.
 *
 * Schema is denormalized on purpose — each entry carries the userEmail,
 * endpoint, and credit cost so the rollup queries don't need joins. Adds
 * one Firestore write per Apollo call (negligible cost vs. the Apollo
 * call itself).
 *
 * Time boundaries use server local clock — for 434media's San Antonio
 * team that's effectively UTC on Vercel. Drift around midnight is
 * acceptable for credit accounting; if a rep cares about exact CST
 * boundaries we can thread a tz offset later.
 */

const COLLECTION = "apollo_credit_log"

export type ApolloEndpointKind = "search" | "enrich"

export interface CreditLogEntry {
  id: string
  userEmail: string
  endpoint: ApolloEndpointKind
  creditsUsed: number
  timestamp: string // ISO
  /** Provenance — search prompts only, for cost-spike debugging */
  prompt?: string
  /** How many candidates the call returned — sanity-check vs. creditsUsed */
  candidateCount?: number
}

interface LogInput {
  userEmail: string
  endpoint: ApolloEndpointKind
  creditsUsed: number
  prompt?: string
  candidateCount?: number
}

/**
 * Append a credit usage entry. Fire-and-forget at the call site —
 * a failure here shouldn't break the Apollo call (which already succeeded).
 * Caller should `.catch()` and log internally rather than throw.
 */
export async function logCreditUsage(input: LogInput): Promise<void> {
  if (input.creditsUsed <= 0) return // skip zero-cost no-ops
  const db = getDb()
  await db.collection(COLLECTION).add({
    userEmail: input.userEmail,
    endpoint: input.endpoint,
    creditsUsed: input.creditsUsed,
    timestamp: new Date().toISOString(),
    // Apollo prompts can be long — cap at 500 chars to keep doc size reasonable
    prompt: input.prompt ? input.prompt.slice(0, 500) : null,
    candidateCount: input.candidateCount ?? null,
  })
}

export interface CreditUsageSummary {
  /** Credits used by this user since start-of-day (server local) */
  today: number
  /** Credits used by this user since the 1st of the current month */
  thisMonth: number
  /** Credits used by ALL users this month — for team-wide budget views */
  thisMonthTeamWide: number
}

/**
 * Roll up credit usage for a user over the standard windows.
 *
 * Strategy: one Firestore query for everything since the start of the
 * current month, then filter in memory. This trades a tiny in-memory
 * scan for avoiding a composite (userEmail, timestamp) index entirely —
 * the equality + inequality combo would otherwise require Firestore
 * console setup on every deployment, and the data volume is small
 * enough that in-memory filtering is genuinely faster.
 *
 * Scale: at Apollo Free plan (~75 credits/mo team-wide → ~75 log
 * entries) this returns at most 75 docs. At Professional (~4K/mo)
 * still under 5K docs — Firestore handles tens of thousands per query
 * in single-digit milliseconds. Revisit only if multiple teams share
 * one deployment with tens of thousands of credits/month each.
 */
export async function getCreditUsage(userEmail: string): Promise<CreditUsageSummary> {
  const db = getDb()

  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const startOfDayMs = startOfDay.getTime()
  const startOfMonthIso = startOfMonth.toISOString()

  // Single-field range query on `timestamp` — uses Firestore's auto
  // index, no composite required.
  const monthSnap = await db
    .collection(COLLECTION)
    .where("timestamp", ">=", startOfMonthIso)
    .get()

  let today = 0
  let thisMonth = 0
  let thisMonthTeamWide = 0

  for (const doc of monthSnap.docs) {
    const data = doc.data()
    const credits = typeof data.creditsUsed === "number" ? data.creditsUsed : 0
    if (credits <= 0) continue

    thisMonthTeamWide += credits

    if (data.userEmail === userEmail) {
      thisMonth += credits
      const tsMs = data.timestamp ? new Date(data.timestamp).getTime() : NaN
      if (Number.isFinite(tsMs) && tsMs >= startOfDayMs) {
        today += credits
      }
    }
  }

  return { today, thisMonth, thisMonthTeamWide }
}

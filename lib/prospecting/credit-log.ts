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
 * Roll up credit usage for a user over the standard windows. Two queries
 * for per-user (today + month) and one team-wide. Each query needs a
 * Firestore composite index on (userEmail, timestamp) — Firestore will
 * surface the index-build link in the console on first query.
 */
export async function getCreditUsage(userEmail: string): Promise<CreditUsageSummary> {
  const db = getDb()

  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const startOfDayIso = startOfDay.toISOString()
  const startOfMonthIso = startOfMonth.toISOString()

  const sumCredits = (snap: FirebaseFirestore.QuerySnapshot) =>
    snap.docs.reduce((sum, d) => {
      const v = d.data().creditsUsed
      return sum + (typeof v === "number" ? v : 0)
    }, 0)

  // Per-user today
  const todaySnap = await db
    .collection(COLLECTION)
    .where("userEmail", "==", userEmail)
    .where("timestamp", ">=", startOfDayIso)
    .get()
  const today = sumCredits(todaySnap)

  // Per-user this month
  const monthSnap = await db
    .collection(COLLECTION)
    .where("userEmail", "==", userEmail)
    .where("timestamp", ">=", startOfMonthIso)
    .get()
  const thisMonth = sumCredits(monthSnap)

  // Team-wide this month (no user filter)
  const teamSnap = await db
    .collection(COLLECTION)
    .where("timestamp", ">=", startOfMonthIso)
    .get()
  const thisMonthTeamWide = sumCredits(teamSnap)

  return { today, thisMonth, thisMonthTeamWide }
}

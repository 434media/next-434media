/**
 * Which existing records the reference backfill numbers (scripts/refs/backfill.ts).
 *
 * The founder, 2026-10-27: "a reference backfill applies only to what survives the triage". Canon does not yet say
 * what surviving the CRM triage means, so the rule below is PROPOSED, AWAITING THE FOUNDER. It lives in one function,
 * `survivesTriage`, so changing it is one edit, and the backfill refuses to write while `TRIAGE_RULE_STATUS` is
 * "proposed".
 *
 * Proposed rule: a record survives when it is live in the store the new model reads.
 * - a task: in the unified `crm_tasks` collection, not completed and not archived;
 * - an opportunity: a `crm_clients` record marked `is_opportunity`, not archived and not closed as lost.
 * Everything else (completed tasks, archived or lost opportunities, the legacy per-person task collections) gets no
 * number from the backfill.
 */
import { parseRef, type RefType } from "./record-refs"

/** "proposed" until the founder decides the rule; the backfill writes nothing while it is. */
export const TRIAGE_RULE_STATUS: "proposed" | "approved" = "proposed"

export interface BackfillCandidate {
  collection: string
  id: string
  type: RefType
  data: Record<string, unknown>
}

export type Verdict = { keep: true } | { keep: false; reason: string }

/** THE RULE. Proposed, awaiting the founder (see the header). */
export function survivesTriage(c: BackfillCandidate): Verdict {
  const d = c.data
  if (d.is_archived === true) return { keep: false, reason: "archived" }
  if (c.type === "TSK") {
    if (c.collection !== "crm_tasks") return { keep: false, reason: "not in the unified task store" }
    if (d.status === "completed" || d.status === "done") return { keep: false, reason: "completed" }
    return { keep: true }
  }
  if (c.type === "OPP") {
    if (c.collection !== "crm_clients" || d.is_opportunity !== true) return { keep: false, reason: "not an opportunity record" }
    if (d.disposition === "closed_lost") return { keep: false, reason: "closed as lost" }
    return { keep: true }
  }
  return { keep: false, reason: `no backfill for ${c.type}` }
}

/** Milliseconds for ordering; a Firestore Timestamp, an ISO string, or anything else (sorted last). */
function createdMs(v: unknown): number {
  if (typeof v === "string") {
    const t = Date.parse(v)
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
  }
  const ts = v as { toMillis?: () => number } | null
  if (ts && typeof ts.toMillis === "function") return ts.toMillis()
  return Number.MAX_SAFE_INTEGER
}

/**
 * The plan: records to number, oldest first (so numbers follow the order records were made), and the ones left out
 * with why. A record that already has a reference is left as it is; running the plan twice numbers nothing twice.
 */
export function planBackfill(candidates: BackfillCandidate[]): {
  assign: BackfillCandidate[]
  skipped: { candidate: BackfillCandidate; reason: string }[]
} {
  const assign: BackfillCandidate[] = []
  const skipped: { candidate: BackfillCandidate; reason: string }[] = []
  for (const c of candidates) {
    if (parseRef(c.data.ref)) {
      skipped.push({ candidate: c, reason: "already has a reference" })
      continue
    }
    const v = survivesTriage(c)
    if (v.keep) assign.push(c)
    else skipped.push({ candidate: c, reason: v.reason })
  }
  assign.sort((a, b) => createdMs(a.data.created_at) - createdMs(b.data.created_at) || a.id.localeCompare(b.id))
  return { assign, skipped }
}

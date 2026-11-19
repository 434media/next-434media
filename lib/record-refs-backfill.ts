/**
 * Which existing records get a short reference (TSK-/OPP-) without being created anew: the backfill
 * (scripts/refs/backfill.ts, GET /api/admin/refs/backfill-plan) and a record reopened later.
 *
 * The rule, DECIDED by the founder on 2026-11-19 ("yes"; run log `05 Run Logs/2026-11-19-1524-short-references.md`):
 * - a task survives the CRM triage when it is open: not completed and not archived, in the task store the CRM reads
 *   (the unified `crm_tasks` once its migration has run, the per-person collections before);
 * - an opportunity survives when it is not archived and not closed as lost;
 * - a closed or archived record gets a reference only if it is reopened (`numberOnUpdate`).
 * "Archived" and "an opportunity" are read as the pipeline reads them (next-434media#347): truthy, not `=== true`.
 * The rule lives in `survivesTriage`, one function, so changing it is one edit.
 */
import { formatRef, nextNumberFrom, parseRef, type RefType } from "./record-refs"

/** The founder decided the rule on 2026-11-19; the backfill's write still needs his separate go. */
export const TRIAGE_RULE_STATUS: "proposed" | "approved" = "approved"

export interface BackfillCandidate {
  collection: string
  id: string
  type: RefType
  data: Record<string, unknown>
}

export type Verdict = { keep: true } | { keep: false; reason: string }

const CLOSED_TASK_STATUSES = new Set(["completed", "done"])

/** THE RULE (decided; see the header). */
export function survivesTriage(c: BackfillCandidate): Verdict {
  const d = c.data
  if (d.is_archived) return { keep: false, reason: "archived" }
  if (c.type === "TSK") {
    if (typeof d.status === "string" && CLOSED_TASK_STATUSES.has(d.status)) return { keep: false, reason: "completed" }
    return { keep: true }
  }
  if (c.type === "OPP") {
    if (c.collection !== "crm_clients" || !d.is_opportunity) return { keep: false, reason: "not an opportunity record" }
    if (d.disposition === "closed_lost") return { keep: false, reason: "closed as lost" }
    return { keep: true }
  }
  return { keep: false, reason: `no backfill for ${c.type}` }
}

/**
 * Whether an update should give a record its reference: it has none, it did not survive the rule before the update,
 * and it does after. That is a reopened record (un-archived, moved off closed-lost, a task moved off completed) or a
 * client that has just become an opportunity. An open record that merely lacks a reference is left to the backfill.
 */
export function numberOnUpdate(before: BackfillCandidate | null, after: BackfillCandidate): boolean {
  if (parseRef(after.data.ref)) return false
  if (!survivesTriage(after).keep) return false
  return !before || !survivesTriage(before).keep
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

function createdIso(v: unknown): string | null {
  const ms = createdMs(v)
  return ms === Number.MAX_SAFE_INTEGER ? null : new Date(ms).toISOString()
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

export interface PlanTypeSummary {
  /** Records the backfill would number. */
  count: number
  /** The reference the first (oldest) would get and the last (newest), from the counter as it stands. */
  first: string | null
  last: string | null
  oldest: string | null
  newest: string | null
  /** The counter's next number now (1 when it does not exist yet). */
  counterNext: number
  /** Records that already have a reference (made since the code went live). */
  alreadyNumbered: number
  /** Why records were left out, by reason. */
  leftOut: Record<string, number>
}

/** What the founder sees before the write: per type, the count, the first and last reference, and what was left out. */
export function summarizePlan(
  plan: ReturnType<typeof planBackfill>,
  counters: Partial<Record<RefType, unknown>>,
): Record<"TSK" | "OPP", PlanTypeSummary> {
  const out = {} as Record<"TSK" | "OPP", PlanTypeSummary>
  for (const t of ["TSK", "OPP"] as const) {
    const list = plan.assign.filter((c) => c.type === t)
    const start = nextNumberFrom(counters[t] ?? null)
    const leftOut: Record<string, number> = {}
    let alreadyNumbered = 0
    for (const s of plan.skipped.filter((x) => x.candidate.type === t)) {
      if (s.reason === "already has a reference") alreadyNumbered++
      else leftOut[s.reason] = (leftOut[s.reason] ?? 0) + 1
    }
    out[t] = {
      count: list.length,
      first: list.length ? formatRef(t, start) : null,
      last: list.length ? formatRef(t, start + list.length - 1) : null,
      oldest: list.length ? createdIso(list[0].data.created_at) : null,
      newest: list.length ? createdIso(list[list.length - 1].data.created_at) : null,
      counterNext: start,
      alreadyNumbered,
      leftOut,
    }
  }
  return out
}

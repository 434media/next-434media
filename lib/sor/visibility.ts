/**
 * Scope rules for the system-of-record connector.
 *
 * Two bearer tokens, two scopes. `internal` reads everything; `public` is what
 * the website and any outward-facing job holds. The difference is enforced here
 * rather than at each tool, so a new tool cannot forget it — a tool that returns
 * a row at all returns it through `project`.
 *
 * This file is deliberately free of Firestore and of the MCP SDK so the rules
 * can be tested as pure functions. The failure this guards against is a rate or
 * a threshold reaching a prospect, which is a policy breach rather than a bug,
 * and it should be provable without standing up a server.
 */

export type Scope = "internal" | "public"

/**
 * Fields never returned to a `public` caller, whatever collection they appear
 * in. `cost_basis` and `modifiers` describe what 434 pays; `quotable` and
 * `annual_floor` belong to thresholds, which are internal by definition.
 */
const INTERNAL_FIELDS = new Set([
  "cost_basis",
  "modifiers",
  "annual_floor",
  "quotable",
  "notes",
  "internal_context",
  "proof_assets_as_written",
  "restrictions_as_written",
  "updated_by",
])

/**
 * Master §4.5 records publication as `work_page: { published, reason }`. Anything
 * other than an explicit `true` is treated as unpublished, so a malformed or
 * missing block fails closed rather than exposing a record by accident.
 */
export function isPublished(row: Record<string, unknown>): boolean {
  const wp = row.work_page
  return typeof wp === "object" && wp !== null && (wp as { published?: unknown }).published === true
}

/** Collections a `public` caller may not read at all. */
const INTERNAL_COLLECTIONS = new Set([
  "icp_cohorts",
  "qualification_thresholds",
  "partner_services",
  "contractors",
  // Names systems that are not built yet and says what to do meanwhile. Useful
  // to a job, and a map of what 434 has not finished to anyone else.
  "launch_dependencies",
  "policy_documents",
])

export function isReadable(collection: string, scope: Scope): boolean {
  return scope === "internal" || !INTERNAL_COLLECTIONS.has(collection)
}

/**
 * A portfolio record's public face. Master §4.5 separates the approved public
 * description from internal context; only the former leaves the building.
 */
const PORTFOLIO_PUBLIC_FIELDS = [
  "key", "title", "commercial_model", "production_categories", "approved_public_description",
  "client_or_partner_as_written", "role_434", "founder_credit", "collaborator_credits_as_written",
  "years", "years_as_written", "operating_status", "public_url", "rights_defaults",
  "registered_identifier_as_written", "video", "work_page", "source",
] as const

type Row = Record<string, unknown>

/** Strip one row to what `scope` may see. Returns null if the row is not visible at all. */
export function project(collection: string, row: Row, scope: Scope): Row | null {
  if (!isReadable(collection, scope)) return null
  if (scope === "internal") return row

  if (collection === "portfolio_records") {
    // An unpublished record does not exist to a public caller. The master holds
    // records it has decided not to publish, and that decision is not advisory.
    //
    // The flag is nested at `work_page.published`, not top-level. An earlier
    // version of this check read `row.published`, which is never present — so it
    // never fired, and all seventeen records would have gone out including the
    // two the master holds back. The tests missed it because they were written
    // from the same assumed shape as the code. They now use a real seed row.
    if (isPublished(row) !== true) return null
    const out: Row = {}
    for (const f of PORTFOLIO_PUBLIC_FIELDS) if (f in row) out[f] = row[f]
    return out
  }

  if (collection === "rate_card_lines") {
    // Only the published anchors. A fixed minimum is a real figure but it is not
    // an anchor, and internal cost lines are never quotable.
    if (row.layer !== "public_anchor") return null
    const out: Row = {}
    for (const [k, v] of Object.entries(row)) if (!INTERNAL_FIELDS.has(k)) out[k] = v
    return out
  }

  const out: Row = {}
  for (const [k, v] of Object.entries(row)) if (!INTERNAL_FIELDS.has(k)) out[k] = v
  return out
}

export function projectAll(collection: string, rows: Row[], scope: Scope): Row[] {
  return rows.map((r) => project(collection, r, scope)).filter((r): r is Row => r !== null)
}

/**
 * Master §2.11: a partner review older than 31 days is stale, and while it is
 * stale only core functions route. The flag is computed at read time rather than
 * stored, because staleness is a function of now and a stored flag is wrong the
 * day after it is written.
 */
export const STALE_AFTER_DAYS = 31

/**
 * Whole UTC days between two instants, counting calendar days rather than
 * elapsed hours.
 *
 * `last_reviewed` is a date, not a timestamp. Comparing it as an instant makes
 * the flag depend on the hour the question is asked: a review dated 2026-09-02
 * would read fresh at 00:00 on 2026-10-04 and stale at 13:00 the same day. A
 * governing threshold that changes answer over lunch is not a threshold.
 */
function daysBetween(from: Date, to: Date): number {
  const floor = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((floor(to) - floor(from)) / 86_400_000)
}

export function isStale(lastReviewed: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastReviewed) return true // unknown review date is not evidence of freshness
  const reviewed = new Date(lastReviewed)
  if (Number.isNaN(reviewed.getTime())) return true
  return daysBetween(reviewed, now) > STALE_AFTER_DAYS
}

export function withStaleFlag<T extends { last_reviewed?: string | null }>(
  rows: T[], now: Date = new Date()
): (T & { stale: boolean })[] {
  return rows.map((r) => ({ ...r, stale: isStale(r.last_reviewed, now) }))
}

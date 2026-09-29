/**
 * Map a `portfolio_records` row to the `WorkRecord` shape the Work page renders.
 *
 * The page used to import `lib/work-records.ts`, a file generated from the
 * master. It now reads the same content from Firestore, loaded from the same
 * master by the same migration — so the mapping's job is to produce output
 * byte-identical to the generated file, not merely equivalent.
 *
 * `scripts/sor/compare-work-records.ts` asserts exactly that, record by record
 * and field by field, which is what makes the switch safe to make at all.
 *
 * The generated file is deliberately NOT deleted. It remains the artifact the
 * drift check hashes and the CI page check reads, and it is the fallback when
 * Firestore is unreachable — see app/work/page.tsx.
 */
import type { WorkRecord } from "../work-records"
import { isPublished } from "./visibility"

/**
 * A portfolio row as Firestore returns it. Only the fields the Work page reads
 * are named; the rest are carried and ignored. Typed rather than `any` so a
 * renamed field fails here instead of rendering as undefined on the page —
 * which is how `work_page.published` slipped through once already.
 */
type Row = {
  key?: unknown
  title?: unknown
  commercial_model?: unknown
  production_categories?: unknown
  client_or_partner_as_written?: unknown
  role_434?: unknown
  founder_credit?: { as_written?: unknown } | null
  collaborator_credits_as_written?: unknown
  years_as_written?: unknown
  operating_status?: unknown
  public_url?: unknown
  rights_defaults?: RightsDefaults | null
  registered_identifier_as_written?: unknown
  video?: unknown
  approved_public_description?: unknown
  work_page?: unknown
}

type RightsDefaults = {
  creator?: unknown
  copyright_notice?: unknown
  credit_line?: unknown
  usage_terms?: unknown
}

/** "Creator X · Copyright notice Y · Credit line Z · Rights usage terms W", or null. */
function rightsDefaults(rd: RightsDefaults | null | undefined): string | null {
  if (!rd) return null
  const parts = [
    rd.creator && `Creator ${String(rd.creator)}`,
    rd.copyright_notice && `Copyright notice ${String(rd.copyright_notice)}`,
    rd.credit_line && `Credit line ${String(rd.credit_line)}`,
    rd.usage_terms && `Rights usage terms ${String(rd.usage_terms)}`,
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : null
}

const orNull = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null

export function toWorkRecord(row: Row): WorkRecord {
  return {
    title: String(row.title ?? ""),
    model: String(row.commercial_model ?? ""),
    categories: Array.isArray(row.production_categories) && row.production_categories.length
      ? row.production_categories.join(", ")
      : null,
    client: orNull(row.client_or_partner_as_written),
    role: orNull(row.role_434),
    founderCredit: orNull(row.founder_credit?.as_written),
    collaboratorCredit: orNull(row.collaborator_credits_as_written),
    years: orNull(row.years_as_written),
    status: orNull(row.operating_status),
    publicUrl: orNull(row.public_url),
    recordKey: orNull(row.key),
    rightsDefaults: rightsDefaults(row.rights_defaults),
    registeredIdentifier: orNull(row.registered_identifier_as_written),
    video: orNull(row.video),
    description: orNull(row.approved_public_description),
  }
}

/**
 * Published records only, in the master's own order.
 *
 * Firestore returns documents ordered by document id, which is the record key —
 * alphabetical, not the master's Section 4 sequence. The Work page groups by
 * commercial model and the order within a group is the master's editorial
 * decision, so it is restored from the generated file's ordering rather than
 * left to the database.
 */
export function toWorkRecords(rows: Row[], order?: readonly string[]): WorkRecord[] {
  const published = rows
    .filter((r) => isPublished(r as Record<string, unknown>))
    .map(toWorkRecord)
  if (!order) return published
  const rank = new Map(order.map((key, i) => [key, i]))
  return published.sort(
    (a, b) => (rank.get(a.recordKey ?? "") ?? 1e9) - (rank.get(b.recordKey ?? "") ?? 1e9)
  )
}

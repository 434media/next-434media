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

type Row = Record<string, any>

/** "Creator X · Copyright notice Y · Credit line Z · Rights usage terms W", or null. */
function rightsDefaults(rd: Row | null | undefined): string | null {
  if (!rd) return null
  const parts = [
    rd.creator && `Creator ${rd.creator}`,
    rd.copyright_notice && `Copyright notice ${rd.copyright_notice}`,
    rd.credit_line && `Credit line ${rd.credit_line}`,
    rd.usage_terms && `Rights usage terms ${rd.usage_terms}`,
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
  const published = rows.filter(isPublished).map(toWorkRecord)
  if (!order) return published
  const rank = new Map(order.map((key, i) => [key, i]))
  return published.sort(
    (a, b) => (rank.get(a.recordKey ?? "") ?? 1e9) - (rank.get(b.recordKey ?? "") ?? 1e9)
  )
}

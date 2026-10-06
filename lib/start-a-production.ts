// The "Start a production" intake (master 9.5). The request options and budget
// ranges are the master's approved lists, verbatim; the form, the API route and
// the admin inbox all read them from here, so a stored value always matches an
// option the form offered.
//
// Organization type is collected for context and routing and never qualifies
// or disqualifies an inquiry on its own (9.5). Its options follow the master's
// meaning of "brands" (1.5).

export const REQUEST_OPTIONS = [
  "Sponsorship, advertising, or partnership in a 434-owned property",
  "A named program or platform",
  "A film, commercial, brand film, documentary, podcast, broadcast piece, content series, or event",
  "Digital infrastructure for a defined initiative",
  "Distribution of existing content",
  "Agency seeking a production partner",
  "AMPD Project application",
  "AMPD Project sponsorship, underwriting, or partnership",
  "Another request",
] as const

export const BUDGET_RANGES = [
  "Under $10,000",
  "$10,000–$24,999",
  "$25,000–$49,999",
  "$50,000–$99,999",
  "$100,000–$249,999",
  "$250,000+",
  "Budget not yet determined",
] as const

export const ORGANIZATION_TYPES = [
  "Business",
  "Nonprofit",
  "Institution",
  "Government entity",
  "Agency",
  "Other organization",
] as const

export type RequestOption = (typeof REQUEST_OPTIONS)[number]
export type BudgetRange = (typeof BUDGET_RANGES)[number]
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number]

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value)
}

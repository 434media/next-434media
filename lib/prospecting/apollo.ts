/**
 * Apollo API wrapper — Stage 1 foundation for the prospecting feature.
 *
 * Two surfaces today:
 *   - searchByFilters()  — for /admin/leads/prospect (NL prompt → ICP search)
 *   - enrichByEmail()    — for the inbound engagement-enrichment flow
 *                          (Mailchimp click → fire Apollo to qualify)
 *
 * Both are header-authenticated (Apollo deprecated URL-param auth). All calls
 * go through `callApollo()` which centralizes auth, error mapping, and the
 * inferred credit counter.
 *
 * Plan-tier notes:
 *   - Free plan: 900 credits/year (~75/mo), 25 results/query cap, 50 reqs/min
 *   - Basic+:    30K+ credits/year, 1000+ results/query, no daily cap
 *   The wrapper does NOT enforce per-page caps locally — Apollo applies them
 *   server-side based on the active plan. Caller passes whatever per_page
 *   it wants; Apollo returns at most what the plan allows.
 *
 * Credit tracking is process-local (resets on server restart). Stage 6 will
 * persist this to Firestore for proper budget governance across restarts.
 */

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1"

// ─── Types ──────────────────────────────────────────────────────────────

// Apollo's `api_search` endpoint returns metadata flags (`has_*`) instead
// of actual values on Free plans. Real values come back on paid plans
// (Basic+) OR after spending an enrichment credit via /people/match.
//
// We model both shapes in the type so downstream code can ask "do we have
// real data?" without crashing on Free-plan responses.

export interface ApolloOrganization {
  id?: string
  name?: string
  website_url?: string
  /** Real value (Basic+) */
  industry?: string
  /** Free-plan flag: Apollo has industry data we'd see on a paid plan */
  has_industry?: boolean
  estimated_num_employees?: number
  has_employee_count?: boolean
  annual_revenue?: number
  has_revenue?: boolean
  primary_phone?: { number: string }
  has_phone?: boolean
  city?: string
  has_city?: boolean
  state?: string
  has_state?: boolean
  country?: string
  has_country?: boolean
  has_zip_code?: boolean
  linkedin_url?: string
}

export interface ApolloPerson {
  id: string
  first_name: string
  /** Real value (Basic+) */
  last_name?: string
  /** Free-plan obfuscated form, e.g. "Or***o" */
  last_name_obfuscated?: string
  name?: string
  title?: string
  /** Real value gated to paid plans + enrichment credit */
  email?: string
  /** Free-plan flag: Apollo has an email for this person */
  has_email?: boolean
  /** "verified" / "guessed" / "unavailable" — gate against this before sending */
  email_status?: string
  linkedin_url?: string
  city?: string
  has_city?: boolean
  state?: string
  has_state?: boolean
  country?: string
  has_country?: boolean
  has_direct_phone?: string | boolean
  last_refreshed_at?: string
  organization?: ApolloOrganization
}

/**
 * True if the response carries the Free-plan obfuscation flags rather than
 * real values. Useful for the review tray to show a "Real data unlocked on
 * Basic plan" affordance instead of empty fields.
 */
export function isObfuscatedPerson(p: ApolloPerson): boolean {
  return p.last_name_obfuscated !== undefined && p.last_name === undefined
}

/**
 * Apollo's seniority enum — used by the api_search endpoint to filter on
 * decision-maker tier without specifying exact titles. Useful when the rep
 * asks for "decision-makers" rather than naming roles explicitly.
 */
export type ApolloSeniority =
  | "owner"
  | "founder"
  | "c_suite"
  | "partner"
  | "vp"
  | "head"
  | "director"
  | "manager"
  | "senior"
  | "entry"
  | "intern"

/**
 * Apollo's contact-email-status enum — narrows results to candidates whose
 * email is verified vs. likely-to-engage vs. unavailable.
 */
export type ApolloEmailStatus =
  | "verified"
  | "likely to engage"
  | "unverified"
  | "unavailable"

/**
 * Filters accepted by searchByFilters(). Field names mirror Apollo's API
 * conventions. The translator (Stage 2) maps LLM-parsed prompts onto this
 * shape.
 *
 * Reference: https://docs.apollo.io/reference/people-api-search
 */
export interface ApolloSearchFilters {
  /** Org HQ locations, e.g. ["Texas, US"]. Apollo matches loosely. */
  organization_locations?: string[]
  /** Person titles, e.g. ["CEO", "VP Marketing", "Head of Partnerships"]. */
  person_titles?: string[]
  /** Expand exact-title matches with similar/related titles. */
  include_similar_titles?: boolean
  /** Seniority tier — broader than titles, e.g. ["c_suite", "founder", "vp"]. */
  person_seniorities?: ApolloSeniority[]
  /** Employee count ranges as strings, e.g. ["10,50", "51,200", "201,500"]. */
  num_employees_ranges?: string[]
  /** Annual revenue range in USD integers. */
  revenue_range?: {
    min?: number
    max?: number
  }
  /** Apollo internal industry tag IDs (resolve via /industry_tags). */
  industry_tag_ids?: string[]
  /** Loose keyword search across the candidate's profile. */
  q_keywords?: string
  /** Filter by email verification status. */
  contact_email_status?: ApolloEmailStatus[]
  /** 1-indexed page number. */
  page?: number
  /** Max results per page. Server caps based on plan (25 Free, 1000 Basic+). */
  per_page?: number
}

export interface ApolloSearchResult {
  people: ApolloPerson[]
  page: number
  perPage: number
  totalEntries: number
  totalPages: number
}

// ─── Error class ────────────────────────────────────────────────────────

export type ApolloErrorCode =
  | "auth"          // 401 — bad / missing API key
  | "plan-blocked"  // 403 — endpoint not available on current plan
  | "rate-limited"  // 429 — slow down
  | "bad-request"   // 400 — invalid filters / payload
  | "validation"    // 422 — unprocessable entity (deprecated endpoint, schema violation)
  | "server-error"  // 500-range — Apollo's problem
  | "unknown"

export class ApolloError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: ApolloErrorCode,
  ) {
    super(message)
    this.name = "ApolloError"
  }
}

// ─── API key (lazy) ─────────────────────────────────────────────────────

let _apiKey: string | null = null

function getApiKey(): string {
  if (_apiKey) return _apiKey
  const key = process.env.APOLLO_API_KEY
  if (!key) {
    throw new ApolloError(
      "Missing required env var: APOLLO_API_KEY",
      0,
      "auth",
    )
  }
  _apiKey = key
  return key
}

// ─── Credit tracking (process-local) ────────────────────────────────────
//
// Apollo doesn't return a `creditsUsed` field in API responses; we infer
// from result shape. Conventions per Apollo docs:
//   - Search: 1 credit per record returned in `people`
//   - Match (enrichment): 1 credit per matched person (0 if no match;
//     Apollo's billing here may differ — verify in dashboard)
//
// Stage 6 makes this persistent. For now, sufficient for dev visibility.

let _creditsUsedThisProcess = 0

export function getCreditsUsedThisProcess(): number {
  return _creditsUsedThisProcess
}

export function resetCreditCounter(): void {
  _creditsUsedThisProcess = 0
}

// ─── Internal call helper ───────────────────────────────────────────────

async function callApollo<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${APOLLO_BASE_URL}${endpoint}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      "X-Api-Key": getApiKey(),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let message = `Apollo API error: ${res.status}`
    try {
      const errBody = await res.json()
      // Apollo error shapes vary; try common fields
      message = errBody?.error || errBody?.message || errBody?.errors?.[0]?.message || message
    } catch {
      /* response wasn't JSON; keep generic message */
    }

    const code: ApolloErrorCode =
      res.status === 401 ? "auth" :
      res.status === 403 ? "plan-blocked" :
      res.status === 429 ? "rate-limited" :
      res.status === 400 ? "bad-request" :
      res.status === 422 ? "validation" :
      res.status >= 500 ? "server-error" :
      "unknown"

    throw new ApolloError(message, res.status, code)
  }

  return (await res.json()) as T
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * People Search — the prospecting workhorse. Returns candidates matching the
 * given ICP filters. Caller is responsible for scoring + dedup.
 *
 * Endpoint: /v1/mixed_people/api_search (the previous /mixed_people/search
 * is deprecated for API callers as of 2026 — Apollo returns 422 with a
 * "use the new endpoint" message if you hit the old one).
 *
 * The new endpoint does NOT return email addresses or phone numbers in the
 * search response; those require enrichByEmail() afterward. Fine for our
 * flow — we score on fit attributes from search, then spend an enrichment
 * credit on approved candidates only.
 *
 * Display cap: 50,000 records total (100 per page, up to 500 pages).
 * Apply filters to narrow before paginating.
 *
 * Credit cost: 1 per record returned.
 */
export async function searchByFilters(
  filters: ApolloSearchFilters,
): Promise<ApolloSearchResult> {
  const body: Record<string, unknown> = {
    page: filters.page ?? 1,
    per_page: filters.per_page ?? 25,
  }

  // Only include filter fields that have values — Apollo treats empty
  // arrays as "no constraint" but it's cleaner to omit.
  // Note: the new api_search endpoint dropped the `q_` prefix on the
  // organization_locations parameter (was `q_organization_locations` on
  // the deprecated endpoint).
  if (filters.organization_locations?.length) {
    body.organization_locations = filters.organization_locations
  }
  if (filters.person_titles?.length) {
    body.person_titles = filters.person_titles
  }
  if (filters.include_similar_titles !== undefined) {
    body.include_similar_titles = filters.include_similar_titles
  }
  if (filters.person_seniorities?.length) {
    body.person_seniorities = filters.person_seniorities
  }
  if (filters.num_employees_ranges?.length) {
    body.organization_num_employees_ranges = filters.num_employees_ranges
  }
  if (filters.revenue_range?.min !== undefined) {
    // Apollo uses bracket-style keys for nested range params.
    body["revenue_range[min]"] = filters.revenue_range.min
  }
  if (filters.revenue_range?.max !== undefined) {
    body["revenue_range[max]"] = filters.revenue_range.max
  }
  if (filters.industry_tag_ids?.length) {
    body.organization_industry_tag_ids = filters.industry_tag_ids
  }
  if (filters.contact_email_status?.length) {
    body.contact_email_status = filters.contact_email_status
  }
  if (filters.q_keywords?.trim()) {
    body.q_keywords = filters.q_keywords.trim()
  }

  interface RawSearchResponse {
    people?: ApolloPerson[]
    pagination?: {
      page?: number
      per_page?: number
      total_entries?: number
      total_pages?: number
    }
  }

  const data = await callApollo<RawSearchResponse>("/mixed_people/api_search", body)
  const people = data.people ?? []
  _creditsUsedThisProcess += people.length

  return {
    people,
    page: data.pagination?.page ?? (body.page as number),
    perPage: data.pagination?.per_page ?? (body.per_page as number),
    totalEntries: data.pagination?.total_entries ?? 0,
    totalPages: data.pagination?.total_pages ?? 1,
  }
}

/**
 * People Enrichment — single record by email. Returns `null` when Apollo
 * has no match. Used by the engagement-enrichment flow when an inbound
 * Mailchimp click triggers a Lead promotion.
 *
 * Endpoint: /v1/people/match
 * Credit cost: 1 per matched person.
 */
export async function enrichByEmail(email: string): Promise<ApolloPerson | null> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return null

  interface RawMatchResponse {
    person?: ApolloPerson
    matched?: boolean
  }

  const data = await callApollo<RawMatchResponse>("/people/match", {
    email: trimmed,
  })

  if (!data.person) return null
  _creditsUsedThisProcess += 1
  return data.person
}

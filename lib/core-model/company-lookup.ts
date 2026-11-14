// The company lookup (V1 item 4, "Then the company lookup"; 434-context `00 Governing/434_Process_Log_and_SOP.md`).
//
// An inbound business arrival whose Organization is unknown or thin is looked up once, by its email domain, before it
// is scored, so the fit grade reflects the real company rather than what the form happened to ask. It reuses Apollo's
// person match (`enrichByEmail` in lib/prospecting/apollo.ts), which spends one credit per match.
//
// The rules, each tested in lib/__tests__/company-lookup.test.ts:
//   - business arrivals only: a personal or private contact, and anything from the founder's Google Contacts, is
//     never looked up;
//   - free-mail and 434's own domains are skipped (lib/core-model/identity.ts);
//   - once per domain: the result is stored on the Organization (claimed by domain in `crm_org_domains`) as
//     `company_lookup`, reserved in a transaction before the call, so two runs never both pay for one domain;
//   - a daily cap, reserved in the same transaction, and a per-run cap;
//   - every lookup is logged with the credits it spent (`crm_company_lookups`), and a matched call is also in the
//     Apollo credit log (`apollo_credit_log`) with the rest of 434's Apollo spend;
//   - it writes only to the Organization, never to a Person (the spec's `automationPatchRefusal` rule): the store it
//     is given has no Person methods at all;
//   - a field a person already filled is never overwritten, and the company's facts are applied only when Apollo's
//     company is on the same domain.
//
// Pure apart from the injected store and Apollo call.

import type { CohortLike } from "@/lib/prospecting/cohort-match"
import type { ApolloPerson } from "@/lib/prospecting/apollo"
import type { CompanyLookupMark, InboxItem, Organization, Relationship, Visibility } from "@/types/core-model"
import { FREE_MAIL_DOMAINS, isOwnDomain, normalizeDomain, normalizeEmail } from "./identity"
import { scoreOrganization } from "./score"
import type { NewOrganization } from "./service"

/** Lookups a day across every run, unless `COMPANY_LOOKUP_DAILY_CAP` says otherwise. */
export const DEFAULT_DAILY_CAP = 20
/** Lookups in one run (one cron run, or one form arrival), unless `COMPANY_LOOKUP_RUN_CAP` says otherwise. */
export const DEFAULT_RUN_CAP = 10
/** A `pending` mark older than this is a run that died mid-call; the domain may be tried again. */
export const PENDING_TIMEOUT_MS = 15 * 60 * 1000

const capFrom = (raw: string | undefined, fallback: number) => {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}
export const dailyCap = () => capFrom(process.env.COMPANY_LOOKUP_DAILY_CAP, DEFAULT_DAILY_CAP)
export const runCap = () => capFrom(process.env.COMPANY_LOOKUP_RUN_CAP, DEFAULT_RUN_CAP)

/** One arrival that might be looked up. */
export interface LookupCandidate {
  email?: string
  /** The company the arrival named, used only to name a new Organization. */
  company?: string
  source?: string
  relationship?: Relationship
  visibility?: Visibility
  /** The inbox activity it came from, for the log. */
  activity_id?: string
}

export type LookupSkip =
  | "no_email"
  | "free_mail"
  | "own_domain"
  | "personal"
  | "google_contacts"
  | "private_organization"
  | "not_thin"
  | "already_looked_up"
  | "in_progress"
  | "daily_cap"
  | "run_cap"

export type LookupOutcome =
  | { domain: string; status: "skipped"; reason: LookupSkip }
  | { domain: string; status: CompanyLookupMark["status"]; organization_id: string; credits: number; filled: string[] }

/** The domain a candidate would be looked up on, or the reason it never is. Checked before anything is read. */
export function lookupGate(c: LookupCandidate): { domain: string } | { reason: LookupSkip; domain: string } {
  // Personal first: a personal contact is never looked up, whatever its address.
  if (c.relationship === "personal" || c.visibility === "private") return { reason: "personal", domain: "" }
  if (c.source === "google_contacts") return { reason: "google_contacts", domain: "" }
  const email = normalizeEmail(c.email)
  if (!email) return { reason: "no_email", domain: "" }
  const domain = normalizeDomain(email.split("@")[1])
  if (!domain) return { reason: "no_email", domain: "" }
  if (FREE_MAIL_DOMAINS.has(domain)) return { reason: "free_mail", domain }
  if (isOwnDomain(domain)) return { reason: "own_domain", domain }
  return { domain }
}

/**
 * Thin: the rubric has too little to grade it. The rubric scores industry, location and size; a company missing
 * its industry, or both its size and its revenue, is thin.
 */
export function isThin(org: Pick<Organization, "industry" | "employee_count" | "annual_revenue">): boolean {
  return !org.industry || (org.employee_count === undefined && org.annual_revenue === undefined)
}

/** True when this Organization's domain has been looked up already, or is being looked up now. */
export function lookupDone(mark: CompanyLookupMark | undefined, nowMs: number): "done" | "in_progress" | null {
  if (!mark) return null
  if (mark.status === "error") return null
  if (mark.status === "pending") {
    const at = Date.parse(mark.at)
    return Number.isFinite(at) && nowMs - at < PENDING_TIMEOUT_MS ? "in_progress" : null
  }
  return "done"
}

/** The company's own website domain, as Apollo gives it. */
const apolloDomain = (p: ApolloPerson) => normalizeDomain(p.organization?.website_url)

/**
 * The Organization fields Apollo's company fills. Only fields that are empty now; a value a person entered stays.
 * The name is taken only when the Organization is still named after its domain (a placeholder).
 */
export function fieldsFromApollo(org: Organization, person: ApolloPerson): Partial<NewOrganization> {
  const a = person.organization ?? {}
  const out: Partial<NewOrganization> = {}
  if (!org.industry && typeof a.industry === "string" && a.industry.trim()) out.industry = a.industry.trim()
  if (org.employee_count === undefined && typeof a.estimated_num_employees === "number" && a.estimated_num_employees > 0) {
    out.employee_count = a.estimated_num_employees
  }
  if (org.annual_revenue === undefined && typeof a.annual_revenue === "number" && a.annual_revenue > 0) {
    out.annual_revenue = a.annual_revenue
  }
  const location = [a.city, a.state, a.country].filter((x) => typeof x === "string" && x.trim()).join(", ")
  if (!org.location && location) out.location = location
  const placeholder = !org.name.trim() || normalizeDomain(org.name) === org.domain
  if (placeholder && typeof a.name === "string" && a.name.trim()) out.name = a.name.trim()
  return out
}

/** The one log line for a lookup: what it cost and what it found. */
export interface LookupLogEntry {
  at: string
  domain: string
  organization_id: string
  activity_id?: string
  trigger: string
  status: CompanyLookupMark["status"]
  /** Apollo credits this call spent: 1 for a matched person, else 0. */
  credits: number
  apollo_organization_id?: string
  filled: string[]
  error?: string
}

/**
 * What the lookup may touch. Organizations only: there is deliberately no Person method here, so the lookup cannot
 * write to a Person's address-book fields.
 */
export interface CompanyLookupStore {
  findOrganizationByDomain(domain: string): Promise<Organization | null>
  createOrganization(input: NewOrganization): Promise<Organization>
  updateOrganization(id: string, patch: Partial<NewOrganization>): Promise<Organization>
  /**
   * In one transaction: refuse if the Organization's domain is already looked up or in flight, or if today's count
   * has reached `cap`; otherwise count one lookup for `day` and mark the Organization `pending`.
   */
  reserve(orgId: string, day: string, cap: number, at: string): Promise<"ok" | "done" | "in_progress" | "daily_cap">
  log(entry: LookupLogEntry): Promise<void>
}

export interface CompanyLookupDeps {
  store: CompanyLookupStore
  /** `enrichByEmail` with its credit-log context. Returns null when Apollo has no match (no credit spent). */
  enrich(email: string): Promise<ApolloPerson | null>
  cohorts: CohortLike[]
  now(): string
  dailyCap: number
}

const dayOf = (iso: string) => iso.slice(0, 10)

/** Look one arrival's company up, if it may and should be. Never throws for an Apollo failure; it is logged. */
export async function lookupCompany(deps: CompanyLookupDeps, c: LookupCandidate, trigger: string): Promise<LookupOutcome> {
  const gate = lookupGate(c)
  if ("reason" in gate) return { domain: gate.domain, status: "skipped", reason: gate.reason }
  const { domain } = gate
  const at = deps.now()

  // The Organization for this domain: the stored one, or a new one named for what the arrival said.
  let org = await deps.store.findOrganizationByDomain(domain)
  if (org?.visibility === "private") return { domain, status: "skipped", reason: "private_organization" }
  const done = lookupDone(org?.company_lookup, Date.parse(at))
  if (done) return { domain, status: "skipped", reason: done === "done" ? "already_looked_up" : "in_progress" }
  if (org && !isThin(org)) return { domain, status: "skipped", reason: "not_thin" }
  if (!org) {
    const name = (c.company ?? "").trim() || domain
    const base = { name, location: undefined }
    try {
      org = await deps.store.createOrganization({
        name,
        domain,
        roles: [],
        visibility: "business",
        legacy_refs: [],
        ...scoreOrganization(base, deps.cohorts, at),
      })
    } catch (err) {
      // Another arrival claimed the domain first: use theirs.
      org = await deps.store.findOrganizationByDomain(domain)
      if (!org) throw err
    }
  }

  const reserved = await deps.store.reserve(org.id, dayOf(at), deps.dailyCap, at)
  if (reserved === "done") return { domain, status: "skipped", reason: "already_looked_up" }
  if (reserved === "in_progress") return { domain, status: "skipped", reason: "in_progress" }
  if (reserved === "daily_cap") return { domain, status: "skipped", reason: "daily_cap" }

  const email = normalizeEmail(c.email)
  let mark: CompanyLookupMark
  let patch: Partial<NewOrganization> = {}
  try {
    const person = await deps.enrich(email)
    if (!person) {
      mark = { status: "no_match", source: "apollo", at, credits: 0 }
    } else if (apolloDomain(person) && apolloDomain(person) !== domain) {
      // Apollo matched the person at a different company (they moved, or the address is shared): the credit is
      // spent, but that company's facts are not this domain's, so nothing is filled.
      mark = { status: "mismatch", source: "apollo", at, credits: 1, apollo_organization_id: person.organization?.id }
    } else {
      patch = fieldsFromApollo(org, person)
      mark = {
        status: "matched",
        source: "apollo",
        at,
        credits: 1,
        apollo_organization_id: person.organization?.id,
        filled: Object.keys(patch),
      }
    }
  } catch (err) {
    // No credit is spent on a failed call. The mark is `error`, so a later run may try again.
    mark = { status: "error", source: "apollo", at, credits: 0, error: (err as Error).message?.slice(0, 300) || "error" }
  }

  // Rescore with the shared rubric on what is now known: the grade reflects the real company.
  const merged = { ...org, ...patch }
  const scored = Object.keys(patch).length ? scoreOrganization(merged, deps.cohorts, at) : {}
  const updated = await deps.store.updateOrganization(org.id, { ...patch, ...scored, company_lookup: mark })
  await deps.store.log({
    at,
    domain,
    organization_id: updated.id,
    activity_id: c.activity_id,
    trigger,
    status: mark.status,
    credits: mark.credits,
    apollo_organization_id: mark.apollo_organization_id,
    filled: mark.filled ?? [],
    error: mark.error,
  })
  return { domain, status: mark.status, organization_id: updated.id, credits: mark.credits, filled: mark.filled ?? [] }
}

/**
 * Look a batch of arrivals up, newest first as given, stopping at `maxPerRun` lookups that reached Apollo. A domain
 * seen twice in one batch is tried once. A reached daily cap ends the run.
 */
export async function lookupCompanies(
  deps: CompanyLookupDeps,
  candidates: LookupCandidate[],
  opts: { trigger: string; maxPerRun: number },
): Promise<{ outcomes: LookupOutcome[]; lookedUp: number; credits: number }> {
  const outcomes: LookupOutcome[] = []
  const seen = new Set<string>()
  let lookedUp = 0
  let credits = 0
  for (const c of candidates) {
    const gate = lookupGate(c)
    if (!("reason" in gate)) {
      if (seen.has(gate.domain)) continue
      seen.add(gate.domain)
      if (lookedUp >= opts.maxPerRun) {
        outcomes.push({ domain: gate.domain, status: "skipped", reason: "run_cap" })
        continue
      }
    }
    const out = await lookupCompany(deps, c, opts.trigger)
    outcomes.push(out)
    if (out.status !== "skipped") {
      lookedUp++
      credits += out.credits
    }
    if (out.status === "skipped" && out.reason === "daily_cap") break
  }
  return { outcomes, lookedUp, credits }
}

/** The inbox items worth a lookup: business arrivals whose Organization is unknown or thin. Newest first. */
export function candidatesFromInbox(items: InboxItem[]): LookupCandidate[] {
  return items
    .filter((i) => !i.organization || (!i.organization.own && isThin(i.organization)))
    .map((i) => ({
      email: i.activity.contact.email ?? i.person?.emails[0],
      company: i.activity.contact.company,
      source: i.activity.source,
      relationship: i.person?.relationship ?? i.activity.relationship,
      visibility: i.activity.visibility === "private" || i.person?.visibility === "private" ? "private" : undefined,
      activity_id: i.activity.id,
    }))
}

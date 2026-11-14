import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type { IcpFitBreakdown, IcpGrade } from "../types/crm-types"
import type { CompanyLookupMark, CoreRole, LegacyRef, Organization } from "../types/core-model"
import { CORE_ROLES } from "../types/core-model"
import { normalizeVisibility } from "./core-model/visibility"
import { normalizeDomain, organizationNameKey } from "./core-model/identity"
import { DuplicateError, type NewOrganization } from "./core-model/service"
import { asStringArray, domainClaimId, stripUndefined, toIsoString } from "./core-model/firestore-util"

// Organizations (the core model). One per website domain, claimed in `crm_org_domains` in the same transaction
// that writes the Organization. An Organization with no domain is allowed when made by hand, and is never matched.

const COLLECTION = CRM_COLLECTIONS.ORGANIZATIONS
const DOMAINS = CRM_COLLECTIONS.ORG_DOMAINS

const CACHE_TTL = 30 * 1000
let listCache: { data: Organization[]; ts: number } | null = null

export function invalidateOrganizations(): void {
  listCache = null
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined)

function normalize(id: string, raw: FirebaseFirestore.DocumentData): Organization {
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : "",
    domain: normalizeDomain(raw.domain) || undefined,
    roles: asStringArray(raw.roles).filter((r): r is CoreRole => CORE_ROLES.includes(r as CoreRole)),
    industry: str(raw.industry),
    location: str(raw.location),
    employee_count: num(raw.employee_count),
    annual_revenue: num(raw.annual_revenue),
    icp_fit_score: num(raw.icp_fit_score),
    icp_grade: str(raw.icp_grade) as IcpGrade | undefined,
    icp_breakdown: raw.icp_breakdown && typeof raw.icp_breakdown === "object" ? (raw.icp_breakdown as IcpFitBreakdown) : undefined,
    icp_review: typeof raw.icp_review === "string" ? raw.icp_review : null,
    scored_at: toIsoString(raw.scored_at) || undefined,
    capabilities: str(raw.capabilities),
    rates: str(raw.rates),
    company_lookup: normalizeLookupMark(raw.company_lookup),
    visibility: normalizeVisibility(raw.visibility),
    legacy_refs: Array.isArray(raw.legacy_refs) ? (raw.legacy_refs as LegacyRef[]) : [],
    merged_into: str(raw.merged_into),
    created_at: toIsoString(raw.created_at),
    updated_at: toIsoString(raw.updated_at),
  }
}

const LOOKUP_STATUSES: ReadonlyArray<CompanyLookupMark["status"]> = ["pending", "matched", "no_match", "mismatch", "error"]

function normalizeLookupMark(raw: unknown): CompanyLookupMark | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const r = raw as Record<string, unknown>
  const status = LOOKUP_STATUSES.includes(r.status as CompanyLookupMark["status"]) ? (r.status as CompanyLookupMark["status"]) : undefined
  if (!status) return undefined
  return {
    status,
    source: "apollo",
    at: toIsoString(r.at),
    credits: num(r.credits) ?? 0,
    apollo_organization_id: str(r.apollo_organization_id),
    filled: Array.isArray(r.filled) ? asStringArray(r.filled) : undefined,
    error: str(r.error),
  }
}

export async function listOrganizations(): Promise<Organization[]> {
  if (listCache && Date.now() - listCache.ts < CACHE_TTL) return listCache.data
  const snap = await getDb().collection(COLLECTION).get()
  const data = snap.docs.map((d) => normalize(d.id, d.data()))
  listCache = { data, ts: Date.now() }
  return data
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const doc = await getDb().collection(COLLECTION).doc(id).get()
  return doc.exists ? normalize(doc.id, doc.data() as FirebaseFirestore.DocumentData) : null
}

export async function findOrganizationByDomain(domain: string): Promise<Organization | null> {
  const key = normalizeDomain(domain)
  if (!key) return null
  const claim = await getDb().collection(DOMAINS).doc(domainClaimId(key)).get()
  const orgId = claim.exists ? (claim.data()?.organization_id as string | undefined) : undefined
  return orgId ? getOrganization(orgId) : null
}

/** A stored, unmerged Organization with no domain whose folded name matches. */
export async function findOrganizationByName(name: string): Promise<Organization | null> {
  const key = organizationNameKey(name)
  if (!key) return null
  const all = await listOrganizations()
  return all.find((o) => !o.domain && !o.merged_into && organizationNameKey(o.name) === key) ?? null
}

export async function createOrganization(input: NewOrganization): Promise<Organization> {
  const db = getDb()
  const ref = db.collection(COLLECTION).doc()
  const now = new Date().toISOString()
  const domain = normalizeDomain(input.domain) || undefined
  await db.runTransaction(async (tx) => {
    const claim = domain ? db.collection(DOMAINS).doc(domainClaimId(domain)) : null
    if (claim) {
      const snap = await tx.get(claim)
      if (snap.exists) throw new DuplicateError(`${domain} already belongs to an organization.`, snap.data()?.organization_id as string)
    }
    tx.set(ref, stripUndefined({ ...input, domain, created_at: now, updated_at: now }))
    if (claim) tx.set(claim, { domain, organization_id: ref.id, at: now })
  })
  const created = (await getOrganization(ref.id)) as Organization
  // Add the new record to a warm list rather than dropping the list: a bulk import creating one company per contact
  // would otherwise re-read the whole collection for every contact (findOrganizationByName reads the list).
  if (listCache && created) listCache = { data: [...listCache.data, created], ts: listCache.ts }
  else invalidateOrganizations()
  return created
}

/** Update fields. A new domain is claimed (and refused if another Organization holds it). */
export async function updateOrganization(id: string, patch: Partial<NewOrganization>): Promise<Organization> {
  const db = getDb()
  const ref = db.collection(COLLECTION).doc(id)
  const now = new Date().toISOString()
  await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref)
    if (!cur.exists) throw new Error(`Organization ${id} not found`)
    // A key present with no value clears the field (null reads back as absent).
    const update: Record<string, unknown> = { updated_at: now }
    for (const [k, v] of Object.entries(patch)) update[k] = v === undefined ? null : v
    if ("domain" in patch) {
      const domain = normalizeDomain(patch.domain) || undefined
      update.domain = domain ?? null
      // The domain it held before is released, so a corrected domain (two Organizations whose domains were swapped)
      // can be claimed by the Organization it belongs to. Only a claim this Organization holds is released.
      const previous = normalizeDomain(cur.data()?.domain) || undefined
      const oldClaim = previous && previous !== domain ? db.collection(DOMAINS).doc(domainClaimId(previous)) : null
      const oldSnap = oldClaim ? await tx.get(oldClaim) : null
      if (domain) {
        const claim = db.collection(DOMAINS).doc(domainClaimId(domain))
        const snap = await tx.get(claim)
        const holder = snap.data()?.organization_id as string | undefined
        if (snap.exists && holder !== id) throw new DuplicateError(`${domain} already belongs to an organization.`, holder as string)
        if (!snap.exists) tx.set(claim, { domain, organization_id: id, at: now })
      }
      if (oldClaim && oldSnap?.exists && oldSnap.data()?.organization_id === id) tx.delete(oldClaim)
    }
    tx.update(ref, stripUndefined(update))
  })
  invalidateOrganizations()
  return (await getOrganization(id)) as Organization
}

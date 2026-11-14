// One view of people, organizations, links and activities: the stored core records plus the read-time ones from
// old collections. Matching is the duplicate rule (a Person by email, an Organization by domain): records that
// share an email are the same Person and are shown once, the stored one winning, with every old record's id kept
// in `legacy_refs`. Nothing here writes, and nothing is merged in storage; an explicit merge is a separate,
// logged action.

import type { Activity, Affiliation, LifecycleStage, Organization, Person } from "@/types/core-model"
import { LIFECYCLE_STAGES } from "@/types/core-model"
import type { CoreBundle } from "./adapters"
import { mergeConsent } from "./consent"
import { normalizeEmail, organizationNameKey } from "./identity"

export interface CoreView {
  people: Person[]
  organizations: Organization[]
  affiliations: Affiliation[]
  activities: Activity[]
}

const union = <T>(a: T[], b: T[]) => Array.from(new Set([...a, ...b]))

const refKey = (r: { collection: string; id: string }) => `${r.collection}/${r.id}`
const unionRefs = <T extends { collection: string; id: string }>(a: T[], b: T[]) => {
  const seen = new Set(a.map(refKey))
  return [...a, ...b.filter((r) => !seen.has(refKey(r)))]
}

/** The later of two stages: a stage only moves forward when two records describe one person. */
export function laterStage(a: LifecycleStage, b: LifecycleStage): LifecycleStage {
  return LIFECYCLE_STAGES.indexOf(a) >= LIFECYCLE_STAGES.indexOf(b) ? a : b
}

/**
 * Combine stored records and adapted bundles into one view. `triagedIds` are activity ids with a triage record.
 * Stored records come first and win; read-time records fold into them by email (people) or domain, then folded
 * name (organizations).
 */
export function assembleCoreView(stored: CoreBundle, adapted: CoreBundle[], triagedIds: ReadonlySet<string>): CoreView {
  const personRemap = new Map<string, string>()
  const orgRemap = new Map<string, string>()

  // ── People ──
  const people = new Map<string, Person>()
  const byEmail = new Map<string, string>()
  const merged = stored.people.filter((p) => p.merged_into)
  for (const p of stored.people) {
    if (p.merged_into) continue
    people.set(p.id, { ...p })
    for (const e of p.emails) byEmail.set(e, p.id)
  }
  // A merged-away Person points at the one it was merged into (followed to the end of the chain).
  for (const p of merged) {
    let target = p.merged_into as string
    const seen = new Set<string>([p.id])
    while (!people.has(target)) {
      const next = stored.people.find((q) => q.id === target)?.merged_into
      if (!next || seen.has(next)) break
      seen.add(target)
      target = next
    }
    personRemap.set(p.id, target)
  }
  for (const bundle of adapted) {
    for (const p of bundle.people) {
      const hit = p.emails.map((e) => byEmail.get(e)).find(Boolean)
      if (hit) {
        const cur = people.get(hit) as Person
        people.set(hit, {
          ...cur,
          emails: union(cur.emails, p.emails),
          phones: union(cur.phones, p.phones),
          roles: union(cur.roles, p.roles),
          title: cur.title || p.title,
          country: cur.country || p.country,
          location: cur.location || p.location,
          lifecycle_stage: laterStage(cur.lifecycle_stage, p.lifecycle_stage),
          consent: cur.read_only ? mergeConsent(cur.consent, p.consent) : cur.consent,
          legacy_refs: unionRefs(cur.legacy_refs, p.legacy_refs),
        })
        for (const e of p.emails) byEmail.set(e, hit)
        personRemap.set(p.id, hit)
      } else if (!people.has(p.id)) {
        people.set(p.id, { ...p })
        for (const e of p.emails) byEmail.set(e, p.id)
      } else {
        personRemap.set(p.id, p.id)
      }
    }
  }

  // ── Organizations ──
  const orgs = new Map<string, Organization>()
  const byDomain = new Map<string, string>()
  const byName = new Map<string, string>()
  const indexOrg = (o: Organization) => {
    if (o.domain) byDomain.set(o.domain, o.id)
    const k = organizationNameKey(o.name)
    if (k && !byName.has(k)) byName.set(k, o.id)
  }
  for (const o of stored.organizations) {
    if (o.merged_into) {
      orgRemap.set(o.id, o.merged_into)
      continue
    }
    orgs.set(o.id, { ...o })
    indexOrg(o)
  }
  for (const bundle of adapted) {
    for (const o of bundle.organizations) {
      // By domain first; a record with no domain folds in by name only.
      const hit = (o.domain && byDomain.get(o.domain)) || (!o.domain ? byName.get(organizationNameKey(o.name)) : undefined)
      if (hit) {
        const cur = orgs.get(hit) as Organization
        orgs.set(hit, {
          ...cur,
          domain: cur.domain || o.domain,
          roles: union(cur.roles, o.roles),
          industry: cur.industry || o.industry,
          location: cur.location || o.location,
          employee_count: cur.employee_count ?? o.employee_count,
          annual_revenue: cur.annual_revenue ?? o.annual_revenue,
          // A company known only from a personal contact becomes business once a business record names it, so a
          // client or lead is never hidden behind the founder's address book.
          visibility: cur.visibility === "private" && o.visibility !== "private" ? "business" : cur.visibility,
          legacy_refs: unionRefs(cur.legacy_refs, o.legacy_refs),
        })
        indexOrg(orgs.get(hit) as Organization)
        orgRemap.set(o.id, hit)
      } else {
        orgs.set(o.id, { ...o })
        indexOrg(o)
      }
    }
  }

  const person = (id: string | undefined) => (id ? personRemap.get(id) ?? id : undefined)
  const org = (id: string | undefined) => (id ? orgRemap.get(id) ?? id : undefined)

  // ── Affiliations ──
  const affs = new Map<string, Affiliation>()
  for (const a of [...stored.affiliations, ...adapted.flatMap((b) => b.affiliations)]) {
    const p = person(a.person_id) as string
    const o = org(a.organization_id) as string
    if (!people.has(p) || !orgs.has(o)) continue
    const key = `${p}|${o}|${a.role}`
    if (!affs.has(key)) affs.set(key, { ...a, person_id: p, organization_id: o })
  }

  // ── Activities ──
  const activities: Activity[] = []
  const seenActivity = new Set<string>()
  for (const a of [...stored.activities, ...adapted.flatMap((b) => b.activities)]) {
    if (seenActivity.has(a.id)) continue
    seenActivity.add(a.id)
    const email = normalizeEmail(a.contact.email)
    const linked = person(a.person_id)
    const personId = linked && people.has(linked) ? linked : email ? byEmail.get(email) : undefined
    activities.push({
      ...a,
      person_id: personId,
      organization_id: org(a.organization_id),
      triaged: a.triaged || triagedIds.has(a.id),
    })
  }
  activities.sort((x, y) => (y.occurred_at || "").localeCompare(x.occurred_at || ""))

  return {
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    organizations: [...orgs.values()].sort((a, b) => a.name.localeCompare(b.name)),
    affiliations: [...affs.values()],
    activities,
  }
}

/** The inbox is a view: activities not yet triaged, newest first. */
export function inboxOf(view: CoreView): Activity[] {
  return view.activities.filter((a) => !a.triaged)
}

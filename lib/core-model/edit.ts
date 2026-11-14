// Editing People and Organizations on /admin/people (V1 item 4; founder, 2026-11-14: "approve the edit build").
//
// One service for every edit, stored or read from an old collection:
//   - A record read from an old collection (`leads`, `crm_clients`, `contact_forms`, AIM) is never written there.
//     Editing it saves a core-model record that replaces it (`supersedes` holds the read-time id, `legacy_refs` the
//     old record), and the read path then shows the saved one only (lib/core-model/assemble.ts).
//   - The rules hold for every path: a cold Person's source, country and location are locked; a client never reverts;
//     only the founder changes personal/business; a private (personal) record is the founder's alone; only full
//     admins restrict. Emails are claimed one Person per address.
//   - A Google-linked Person's address-book fields (name, emails, phones, notes, title) are applied to its address
//     book and stamped, so the sync writes them back when write-back is on; until then they wait as a pending change.
//   - Every edit is written as a `record_edit` Activity with each field before and after, triaged at once so it never
//     reaches the inbox, and carrying the record's visibility.

import type {
  Affiliation,
  AffiliationRole,
  CoreRole,
  CoreSource,
  LifecycleStage,
  Organization,
  Person,
  Relationship,
  Visibility,
} from "@/types/core-model"
import type { CohortLike } from "@/lib/prospecting/cohort-match"
import { applyPersonEditToBook } from "./address-book"
import type { CoreView } from "./assemble"
import { personColdEditRefusal } from "./cold-gate"
import { domainFromEmail, isOwnDomain, normalizeDomain, normalizeEmail } from "./identity"
import { stageMoveRefusal } from "./lifecycle"
import { rolesForDomain } from "./own-company"
import { scoreOrganization } from "./score"
import { CoreRuleError, DuplicateError, editPerson, type CoreStore, type NewOrganization, type NewPerson } from "./service"
import { canHandlePersonal, canSee, canSetVisibility, effectiveVisibility, type VisibilityViewer } from "./visibility"

export interface EditContext {
  viewer: VisibilityViewer
  /** Who is editing, for the Activity and `added_by`. */
  actor: string
  cohorts: CohortLike[]
  now?: () => string
}

/** One link the Person should have after the edit: an existing Organization, or a new one to create. */
export interface LinkEdit {
  organization_id?: string
  create?: { name: string; domain?: string }
  role: AffiliationRole
  title?: string
}

/** A Person edit, validated by the route. A key that is present is changed; an absent key is left alone. */
export interface PersonEdit {
  name?: string
  emails?: string[]
  phones?: string[]
  title?: string
  notes?: string
  roles?: CoreRole[]
  lifecycle_stage?: LifecycleStage
  relationship?: Relationship
  visibility?: Visibility
  source?: CoreSource
  country?: string
  location?: string
  /** The whole set of current links. Links not in it end (kept as inactive history); new ones are created. */
  links?: LinkEdit[]
}

export interface OrganizationEdit {
  name?: string
  domain?: string
  roles?: CoreRole[]
  industry?: string
  location?: string
}

const ADDRESS_BOOK_EDITABLE = ["name", "emails", "phones", "notes", "title"] as const
const RUBRIC_FIELDS = ["name", "industry", "location"] as const

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** The read-time Person an adapted link was read for (`aff:<personId>|<orgId>|<role>`), or null for a stored link. */
export function readTimePersonOf(a: Pick<Affiliation, "id" | "read_only">): string | null {
  if (!a.read_only || !a.id.startsWith("aff:")) return null
  return a.id.slice(4).split("|")[0] || null
}

type Change = { field: string; before: unknown; after: unknown; winner: "crm" }

async function logEdit(
  store: CoreStore,
  ctx: EditContext,
  target: { person?: Person; organization?: Organization },
  changes: Change[],
  summary: string,
) {
  if (changes.length === 0) return
  const at = (ctx.now ?? (() => new Date().toISOString()))()
  const record = target.person ?? target.organization
  const activity = await store.createActivity({
    type: "record_edit",
    source: "manual",
    occurred_at: at,
    contact: target.person ? { name: target.person.name, email: target.person.emails[0] } : { company: target.organization?.name },
    person_id: target.person?.id,
    organization_id: target.organization?.id,
    summary,
    // Firestore refuses `undefined`; a missing value is kept as null.
    change: changes.map((c) => ({ ...c, before: c.before ?? null, after: c.after ?? null })),
    visibility: record ? effectiveVisibility(record) : "business",
    created_by: ctx.actor,
  })
  // An edit is not an arrival: triaged at once, so it never reaches the inbox.
  await store.recordTriage({ id: activity.id, decision: "save", by: ctx.actor, at, person_id: target.person?.id })
}

function notFound(): never {
  throw new CoreRuleError("Not found", 404)
}

// ── Organizations ────────────────────────────────────────────────────────────────────────────────────────────

/** Save a read-time Organization as a stored one that replaces it. Its domain is claimed (409 if held). */
async function saveOrganization(store: CoreStore, current: Organization, patch: Partial<NewOrganization>, ctx: EditContext): Promise<Organization> {
  const at = (ctx.now ?? (() => new Date().toISOString()))()
  const merged = { ...current, ...patch }
  const domain = "domain" in patch ? patch.domain : current.domain
  return store.createOrganization({
    name: merged.name,
    domain,
    roles: rolesForDomain(domain, merged.roles),
    industry: merged.industry,
    location: merged.location,
    employee_count: merged.employee_count,
    annual_revenue: merged.annual_revenue,
    capabilities: merged.capabilities,
    rates: merged.rates,
    company_lookup: merged.company_lookup,
    visibility: merged.visibility === "private" ? "private" : merged.visibility,
    legacy_refs: current.legacy_refs,
    supersedes: [current.id],
    ...(current.own ? {} : scoreOrganization(merged, ctx.cohorts, at)),
  })
}

export async function editOrganizationRecord(
  store: CoreStore,
  view: CoreView,
  id: string,
  edit: OrganizationEdit,
  ctx: EditContext,
): Promise<Organization> {
  const current = view.organizations.find((o) => o.id === id)
  if (!current || !canSee(current, ctx.viewer)) notFound()
  const patch: Partial<NewOrganization> = {}
  if ("name" in edit) {
    if (!edit.name?.trim()) throw new CoreRuleError("Name cannot be empty")
    patch.name = edit.name.trim()
  }
  if ("domain" in edit) patch.domain = normalizeDomain(edit.domain) || undefined
  if ("roles" in edit) patch.roles = rolesForDomain(patch.domain ?? current.domain, edit.roles ?? [])
  if ("industry" in edit) patch.industry = edit.industry || undefined
  if ("location" in edit) patch.location = edit.location || undefined

  const changes: Change[] = Object.entries(patch)
    .filter(([k, v]) => !same((current as unknown as Record<string, unknown>)[k], v))
    .map(([field, after]) => ({ field, before: (current as unknown as Record<string, unknown>)[field], after, winner: "crm" as const }))
  if (changes.length === 0) return current

  let saved: Organization
  if (current.read_only) {
    saved = await saveOrganization(store, current, patch, ctx)
  } else {
    const rescore = !current.own && RUBRIC_FIELDS.some((k) => k in patch)
    const at = (ctx.now ?? (() => new Date().toISOString()))()
    if (rescore) Object.assign(patch, scoreOrganization({ ...current, ...patch }, ctx.cohorts, at))
    saved = await store.updateOrganization(current.id, patch)
  }
  await logEdit(store, ctx, { organization: saved }, changes, `Organization edited: ${changes.map((c) => c.field).join(", ")}`)
  return saved
}

// ── People ───────────────────────────────────────────────────────────────────────────────────────────────────

function checkPersonRules(current: Person, edit: PersonEdit, viewer: VisibilityViewer) {
  const cold = personColdEditRefusal(current, edit)
  if (cold) throw new CoreRuleError(cold, 403, "jurisdiction_locked")
  if ("relationship" in edit && edit.relationship !== current.relationship && !canHandlePersonal(viewer)) {
    throw new CoreRuleError("Only the founder can change whether a contact is personal or business.", 403)
  }
  if ("visibility" in edit && edit.visibility !== current.visibility) {
    if (edit.visibility === "private") throw new CoreRuleError("A personal contact is private; set personal instead.")
    if (!canSetVisibility(viewer, edit.visibility)) throw new CoreRuleError("Only a full admin can change visibility.", 403)
  }
  if ("lifecycle_stage" in edit) {
    const refusal = stageMoveRefusal(current.lifecycle_stage, edit.lifecycle_stage)
    if (refusal) throw new CoreRuleError(refusal, 409, "client_never_reverts")
  }
  if ("name" in edit && !edit.name?.trim()) throw new CoreRuleError("Name cannot be empty")
}

/** The Person's current links in the view, each with whether it is stored or read from an old collection. */
function linksOf(view: CoreView, personId: string): Affiliation[] {
  return view.affiliations.filter((a) => a.person_id === personId)
}

/**
 * Save a read-time Person as a stored one that replaces it, with its current links copied as stored links. The
 * Person's emails are claimed (409 if another stored Person holds one).
 */
async function savePerson(store: CoreStore, view: CoreView, current: Person, ctx: EditContext): Promise<Person> {
  const rest: Partial<Person> = { ...current }
  const oldId = current.id
  delete rest.id
  delete rest.read_only
  delete rest.created_at
  delete rest.updated_at
  const stored = await store.createPerson({ ...(rest as NewPerson), supersedes: [oldId], added_by: current.added_by ?? ctx.actor })
  for (const a of linksOf(view, oldId)) {
    await store.createAffiliation({ person_id: stored.id, organization_id: a.organization_id, role: a.role, title: a.title, active: true })
  }
  return stored
}

/**
 * Edit a Person: stored, or read from an old collection (saved first, superseding it). Returns the stored Person.
 */
export async function editPersonRecord(store: CoreStore, view: CoreView, id: string, edit: PersonEdit, ctx: EditContext): Promise<Person> {
  const current = view.people.find((p) => p.id === id)
  if (!current || !canSee(current, ctx.viewer)) notFound()
  checkPersonRules(current, edit, ctx.viewer)

  const patch: Partial<NewPerson> = {}
  if ("name" in edit) patch.name = edit.name?.trim()
  if ("emails" in edit) {
    const emails = Array.from(new Set((edit.emails ?? []).map(normalizeEmail).filter(Boolean)))
    if (emails.length === 0 && !(patch.name ?? current.name)) throw new CoreRuleError("A person needs a name or an email.")
    patch.emails = emails
  }
  for (const k of ["phones", "title", "notes", "roles", "lifecycle_stage", "relationship", "visibility", "source", "country", "location"] as const) {
    if (k in edit) (patch as Record<string, unknown>)[k] = edit[k]
  }
  const changes: Change[] = Object.entries(patch)
    .filter(([k, v]) => !same((current as unknown as Record<string, unknown>)[k], v))
    .map(([field, after]) => ({ field, before: (current as unknown as Record<string, unknown>)[field], after, winner: "crm" as const }))
  for (const k of Object.keys(patch) as Array<keyof typeof patch>) {
    if (same((current as unknown as Record<string, unknown>)[k], patch[k])) delete patch[k]
  }

  // Links that match the current ones exactly (same organizations, roles and titles, nothing new) are no change.
  const currentLinks = linksOf(view, current.id)
  const linkKey = (l: { organization_id?: string; role: string; title?: string }) => `${l.organization_id}|${l.role}|${l.title ?? ""}`
  const wantsLinks =
    "links" in edit &&
    !(
      (edit.links ?? []).every((l) => l.organization_id && !l.create) &&
      same([...(edit.links ?? []).map((l) => linkKey({ ...l, title: l.title || undefined }))].sort(), currentLinks.map(linkKey).sort())
    )
  if (changes.length === 0 && !wantsLinks) return current

  // A Person read from an old collection is saved first. Its old record is never written.
  let person: Person = current.read_only ? await savePerson(store, view, current, ctx) : current
  const founder = canHandlePersonal(ctx.viewer)

  if (Object.keys(patch).length) {
    // A Google-linked Person's address book follows, so the sync can write it back (a pending change while
    // write-back is off). Latest edit wins against Google, by the stamp editPerson sets.
    const stored = await store.getPerson(person.id)
    if (stored?.address_book && ADDRESS_BOOK_EDITABLE.some((k) => k in patch)) {
      patch.address_book = applyPersonEditToBook(stored.address_book, patch)
    }
    person = await editPerson(store, person.id, patch, { founder, byPerson: true })
  }

  if (wantsLinks) {
    const linkChanges = await applyLinks(store, view, current, person, edit.links ?? [], ctx)
    changes.push(...linkChanges)
  }

  await logEdit(store, ctx, { person }, changes, `Edited: ${changes.map((c) => c.field).join(", ") || "no change"}`)
  return person
}

/**
 * Make the Person's current links exactly `wanted`. Stored links that go are marked inactive (never deleted).
 * Read-time links are replaced: the read-time Person they were read for is superseded, so they stop showing, and the
 * ones kept are stored. When a link to a client row's Organization ends and that Organization's domain came from this
 * Person's email, the Organization is saved without the domain, so it does not swallow the company the Person moved to.
 */
async function applyLinks(
  store: CoreStore,
  view: CoreView,
  before: Person,
  person: Person,
  wanted: LinkEdit[],
  ctx: EditContext,
): Promise<Change[]> {
  const orgById = new Map(view.organizations.map((o) => [o.id, o]))
  const at = (ctx.now ?? (() => new Date().toISOString()))()
  const personDomains = new Set(person.emails.map(domainFromEmail).filter(Boolean))

  // The links as they stand: for a Person just saved, the copies savePerson made; otherwise the view's.
  const current = before.read_only
    ? (await Promise.all(linksOf(view, before.id).map((a) => store.findAffiliation(person.id, a.organization_id, a.role)))).filter(
        (a): a is Affiliation => Boolean(a),
      )
    : linksOf(view, person.id)

  // Resolve each wanted link to an Organization id, creating new Organizations (an existing one on that domain is used).
  const targets: Array<{ organization_id: string; role: AffiliationRole; title?: string }> = []
  const endedIds = new Set<string>()
  const keyOf = (orgId: string, role: string) => `${orgId}|${role}`
  for (const a of current) if (!wanted.some((w) => w.organization_id === a.organization_id)) endedIds.add(a.organization_id)

  // An ended link to a client row whose domain came from this Person: save the Organization without it, first, so a
  // new Organization on that domain can claim it.
  const orgChanges: Change[] = []
  for (const orgId of endedIds) {
    const org = orgById.get(orgId)
    if (!org?.read_only || !org.domain || !personDomains.has(org.domain)) continue
    if (!org.legacy_refs.some((r) => r.collection === "crm_clients")) continue
    const saved = await saveOrganization(store, org, { domain: undefined }, ctx)
    await logEdit(
      store,
      ctx,
      { organization: saved },
      [{ field: "domain", before: org.domain, after: null, winner: "crm" }],
      `Domain cleared: it came from ${person.name}'s email, and ${person.name} moved to another organization`,
    )
  }

  for (const w of wanted) {
    let orgId = w.organization_id
    if (!orgId && w.create) {
      const name = w.create.name.trim()
      if (!name) throw new CoreRuleError("A new organization needs a name.")
      const domain = normalizeDomain(w.create.domain) || undefined
      try {
        const created = await store.createOrganization({
          name,
          domain,
          roles: [],
          visibility: effectiveVisibility(person) === "private" ? "private" : "business",
          legacy_refs: [],
          // 434's own company is never scored.
          ...(isOwnDomain(domain) ? {} : scoreOrganization({ name }, ctx.cohorts, at)),
        })
        orgId = created.id
        orgChanges.push({ field: "organization_created", before: null, after: `${name}${domain ? ` (${domain})` : ""}`, winner: "crm" })
      } catch (err) {
        // The domain already belongs to an Organization: link to that one.
        if (err instanceof DuplicateError) orgId = err.existingId
        else throw err
      }
    }
    if (!orgId) throw new CoreRuleError("Each link needs an organization.")
    if (w.organization_id) {
      const org = orgById.get(orgId)
      if (!org || !canSee(org, ctx.viewer)) throw new CoreRuleError("That organization was not found.", 404)
    }
    targets.push({ organization_id: orgId, role: w.role, title: w.title || undefined })
  }

  const changes: Change[] = [...orgChanges]
  const wantedKeys = new Set(targets.map((t) => keyOf(t.organization_id, t.role)))
  const readTime = new Set<string>()

  // End what is no longer wanted.
  for (const a of current) {
    if (wantedKeys.has(keyOf(a.organization_id, a.role))) continue
    const rt = readTimePersonOf(a)
    if (rt) readTime.add(rt)
    else await store.updateAffiliation(a.id, { active: false })
    changes.push({ field: "link_ended", before: `${orgById.get(a.organization_id)?.name ?? a.organization_id} (${a.role})`, after: null, winner: "crm" })
  }
  // Create or update what is wanted.
  for (const t of targets) {
    const existing = current.find((a) => keyOf(a.organization_id, a.role) === keyOf(t.organization_id, t.role))
    if (existing && !readTimePersonOf(existing)) {
      if ((existing.title ?? undefined) !== t.title) {
        await store.updateAffiliation(existing.id, { title: t.title })
        changes.push({ field: "link_title", before: existing.title, after: t.title, winner: "crm" })
      }
      continue
    }
    if (existing) {
      // A read-time link that stays: store it, and stop reading it from the old record.
      readTime.add(readTimePersonOf(existing) as string)
    }
    const found = await store.findAffiliation(person.id, t.organization_id, t.role)
    if (found) await store.updateAffiliation(found.id, { active: true, title: t.title })
    else await store.createAffiliation({ person_id: person.id, organization_id: t.organization_id, role: t.role, title: t.title, active: true })
    if (!existing) changes.push({ field: "link_added", before: null, after: `${orgById.get(t.organization_id)?.name ?? t.organization_id} (${t.role})`, winner: "crm" })
  }
  // A stored Person still showing links read from old records: supersede those read-time records, so only its stored
  // links show. Their old ids are kept.
  if (readTime.size) {
    const supersedes = Array.from(new Set([...(person.supersedes ?? []), ...readTime]))
    await store.updatePerson(person.id, { supersedes })
    // The links read from those records that are still wanted were stored above; any others the edit kept are copied.
    for (const a of current) {
      const rt = readTimePersonOf(a)
      if (!rt || !wantedKeys.has(keyOf(a.organization_id, a.role))) continue
      const found = await store.findAffiliation(person.id, a.organization_id, a.role)
      if (!found) await store.createAffiliation({ person_id: person.id, organization_id: a.organization_id, role: a.role, title: a.title, active: true })
    }
  }
  return changes
}

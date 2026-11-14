// The write side of the core model, against a store interface so the rules are tested without Firestore
// (lib/__tests__/core-model.test.ts uses an in-memory store; lib/core-model/firestore-store.ts is the real one).
//
// Rules held here:
//   - duplicates: a Person is matched by email and an Organization by domain; a match is reused, never copied,
//     and a merge is only ever the explicit mergePeople call, which is logged.
//   - consent: set from the source of first touch and only ever moved forward (lib/core-model/consent.ts).
//   - Google Contacts: an arrival from the address book is not stored until someone saves or promotes it; a
//     dismissal writes nothing at all.
//   - promote: the Person's stage moves to lead and the lead is created through the existing lead path, with its
//     consent and suppression checks (build sequence, item 4 first step: "'Create Lead' goes through the
//     existing lead path").
//   - personal contacts (spec, "People: personal and business"): a personal Person is always `private`, the founder
//     only. Only the founder adds, saves or promotes one; promoting makes it `business` at that moment. A personal
//     Person never reaches the lead path, so it never reaches a sequence or broadcast. An arrival that matches a
//     private Person by email is refused for anyone but the founder, without saying whose the address is.
//   - clients never revert: no write moves a stage back from `customer` (lib/core-model/lifecycle.ts).
//   - automation never edits address-book fields (name, emails, phones, title, notes, the Google record): enrichment
//     writes to the Organization only, so only people make the edits that sync to the phone.

import type { CohortLike } from "@/lib/prospecting/cohort-match"
import type {
  Activity,
  ActivityContact,
  AddressBook,
  Affiliation,
  AffiliationRole,
  GoogleLink,
  CoreRole,
  CoreSource,
  LifecycleStage,
  MergeRecord,
  Organization,
  Person,
  Relationship,
  TriageDecision,
  TriageRecord,
  Visibility,
} from "@/types/core-model"
import { validateActivity, type ActivityInput } from "./activity"
import { laterStage } from "./assemble"
import { consentFromSource, mergeConsent } from "./consent"
import { isOwnDomain, normalizeEmail, organizationDomain, organizationNameKey } from "./identity"
import { stageMoveRefusal } from "./lifecycle"
import { scoreOrganization } from "./score"
import { affiliationRoleForDomain, rolesForDomain } from "./own-company"
import { effectiveVisibility } from "./visibility"

export type NewPerson = Omit<Person, "id" | "created_at" | "updated_at" | "read_only">
export type NewOrganization = Omit<Organization, "id" | "created_at" | "updated_at" | "read_only">
export type NewAffiliation = Omit<Affiliation, "id" | "created_at" | "updated_at" | "read_only">

export interface CoreStore {
  getPerson(id: string): Promise<Person | null>
  findPersonByEmail(email: string): Promise<Person | null>
  /** Creates the Person and claims each email; throws DuplicateError if an email is already held. */
  createPerson(input: NewPerson): Promise<Person>
  updatePerson(id: string, patch: Partial<NewPerson>): Promise<Person>
  /** Points each email's claim at `personId` (used by an explicit merge). */
  reassignEmails(emails: string[], personId: string): Promise<void>
  getOrganization(id: string): Promise<Organization | null>
  findOrganizationByDomain(domain: string): Promise<Organization | null>
  /** A stored Organization with no domain whose folded name matches (address-book companies carry no domain). */
  findOrganizationByName(name: string): Promise<Organization | null>
  /** Creates the Organization and claims its domain; throws DuplicateError if the domain is held. */
  createOrganization(input: NewOrganization): Promise<Organization>
  updateOrganization(id: string, patch: Partial<NewOrganization>): Promise<Organization>
  findAffiliation(personId: string, organizationId: string, role: AffiliationRole): Promise<Affiliation | null>
  createAffiliation(input: NewAffiliation): Promise<Affiliation>
  /** Write-once. There is no update or delete. */
  createActivity(input: ActivityInput): Promise<Activity>
  getTriage(activityId: string): Promise<TriageRecord | null>
  recordTriage(record: TriageRecord): Promise<void>
  recordMerge(record: Omit<MergeRecord, "id">): Promise<void>
}

/** The existing lead path (lib/firestore-leads.ts), behind an interface so it can be tested. */
export interface LeadPath {
  /** Never called for a personal Person: the service refuses before it gets here. */
  createLeadFor(person: Person, activity: Activity): Promise<{ leadId: string | null }>
}

export class DuplicateError extends Error {
  constructor(
    message: string,
    readonly existingId: string,
  ) {
    super(message)
    this.name = "DuplicateError"
  }
}

export class CoreRuleError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 502 = 400,
  ) {
    super(message)
    this.name = "CoreRuleError"
  }
}

const now = () => new Date().toISOString()

// ── Person ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface PersonArrival {
  contact: ActivityContact
  source: CoreSource
  at: string
  actor?: string
  stage?: LifecycleStage
  roles?: CoreRole[]
  visibility?: Visibility
  /** Defaults to `business`. `personal` makes the Person `private`. */
  relationship?: Relationship
  /** True only when the founder is acting: an arrival may then match (and update) a private Person. */
  allowPrivate?: boolean
  /** The whole Google record, for a Person created from the address book. */
  address_book?: AddressBook
  /** The Google link, written with a new Person in the same write (the sync's import). */
  google?: GoogleLink
}

/** The relationship and visibility a new record gets. Personal is always `private`. */
export function relationshipAndVisibility(input: { relationship?: Relationship; visibility?: Visibility }): {
  relationship: Relationship
  visibility: Visibility
} {
  const relationship: Relationship = input.relationship === "personal" ? "personal" : "business"
  if (relationship === "personal") return { relationship, visibility: "private" }
  // A business record may be restricted, never private: private is the founder's personal tier.
  return { relationship, visibility: input.visibility === "restricted" ? "restricted" : "business" }
}

/** Refuses, for anyone but the founder, an arrival that matched a private Person. Says nothing about whose it is. */
function assertMayTouch(person: Person, allowPrivate: boolean | undefined) {
  if (effectiveVisibility(person) === "private" && !allowPrivate) {
    throw new CoreRuleError("That email address is already on file.", 409)
  }
}

/** Match the Person by email, or create one. A known Person's stage only moves forward and consent only gains. */
export async function ensurePerson(store: CoreStore, input: PersonArrival): Promise<{ person: Person; created: boolean }> {
  const email = normalizeEmail(input.contact.email)
  const stage = input.stage ?? "contact"
  if (email) {
    const existing = await store.findPersonByEmail(email)
    if (existing) {
      assertMayTouch(existing, input.allowPrivate)
      const consent = mergeConsent(existing.consent, consentFromSource(input.source, input.at))
      const nextStage = laterStage(existing.lifecycle_stage, stage)
      const roles = Array.from(new Set([...existing.roles, ...(input.roles ?? [])]))
      const changed =
        nextStage !== existing.lifecycle_stage ||
        consent !== existing.consent ||
        roles.length !== existing.roles.length
      const person = changed
        ? await store.updatePerson(existing.id, { lifecycle_stage: nextStage, consent, roles })
        : existing
      return { person, created: false }
    }
  }
  const name = (input.contact.name ?? "").trim() || email || (input.contact.phone ?? "").trim()
  if (!name) throw new CoreRuleError("A person needs a name or an email.")
  const rv = relationshipAndVisibility(input)
  if (rv.relationship === "personal" && !input.allowPrivate) {
    throw new CoreRuleError("Only the founder can add a personal contact.", 400)
  }
  if (rv.relationship === "personal" && stage !== "contact") {
    throw new CoreRuleError("A lead or client is a business contact; add them as business.", 400)
  }
  const book = input.address_book
  const person = await store.createPerson({
    name,
    emails: book ? Array.from(new Set(book.emails.map((e) => normalizeEmail(e.value)).filter(Boolean))) : email ? [email] : [],
    phones: book ? book.phones.map((p) => p.value).filter(Boolean) : input.contact.phone ? [input.contact.phone] : [],
    title: input.contact.title || undefined,
    lifecycle_stage: stage,
    roles: input.roles ?? [],
    consent: consentFromSource(input.source, input.at),
    source: input.source,
    country: input.contact.country || undefined,
    location: input.contact.location || undefined,
    ...rv,
    notes: book?.notes || undefined,
    address_book: book,
    google: input.google,
    added_by: input.actor,
    legacy_refs: [],
  })
  return { person, created: true }
}

// ── Organization ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Match the Organization by domain, or create and score it (scoring on arrival). An arrival with no company
 * domain (a free-mail address and no website) makes no Organization, because nothing could match it again.
 */
export async function ensureOrganization(
  store: CoreStore,
  input: {
    name?: string
    website?: string
    email?: string
    location?: string
    roles?: CoreRole[]
    /** `private` when the company comes only from a personal contact. */
    visibility?: Visibility
    /** Address-book companies carry a name and often no domain: match or create by name. */
    byName?: boolean
  },
  cohorts: CohortLike[],
): Promise<Organization | null> {
  const domain = organizationDomain({ website: input.website, email: input.email })
  const visibility: Visibility = input.visibility === "private" ? "private" : "business"
  const name = (input.name ?? "").trim()
  if (!domain && !(input.byName && organizationNameKey(name))) return null
  const existing = domain ? await store.findOrganizationByDomain(domain) : await store.findOrganizationByName(name)
  if (existing) {
    // A company first seen only through a personal contact becomes business once a business arrival names it.
    if (existing.visibility === "private" && visibility !== "private") {
      return store.updateOrganization(existing.id, { visibility: "business" })
    }
    return existing
  }
  const at = now()
  const base = { name: name || domain, location: input.location || undefined }
  try {
    return await store.createOrganization({
      ...base,
      domain: domain || undefined,
      // 434's own company never takes the prospect or client role, and is never scored.
      roles: rolesForDomain(domain, input.roles ?? []),
      visibility,
      legacy_refs: [],
      ...(isOwnDomain(domain) ? {} : scoreOrganization(base, cohorts, at)),
    })
  } catch (err) {
    // Another arrival claimed the domain first: use theirs.
    if (err instanceof DuplicateError) {
      const winner = await store.getOrganization(err.existingId)
      if (winner) return winner
    }
    throw err
  }
}

export async function ensureAffiliation(store: CoreStore, personId: string, organizationId: string, role: AffiliationRole, title?: string) {
  const existing = await store.findAffiliation(personId, organizationId, role)
  if (existing) return existing
  return store.createAffiliation({ person_id: personId, organization_id: organizationId, role, title, active: true })
}

// ── Arrivals and activities ──────────────────────────────────────────────────────────────────────────────────

/**
 * Record a touch against its Person (created or matched by email) and Organization (by domain). The activity is
 * validated first, so an email without its full text is refused before anything is written.
 */
export async function recordArrival(
  store: CoreStore,
  input: Omit<ActivityInput, "person_id" | "organization_id" | "visibility" | "relationship"> & {
    stage?: LifecycleStage
    roles?: CoreRole[]
    visibility?: Visibility
    relationship?: Relationship
    allowPrivate?: boolean
    address_book?: AddressBook
    google?: GoogleLink
  },
  cohorts: CohortLike[],
): Promise<{ person: Person; organization: Organization | null; activity: Activity; created: boolean }> {
  const { stage, roles, visibility, relationship, allowPrivate, address_book, google, ...activityInput } = input
  const problem = validateActivity({ ...activityInput })
  if (problem) throw new CoreRuleError(problem)
  const { person, created } = await ensurePerson(store, {
    contact: input.contact,
    source: input.source,
    at: input.occurred_at,
    actor: input.created_by,
    stage,
    roles,
    visibility,
    relationship,
    allowPrivate,
    address_book,
    google,
  })
  const fromAddressBook = Boolean(address_book) || input.source === "google_contacts"
  const organization = await ensureOrganization(
    store,
    {
      name: input.contact.company,
      website: input.contact.website,
      // A personal address names a person, not a company: only a business email's domain makes an Organization.
      email: person.relationship === "personal" ? undefined : input.contact.email,
      location: input.contact.location,
      visibility: person.relationship === "personal" ? "private" : "business",
      byName: fromAddressBook,
    },
    cohorts,
  )
  const role: AffiliationRole = roles?.[0] ?? (fromAddressBook ? "works_at" : "prospect")
  if (organization) {
    await ensureAffiliation(store, person.id, organization.id, affiliationRoleForDomain(organization.domain, role), input.contact.title)
  }
  const activity = await store.createActivity({
    ...activityInput,
    // The activity carries its Person's visibility, so it stays hidden even if read without its Person.
    visibility: effectiveVisibility(person),
    person_id: person.id,
    organization_id: organization?.id,
  })
  return { person, organization, activity, created }
}

// ── Triage ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface TriageResult {
  decision: TriageDecision
  /** False only for a dismissed Google Contacts entry: nothing about it was written. */
  stored: boolean
  person?: Person
  leadId?: string
}

/** True for an address-book entry that is waiting in the inbox and has never been written to the store. */
export function isPendingGoogleContact(activity: Pick<Activity, "source" | "type" | "read_only">): boolean {
  return activity.source === "google_contacts" && Boolean(activity.read_only)
}

/**
 * The waiting address-book arrivals (lib/google-contacts/server.ts holds them until someone decides). `discard`
 * forgets one: after a dismissal nothing about it is left in the CRM. `link` ties a saved Person to its Google contact.
 */
export interface PendingArrivals {
  discard(activityId: string): Promise<void>
  link(person: Person, activity: Activity): Promise<Person>
}

export const NO_PENDING_ARRIVALS: PendingArrivals = {
  async discard() {},
  async link(person) {
    return person
  },
}

/**
 * Promote (to lead), save (as a contact) or dismiss an inbox item. A Google Contacts entry that is dismissed is
 * never stored: this returns before any write to the store. Every other decision is recorded once, keyed on the
 * activity id.
 *
 * Personal contacts: `founder` must be true to save one as personal, to act on anything linked to a private Person,
 * or to promote one. Promotion makes the Person `business` at that moment, before the lead path is reached, so a
 * personal Person never becomes a lead.
 */
export async function triageActivity(
  store: CoreStore,
  leads: LeadPath,
  input: { activity: Activity; decision: TriageDecision; actor: string; founder?: boolean; relationship?: Relationship },
  cohorts: CohortLike[],
  pending: PendingArrivals = NO_PENDING_ARRIVALS,
): Promise<TriageResult> {
  const { decision, actor } = input
  const founder = input.founder === true
  let activity = input.activity
  if (activity.triaged) throw new CoreRuleError("This item has already been triaged.", 409)
  if (decision === "promote" && !normalizeEmail(activity.contact.email)) {
    throw new CoreRuleError("A lead needs an email address; save this person as a contact instead.")
  }
  if (effectiveVisibility(activity) === "private" && !founder) throw new CoreRuleError("Not found", 404)
  // A lead is always business. Otherwise the decision's relationship, or the one the arrival came with.
  const relationship: Relationship =
    decision === "promote" ? "business" : (input.relationship ?? activity.relationship ?? "business")
  if (relationship === "personal" && !founder) throw new CoreRuleError("Only the founder can save a personal contact.", 400)

  if (isPendingGoogleContact(activity)) {
    if (decision === "dismiss") {
      await pending.discard(activity.id)
      return { decision, stored: false }
    }
    if (activity.relationship === "personal" && !founder) throw new CoreRuleError("Not found", 404)
    // Saved or promoted: only now is the entry written, as a Person and its Activity.
    const { read_only: _r, triaged: _t, id: pendingId, created_at: _c, visibility: _v, relationship: _rel, address_book: _b, ...rest } = activity
    const book = activity.address_book
    const arrival = await recordArrival(
      store,
      {
        ...rest,
        type: "google_contact",
        legacy_ref: undefined,
        created_by: actor,
        stage: decision === "promote" ? "lead" : "contact",
        relationship,
        allowPrivate: founder,
        address_book: book,
      },
      cohorts,
    )
    const linked = await pending.link(arrival.person, activity)
    await pending.discard(pendingId)
    activity = { ...arrival.activity }
    if (decision === "save") {
      await store.recordTriage({ id: activity.id, decision, by: actor, at: now(), person_id: linked.id })
      return { decision, stored: true, person: linked }
    }
  } else {
    const existing = await store.getTriage(activity.id)
    if (existing) throw new CoreRuleError("This item has already been triaged.", 409)
  }

  if (decision === "dismiss") {
    await store.recordTriage({ id: activity.id, decision, by: actor, at: now() })
    return { decision, stored: true }
  }

  let { person } = await ensurePerson(store, {
    contact: activity.contact,
    source: activity.source,
    at: activity.occurred_at || now(),
    actor,
    stage: decision === "promote" ? "lead" : "contact",
    relationship,
    allowPrivate: founder,
  })
  // A stored activity already links its Organization; one read from an old collection gets it matched or
  // created now, so the saved Person has its company.
  if (activity.read_only) {
    const org = await ensureOrganization(
      store,
      { name: activity.contact.company, website: activity.contact.website, email: activity.contact.email },
      cohorts,
    )
    if (org) await ensureAffiliation(store, person.id, org.id, affiliationRoleForDomain(org.domain, "prospect"), activity.contact.title)
  }

  let leadId: string | undefined
  if (decision === "promote") {
    person = await promoteToBusiness(store, person, founder)
    const result = await leads.createLeadFor(person, activity)
    if (!result.leadId) throw new CoreRuleError("The lead could not be created through the lead path.", 502)
    leadId = result.leadId
  }
  await store.recordTriage({ id: activity.id, decision, by: actor, at: now(), person_id: person.id, ...(leadId ? { lead_id: leadId } : {}) })
  return { decision, stored: true, person, leadId }
}

/**
 * Personal → business: only the founder decides, and the visibility changes with it. Returns the Person unchanged
 * when it is already business. The service calls this before the lead path, so the lead path never sees a personal
 * Person.
 */
export async function promoteToBusiness(store: CoreStore, person: Person, founder: boolean): Promise<Person> {
  if (person.relationship !== "personal") return person
  if (!founder) throw new CoreRuleError("Only the founder can make a personal contact business.", 400)
  return store.updatePerson(person.id, { relationship: "business", visibility: "business" })
}

// ── Edits ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The Person fields that sync to the phone. Automation (enrichment, agents) never writes them. */
export const ADDRESS_BOOK_PERSON_FIELDS = ["name", "emails", "phones", "title", "notes", "address_book"] as const

/** Null when an automated patch may be written; otherwise the fields it may not touch. */
export function automationPatchRefusal(patch: Record<string, unknown>): string | null {
  const touched = ADDRESS_BOOK_PERSON_FIELDS.filter((f) => f in patch)
  return touched.length ? `Automation never edits address-book fields (${touched.join(", ")}); enrich the Organization instead.` : null
}

/**
 * Edit a stored Person. Refuses a backward move from `customer` (clients never revert) and, for anyone but the
 * founder, any change to a private Person or to `relationship`. When `byPerson` is set and an address-book field
 * changes, the edit time is stamped for latest-edit-wins against Google.
 */
export async function editPerson(
  store: CoreStore,
  id: string,
  patch: Partial<NewPerson>,
  opts: { founder: boolean; byPerson: boolean },
): Promise<Person> {
  const current = await store.getPerson(id)
  if (!current || current.merged_into) throw new CoreRuleError("Not found", 404)
  if (effectiveVisibility(current) === "private" && !opts.founder) throw new CoreRuleError("Not found", 404)
  if (!opts.byPerson) {
    const refusal = automationPatchRefusal(patch as Record<string, unknown>)
    if (refusal) throw new CoreRuleError(refusal)
  }
  const stageRefusal = stageMoveRefusal(current.lifecycle_stage, patch.lifecycle_stage)
  if (stageRefusal) throw new CoreRuleError(stageRefusal, 409)
  const next: Partial<NewPerson> = { ...patch }
  if ("relationship" in patch || "visibility" in patch) {
    const wantsRelationship = patch.relationship ?? current.relationship
    if (wantsRelationship !== current.relationship && !opts.founder) {
      throw new CoreRuleError("Only the founder can change whether a contact is personal or business.", 400)
    }
    const rv = relationshipAndVisibility({ relationship: wantsRelationship, visibility: patch.visibility ?? current.visibility })
    next.relationship = rv.relationship
    next.visibility = rv.visibility
  }
  // Leads and clients are business: a personal contact stays at the contact stage until the founder promotes it.
  if ((next.relationship ?? current.relationship) === "personal" && (next.lifecycle_stage ?? current.lifecycle_stage) !== "contact") {
    throw new CoreRuleError("A lead or client is a business contact; make this person business first.", 400)
  }
  if (opts.byPerson && ADDRESS_BOOK_PERSON_FIELDS.some((f) => f in patch)) next.address_book_edited_at = now()
  return store.updatePerson(id, next)
}

// ── Merge ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The only way two People become one: an explicit call, logged in the merge record. The absorbed Person is kept
 * and marked `merged_into`, never deleted. Consent is the safer of the two: a withdrawal on either side holds.
 */
export async function mergePeople(store: CoreStore, keepId: string, absorbId: string, actor: string, founder = false): Promise<Person> {
  if (keepId === absorbId) throw new CoreRuleError("A person cannot be merged into itself.")
  const [keep, absorb] = await Promise.all([store.getPerson(keepId), store.getPerson(absorbId)])
  if (!keep || !absorb) throw new CoreRuleError("Both people must be stored records.", 404)
  // A private Person is invisible to everyone but the founder: say "not found", not "private".
  if (!founder && (effectiveVisibility(keep) === "private" || effectiveVisibility(absorb) === "private")) {
    throw new CoreRuleError("Both people must be stored records.", 404)
  }
  // Personal details never move into a business record by a merge: the founder promotes the personal one first.
  if (keep.relationship !== absorb.relationship) {
    throw new CoreRuleError("A personal and a business contact cannot be merged; make the personal one business first.", 409)
  }
  if (keep.merged_into || absorb.merged_into) throw new CoreRuleError("One of these people was already merged.", 409)

  const emails = Array.from(new Set([...keep.emails, ...absorb.emails]))
  const moved = absorb.emails.filter((e) => !keep.emails.includes(e))
  const consent =
    keep.consent.email.status === "withdrawn" || absorb.consent.email.status === "withdrawn"
      ? keep.consent.email.status === "withdrawn"
        ? keep.consent
        : absorb.consent
      : mergeConsent(keep.consent, absorb.consent)
  await store.reassignEmails(moved, keep.id)
  const kept = await store.updatePerson(keep.id, {
    emails,
    phones: Array.from(new Set([...keep.phones, ...absorb.phones])),
    roles: Array.from(new Set([...keep.roles, ...absorb.roles])),
    lifecycle_stage: laterStage(keep.lifecycle_stage, absorb.lifecycle_stage),
    consent,
    legacy_refs: [...keep.legacy_refs, ...absorb.legacy_refs],
  })
  await store.updatePerson(absorb.id, { merged_into: keep.id })
  await store.recordMerge({ kind: "person", kept_id: keep.id, absorbed_id: absorb.id, by: actor, at: now(), moved: { emails: moved } })
  return kept
}

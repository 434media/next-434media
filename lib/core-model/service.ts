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

import type { CohortLike } from "@/lib/prospecting/cohort-match"
import type {
  Activity,
  ActivityContact,
  Affiliation,
  CoreRole,
  CoreSource,
  LifecycleStage,
  MergeRecord,
  Organization,
  Person,
  TriageDecision,
  TriageRecord,
  Visibility,
} from "@/types/core-model"
import { validateActivity, type ActivityInput } from "./activity"
import { laterStage } from "./assemble"
import { consentFromSource, mergeConsent } from "./consent"
import { normalizeEmail, organizationDomain } from "./identity"
import { scoreOrganization } from "./score"

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
  /** Creates the Organization and claims its domain; throws DuplicateError if the domain is held. */
  createOrganization(input: NewOrganization): Promise<Organization>
  updateOrganization(id: string, patch: Partial<NewOrganization>): Promise<Organization>
  findAffiliation(personId: string, organizationId: string, role: CoreRole): Promise<Affiliation | null>
  createAffiliation(input: NewAffiliation): Promise<Affiliation>
  /** Write-once. There is no update or delete. */
  createActivity(input: ActivityInput): Promise<Activity>
  getTriage(activityId: string): Promise<TriageRecord | null>
  recordTriage(record: TriageRecord): Promise<void>
  recordMerge(record: Omit<MergeRecord, "id">): Promise<void>
}

/** The existing lead path (lib/firestore-leads.ts), behind an interface so it can be tested. */
export interface LeadPath {
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
}

/** Match the Person by email, or create one. A known Person's stage only moves forward and consent only gains. */
export async function ensurePerson(store: CoreStore, input: PersonArrival): Promise<{ person: Person; created: boolean }> {
  const email = normalizeEmail(input.contact.email)
  const stage = input.stage ?? "contact"
  if (email) {
    const existing = await store.findPersonByEmail(email)
    if (existing) {
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
  const name = (input.contact.name ?? "").trim() || email
  if (!name) throw new CoreRuleError("A person needs a name or an email.")
  const person = await store.createPerson({
    name,
    emails: email ? [email] : [],
    phones: input.contact.phone ? [input.contact.phone] : [],
    title: input.contact.title || undefined,
    lifecycle_stage: stage,
    roles: input.roles ?? [],
    consent: consentFromSource(input.source, input.at),
    source: input.source,
    country: input.contact.country || undefined,
    location: input.contact.location || undefined,
    visibility: input.visibility ?? "business",
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
  input: { name?: string; website?: string; email?: string; location?: string; roles?: CoreRole[] },
  cohorts: CohortLike[],
): Promise<Organization | null> {
  const domain = organizationDomain({ website: input.website, email: input.email })
  if (!domain) return null
  const existing = await store.findOrganizationByDomain(domain)
  if (existing) return existing
  const at = now()
  const base = { name: (input.name ?? "").trim() || domain, location: input.location || undefined }
  try {
    return await store.createOrganization({
      ...base,
      domain,
      roles: input.roles ?? [],
      visibility: "business",
      legacy_refs: [],
      ...scoreOrganization(base, cohorts, at),
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

export async function ensureAffiliation(store: CoreStore, personId: string, organizationId: string, role: CoreRole, title?: string) {
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
  input: Omit<ActivityInput, "person_id" | "organization_id"> & { stage?: LifecycleStage; roles?: CoreRole[]; visibility?: Visibility },
  cohorts: CohortLike[],
): Promise<{ person: Person; organization: Organization | null; activity: Activity }> {
  const problem = validateActivity({ ...input })
  if (problem) throw new CoreRuleError(problem)
  const { person } = await ensurePerson(store, {
    contact: input.contact,
    source: input.source,
    at: input.occurred_at,
    actor: input.created_by,
    stage: input.stage,
    roles: input.roles,
    visibility: input.visibility,
  })
  const organization = await ensureOrganization(
    store,
    { name: input.contact.company, website: input.contact.website, email: input.contact.email, location: input.contact.location },
    cohorts,
  )
  if (organization) await ensureAffiliation(store, person.id, organization.id, input.roles?.[0] ?? "prospect", input.contact.title)
  const { stage: _stage, roles: _roles, visibility: _visibility, ...activityInput } = input
  const activity = await store.createActivity({
    ...activityInput,
    person_id: person.id,
    organization_id: organization?.id,
  })
  return { person, organization, activity }
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
 * Promote (to lead), save (as a contact) or dismiss an inbox item. A Google Contacts entry that is dismissed is
 * never stored: this returns before any write. Every other decision is recorded once, keyed on the activity id.
 */
export async function triageActivity(
  store: CoreStore,
  leads: LeadPath,
  input: { activity: Activity; decision: TriageDecision; actor: string },
  cohorts: CohortLike[],
): Promise<TriageResult> {
  const { decision, actor } = input
  let activity = input.activity
  if (activity.triaged) throw new CoreRuleError("This item has already been triaged.", 409)
  if (decision === "promote" && !normalizeEmail(activity.contact.email)) {
    throw new CoreRuleError("A lead needs an email address; save this person as a contact instead.")
  }

  if (isPendingGoogleContact(activity)) {
    if (decision === "dismiss") return { decision, stored: false }
    // Saved or promoted: only now is the entry written, as a Person and its Activity.
    const { read_only: _r, triaged: _t, id: _id, created_at: _c, ...rest } = activity
    const arrival = await recordArrival(
      store,
      { ...rest, type: "google_contact", legacy_ref: undefined, created_by: actor, stage: decision === "promote" ? "lead" : "contact" },
      cohorts,
    )
    activity = { ...arrival.activity }
  } else {
    const existing = await store.getTriage(activity.id)
    if (existing) throw new CoreRuleError("This item has already been triaged.", 409)
  }

  if (decision === "dismiss") {
    await store.recordTriage({ id: activity.id, decision, by: actor, at: now() })
    return { decision, stored: true }
  }

  const { person } = await ensurePerson(store, {
    contact: activity.contact,
    source: activity.source,
    at: activity.occurred_at || now(),
    actor,
    stage: decision === "promote" ? "lead" : "contact",
  })
  // A stored activity already links its Organization; one read from an old collection gets it matched or
  // created now, so the saved Person has its company.
  if (activity.read_only) {
    const org = await ensureOrganization(
      store,
      { name: activity.contact.company, website: activity.contact.website, email: activity.contact.email },
      cohorts,
    )
    if (org) await ensureAffiliation(store, person.id, org.id, "prospect", activity.contact.title)
  }

  let leadId: string | undefined
  if (decision === "promote") {
    const result = await leads.createLeadFor(person, activity)
    if (!result.leadId) throw new CoreRuleError("The lead could not be created through the lead path.", 502)
    leadId = result.leadId
  }
  await store.recordTriage({ id: activity.id, decision, by: actor, at: now(), person_id: person.id, ...(leadId ? { lead_id: leadId } : {}) })
  return { decision, stored: true, person, leadId }
}

// ── Merge ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The only way two People become one: an explicit call, logged in the merge record. The absorbed Person is kept
 * and marked `merged_into`, never deleted. Consent is the safer of the two: a withdrawal on either side holds.
 */
export async function mergePeople(store: CoreStore, keepId: string, absorbId: string, actor: string): Promise<Person> {
  if (keepId === absorbId) throw new CoreRuleError("A person cannot be merged into itself.")
  const [keep, absorb] = await Promise.all([store.getPerson(keepId), store.getPerson(absorbId)])
  if (!keep || !absorb) throw new CoreRuleError("Both people must be stored records.", 404)
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

import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type { CoreRole, CoreSource, LegacyRef, LifecycleStage, Person } from "../types/core-model"
import { CORE_ROLES, CORE_SOURCES, LIFECYCLE_STAGES } from "../types/core-model"
import { normalizeConsent } from "./core-model/consent"
import { normalizeVisibility } from "./core-model/visibility"
import { normalizeEmail } from "./core-model/identity"
import { DuplicateError, type NewPerson } from "./core-model/service"
import { asStringArray, emailClaimId, stripUndefined, toIsoString } from "./core-model/firestore-util"

// People (the core model). One Person per email: each address is claimed in `crm_person_emails` inside the same
// transaction that writes the Person, so two arrivals can never make two People for one email.

const COLLECTION = CRM_COLLECTIONS.PEOPLE
const EMAILS = CRM_COLLECTIONS.PERSON_EMAILS

const CACHE_TTL = 30 * 1000
let listCache: { data: Person[]; ts: number } | null = null

export function invalidatePeople(): void {
  listCache = null
}

function normalize(id: string, raw: FirebaseFirestore.DocumentData): Person {
  const source = (CORE_SOURCES.includes(raw.source) ? raw.source : "manual") as CoreSource
  const created = toIsoString(raw.created_at)
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : "",
    emails: asStringArray(raw.emails).map(normalizeEmail).filter(Boolean),
    phones: asStringArray(raw.phones),
    title: typeof raw.title === "string" && raw.title ? raw.title : undefined,
    lifecycle_stage: (LIFECYCLE_STAGES.includes(raw.lifecycle_stage) ? raw.lifecycle_stage : "contact") as LifecycleStage,
    roles: asStringArray(raw.roles).filter((r): r is CoreRole => CORE_ROLES.includes(r as CoreRole)),
    consent: normalizeConsent(raw.consent, source, created),
    source,
    country: typeof raw.country === "string" && raw.country ? raw.country : undefined,
    location: typeof raw.location === "string" && raw.location ? raw.location : undefined,
    visibility: normalizeVisibility(raw.visibility),
    notes: typeof raw.notes === "string" && raw.notes ? raw.notes : undefined,
    added_by: typeof raw.added_by === "string" && raw.added_by ? raw.added_by : undefined,
    legacy_refs: Array.isArray(raw.legacy_refs) ? (raw.legacy_refs as LegacyRef[]) : [],
    merged_into: typeof raw.merged_into === "string" && raw.merged_into ? raw.merged_into : undefined,
    created_at: created,
    updated_at: toIsoString(raw.updated_at),
  }
}

/** Every stored Person, including merged-away ones (the read layer resolves those). */
export async function listPeople(): Promise<Person[]> {
  if (listCache && Date.now() - listCache.ts < CACHE_TTL) return listCache.data
  const snap = await getDb().collection(COLLECTION).get()
  const data = snap.docs.map((d) => normalize(d.id, d.data()))
  listCache = { data, ts: Date.now() }
  return data
}

export async function getPerson(id: string): Promise<Person | null> {
  const doc = await getDb().collection(COLLECTION).doc(id).get()
  return doc.exists ? normalize(doc.id, doc.data() as FirebaseFirestore.DocumentData) : null
}

export async function findPersonByEmail(email: string): Promise<Person | null> {
  const key = normalizeEmail(email)
  if (!key) return null
  const claim = await getDb().collection(EMAILS).doc(emailClaimId(key)).get()
  const personId = claim.exists ? (claim.data()?.person_id as string | undefined) : undefined
  return personId ? getPerson(personId) : null
}

export async function createPerson(input: NewPerson): Promise<Person> {
  const db = getDb()
  const ref = db.collection(COLLECTION).doc()
  const now = new Date().toISOString()
  const emails = Array.from(new Set(input.emails.map(normalizeEmail).filter(Boolean)))
  await db.runTransaction(async (tx) => {
    const claims = emails.map((e) => db.collection(EMAILS).doc(emailClaimId(e)))
    const snaps = claims.length ? await tx.getAll(...claims) : []
    snaps.forEach((s, i) => {
      if (s.exists) throw new DuplicateError(`${emails[i]} already belongs to a person.`, s.data()?.person_id as string)
    })
    tx.set(ref, stripUndefined({ ...input, emails, created_at: now, updated_at: now }))
    claims.forEach((c, i) => tx.set(c, { email: emails[i], person_id: ref.id, at: now }))
  })
  invalidatePeople()
  return (await getPerson(ref.id)) as Person
}

/**
 * Update fields on a Person. New emails are claimed in the same transaction (and refused if another Person holds
 * one); emails are never released here, so a removed address stays pointing at this Person.
 */
export async function updatePerson(id: string, patch: Partial<NewPerson>): Promise<Person> {
  const db = getDb()
  const ref = db.collection(COLLECTION).doc(id)
  const now = new Date().toISOString()
  await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref)
    if (!cur.exists) throw new Error(`Person ${id} not found`)
    // A key present with no value clears the field (null reads back as absent).
    const update: Record<string, unknown> = { updated_at: now }
    for (const [k, v] of Object.entries(patch)) update[k] = v === undefined ? null : v
    if (patch.emails) {
      const emails = Array.from(new Set(patch.emails.map(normalizeEmail).filter(Boolean)))
      update.emails = emails
      const claims = emails.map((e) => db.collection(EMAILS).doc(emailClaimId(e)))
      const snaps = claims.length ? await tx.getAll(...claims) : []
      snaps.forEach((s, i) => {
        const holder = s.data()?.person_id as string | undefined
        if (s.exists && holder !== id) throw new DuplicateError(`${emails[i]} already belongs to a person.`, holder as string)
        if (!s.exists) tx.set(claims[i], { email: emails[i], person_id: id, at: now })
      })
    }
    tx.update(ref, stripUndefined(update))
  })
  invalidatePeople()
  return (await getPerson(id)) as Person
}

/** Point each email's claim at `personId`. Used only by an explicit, logged merge. */
export async function reassignPersonEmails(emails: string[], personId: string): Promise<void> {
  if (emails.length === 0) return
  const db = getDb()
  const batch = db.batch()
  const now = new Date().toISOString()
  for (const e of emails.map(normalizeEmail).filter(Boolean)) {
    batch.set(db.collection(EMAILS).doc(emailClaimId(e)), { email: e, person_id: personId, at: now })
  }
  await batch.commit()
  invalidatePeople()
}

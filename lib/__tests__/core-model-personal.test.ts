/**
 * Offline. People: personal and business (434-context `04 Build/434_Core_Data_Model_Spec.md`, "People: personal and
 * business, and the Google Contacts sync"; interface contract 1.5 §2), against the in-memory store:
 *   1. visibility: `private` is the founder only. Staff, full admins, super admins and agents cannot see it, in any
 *      read path (people, organizations, affiliations, activities, the inbox);
 *   2. staff adds are always business, and staff can neither create nor touch a personal contact;
 *   3. personal contacts never reach a sequence, broadcast or the lead path; promotion makes them business first;
 *   4. clients never revert: no backward move from `customer`, wherever the stage is written;
 *   5. automation never edits address-book fields;
 *   6. latest edit wins, field by field, keeping what it overwrote.
 *
 * Run: tsx --test lib/__tests__/core-model-personal.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import type { Activity, AddressBook, Person } from "../../types/core-model"
import { agentMayUse, canHandlePersonal, canSee, canSetVisibility, effectiveVisibility } from "../core-model/visibility"
import { filterViewFor } from "../core-model/view-filter"
import { canEmail, consentFromSource } from "../core-model/consent"
import { stageMoveRefusal } from "../core-model/lifecycle"
import { emptyAddressBook, mergeLatestEditWins, applyPersonEditToBook, personFieldsFromBook } from "../core-model/address-book"
import {
  CoreRuleError,
  automationPatchRefusal,
  editPerson,
  ensurePerson,
  mergePeople,
  recordArrival,
  triageActivity,
  type PendingArrivals,
} from "../core-model/service"
import { AT, FakeLeadPath, MemoryStore } from "./helpers/core-memory-store"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")
const COHORTS: never[] = []

const STAFF = { role: "crm_only" as const }
const INTERN = { role: "intern" as const }
const FULL_ADMIN = { role: "full_admin" as const }
const SUPER_ADMIN = { role: "crm_super_admin" as const, superAdmin: true }
const FOUNDER = { role: "crm_super_admin" as const, superAdmin: true, founder: true }

async function personalPerson(store: MemoryStore, email = "friend@example.com") {
  const { person } = await ensurePerson(store, {
    contact: { name: "Pat Friend", email, phone: "210-555-0142" },
    source: "google_contacts",
    at: AT,
    relationship: "personal",
    allowPrivate: true,
  })
  return person
}

// ── 1. Visibility ───────────────────────────────────────────────────────────────────────────────────────────────

test("visibility: private is the founder only; staff, interns, full admins and super admins cannot see it", () => {
  for (const viewer of [STAFF, INTERN, FULL_ADMIN, SUPER_ADMIN, {}]) {
    assert.equal(canSee({ visibility: "private" }, viewer), false, JSON.stringify(viewer))
  }
  assert.equal(canSee({ visibility: "private" }, FOUNDER), true)
  // The founder still sees business and restricted records.
  assert.equal(canSee({ visibility: "restricted" }, FOUNDER), true)
  assert.equal(canSee({ visibility: "business" }, STAFF), true)
})

test("visibility: a personal record is private whatever its stored visibility says (fails safe)", () => {
  assert.equal(effectiveVisibility({ relationship: "personal", visibility: "business" }), "private")
  assert.equal(canSee({ relationship: "personal", visibility: "business" }, FULL_ADMIN), false)
  assert.equal(canSee({ relationship: "personal" }, FOUNDER), true)
})

test("visibility: only the founder may set private or handle personal contacts", () => {
  assert.equal(canSetVisibility(SUPER_ADMIN, "private"), false)
  assert.equal(canSetVisibility(FOUNDER, "private"), true)
  assert.equal(canSetVisibility(FULL_ADMIN, "restricted"), true)
  assert.equal(canHandlePersonal(SUPER_ADMIN), false)
  assert.equal(canHandlePersonal(FOUNDER), true)
})

test("visibility: agents read a personal contact only to suggest promotion to the founder, never to contact, edit or share", () => {
  const personal = { relationship: "personal" as const, visibility: "private" as const }
  assert.equal(agentMayUse(personal, "suggest_promotion", FOUNDER), true)
  for (const purpose of ["read", "contact", "edit", "share"] as const) assert.equal(agentMayUse(personal, purpose, FOUNDER), false)
  // Acting for anyone else, not even the suggestion.
  assert.equal(agentMayUse(personal, "suggest_promotion", SUPER_ADMIN), false)
  assert.equal(agentMayUse({ relationship: "business", visibility: "business" }, "contact", STAFF), true)
})

test("visibility: the read filter removes private people with their links and activities, and private phone arrivals", async () => {
  const store = new MemoryStore()
  const friend = await personalPerson(store)
  const { person: client } = await ensurePerson(store, { contact: { name: "Ana", email: "ana@alamolabs.example" }, source: "web", at: AT })
  const arrival: Activity = {
    id: "gc:abc",
    type: "google_contact",
    source: "google_contacts",
    occurred_at: AT,
    contact: { name: "New Friend", phone: "210-555-0199" },
    summary: "Added on the phone",
    relationship: "personal",
    visibility: "private",
    read_only: true,
    triaged: false,
    created_at: AT,
  }
  const view = {
    people: [friend, client],
    organizations: [],
    affiliations: [
      { id: "a1", person_id: friend.id, organization_id: "o1", role: "works_at" as const, active: true, created_at: AT, updated_at: AT },
    ],
    activities: [
      { ...arrival, id: "x1", person_id: friend.id, visibility: undefined, relationship: undefined, read_only: false },
      { ...arrival, id: "x2", person_id: client.id, visibility: "business" as const, relationship: undefined },
      arrival,
    ],
  }
  for (const viewer of [STAFF, FULL_ADMIN, SUPER_ADMIN]) {
    const v = filterViewFor(view, viewer)
    assert.deepEqual(v.people.map((p) => p.id), [client.id])
    assert.equal(v.affiliations.length, 0)
    assert.deepEqual(v.activities.map((a) => a.id), ["x2"], "the friend's activity and the private arrival are hidden")
  }
  const f = filterViewFor(view, FOUNDER)
  assert.equal(f.people.length, 2)
  assert.equal(f.activities.length, 3)
})

test("visibility: every core read path goes through the filter, and the viewer's founder flag comes from the founder guard", () => {
  const read_ = read("lib/core-model/read.ts")
  assert.match(read_, /filterViewFor\(await getCoreView\(\), viewer\)/)
  assert.match(read("lib/core-model/route-helpers.ts"), /founder: founderDecision\(session, founderEmails\(\)\)\.allowed/)
  for (const route of [
    "app/api/admin/core/people/route.ts",
    "app/api/admin/core/people/[id]/route.ts",
    "app/api/admin/core/organizations/route.ts",
    "app/api/admin/core/organizations/[id]/route.ts",
    "app/api/admin/core/inbox/route.ts",
    "app/api/admin/core/inbox/[activityId]/triage/route.ts",
  ]) {
    const src = read(route)
    assert.match(src, /getVisibleCoreView\(/, `${route} reads through the visibility filter`)
    assert.doesNotMatch(src, /getCoreView\(\)/, `${route} never reads the unfiltered view`)
  }
  // Nothing outside the core model and the sync reads the stored people directly.
  const offenders = walk(join(ROOT, "app")).concat(walk(join(ROOT, "lib")))
    .filter((f) => !f.includes("__tests__") && !f.includes("/lib/core-model/") && !f.includes("/lib/google-contacts/"))
    .filter((f) => !/lib\/firestore-(people|activities|organizations|affiliations)\.ts$/.test(f))
    .filter((f) => /from ["']@\/lib\/firestore-people["']|getCoreView\(/.test(readFileSync(f, "utf-8")))
  assert.deepEqual(offenders.map((f) => f.slice(ROOT.length + 1)), [])
})

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (n === "node_modules" || n.startsWith(".")) return []
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}

// ── 2. Staff and personal contacts ──────────────────────────────────────────────────────────────────────────────

test("staff: cannot add a personal contact; the add route makes staff adds business", async () => {
  const store = new MemoryStore()
  await assert.rejects(
    ensurePerson(store, { contact: { name: "X", email: "x@example.com" }, source: "manual", at: AT, relationship: "personal" }),
    CoreRuleError,
  )
  assert.equal(store.writes, 0)
  const route = read("app/api/admin/core/people/route.ts")
  assert.match(route, /canHandlePersonal\(viewer\) && stage === "contact" && body\.relationship !== "business" \? "personal" : "business"/)
  assert.match(route, /Only the founder can add a personal contact/)
})

test("staff: an arrival matching a private Person is refused without naming whose the address is, and writes nothing", async () => {
  const store = new MemoryStore()
  await personalPerson(store, "friend@example.com")
  const before = store.writes
  await assert.rejects(
    recordArrival(store, { type: "note", source: "manual", occurred_at: AT, contact: { email: "Friend@Example.com" }, summary: "Note" }, COHORTS),
    (err: unknown) => err instanceof CoreRuleError && err.status === 409 && !/Pat/.test(err.message),
  )
  assert.equal(store.writes, before)
  // The founder may.
  const ok = await recordArrival(
    store,
    { type: "note", source: "manual", occurred_at: AT, contact: { email: "friend@example.com" }, summary: "Note", allowPrivate: true },
    COHORTS,
  )
  assert.equal(ok.activity.visibility, "private", "an activity on a personal Person carries private visibility")
})

test("staff: cannot triage, save or promote a private arrival; cannot save anything as personal", async () => {
  const store = new MemoryStore()
  const leads = new FakeLeadPath()
  const arrival: Activity = {
    id: "gc:1",
    type: "google_contact",
    source: "google_contacts",
    occurred_at: AT,
    contact: { name: "New Friend", email: "nf@example.com" },
    summary: "Added on the phone",
    relationship: "personal",
    visibility: "private",
    read_only: true,
    triaged: false,
    created_at: AT,
  }
  for (const decision of ["save", "promote", "dismiss"] as const) {
    await assert.rejects(triageActivity(store, leads, { activity: arrival, decision, actor: "staff@example.com" }, COHORTS), CoreRuleError)
  }
  const form: Activity = { ...arrival, id: "f1", source: "web", type: "form_submission", relationship: undefined, visibility: undefined, read_only: false }
  await assert.rejects(
    triageActivity(store, leads, { activity: form, decision: "save", actor: "staff@example.com", relationship: "personal" }, COHORTS),
    /Only the founder/,
  )
  assert.equal(store.writes, 0)
})

test("staff: merging involves a private Person only for the founder, and never personal into business", async () => {
  const store = new MemoryStore()
  const a = await personalPerson(store, "a@example.com")
  const { person: b } = await ensurePerson(store, { contact: { name: "B", email: "b@example.com" }, source: "manual", at: AT })
  await assert.rejects(mergePeople(store, b.id, a.id, "admin@example.com", false), (e: unknown) => e instanceof CoreRuleError && e.status === 404)
  await assert.rejects(mergePeople(store, b.id, a.id, "founder@example.com", true), /make the personal one business first/)
})

// ── 3. Never outbound ───────────────────────────────────────────────────────────────────────────────────────────

test("outbound: a personal contact is never emailable by a sequence or broadcast, whatever its consent", () => {
  const consent = consentFromSource("web", AT)
  assert.equal(canEmail({ consent, relationship: "personal" }, false).allowed, false)
  assert.equal(canEmail({ consent, relationship: "business" }, false).allowed, true)
})

test("outbound: promoting a personal contact makes it business before the lead path, so the lead path never sees personal", async () => {
  const store = new MemoryStore()
  const friend = await personalPerson(store, "friend@example.com")
  const leads = new FakeLeadPath()
  const activity: Activity = {
    id: "n1",
    type: "note",
    source: "manual",
    occurred_at: AT,
    contact: { email: "friend@example.com" },
    person_id: friend.id,
    summary: "Talked about a shoot",
    visibility: "private",
    triaged: false,
    created_at: AT,
  }
  await assert.rejects(triageActivity(store, leads, { activity, decision: "promote", actor: "admin@example.com" }, COHORTS))
  assert.equal(leads.calls.length, 0)
  const r = await triageActivity(store, leads, { activity, decision: "promote", actor: "founder@example.com", founder: true }, COHORTS)
  assert.equal(leads.calls.length, 1)
  assert.equal(leads.calls[0].person.relationship, "business")
  assert.equal(r.person?.visibility, "business")
  assert.equal(store.people.get(friend.id)?.lifecycle_stage, "lead")
  // And the Firestore lead path refuses a personal Person on its own.
  assert.match(read("lib/core-model/firestore-store.ts"), /if \(person\.relationship === "personal"\) return \{ leadId: null \}/)
})

test("outbound: no outbound surface reads the core model's people (sequences and broadcasts read leads and audiences)", () => {
  for (const f of [
    "lib/outreach-sequence.ts",
    "lib/broadcast-send.ts",
    "lib/broadcast-ledger.ts",
    "app/api/cron/outreach-sequence/route.ts",
    "app/api/cron/mailchimp-push/route.ts",
  ]) {
    assert.doesNotMatch(read(f), /core-model|firestore-people|crm_people/, f)
  }
})

test("personal: a lead or client is business; a personal contact cannot be added at, or moved to, a later stage", async () => {
  const store = new MemoryStore()
  await assert.rejects(
    ensurePerson(store, { contact: { name: "X", email: "x@example.com" }, source: "manual", at: AT, relationship: "personal", allowPrivate: true, stage: "lead" }),
    /business contact/,
  )
  const friend = await personalPerson(store)
  await assert.rejects(editPerson(store, friend.id, { lifecycle_stage: "lead" }, { founder: true, byPerson: true }), /business first/)
  // Only the founder changes the relationship.
  const { person: biz } = await ensurePerson(store, { contact: { name: "B", email: "b@example.com" }, source: "manual", at: AT })
  await assert.rejects(editPerson(store, biz.id, { relationship: "personal" }, { founder: false, byPerson: true }), /Only the founder/)
  const made = await editPerson(store, friend.id, { relationship: "business" }, { founder: true, byPerson: true })
  assert.equal(made.visibility, "business")
})

// ── 4. Clients never revert ─────────────────────────────────────────────────────────────────────────────────────

test("clients never revert: no move back from customer, through the rule, the service, the store and the route", async () => {
  assert.match(stageMoveRefusal("customer", "lead") ?? "", /never reverts/)
  assert.match(stageMoveRefusal("customer", "contact") ?? "", /never reverts/)
  assert.equal(stageMoveRefusal("lead", "customer"), null)
  assert.equal(stageMoveRefusal("lead", "contact"), null)
  assert.equal(stageMoveRefusal("customer", "customer"), null)

  const store = new MemoryStore()
  const { person } = await ensurePerson(store, { contact: { name: "C", email: "c@example.com" }, source: "manual", at: AT, stage: "customer" })
  await assert.rejects(editPerson(store, person.id, { lifecycle_stage: "lead" }, { founder: true, byPerson: true }), (e: unknown) => e instanceof CoreRuleError && e.status === 409)
  await assert.rejects(store.updatePerson(person.id, { lifecycle_stage: "contact" }), /never reverts/)
  // A later arrival at an earlier stage leaves the customer a customer.
  await ensurePerson(store, { contact: { email: "c@example.com" }, source: "web", at: AT, stage: "contact" })
  assert.equal(store.people.get(person.id)?.lifecycle_stage, "customer")

  assert.match(read("app/api/admin/core/people/[id]/route.ts"), /stageMoveRefusal\(current\.lifecycle_stage/)
  assert.match(read("lib/firestore-people.ts"), /stageMoveRefusal\(cur\.data\(\)\?\.lifecycle_stage, patch\.lifecycle_stage\)/)
})

// ── 5. Automation never edits the address book ──────────────────────────────────────────────────────────────────

test("automation: never edits a Person's address-book fields; enrichment writes the Organization only", async () => {
  assert.match(automationPatchRefusal({ name: "X" }) ?? "", /never edits address-book fields/)
  assert.match(automationPatchRefusal({ phones: [] }) ?? "", /phones/)
  assert.equal(automationPatchRefusal({ lifecycle_stage: "lead", roles: [] }), null)
  const store = new MemoryStore()
  const { person } = await ensurePerson(store, { contact: { name: "A", email: "a@example.com" }, source: "manual", at: AT })
  await assert.rejects(editPerson(store, person.id, { title: "CEO" }, { founder: true, byPerson: false }), /Automation never edits/)
  // The company lookup (Apollo) reaches no Person write.
  const enrichers = walk(join(ROOT, "lib")).filter((f) => /enrichByEmail/.test(readFileSync(f, "utf-8")) && !f.includes("__tests__"))
  for (const f of enrichers) assert.doesNotMatch(readFileSync(f, "utf-8"), /updatePerson\(/, f)
})

test("automation: a matched arrival never changes the Person's name, phones or title", async () => {
  const store = new MemoryStore()
  const { person } = await ensurePerson(store, { contact: { name: "Ana Reyes", email: "ana@example.com", phone: "210-555-0100", title: "Producer" }, source: "manual", at: AT })
  await ensurePerson(store, { contact: { name: "A. R.", email: "ana@example.com", phone: "210-555-0111", title: "Intern" }, source: "web", at: AT })
  const after = store.people.get(person.id) as Person
  assert.equal(after.name, "Ana Reyes")
  assert.deepEqual(after.phones, ["210-555-0100"])
  assert.equal(after.title, "Producer")
})

// ── 6. Latest edit wins ─────────────────────────────────────────────────────────────────────────────────────────

const book = (over: Partial<AddressBook> = {}): AddressBook => ({ ...emptyAddressBook(), name: { given: "Pat", family: "Friend" }, ...over })

test("latest edit wins: a field changed on one side only takes that side, and a CRM-only change is due for write-back", () => {
  const snapshot = book({ phones: [{ value: "210-555-0100", type: "mobile" }] })
  const crm = book({ phones: [{ value: "210-555-0100", type: "mobile" }], notes: "Met at AIM" })
  const google = book({ phones: [{ value: "210-555-0177", type: "mobile" }] })
  const r = mergeLatestEditWins({ crm, snapshot, google, crmEditedAt: "2026-11-13T10:00:00Z", googleUpdatedAt: "2026-11-13T09:00:00Z" })
  assert.deepEqual(r.book.phones, google.phones, "Google changed phones and the CRM did not: Google's value")
  assert.equal(r.book.notes, "Met at AIM", "the CRM changed notes and Google did not: the CRM's value")
  assert.deepEqual(r.toGoogle, ["notes"])
  assert.deepEqual(r.changes.map((c) => [c.field, c.winner]), [["phones", "google"]])
})

test("latest edit wins: both changed, the later edit wins and the overwritten value is kept", () => {
  const snapshot = book({ notes: "old" })
  const crm = book({ notes: "CRM edit" })
  const google = book({ notes: "phone edit" })
  const googleLater = mergeLatestEditWins({ crm, snapshot, google, crmEditedAt: "2026-11-13T10:00:00Z", googleUpdatedAt: "2026-11-13T11:00:00Z" })
  assert.equal(googleLater.book.notes, "phone edit")
  assert.deepEqual(googleLater.changes, [{ field: "notes", before: "CRM edit", after: "phone edit", winner: "google" }])
  assert.deepEqual(googleLater.toGoogle, [])

  const crmLater = mergeLatestEditWins({ crm, snapshot, google, crmEditedAt: "2026-11-13T12:00:00Z", googleUpdatedAt: "2026-11-13T11:00:00Z" })
  assert.equal(crmLater.book.notes, "CRM edit")
  assert.deepEqual(crmLater.changes, [{ field: "notes", before: "phone edit", after: "CRM edit", winner: "crm" }])
  assert.deepEqual(crmLater.toGoogle, ["notes"])
})

test("latest edit wins: labels and the photo are Google's alone; equal edits on both sides are not a conflict", () => {
  const snapshot = book()
  const crm = book({ notes: "same", labels: ["Old"] })
  const google = book({ notes: "same", labels: ["Business"], photo_url: "https://example.com/p.jpg" })
  const r = mergeLatestEditWins({ crm, snapshot, google })
  assert.deepEqual(r.book.labels, ["Business"])
  assert.equal(r.book.photo_url, "https://example.com/p.jpg")
  assert.deepEqual(r.changes, [])
  assert.deepEqual(r.toGoogle, [])
})

test("address book: a person's CRM edit updates the book (keeping a kept phone's type), and the book gives the Person's fields", () => {
  const b = book({ phones: [{ value: "210-555-0100", type: "mobile" }], organizations: [{ name: "Alamo Labs", title: "Producer" }] })
  const next = applyPersonEditToBook(b, { name: "Patricia Friend", phones: ["210-555-0100", "210-555-0101"], title: "Director" })
  assert.deepEqual(next.name, { given: "Patricia", family: "Friend" })
  assert.deepEqual(next.phones, [{ value: "210-555-0100", type: "mobile" }, { value: "210-555-0101", type: undefined }])
  assert.equal(next.organizations[0].title, "Director")
  assert.equal(next.organizations[0].name, "Alamo Labs")
  const f = personFieldsFromBook(next)
  assert.equal(f.name, "Patricia Friend")
  assert.equal(f.title, "Director")
})

test("address book: an edit through editPerson stamps the edit time used by latest edit wins", async () => {
  const store = new MemoryStore()
  const friend = await personalPerson(store)
  const edited = await editPerson(store, friend.id, { notes: "x" }, { founder: true, byPerson: true })
  assert.ok(edited.address_book_edited_at)
  const stageOnly = await editPerson(store, friend.id, { roles: [] }, { founder: true, byPerson: true })
  assert.equal(stageOnly.address_book_edited_at, edited.address_book_edited_at)
})

// ── Dismissed is never stored (with the pending-arrival hook) ───────────────────────────────────────────────────

test("google contacts: dismissing a phone arrival forgets it and writes nothing to the store", async () => {
  const store = new MemoryStore()
  const discarded: string[] = []
  const pending: PendingArrivals = {
    async discard(id) {
      discarded.push(id)
    },
    async link(p) {
      return p
    },
  }
  const arrival: Activity = {
    id: "gc:9",
    type: "google_contact",
    source: "google_contacts",
    occurred_at: AT,
    contact: { name: "New Friend" },
    summary: "Added on the phone",
    relationship: "personal",
    visibility: "private",
    read_only: true,
    triaged: false,
    created_at: AT,
  }
  const r = await triageActivity(store, new FakeLeadPath(), { activity: arrival, decision: "dismiss", actor: "f@example.com", founder: true }, COHORTS, pending)
  assert.equal(r.stored, false)
  assert.equal(store.writes, 0)
  assert.deepEqual(discarded, ["gc:9"])
})

test("google contacts: saving a phone arrival as personal stores a private Person, out of the inbox, and links it", async () => {
  const store = new MemoryStore()
  const linked: string[] = []
  const pending: PendingArrivals = {
    async discard() {},
    async link(p) {
      linked.push(p.id)
      return p
    },
  }
  const arrival: Activity = {
    id: "gc:10",
    type: "google_contact",
    source: "google_contacts",
    occurred_at: AT,
    contact: { name: "New Friend", phone: "210-555-0123" },
    summary: "Added on the phone",
    relationship: "personal",
    visibility: "private",
    address_book: book({ name: { given: "New", family: "Friend" }, phones: [{ value: "210-555-0123", type: "mobile" }] }),
    read_only: true,
    triaged: false,
    created_at: AT,
  }
  const r = await triageActivity(store, new FakeLeadPath(), { activity: arrival, decision: "save", actor: "f@example.com", founder: true }, COHORTS, pending)
  assert.equal(r.person?.relationship, "personal")
  assert.equal(r.person?.visibility, "private")
  assert.deepEqual(r.person?.address_book?.phones, [{ value: "210-555-0123", type: "mobile" }])
  assert.deepEqual(linked, [r.person?.id])
  const stored = [...store.activities.values()][0]
  assert.equal(store.triage.has(stored.id), true, "the stored activity is triaged, so it leaves the inbox")
  assert.equal(stored.visibility, "private")
})

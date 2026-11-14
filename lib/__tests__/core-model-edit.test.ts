/**
 * Offline. Editing People and Organizations on /admin/people (V1 item 4; founder, 2026-11-14, "approve the edit
 * build"), against the in-memory store and the real read-time adapters and assembly:
 *   1. permissions by role: staff cannot see or edit a personal (private) contact; only the founder changes
 *      personal/business; only full admins restrict;
 *   2. a record read from an old collection: an edit saves one core record that supersedes it, and the old collection
 *      is never written (the edit service is given no path to it);
 *   3. no duplicate in the list after the edit: the read path shows the saved record only;
 *   4. clients never revert;
 *   5. the cold-gate lock: a cold Person's source, country and location stay locked;
 *   6. personal stays private, and every edit is logged as a triaged Activity carrying the record's visibility;
 *   7. the founder's case: a client contact moved from the client's Organization to a new one on his own domain.
 *
 * Run: tsx --test lib/__tests__/core-model-edit.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { ClientRecord, Lead } from "../../types/crm-types"
import type { Organization, Person } from "../../types/core-model"
import { adaptClient, adaptLead, emptyBundle, type CoreBundle } from "../core-model/adapters"
import { assembleCoreView, type CoreView } from "../core-model/assemble"
import { editOrganizationRecord, editPersonRecord, type EditContext } from "../core-model/edit"
import { filterViewFor, type Viewer } from "../core-model/view-filter"
import { CoreRuleError } from "../core-model/service"
import { MemoryStore } from "./helpers/core-memory-store"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")
const AT = "2026-11-14T15:00:00.000Z"

const FOUNDER: Viewer = { role: "crm_super_admin", superAdmin: true, founder: true }
const FULL_ADMIN: Viewer = { role: "full_admin", superAdmin: false, founder: false }
const STAFF: Viewer = { role: "crm_only", superAdmin: false, founder: false }

const ctx = (viewer: Viewer): EditContext => ({ viewer, actor: "editor@example.test", cohorts: [], now: () => AT })

/** The view a viewer sees: stored records plus the read-time ones, assembled and filtered, as the routes read it. */
function viewOf(store: MemoryStore, adapted: CoreBundle[], viewer: Viewer): CoreView {
  const stored: CoreBundle = {
    people: [...store.people.values()],
    organizations: [...store.orgs.values()],
    affiliations: [...store.affs.values()],
    activities: [...store.activities.values()],
  }
  return filterViewFor(assembleCoreView(stored, adapted, new Set(store.triage.keys())), viewer)
}

/** The founder's case, invented: a client row whose only contact works at another company. */
const CLIENT = {
  id: "c1",
  company_name: "First Foundation (a note)",
  status: "active",
  contacts: [{ id: "k1", name: "Pat Doe", email: "pat@seconddevices.test", role: "Director" }],
} as unknown as ClientRecord

const LEAD = (over: Partial<Lead> = {}) =>
  ({
    id: "L1",
    name: "Ana Reyes",
    company: "Alamo Labs",
    email: "ana@alamolabs.test",
    source: "web",
    status: "new",
    created_at: AT,
    updated_at: AT,
    ...over,
  }) as Lead

async function rejects(p: Promise<unknown>, status: number, code?: string) {
  try {
    await p
  } catch (err) {
    assert.ok(err instanceof CoreRuleError, `expected a rule error, got ${String(err)}`)
    assert.equal(err.status, status)
    if (code) assert.equal(err.code, code)
    return
  }
  assert.fail("expected the edit to be refused")
}

async function storedPersonal(store: MemoryStore): Promise<Person> {
  return store.createPerson({
    name: "Old Friend",
    emails: ["friend@example.test"],
    phones: [],
    lifecycle_stage: "contact",
    roles: [],
    consent: { email: { status: "none", basis: "none", source: "google_contacts", at: "" } },
    source: "google_contacts",
    visibility: "private",
    relationship: "personal",
    legacy_refs: [],
  })
}

// ── 1. Permissions by role ───────────────────────────────────────────────────────────────────────────────────

test("permissions: staff and full admins cannot see or edit a personal contact; the founder can", async () => {
  const store = new MemoryStore()
  const friend = await storedPersonal(store)
  for (const viewer of [STAFF, FULL_ADMIN]) {
    await rejects(editPersonRecord(store, viewOf(store, [], viewer), friend.id, { name: "X" }, ctx(viewer)), 404)
  }
  const edited = await editPersonRecord(store, viewOf(store, [], FOUNDER), friend.id, { name: "Old Friend Jr" }, ctx(FOUNDER))
  assert.equal(edited.name, "Old Friend Jr")
})

test("permissions: only the founder changes personal/business; only a full admin restricts", async () => {
  const store = new MemoryStore()
  const v = () => viewOf(store, [adaptLead(LEAD())], STAFF)
  const id = v().people[0].id
  await rejects(editPersonRecord(store, v(), id, { relationship: "personal" }, ctx(STAFF)), 403)
  await rejects(editPersonRecord(store, v(), id, { visibility: "restricted" }, ctx(STAFF)), 403)
  await rejects(editPersonRecord(store, v(), id, { visibility: "private" }, ctx(FOUNDER)), 400)
  const restricted = await editPersonRecord(store, viewOf(store, [adaptLead(LEAD())], FULL_ADMIN), id, { visibility: "restricted" }, ctx(FULL_ADMIN))
  assert.equal(restricted.visibility, "restricted")
})

test("permissions: staff may edit a business contact", async () => {
  const store = new MemoryStore()
  const view = viewOf(store, [adaptLead(LEAD())], STAFF)
  const p = await editPersonRecord(store, view, view.people[0].id, { title: "COO" }, ctx(STAFF))
  assert.equal(p.title, "COO")
})

// ── 2 and 3. A legacy record: one superseding record, no duplicate, the old collection untouched ───────────────

test("legacy: editing a lead's Person saves one record that supersedes it; the list shows it once", async () => {
  const store = new MemoryStore()
  const lead = LEAD()
  const before = JSON.stringify(lead)
  const adapted = [adaptLead(lead)]
  const view = viewOf(store, adapted, FOUNDER)
  assert.equal(view.people[0].read_only, true)
  const saved = await editPersonRecord(store, view, "lead:L1", { name: "Ana M. Reyes", phones: ["210-555-0101"] }, ctx(FOUNDER))
  assert.equal(store.people.size, 1, "exactly one stored Person")
  assert.deepEqual(saved.supersedes, ["lead:L1"])
  assert.ok(saved.legacy_refs.some((r) => r.collection === "leads" && r.id === "L1"), "linked by legacy_ref")
  assert.equal(JSON.stringify(lead), before, "the old record is not changed")

  const after = viewOf(store, adapted, FOUNDER)
  assert.equal(after.people.length, 1, "no duplicate")
  assert.equal(after.people[0].id, saved.id)
  assert.equal(after.people[0].name, "Ana M. Reyes")
  assert.equal(after.people[0].read_only, undefined)
  assert.ok(after.activities.some((a) => a.id === "leads:L1" && a.person_id === saved.id), "its history follows it")

  // A second edit edits the saved record; nothing new is created.
  await editPersonRecord(store, after, saved.id, { title: "CEO" }, ctx(FOUNDER))
  assert.equal(store.people.size, 1)
})

test("legacy: a contact with no email is superseded by id, so it never shows twice", async () => {
  const store = new MemoryStore()
  const client = { id: "c2", company_name: "Quiet Co", status: "active", contacts: [{ id: "k9", name: "No Email" }] } as unknown as ClientRecord
  const adapted = [adaptClient(client)]
  const view = viewOf(store, adapted, FOUNDER)
  const p = view.people.find((x) => x.name === "No Email") as Person
  await editPersonRecord(store, view, p.id, { name: "Has A Name Now" }, ctx(FOUNDER))
  const names = viewOf(store, adapted, FOUNDER).people.map((x) => x.name)
  assert.deepEqual(names, ["Has A Name Now"])
})

test("legacy: editing a client row's Organization saves one record that supersedes it", async () => {
  const store = new MemoryStore()
  const adapted = [adaptClient({ id: "c3", company_name: "Acme", website: "acme.test", status: "active" } as ClientRecord)]
  const view = viewOf(store, adapted, FOUNDER)
  const saved = await editOrganizationRecord(store, view, "client:c3", { industry: "Manufacturing" }, ctx(FOUNDER))
  assert.deepEqual(saved.supersedes, ["client:c3"])
  const after = viewOf(store, adapted, FOUNDER)
  assert.equal(after.organizations.length, 1)
  assert.equal(after.organizations[0].industry, "Manufacturing")
  assert.equal(after.organizations[0].id, saved.id)
})

test("legacy: the edit service never reaches an old collection", () => {
  const src = read("lib/core-model/edit.ts")
  for (const forbidden of ["firestore-leads", "firestore-crm", "firestore-contact-forms", "getDb", "aimsatx"]) {
    assert.doesNotMatch(src, new RegExp(forbidden), `edit.ts does not touch ${forbidden}`)
  }
  for (const route of ["app/api/admin/core/people/[id]/route.ts", "app/api/admin/core/organizations/[id]/route.ts"]) {
    const r = read(route)
    assert.match(r, /getVisibleCoreView\(viewer\)/, `${route} edits within the viewer's own view`)
    assert.doesNotMatch(r, /updateLead|updateClient|updateContactForm/)
  }
})

test("legacy: saving without a change writes nothing", async () => {
  const store = new MemoryStore()
  const view = viewOf(store, [adaptLead(LEAD())], FOUNDER)
  const p = view.people[0]
  const links = view.affiliations.filter((a) => a.person_id === p.id).map((a) => ({ organization_id: a.organization_id, role: a.role, title: a.title }))
  await editPersonRecord(store, view, p.id, { name: p.name, links }, ctx(FOUNDER))
  assert.equal(store.writes, 0)
})

// ── 4. Clients never revert ──────────────────────────────────────────────────────────────────────────────────

test("clients never revert: a customer cannot be moved back, stored or read-time", async () => {
  const store = new MemoryStore()
  const adapted = [adaptLead(LEAD({ status: "converted" }))]
  const view = viewOf(store, adapted, FOUNDER)
  assert.equal(view.people[0].lifecycle_stage, "customer")
  await rejects(editPersonRecord(store, view, view.people[0].id, { lifecycle_stage: "lead" }, ctx(FOUNDER)), 409, "client_never_reverts")
  assert.equal(store.writes, 0, "refused before anything is saved")
  const saved = await editPersonRecord(store, view, view.people[0].id, { title: "Owner" }, ctx(FOUNDER))
  await rejects(editPersonRecord(store, viewOf(store, adapted, FOUNDER), saved.id, { lifecycle_stage: "contact" }, ctx(FOUNDER)), 409)
})

// ── 5. The cold-gate lock ────────────────────────────────────────────────────────────────────────────────────

test("cold lock: a prospected Person's source, country and location cannot change; other fields can", async () => {
  const store = new MemoryStore()
  const adapted = [adaptLead(LEAD({ source: "prospected", country: "US", location: "Austin, TX" }))]
  const view = viewOf(store, adapted, FOUNDER)
  const id = view.people[0].id
  for (const edit of [{ source: "web" as const }, { country: "CA" }, { location: "Toronto, ON" }]) {
    await rejects(editPersonRecord(store, view, id, edit, ctx(FOUNDER)), 403, "jurisdiction_locked")
  }
  assert.equal(store.writes, 0)
  const ok = await editPersonRecord(store, view, id, { title: "VP Marketing" }, ctx(FOUNDER))
  assert.equal(ok.source, "prospected")
  assert.equal(ok.country, "US")
})

// ── 6. Personal stays private; every edit is logged ─────────────────────────────────────────────────────────

test("log: every edit is a triaged record_edit Activity with before and after, carrying the record's visibility", async () => {
  const store = new MemoryStore()
  const friend = await storedPersonal(store)
  await editPersonRecord(store, viewOf(store, [], FOUNDER), friend.id, { phones: ["210-555-0199"] }, ctx(FOUNDER))
  const acts = [...store.activities.values()].filter((a) => a.type === "record_edit")
  assert.equal(acts.length, 1)
  assert.equal(acts[0].visibility, "private", "an edit to a personal contact is as private as the contact")
  assert.deepEqual(acts[0].change?.[0], { field: "phones", before: [], after: ["210-555-0199"], winner: "crm" })
  assert.ok(store.triage.has(acts[0].id), "never reaches the inbox")
  assert.equal(filterViewFor(viewOf(store, [], FOUNDER), STAFF).activities.length, 0, "staff cannot see it")
})

test("personal: a personal contact stays private when edited, and its new organization is private too", async () => {
  const store = new MemoryStore()
  const friend = await storedPersonal(store)
  const edited = await editPersonRecord(
    store,
    viewOf(store, [], FOUNDER),
    friend.id,
    { name: "Friend", links: [{ create: { name: "Friend's Bakery", domain: "bakery.test" }, role: "works_at" }] },
    ctx(FOUNDER),
  )
  assert.equal(edited.visibility, "private")
  const org = [...store.orgs.values()][0]
  assert.equal(org.visibility, "private")
  assert.equal(viewOf(store, [], STAFF).organizations.length, 0)
})

test("google: an edit to a synced Person's address-book fields updates its address book and is stamped for write-back", async () => {
  const store = new MemoryStore()
  const friend = await storedPersonal(store)
  store.people.set(friend.id, {
    ...friend,
    address_book: {
      name: { given: "Old", family: "Friend" },
      nicknames: [],
      emails: [{ value: "friend@example.test", type: "home" }],
      phones: [],
      addresses: [],
      events: [],
      urls: [],
      relations: [],
      custom_fields: [],
      labels: [],
      organizations: [],
    },
  })
  const edited = await editPersonRecord(
    store,
    viewOf(store, [], FOUNDER),
    friend.id,
    { emails: ["friend@example.test", "friend.work@example.test"] },
    ctx(FOUNDER),
  )
  assert.deepEqual(edited.address_book?.emails, [
    { value: "friend@example.test", type: "home" },
    { value: "friend.work@example.test", type: undefined },
  ])
  assert.ok(edited.address_book_edited_at, "stamped, so latest edit wins and the sync can write it back")
})

test("emails: an address another Person holds is refused", async () => {
  const store = new MemoryStore()
  await storedPersonal(store)
  const view = viewOf(store, [adaptLead(LEAD())], FOUNDER)
  const lead = view.people.find((p) => p.read_only) as Person
  await assert.rejects(editPersonRecord(store, view, lead.id, { emails: ["friend@example.test"] }, ctx(FOUNDER)), /held/)
})

// ── 7. The founder's case: move a client contact to a new Organization on his own domain ────────────────────

test("move: a client contact moves to a new Organization on his domain; the client keeps its name and loses that domain", async () => {
  const store = new MemoryStore()
  const adapted = [adaptClient(CLIENT)]
  const view = viewOf(store, adapted, FOUNDER)
  const client = view.organizations[0]
  assert.equal(client.domain, "seconddevices.test", "the client row's domain came from its contact's email")
  const pat = view.people[0]

  const saved = await editPersonRecord(
    store,
    view,
    pat.id,
    { links: [{ create: { name: "Second Devices", domain: "seconddevices.test" }, role: "client", title: "Director" }] },
    ctx(FOUNDER),
  )

  const after = viewOf(store, adapted, FOUNDER)
  assert.equal(after.people.length, 1, "Pat shows once")
  const byName = new Map(after.organizations.map((o) => [o.name, o]))
  assert.equal(byName.get("Second Devices")?.domain, "seconddevices.test")
  assert.equal(byName.get("First Foundation (a note)")?.domain, undefined, "the client keeps its name, without Pat's domain")
  const links = after.affiliations.filter((a) => a.person_id === saved.id)
  assert.equal(links.length, 1)
  assert.equal(links[0].organization_id, byName.get("Second Devices")?.id)
  assert.equal(links[0].title, "Director")
  // Nothing was deleted: the ended link is kept as inactive history.
  assert.ok([...store.affs.values()].some((a) => a.active === false))
  assert.ok([...store.activities.values()].filter((a) => a.type === "record_edit").length >= 2, "the move and the cleared domain are both logged")
})

test("move: linking to a new Organization on a domain already held links to the one that holds it", async () => {
  const store = new MemoryStore()
  const existing: Organization = await store.createOrganization({ name: "Alamo Labs Inc", domain: "alamolabs.test", roles: [], visibility: "business", legacy_refs: [] })
  const view = viewOf(store, [adaptLead(LEAD())], FOUNDER)
  const p = view.people[0]
  await editPersonRecord(store, view, p.id, { links: [{ create: { name: "Alamo", domain: "alamolabs.test" }, role: "works_at" }] }, ctx(FOUNDER))
  assert.equal(store.orgs.size, 1)
  assert.ok([...store.affs.values()].some((a) => a.organization_id === existing.id && a.active))
})

test("organization edit: name, domain, roles, industry and location; a rubric change rescores", async () => {
  const store = new MemoryStore()
  const org = await store.createOrganization({ name: "Acme", roles: [], visibility: "business", legacy_refs: [], icp_fit_score: 0, icp_grade: "D" })
  const saved = await editOrganizationRecord(
    store,
    viewOf(store, [], FOUNDER),
    org.id,
    { name: "Acme Health", domain: "acmehealth.test", roles: ["prospect"], industry: "hospital & health care", location: "San Antonio, TX" },
    ctx(FOUNDER),
  )
  assert.equal(saved.domain, "acmehealth.test")
  assert.deepEqual(saved.roles, ["prospect"])
  assert.ok((saved.icp_fit_score ?? 0) > 0, "rescored on the new industry and location")
  await rejects(editOrganizationRecord(store, viewOf(store, [], FOUNDER), org.id, { name: "" }, ctx(FOUNDER)), 400)
})

test("organization edit: 434's own domain never takes the prospect or client role", async () => {
  const store = new MemoryStore()
  const org = await store.createOrganization({ name: "434 MEDIA", domain: "434media.com", roles: [], visibility: "business", legacy_refs: [] })
  const saved = await editOrganizationRecord(store, viewOf(store, [], FOUNDER), org.id, { roles: ["prospect", "partner"] }, ctx(FOUNDER))
  assert.deepEqual(saved.roles, ["partner"])
})

test("empty: a view with nothing in it has nothing to edit", async () => {
  const store = new MemoryStore()
  await rejects(editPersonRecord(store, assembleCoreView(emptyBundle(), [], new Set()), "nobody", { name: "X" }, ctx(FOUNDER)), 404)
})

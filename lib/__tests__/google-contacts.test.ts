/**
 * Offline. The Google Contacts sync (434-context `04 Build/434_Core_Data_Model_Spec.md`, "The Google Contacts sync:
 * the CRM is the master"; interface contract 1.5 §2), against a fake People API and the in-memory core store:
 *   1. the import mapping: the whole record, company and title as an Affiliation, personal unless labeled Business;
 *   2. the import saves directly (nothing waits in the inbox) and hands over to the sync token;
 *   3. incremental: a new phone contact waits in the inbox as personal (business when labeled); a deletion in Google
 *      deletes nothing here; an expired token resyncs, and only contacts changed since the last pass arrive;
 *   4. latest edit wins against Google, keeping the overwritten value in the activity history;
 *   5. never delete: no call can delete in Google or remove anyone from a group;
 *   6. write-back is off by default and writes nothing; switched on, it writes only to the "434" group, with the etag,
 *      re-reads on a stale etag and retries once, and logs every write;
 *   7. OAuth: the contacts scope alone, offline access, and the routes gated to the founder who is a super admin.
 *
 * Run: tsx --test lib/__tests__/google-contacts.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Person } from "../../types/core-model"
import { fromGooglePerson, relationshipFromLabels, toGoogleUpdate, type GooglePerson } from "../google-contacts/mapping"
import {
  ALLOWED,
  CONTACTS_SCOPE,
  GcError,
  authorizeUrl,
  isWriteCall,
  requestRefusal,
  scopeIsContactsOnly,
} from "../google-contacts/client"
import {
  runSync,
  pendingFields,
  writeRefusal,
  type ContactGroup,
  type PeopleApi,
  type PendingArrival,
  type PendingStore,
  type SyncState,
  type WriteLogEntry,
} from "../google-contacts/sync"
import { AT, MemoryStore } from "./helpers/core-memory-store"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")

const BUSINESS_GROUP = "contactGroups/biz1"
const FAMILY_GROUP = "contactGroups/fam1"
const CRM_GROUP = "contactGroups/crm434"

function gp(id: string, over: Partial<GooglePerson> & { updateTime?: string } = {}): GooglePerson {
  const { updateTime, ...rest } = over
  return {
    resourceName: `people/c${id}`,
    etag: `etag-${id}-1`,
    metadata: { sources: [{ type: "CONTACT", id, etag: `src-${id}-1`, updateTime: updateTime ?? "2026-11-13T09:00:00Z" }] },
    names: [{ givenName: `Given${id}`, familyName: "Example" }],
    ...rest,
  }
}

const FULL: GooglePerson = gp("100", {
  names: [{ givenName: "Ana", familyName: "Reyes", middleName: "Q", honorificSuffix: "Jr." }],
  nicknames: [{ value: "Annie" }],
  emailAddresses: [
    { value: "Ana@AlamoLabs.example", type: "work" },
    { value: "ana.home@example.com", type: "home" },
  ],
  phoneNumbers: [
    { value: "210-555-0100", type: "mobile" },
    { value: "210-555-0101", type: "Studio line" },
  ],
  addresses: [{ formattedValue: "1 Main St, San Antonio, TX", streetAddress: "1 Main St", city: "San Antonio", region: "TX", countryCode: "US", type: "work" }],
  birthdays: [{ date: { month: 4, day: 2 } }],
  events: [{ date: { year: 2015, month: 6, day: 1 }, type: "anniversary" }],
  urls: [{ value: "https://alamolabs.example", type: "work" }],
  relations: [{ person: "Sam Reyes", type: "spouse" }],
  userDefined: [{ key: "Met at", value: "AIM 2025" }],
  biographies: [{ value: "Prefers text.", contentType: "TEXT_PLAIN" }],
  memberships: [{ contactGroupMembership: { contactGroupResourceName: BUSINESS_GROUP } }],
  photos: [{ url: "https://example.com/ana.jpg" }],
  organizations: [{ name: "Alamo Labs", title: "Producer", department: "Events" }],
})

const GROUP_NAMES = new Map([
  [BUSINESS_GROUP, "Business"],
  [FAMILY_GROUP, "Family"],
])

// ── Fakes ───────────────────────────────────────────────────────────────────────────────────────────────────────

class FakeApi implements PeopleApi {
  pages: Array<{ connections: GooglePerson[]; nextPageToken?: string; nextSyncToken?: string }> = []
  syncPages: Array<{ connections: GooglePerson[]; nextPageToken?: string; nextSyncToken?: string }> = []
  expireSyncToken = false
  contacts = new Map<string, GooglePerson>()
  groups: ContactGroup[] = [
    { resourceName: BUSINESS_GROUP, name: "Business", groupType: "USER_CONTACT_GROUP" },
    { resourceName: FAMILY_GROUP, name: "Family", groupType: "USER_CONTACT_GROUP" },
    { resourceName: "contactGroups/myContacts", name: "myContacts", groupType: "SYSTEM_CONTACT_GROUP" },
  ]
  calls: string[] = []
  staleOnce = new Set<string>()
  async list(opts: { pageToken?: string; syncToken?: string }) {
    this.calls.push(`list ${opts.syncToken ? "sync" : "full"} ${opts.pageToken ?? ""}`.trim())
    if (opts.syncToken) {
      if (this.expireSyncToken) {
        this.expireSyncToken = false
        throw new GcError("expired", "expired_sync_token", false, 400)
      }
      return this.syncPages.shift() ?? { connections: [], nextSyncToken: opts.syncToken }
    }
    return this.pages.shift() ?? { connections: [], nextSyncToken: "sync-x" }
  }
  async get(rn: string) {
    this.calls.push(`get ${rn}`)
    return this.contacts.get(rn) as GooglePerson
  }
  async update(rn: string, body: Record<string, unknown>, fields: string) {
    this.calls.push(`update ${rn} ${fields} etag=${String(body.etag)}`)
    if (this.staleOnce.has(rn)) {
      this.staleOnce.delete(rn)
      throw new GcError("stale", "stale_etag", false, 400)
    }
    const cur = this.contacts.get(rn) ?? gp(rn.replace("people/c", ""))
    const next = { ...cur, ...body, etag: `${cur.etag}+` }
    this.contacts.set(rn, next)
    return next
  }
  async listGroups() {
    this.calls.push("listGroups")
    return this.groups
  }
  async createGroup(name: string) {
    this.calls.push(`createGroup ${name}`)
    const g = { resourceName: CRM_GROUP, name, groupType: "USER_CONTACT_GROUP" }
    this.groups.push(g)
    return g
  }
  async addToGroup(group: string, rns: string[]) {
    this.calls.push(`addToGroup ${group} ${rns.length}`)
    for (const rn of rns) {
      const c = this.contacts.get(rn)
      if (c) c.memberships = [...((c.memberships as unknown[]) ?? []), { contactGroupMembership: { contactGroupResourceName: group } }]
    }
  }
  writes() {
    return this.calls.filter((c) => /^(update|createGroup|addToGroup)/.test(c))
  }
}

class MemoryPending implements PendingStore {
  map = new Map<string, PendingArrival>()
  async get(rn: string) {
    return this.map.get(rn) ?? null
  }
  async put(a: PendingArrival) {
    this.map.set(a.resource_name, a)
  }
  async remove(rn: string) {
    this.map.delete(rn)
  }
}

function harness(state: Partial<SyncState> = {}) {
  const store = new MemoryStore()
  const api = new FakeApi()
  const pending = new MemoryPending()
  const log: WriteLogEntry[] = []
  let st: SyncState = { phase: "import", write_back: false, ...state }
  const knownBusiness = new Set<string>()
  let clock = Date.parse("2026-11-13T12:00:00Z")
  const deps = {
    api,
    store,
    pending,
    cohorts: [] as never[],
    state: {
      async read() {
        return { ...st }
      },
      async write(s: SyncState) {
        // As the Firestore store: a run never writes the switch.
        st = { ...s, write_back: st.write_back }
      },
    },
    log: {
      async record(e: WriteLogEntry) {
        log.push(e)
      },
    },
    people: {
      async byResourceName(rn: string) {
        return [...store.people.values()].find((p) => p.google?.resource_name === rn) ?? null
      },
      async linked() {
        return [...store.people.values()].filter((p) => p.google)
      },
      async knownBusinessEmails() {
        return knownBusiness
      },
    },
    now: () => new Date((clock += 1000)).toISOString(),
  }
  return {
    store,
    api,
    pending,
    log,
    deps,
    knownBusiness,
    state: () => st,
    setWriteBack: (on: boolean) => {
      st = { ...st, write_back: on }
    },
    person: (rn: string) => [...store.people.values()].find((p) => p.google?.resource_name === rn) as Person,
  }
}

// ── 1. Mapping ──────────────────────────────────────────────────────────────────────────────────────────────────

test("mapping: the whole Google record comes over under Google's meanings", () => {
  const m = fromGooglePerson(FULL, GROUP_NAMES)
  assert.equal(m.resource_name, "people/c100")
  assert.equal(m.etag, "etag-100-1")
  assert.deepEqual(m.contact_source, { id: "100", etag: "src-100-1" })
  assert.equal(m.update_time, "2026-11-13T09:00:00Z")
  const b = m.book
  assert.deepEqual(b.name, { given: "Ana", family: "Reyes", middle: "Q", prefix: undefined, suffix: "Jr." })
  assert.deepEqual(b.nicknames, ["Annie"])
  assert.deepEqual(b.emails, [{ value: "Ana@AlamoLabs.example", type: "work" }, { value: "ana.home@example.com", type: "home" }])
  assert.deepEqual(b.phones, [{ value: "210-555-0100", type: "mobile" }, { value: "210-555-0101", type: "Studio line" }])
  assert.equal(b.addresses[0].city, "San Antonio")
  assert.equal(b.addresses[0].country_code, "US")
  assert.deepEqual(b.birthday, { year: undefined, month: 4, day: 2, text: undefined })
  assert.deepEqual(b.events, [{ date: { year: 2015, month: 6, day: 1 }, type: "anniversary" }])
  assert.deepEqual(b.urls, [{ value: "https://alamolabs.example", type: "work" }])
  assert.deepEqual(b.relations, [{ person: "Sam Reyes", type: "spouse" }])
  assert.deepEqual(b.custom_fields, [{ key: "Met at", value: "AIM 2025" }])
  assert.equal(b.notes, "Prefers text.")
  assert.deepEqual(b.labels, ["Business"])
  assert.equal(b.photo_url, "https://example.com/ana.jpg")
  assert.deepEqual(b.organizations, [{ name: "Alamo Labs", title: "Producer", department: "Events" }])
})

test("mapping: personal unless labeled Business (any case); system groups are not labels", () => {
  assert.equal(relationshipFromLabels(["Business"]), "business")
  assert.equal(relationshipFromLabels(["business "]), "business")
  assert.equal(relationshipFromLabels(["Family"]), "personal")
  assert.equal(relationshipFromLabels([]), "personal")
})

test("mapping: an update sends the etag and the contact source, and names only the fields it changes", () => {
  const m = fromGooglePerson(FULL, GROUP_NAMES)
  const { body, updatePersonFields } = toGoogleUpdate(m.book, ["notes", "phones"], { resource_name: m.resource_name, etag: m.etag, contact_source: m.contact_source })
  assert.equal(updatePersonFields, "biographies,phoneNumbers")
  assert.equal(body.etag, "etag-100-1")
  assert.deepEqual(body.metadata, { sources: [{ type: "CONTACT", id: "100", etag: "src-100-1" }] })
  assert.deepEqual(body.biographies, [{ value: "Prefers text.", contentType: "TEXT_PLAIN" }])
  assert.equal(body.names, undefined)
  assert.equal(body.memberships, undefined, "labels are never written")
  assert.equal(body.photos, undefined, "the photo is never written")
})

// ── 2. Import ───────────────────────────────────────────────────────────────────────────────────────────────────

test("import: every contact is saved directly, personal unless labeled Business, with the whole record and the link", async () => {
  const h = harness()
  const friend = gp("200", {
    names: [{ givenName: "Pat", familyName: "Friend" }],
    phoneNumbers: [{ value: "210-555-0142", type: "mobile" }],
    emailAddresses: [{ value: "pat@example.com" }],
    memberships: [{ contactGroupMembership: { contactGroupResourceName: FAMILY_GROUP } }],
    organizations: [{ name: "Sunrise Bakery", title: "Owner" }],
  })
  h.api.pages = [{ connections: [FULL], nextPageToken: "p2" }, { connections: [friend], nextSyncToken: "sync-1" }]
  const r = await runSync(h.deps)
  assert.equal(r.imported, 2)
  assert.equal(h.pending.map.size, 0, "the import fills no inbox")
  assert.deepEqual([...h.store.activities.keys()].filter((id) => !h.store.triage.has(id)), [], "every import activity is triaged")

  const ana = h.person("people/c100")
  assert.equal(ana.relationship, "business")
  assert.equal(ana.visibility, "business")
  assert.equal(ana.source, "google_contacts")
  assert.equal(ana.consent.email.status, "none", "the address book carries no consent")
  assert.deepEqual(ana.emails, ["ana@alamolabs.example", "ana.home@example.com"], "emails stay a list")
  assert.deepEqual(ana.phones, ["210-555-0100", "210-555-0101"], "phones stay a list")
  assert.equal(ana.address_book?.birthday?.month, 4)
  assert.equal(ana.google?.etag, "etag-100-1")
  assert.equal(ana.google?.resource_name, "people/c100")

  const pat = h.person("people/c200")
  assert.equal(pat.relationship, "personal")
  assert.equal(pat.visibility, "private")
  // Company and title become an Affiliation to an Organization, private when only a personal contact names it.
  const aff = [...h.store.affs.values()].find((a) => a.person_id === pat.id)
  assert.equal(aff?.role, "works_at")
  assert.equal(aff?.title, "Owner")
  const org = h.store.orgs.get(aff!.organization_id)
  assert.equal(org?.name, "Sunrise Bakery")
  assert.equal(org?.visibility, "private")
  // A business contact's company is business.
  const anaAff = [...h.store.affs.values()].find((a) => a.person_id === ana.id)
  assert.equal(h.store.orgs.get(anaAff!.organization_id)?.visibility, "business")

  assert.equal(h.state().phase, "sync")
  assert.equal(h.state().sync_token, "sync-1")
  assert.ok(h.state().last_synced_at)
})

test("import: an email that already belongs to a business record imports as business, and an existing Person is linked, not copied", async () => {
  const h = harness()
  h.knownBusiness.add("lead@example.com")
  const { person: existing } = await (await import("../core-model/service")).ensurePerson(h.store, {
    contact: { name: "Existing Client", email: "client@example.com" },
    source: "web",
    at: AT,
    stage: "customer",
  })
  h.api.pages = [
    {
      connections: [
        gp("300", { emailAddresses: [{ value: "lead@example.com" }] }),
        gp("301", { emailAddresses: [{ value: "Client@Example.com" }], names: [{ givenName: "Phone", familyName: "Name" }] }),
      ],
      nextSyncToken: "s",
    },
  ]
  const r = await runSync(h.deps)
  assert.equal(h.person("people/c300").relationship, "business")
  assert.equal(r.linked, 1)
  const linked = h.store.people.get(existing.id) as Person
  assert.equal(linked.google?.resource_name, "people/c301")
  assert.equal(linked.name, "Existing Client", "the CRM's name is kept; Google's is in the address book")
  assert.equal(linked.lifecycle_stage, "customer")
  assert.equal(h.store.people.size, 2)
})

// ── 3. Incremental ──────────────────────────────────────────────────────────────────────────────────────────────

test("incremental: a new phone contact waits in the inbox as personal; a Business-labeled one as business; nothing is stored", async () => {
  const h = harness({ phase: "sync", sync_token: "s1", last_synced_at: "2026-11-13T08:00:00Z" })
  h.api.syncPages = [
    {
      connections: [
        gp("400", { names: [{ givenName: "New", familyName: "Friend" }] }),
        gp("401", { memberships: [{ contactGroupMembership: { contactGroupResourceName: BUSINESS_GROUP } }] }),
      ],
      nextSyncToken: "s2",
    },
  ]
  const r = await runSync(h.deps)
  assert.equal(r.arrivals, 2)
  assert.equal(h.pending.map.get("people/c400")?.relationship, "personal")
  assert.equal(h.pending.map.get("people/c401")?.relationship, "business")
  assert.equal(h.store.writes, 0, "an arrival is not a Person until someone decides")
  assert.equal(h.state().sync_token, "s2")
})

test("incremental: a deletion in Google deletes nothing here: the Person is kept and marked, a waiting arrival forgotten", async () => {
  const h = harness()
  h.api.pages = [{ connections: [gp("500")], nextSyncToken: "s1" }]
  await runSync(h.deps)
  await h.pending.put({ resource_name: "people/c501", etag: "e", book: fromGooglePerson(gp("501"), GROUP_NAMES).book, groups: [], relationship: "personal", arrived_at: AT })
  h.api.syncPages = [
    {
      connections: [
        { resourceName: "people/c500", etag: "x", metadata: { deleted: true } },
        { resourceName: "people/c501", etag: "x", metadata: { deleted: true } },
      ],
      nextSyncToken: "s2",
    },
  ]
  const r = await runSync(h.deps)
  assert.equal(r.deleted_in_google, 1)
  const kept = h.person("people/c500")
  assert.ok(kept, "the Person still exists")
  assert.ok(kept.google?.deleted_at)
  assert.equal(h.pending.map.has("people/c501"), false)
  assert.deepEqual(h.api.writes(), [])
})

test("incremental: an expired sync token means a full resync, and only contacts changed since the last pass arrive", async () => {
  const h = harness({ phase: "sync", sync_token: "old", last_synced_at: "2026-11-13T08:00:00Z" })
  h.api.expireSyncToken = true
  h.api.pages = [
    {
      connections: [
        gp("600", { updateTime: "2026-11-01T00:00:00Z" }), // dismissed long ago, untouched since: stays gone
        gp("601", { updateTime: "2026-11-13T10:00:00Z" }), // edited on the phone since the last pass: arrives
      ],
      nextSyncToken: "fresh",
    },
  ]
  const r = await runSync(h.deps)
  assert.ok(h.api.calls.includes("list sync"))
  assert.ok(h.api.calls.includes("list full"))
  assert.equal(r.arrivals, 1)
  assert.equal(h.pending.map.has("people/c600"), false)
  assert.equal(h.pending.map.has("people/c601"), true)
  assert.equal(h.state().phase, "sync")
  assert.equal(h.state().sync_token, "fresh")
})

// ── 4. Latest edit wins against Google ──────────────────────────────────────────────────────────────────────────

test("latest edit wins: a phone edit made after the CRM's edit wins, and the CRM's value is kept in the activity history", async () => {
  const h = harness()
  h.api.pages = [{ connections: [gp("700", { biographies: [{ value: "original" }] })], nextSyncToken: "s1" }]
  await runSync(h.deps)
  const p = h.person("people/c700")
  await h.store.updatePerson(p.id, {
    address_book: { ...p.address_book!, notes: "CRM edit" },
    notes: "CRM edit",
    address_book_edited_at: "2026-11-13T10:00:00Z",
  })
  h.api.syncPages = [{ connections: [gp("700", { biographies: [{ value: "phone edit" }], updateTime: "2026-11-13T11:00:00Z", etag: "etag-700-2" })], nextSyncToken: "s2" }]
  await runSync(h.deps)
  const after = h.person("people/c700")
  assert.equal(after.address_book?.notes, "phone edit")
  assert.equal(after.notes, "phone edit")
  assert.equal(after.google?.etag, "etag-700-2")
  const history = [...h.store.activities.values()].find((a) => a.type === "address_book_change" && a.person_id === p.id)
  assert.deepEqual(history?.change, [{ field: "notes", before: "CRM edit", after: "phone edit", winner: "google" }])
  assert.equal(h.store.triage.has(history!.id), true, "history does not fill the inbox")
  assert.equal(history?.visibility, "private", "a personal contact's history is private")
})

test("latest edit wins: a CRM edit made after the phone's keeps the CRM value and records the phone's", async () => {
  const h = harness()
  h.api.pages = [{ connections: [gp("710", { biographies: [{ value: "original" }] })], nextSyncToken: "s1" }]
  await runSync(h.deps)
  const p = h.person("people/c710")
  await h.store.updatePerson(p.id, { address_book: { ...p.address_book!, notes: "CRM edit" }, address_book_edited_at: "2026-11-13T12:30:00Z" })
  h.api.syncPages = [{ connections: [gp("710", { biographies: [{ value: "phone edit" }], updateTime: "2026-11-13T11:00:00Z" })], nextSyncToken: "s2" }]
  await runSync(h.deps)
  const after = h.person("people/c710")
  assert.equal(after.address_book?.notes, "CRM edit")
  assert.deepEqual(pendingFields(after), ["notes"], "due to be written back")
  const history = [...h.store.activities.values()].find((a) => a.type === "address_book_change")
  assert.deepEqual(history?.change, [{ field: "notes", before: "phone edit", after: "CRM edit", winner: "crm" }])
})

// ── 5. Never delete ─────────────────────────────────────────────────────────────────────────────────────────────

test("never delete: the allow-list has no delete; delete calls and group removals are refused", () => {
  assert.equal(ALLOWED.some((r) => (r.method as string) === "DELETE"), false)
  assert.ok(requestRefusal("DELETE", "/v1/people/c1:deleteContact"))
  assert.ok(requestRefusal("POST", "/v1/people:batchDeleteContacts"))
  assert.ok(requestRefusal("DELETE", "/v1/people/c1:deleteContactPhoto"))
  assert.ok(requestRefusal("DELETE", "/v1/contactGroups/abc"))
  assert.ok(requestRefusal("POST", "/v1/people:batchCreateContacts"), "the sync never creates contacts in Google either")
  assert.ok(requestRefusal("POST", "/v1/contactGroups/abc/members:modify", { resourceNamesToRemove: ["people/c1"] }))
  assert.equal(requestRefusal("POST", "/v1/contactGroups/abc/members:modify", { resourceNamesToAdd: ["people/c1"] }), null)
  assert.equal(requestRefusal("PATCH", "/v1/people/c1:updateContact"), null)
  assert.equal(isWriteCall("GET", "/v1/people/me/connections"), false)
  assert.equal(isWriteCall("PATCH", "/v1/people/c1:updateContact"), true)
  const client = read("lib/google-contacts/client.ts")
  assert.doesNotMatch(client, /method:\s*"DELETE"|deleteContact"|batchDelete"/)
  assert.doesNotMatch(read("lib/google-contacts/sync.ts"), /resourceNamesToRemove|\.delete\(/)
})

// ── 6. Write-back ───────────────────────────────────────────────────────────────────────────────────────────────

async function importedWithCrmEdit(h: ReturnType<typeof harness>) {
  h.api.contacts.set("people/c800", gp("800", { biographies: [{ value: "original" }] }))
  h.api.pages = [{ connections: [h.api.contacts.get("people/c800")!], nextSyncToken: "s1" }]
  await runSync(h.deps)
  const p = h.person("people/c800")
  await h.store.updatePerson(p.id, { address_book: { ...p.address_book!, notes: "CRM edit" }, address_book_edited_at: "2026-11-13T12:30:00Z" })
  return p
}

test("write-back: off by default; with edits waiting, nothing is written to Google and nothing joins a group", async () => {
  const h = harness()
  assert.equal(h.state().write_back, false)
  await importedWithCrmEdit(h)
  const r = await runSync(h.deps)
  assert.equal(r.waiting_for_write_back, 1)
  assert.deepEqual(h.api.writes(), [])
  assert.deepEqual(h.log, [])
  assert.equal(writeRefusal(h.person("people/c800"), { write_back: false }), "write_back_off")
})

test("write-back: a run never turns the switch on; only the founder's switch does", async () => {
  const h = harness()
  await runSync(h.deps)
  assert.equal(h.state().write_back, false)
  assert.match(read("lib/google-contacts/server.ts"), /write_back: d\.write_back === true/)
  assert.match(read("lib/google-contacts/server.ts"), /const \{ write_back: _w, \.\.\.rest \} = state/)
})

test("write-back: on, it claims the 434 group (add only), writes with the etag, and logs every write", async () => {
  const h = harness()
  await importedWithCrmEdit(h)
  h.setWriteBack(true)
  const r = await runSync(h.deps)
  assert.equal(r.written, 1)
  assert.deepEqual(h.api.writes(), ["createGroup 434", `addToGroup ${CRM_GROUP} 1`, "update people/c800 biographies etag=etag-800-1"])
  assert.deepEqual(h.log.map((e) => [e.op, e.outcome]), [["create_group", "ok"], ["add_to_group", "ok"], ["update_contact", "ok"]])
  const after = h.person("people/c800")
  assert.equal(after.google?.in_434_group, true)
  assert.deepEqual(pendingFields(after), [], "the copies agree after the write")
  assert.deepEqual(h.api.contacts.get("people/c800")?.biographies, [{ value: "CRM edit", contentType: "TEXT_PLAIN" }])
})

test("write-back: only to contacts in the 434 group", () => {
  const p = { google: { resource_name: "people/c1", etag: "e", snapshot: {} as never, in_434_group: false, synced_at: AT } } as unknown as Person
  assert.equal(writeRefusal(p, { write_back: true }), "not_in_434_group")
  assert.equal(writeRefusal({ ...p, google: { ...p.google!, in_434_group: true } }, { write_back: true }), null)
  assert.equal(writeRefusal({ ...p, google: { ...p.google!, in_434_group: true, deleted_at: AT } }, { write_back: true }), "not_linked")
})

test("write-back: a stale etag is refused by Google; the sync re-reads, applies latest edit wins and retries once", async () => {
  const h = harness()
  await importedWithCrmEdit(h)
  h.setWriteBack(true)
  // The phone edited a different field meanwhile: both edits survive.
  h.api.contacts.set(
    "people/c800",
    gp("800", { biographies: [{ value: "original" }], nicknames: [{ value: "Gee" }], etag: "etag-800-2", updateTime: "2026-11-13T12:40:00Z" }),
  )
  h.api.staleOnce.add("people/c800")
  const r = await runSync(h.deps)
  assert.equal(r.stale_retries, 1)
  assert.equal(r.written, 1)
  const updates = h.api.calls.filter((c) => c.startsWith("update"))
  assert.equal(updates.length, 2)
  assert.ok(h.api.calls.includes("get people/c800"))
  assert.match(updates[1], /etag=etag-800-2/, "the retry sends the fresh etag")
  assert.deepEqual(h.log.filter((e) => e.op === "update_contact").map((e) => e.outcome), ["stale_etag", "ok"])
  const after = h.person("people/c800")
  assert.deepEqual(after.address_book?.nicknames, ["Gee"])
  assert.equal(after.address_book?.notes, "CRM edit")
})

// ── 7. OAuth and the gate ───────────────────────────────────────────────────────────────────────────────────────

test("oauth: the contacts scope alone, offline access, consent prompt; a broader grant is refused", () => {
  const u = new URL(authorizeUrl({ clientId: "client.apps.example", redirectUri: "https://www.434media.com/cb" }, "state123"))
  assert.equal(u.searchParams.get("scope"), CONTACTS_SCOPE)
  assert.equal(CONTACTS_SCOPE, "https://www.googleapis.com/auth/contacts")
  assert.equal(u.searchParams.get("access_type"), "offline")
  assert.equal(u.searchParams.get("prompt"), "consent")
  assert.equal(u.searchParams.get("include_granted_scopes"), null)
  assert.equal(scopeIsContactsOnly(CONTACTS_SCOPE), true)
  assert.equal(scopeIsContactsOnly(`${CONTACTS_SCOPE} https://www.googleapis.com/auth/gmail.readonly`), false)
  assert.equal(scopeIsContactsOnly(""), false)
})

test("oauth: every Google Contacts route is the founder who is a super admin; the cron runs under the cron secret", () => {
  const guard = read("lib/google-contacts/guard.ts")
  assert.match(guard, /await requireFounder\(where\)/)
  assert.match(guard, /isCrmSuperAdmin\(auth\.session\.email\)/)
  for (const r of ["route.ts", "connect/route.ts", "callback/route.ts", "disconnect/route.ts", "sync/route.ts"]) {
    const src = read(`app/api/admin/core/google-contacts/${r}`)
    assert.match(src, /requireContactsOwner\(/, r)
  }
  assert.match(read("app/api/admin/core/google-contacts/callback/route.ts"), /pending\.by !== gate\.session\.email/)
  assert.match(read("app/api/cron/google-contacts-sync/route.ts"), /runCronJob\("google-contacts-sync"/)
  assert.ok(JSON.parse(read("vercel.json")).crons.some((c: { path: string }) => c.path === "/api/cron/google-contacts-sync"))
})

test("oauth: the token is sealed with its own key and kept in Firestore, never in the repository", () => {
  const server = read("lib/google-contacts/server.ts")
  assert.match(server, /google_contacts_connection/)
  assert.match(read("lib/google-contacts/client.ts"), /sealJson\(deps\.client\.tokenKey/)
  assert.match(read("lib/google-contacts/client.ts"), /GOOGLE_CONTACTS_TOKEN_KEY/)
})

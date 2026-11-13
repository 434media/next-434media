/**
 * Offline. The core data model's first slice (V1 item 4; 434-context `04 Build/434_Core_Data_Model_Spec.md`):
 * Person, Organization, Affiliation, Activity and the inbox view, with the guardrails the spec says must survive,
 * each tested here against an in-memory store:
 *   1. the cold-outreach gate (US only, fails closed, keyed on source; a cold Person's gate inputs are locked);
 *   2. consent per source (form submitters asked to hear from us; prospects did not), suppression always wins;
 *   3. the CRM keeps the full text of what is sent and received;
 *   4. Google Contacts: a dismissed entry is never stored;
 *   5. duplicates: matched by email and domain, merged only by the explicit, logged call;
 *   6. visibility: `business` by default, `restricted` for full admins only;
 *   7. read-time adapters keep old identifiers and values, and collapse one email to one Person;
 *   8. scoring on arrival uses the one rubric.
 * The routes import Firestore, so their wiring is checked from source.
 *
 * Run: tsx --test lib/__tests__/core-model.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { ClientRecord, Lead } from "../../types/crm-types"
import type { ContactFormSubmission } from "../firestore-contact-forms"
import type { Activity, Affiliation, MergeRecord, Organization, Person, TriageRecord } from "../../types/core-model"
import { canEmail, consentFromSource, mergeConsent } from "../core-model/consent"
import { personColdEditRefusal, personColdGate } from "../core-model/cold-gate"
import { canSee, normalizeVisibility } from "../core-model/visibility"
import { validateActivity, type ActivityInput } from "../core-model/activity"
import { domainFromEmail, matchPerson, normalizeDomain, normalizeEmail } from "../core-model/identity"
import { adaptClient, adaptContactForm, adaptLead, contactFormLegacyRef, emptyBundle } from "../core-model/adapters"
import { assembleCoreView, inboxOf } from "../core-model/assemble"
import { scoreOrganization } from "../core-model/score"
import { scoreIcpFit } from "../icp/rubric"
import {
  CoreRuleError,
  DuplicateError,
  ensureOrganization,
  ensurePerson,
  mergePeople,
  recordArrival,
  triageActivity,
  type CoreStore,
  type LeadPath,
  type NewAffiliation,
  type NewOrganization,
  type NewPerson,
} from "../core-model/service"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")
const AT = "2026-11-13T15:00:00.000Z"

// ── An in-memory store that counts every write ─────────────────────────────────────────────────────────────

class MemoryStore implements CoreStore {
  people = new Map<string, Person>()
  orgs = new Map<string, Organization>()
  affs = new Map<string, Affiliation>()
  activities = new Map<string, Activity>()
  triage = new Map<string, TriageRecord>()
  merges: Omit<MergeRecord, "id">[] = []
  emailIndex = new Map<string, string>()
  domainIndex = new Map<string, string>()
  writes = 0
  private seq = 0
  private id(prefix: string) {
    return `${prefix}${++this.seq}`
  }
  async getPerson(id: string) {
    return this.people.get(id) ?? null
  }
  async findPersonByEmail(email: string) {
    const id = this.emailIndex.get(normalizeEmail(email))
    return id ? (this.people.get(id) ?? null) : null
  }
  async createPerson(input: NewPerson) {
    for (const e of input.emails) {
      const held = this.emailIndex.get(e)
      if (held) throw new DuplicateError(`${e} is held`, held)
    }
    this.writes++
    const p: Person = { ...input, id: this.id("p"), created_at: AT, updated_at: AT }
    this.people.set(p.id, p)
    for (const e of p.emails) this.emailIndex.set(e, p.id)
    return p
  }
  async updatePerson(id: string, patch: Partial<NewPerson>) {
    this.writes++
    const p = { ...(this.people.get(id) as Person), ...patch, updated_at: AT }
    this.people.set(id, p)
    return p
  }
  async reassignEmails(emails: string[], personId: string) {
    this.writes++
    for (const e of emails) this.emailIndex.set(e, personId)
  }
  async getOrganization(id: string) {
    return this.orgs.get(id) ?? null
  }
  async findOrganizationByDomain(domain: string) {
    const id = this.domainIndex.get(domain)
    return id ? (this.orgs.get(id) ?? null) : null
  }
  async createOrganization(input: NewOrganization) {
    if (input.domain && this.domainIndex.has(input.domain)) throw new DuplicateError("held", this.domainIndex.get(input.domain) as string)
    this.writes++
    const o: Organization = { ...input, id: this.id("o"), created_at: AT, updated_at: AT }
    this.orgs.set(o.id, o)
    if (o.domain) this.domainIndex.set(o.domain, o.id)
    return o
  }
  async updateOrganization(id: string, patch: Partial<NewOrganization>) {
    this.writes++
    const o = { ...(this.orgs.get(id) as Organization), ...patch }
    this.orgs.set(id, o)
    return o
  }
  async findAffiliation(personId: string, organizationId: string, role: string) {
    return [...this.affs.values()].find((a) => a.person_id === personId && a.organization_id === organizationId && a.role === role) ?? null
  }
  async createAffiliation(input: NewAffiliation) {
    this.writes++
    const a: Affiliation = { ...input, id: this.id("a"), created_at: AT, updated_at: AT }
    this.affs.set(a.id, a)
    return a
  }
  async createActivity(input: ActivityInput) {
    this.writes++
    const a: Activity = { ...input, id: this.id("act"), triaged: false, created_at: AT }
    this.activities.set(a.id, a)
    return a
  }
  async getTriage(id: string) {
    return this.triage.get(id) ?? null
  }
  async recordTriage(r: TriageRecord) {
    this.writes++
    this.triage.set(r.id, r)
  }
  async recordMerge(r: Omit<MergeRecord, "id">) {
    this.writes++
    this.merges.push(r)
  }
}

class FakeLeadPath implements LeadPath {
  calls: Array<{ person: Person; activity: Activity }> = []
  constructor(private readonly leadId: string | null = "lead-1") {}
  async createLeadFor(person: Person, activity: Activity) {
    this.calls.push({ person, activity })
    return { leadId: this.leadId }
  }
}

const COHORTS: never[] = []

function formActivity(overrides: Partial<Activity> = {}): Activity {
  return { ...adaptContactForm(contactForm(), false).activities[0], ...overrides }
}

function contactForm(overrides: Partial<ContactFormSubmission> = {}): ContactFormSubmission {
  return {
    id: "cf1",
    firstName: "Ana",
    lastName: "Reyes",
    company: "Alamo Labs",
    email: "  Ana@AlamoLabs.test ",
    phone: "210-555-0100",
    message: "We need a three-camera shoot for our summit in March.\n\nSecond paragraph with the detail.",
    source: "434Media",
    created_at: AT,
    ...overrides,
  }
}

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "L1",
    name: "Ana Reyes",
    company: "Alamo Labs",
    email: "ana@alamolabs.test",
    source: "web",
    score: 0,
    priority: "low",
    score_breakdown: {},
    status: "new",
    email_opens: 0,
    email_clicks: 0,
    created_at: AT,
    updated_at: AT,
    ...overrides,
  } as Lead
}

function googleContact(): Activity {
  return {
    id: "gc:people/c123",
    type: "google_contact",
    source: "google_contacts",
    occurred_at: AT,
    contact: { name: "Sam Ortiz", email: "sam@ortizfilms.test", company: "Ortiz Films" },
    summary: "New Google contact",
    triaged: false,
    read_only: true,
    created_at: AT,
  }
}

// ── 1. The cold-outreach gate ───────────────────────────────────────────────────────────────────────────────

test("cold gate: a prospected or partner Person outside the US, or with no readable country, is blocked", () => {
  for (const source of ["prospected", "partner"] as const) {
    assert.equal(personColdGate({ source, country: "GB" }).allowed, false)
    assert.equal(personColdGate({ source, country: "" , location: "" }).allowed, false, "blank fails closed")
    assert.equal(personColdGate({ source, location: "Atlantis" }).allowed, false, "unknown fails closed")
    assert.equal(personColdGate({ source, country: "US" }).allowed, true)
    assert.equal(personColdGate({ source, location: "San Antonio, TX" }).allowed, true)
  }
})

test("cold gate: warm and inbound Persons are not jurisdiction-gated", () => {
  for (const source of ["web", "newsletter", "event", "manual", "referral", "google_contacts"] as const) {
    const g = personColdGate({ source, country: "GB" })
    assert.equal(g.allowed, true)
    assert.equal(g.cold, false)
  }
})

test("cold gate: a cold Person's source, country and location are locked; a warm one's are not", () => {
  const cold = { source: "prospected" as const, country: "US", location: "Austin, TX" }
  assert.match(personColdEditRefusal(cold, { country: "CA" }) ?? "", /locked/)
  assert.match(personColdEditRefusal(cold, { location: "Toronto, ON" }) ?? "", /locked/)
  assert.ok(personColdEditRefusal(cold, { source: "web" }))
  assert.equal(personColdEditRefusal(cold, { country: "US" }), null, "re-sending the same value is not a change")
  const warm = { source: "web" as const, country: "US" }
  assert.ok(personColdEditRefusal(warm, { source: "prospected" }), "a warm Person cannot be moved onto a cold source")
  assert.equal(personColdEditRefusal(warm, { country: "MX" }), null)
})

test("cold gate: the Person PATCH route refuses a locked edit with 403 jurisdiction_locked", () => {
  const src = read("app/api/admin/core/people/[id]/route.ts")
  assert.match(src, /personColdEditRefusal\(/)
  assert.match(src, /jurisdiction_locked/)
  assert.match(src, /status: 403/)
  // No country list of its own: the gate comes from the one allow-list.
  assert.doesNotMatch(read("lib/core-model/cold-gate.ts"), /EXCLUDED_COUNTR/)
})

// ── 2. Consent per source ───────────────────────────────────────────────────────────────────────────────────

test("consent: a form submitter has granted email consent, with its source and time", () => {
  const c = consentFromSource("web", AT).email
  assert.deepEqual(c, { status: "granted", basis: "requested_contact", source: "web", at: AT })
})

test("consent: prospects, partner lists and the address book carry none", () => {
  for (const source of ["prospected", "partner", "google_contacts", "manual"] as const) {
    const c = consentFromSource(source, AT)
    assert.equal(c.email.status, "none")
    assert.equal(canEmail({ consent: c }, false).allowed, false)
  }
})

test("consent: suppression wins over granted consent", () => {
  const c = consentFromSource("web", AT)
  assert.equal(canEmail({ consent: c }, false).allowed, true)
  assert.equal(canEmail({ consent: c }, true).allowed, false)
})

test("consent: a later arrival never overwrites a withdrawal, and granted consent keeps its first source", () => {
  const withdrawn = { email: { status: "withdrawn" as const, basis: "withdrawn" as const, source: "web" as const, at: AT } }
  assert.equal(mergeConsent(withdrawn, consentFromSource("web", AT)).email.status, "withdrawn")
  const first = consentFromSource("newsletter", "2026-01-01T00:00:00.000Z")
  assert.equal(mergeConsent(first, consentFromSource("web", AT)).email.source, "newsletter")
  assert.equal(mergeConsent(consentFromSource("prospected", AT), consentFromSource("web", AT)).email.status, "granted")
})

test("consent: a prospected Person who later writes in through the form gains consent from that source", async () => {
  const store = new MemoryStore()
  await ensurePerson(store, { contact: { email: "x@acme.test", name: "X" }, source: "prospected", at: AT })
  const { person, created } = await ensurePerson(store, { contact: { email: "X@acme.test" }, source: "web", at: AT })
  assert.equal(created, false)
  assert.equal(person.source, "prospected", "first touch is kept, so the cold gate still applies")
  assert.equal(person.consent.email.status, "granted")
  assert.equal(person.consent.email.source, "web")
})

// ── 3. Full text ────────────────────────────────────────────────────────────────────────────────────────────

const emailInput = (over: Partial<ActivityInput> = {}): ActivityInput => ({
  type: "email",
  source: "manual",
  occurred_at: AT,
  contact: { email: "ana@alamolabs.test" },
  summary: "Re: summit",
  body: "Full reply text, every line of it.",
  email: { direction: "received", from: "ana@alamolabs.test", to: ["marcos@434media.com"], cc: [], subject: "Re: summit" },
  ...over,
})

test("full text: an email activity must carry its body, sender, recipients and time", () => {
  assert.equal(validateActivity(emailInput()), null)
  assert.match(validateActivity(emailInput({ body: "" })) ?? "", /full text/)
  assert.match(validateActivity(emailInput({ body: undefined })) ?? "", /full text/)
  assert.match(validateActivity(emailInput({ email: undefined })) ?? "", /envelope/)
  assert.match(validateActivity(emailInput({ email: { ...emailInput().email!, from: "" } })) ?? "", /sender/)
  assert.match(validateActivity(emailInput({ email: { ...emailInput().email!, to: [] } })) ?? "", /recipient/)
  assert.match(validateActivity(emailInput({ occurred_at: "" })) ?? "", /time/)
})

test("full text: recordArrival refuses an email without its body before writing anything", async () => {
  const store = new MemoryStore()
  await assert.rejects(recordArrival(store, emailInput({ body: "  " }), COHORTS), CoreRuleError)
  assert.equal(store.writes, 0)
})

test("full text: a long body is stored whole", async () => {
  const store = new MemoryStore()
  const body = "x".repeat(50_000)
  const { activity } = await recordArrival(store, emailInput({ body }), COHORTS)
  assert.equal(store.activities.get(activity.id)?.body?.length, 50_000)
})

test("full text: an adapted contact form keeps the whole message and the intake answers", () => {
  const sub = contactForm({ requestType: "Production", budgetRange: "$10k+" })
  const a = adaptContactForm(sub, false).activities[0]
  assert.ok(a.body?.includes(sub.message as string))
  assert.ok(a.body?.includes("Request: Production"))
  assert.ok(a.body?.includes("Budget: $10k+"))
})

test("full text: the Activity store has no update or delete", () => {
  const src = read("lib/firestore-activities.ts")
  assert.doesNotMatch(src, /export async function (update|delete)/)
  assert.doesNotMatch(src, /\.update\(|\.delete\(/)
})

// ── 4. Google Contacts ──────────────────────────────────────────────────────────────────────────────────────

test("google contacts: a dismissed entry is never stored", async () => {
  const store = new MemoryStore()
  const leads = new FakeLeadPath()
  const r = await triageActivity(store, leads, { activity: googleContact(), decision: "dismiss", actor: "a@434media.com" }, COHORTS)
  assert.equal(r.stored, false)
  assert.equal(store.writes, 0)
  assert.equal(store.people.size + store.activities.size + store.triage.size, 0)
  assert.equal(leads.calls.length, 0)
})

test("google contacts: a saved entry is stored as one Person and one Activity, with no consent", async () => {
  const store = new MemoryStore()
  const r = await triageActivity(store, new FakeLeadPath(), { activity: googleContact(), decision: "save", actor: "a@434media.com" }, COHORTS)
  assert.equal(r.stored, true)
  assert.equal(store.people.size, 1)
  assert.equal(store.activities.size, 1)
  const person = [...store.people.values()][0]
  assert.equal(person.lifecycle_stage, "contact")
  assert.equal(person.consent.email.status, "none")
  assert.equal(store.orgs.size, 1, "the company domain makes an Organization")
})

test("google contacts: a promoted entry becomes a lead through the lead path", async () => {
  const store = new MemoryStore()
  const leads = new FakeLeadPath("lead-9")
  const r = await triageActivity(store, leads, { activity: googleContact(), decision: "promote", actor: "a@434media.com" }, COHORTS)
  assert.equal(r.leadId, "lead-9")
  assert.equal(leads.calls.length, 1)
  assert.equal([...store.people.values()][0].lifecycle_stage, "lead")
})

// ── Triage of other arrivals ────────────────────────────────────────────────────────────────────────────────

test("triage: promote moves the stage to lead and creates the lead through the existing path", async () => {
  const store = new MemoryStore()
  const leads = new FakeLeadPath("lead-7")
  const activity = formActivity()
  const r = await triageActivity(store, leads, { activity, decision: "promote", actor: "a@434media.com" }, COHORTS)
  assert.equal(r.leadId, "lead-7")
  assert.equal(r.person?.lifecycle_stage, "lead")
  assert.equal(store.triage.get(activity.id)?.decision, "promote")
  assert.equal(store.triage.get(activity.id)?.lead_id, "lead-7")
})

test("triage: a failed lead path records no triage, so the item stays in the inbox", async () => {
  const store = new MemoryStore()
  const activity = formActivity()
  await assert.rejects(triageActivity(store, new FakeLeadPath(null), { activity, decision: "promote", actor: "a" }, COHORTS), CoreRuleError)
  assert.equal(store.triage.size, 0)
})

test("triage: dismissing an old form writes only the triage record, never the old collection", async () => {
  const store = new MemoryStore()
  const activity = formActivity()
  await triageActivity(store, new FakeLeadPath(), { activity, decision: "dismiss", actor: "a" }, COHORTS)
  assert.equal(store.writes, 1)
  assert.equal(store.triage.get(activity.id)?.decision, "dismiss")
  assert.equal(store.people.size, 0)
})

test("triage: an item cannot be triaged twice", async () => {
  const store = new MemoryStore()
  const activity = formActivity()
  await triageActivity(store, new FakeLeadPath(), { activity, decision: "save", actor: "a" }, COHORTS)
  await assert.rejects(triageActivity(store, new FakeLeadPath(), { activity, decision: "dismiss", actor: "a" }, COHORTS), /already/)
})

test("triage: the lead path is the existing one, reached from the Firestore store", () => {
  const src = read("lib/core-model/firestore-store.ts")
  assert.match(src, /captureLeadFromContactForm/)
  assert.match(src, /createLead/)
  assert.match(src, /findLeadByEmail/)
})

// ── 5. Duplicates and merges ────────────────────────────────────────────────────────────────────────────────

test("duplicates: one Person per email, whatever the case or spacing", async () => {
  const store = new MemoryStore()
  const a = await ensurePerson(store, { contact: { email: "Ana@AlamoLabs.test", name: "Ana" }, source: "web", at: AT })
  const b = await ensurePerson(store, { contact: { email: "  ana@alamolabs.test " }, source: "manual", at: AT })
  assert.equal(a.person.id, b.person.id)
  assert.equal(store.people.size, 1)
})

test("duplicates: the store refuses a second Person on a held email", async () => {
  const store = new MemoryStore()
  await ensurePerson(store, { contact: { email: "a@b.test", name: "A" }, source: "web", at: AT })
  await assert.rejects(
    store.createPerson({
      name: "B",
      emails: ["a@b.test"],
      phones: [],
      lifecycle_stage: "contact",
      roles: [],
      consent: consentFromSource("web", AT),
      source: "web",
      visibility: "business",
      legacy_refs: [],
    }),
    DuplicateError,
  )
})

test("duplicates: one Organization per domain; free mail makes none", async () => {
  const store = new MemoryStore()
  const a = await ensureOrganization(store, { name: "Alamo Labs", email: "ana@alamolabs.test" }, COHORTS)
  const b = await ensureOrganization(store, { name: "Alamo Labs Inc", website: "https://www.AlamoLabs.test/about" }, COHORTS)
  assert.equal(a?.id, b?.id)
  assert.equal(await ensureOrganization(store, { name: "Gmail person", email: "x@gmail.com" }, COHORTS), null)
  assert.equal(domainFromEmail("x@gmail.com"), "")
  assert.equal(normalizeDomain("https://www.example.com:443/x"), "example.com")
})

test("duplicates: nothing merges on its own; mergePeople is explicit, logged and keeps the absorbed record", async () => {
  const store = new MemoryStore()
  const { person: keep } = await ensurePerson(store, { contact: { email: "ana@alamolabs.test", name: "Ana" }, source: "web", at: AT })
  const { person: other } = await ensurePerson(store, { contact: { email: "x@gmail.com", name: "Ana Reyes" }, source: "manual", at: AT })
  assert.equal(store.people.size, 2, "different emails are different People until someone merges them")
  assert.equal(store.merges.length, 0)
  const merged = await mergePeople(store, keep.id, other.id, "founder@434media.com")
  assert.deepEqual(merged.emails.sort(), ["x@gmail.com", "ana@alamolabs.test"])
  assert.equal(store.people.get(other.id)?.merged_into, keep.id)
  assert.equal(store.merges.length, 1)
  assert.equal(store.merges[0].by, "founder@434media.com")
  assert.equal((await store.findPersonByEmail("x@gmail.com"))?.id, keep.id)
})

test("duplicates: a merge keeps a withdrawal from either side", async () => {
  const store = new MemoryStore()
  const { person: a } = await ensurePerson(store, { contact: { email: "a@x.test", name: "A" }, source: "web", at: AT })
  const { person: b } = await ensurePerson(store, { contact: { email: "b@x.test", name: "B" }, source: "manual", at: AT })
  await store.updatePerson(b.id, { consent: { email: { status: "withdrawn", basis: "withdrawn", source: "web", at: AT } } })
  const kept = await mergePeople(store, a.id, b.id, "x")
  assert.equal(kept.consent.email.status, "withdrawn")
})

// ── 6. Visibility ───────────────────────────────────────────────────────────────────────────────────────────

test("visibility: business by default; restricted is full admins only", () => {
  assert.equal(normalizeVisibility(undefined), "business")
  assert.equal(normalizeVisibility("nonsense"), "business")
  for (const role of ["crm_only", "intern"] as const) {
    assert.equal(canSee({ visibility: "business" }, { role }), true)
    assert.equal(canSee({ visibility: "restricted" }, { role }), false)
  }
  for (const role of ["full_admin", "crm_super_admin"] as const) assert.equal(canSee({ visibility: "restricted" }, { role }), true)
  assert.equal(canSee({ visibility: "restricted" }, { role: "intern", superAdmin: true }), true)
})

test("visibility: every core read route filters by it", () => {
  for (const p of [
    "app/api/admin/core/people/route.ts",
    "app/api/admin/core/people/[id]/route.ts",
    "app/api/admin/core/organizations/route.ts",
    "app/api/admin/core/organizations/[id]/route.ts",
    "app/api/admin/core/inbox/route.ts",
  ]) {
    assert.match(read(p), /canSee|visibleOnly|getVisibleCoreView/, p)
  }
})

// ── 7. Read-time adapters ───────────────────────────────────────────────────────────────────────────────────

test("adapters: a lead becomes a Person at the lead stage, keeping its id and source", () => {
  const b = adaptLead(lead({ id: "abc", source: "prospected", country: "US", location: "Austin, TX" }))
  const p = b.people[0]
  assert.equal(p.lifecycle_stage, "lead")
  assert.equal(p.source, "prospected")
  assert.deepEqual(p.legacy_refs, [{ collection: "leads", id: "abc" }])
  assert.equal(p.consent.email.status, "none")
  assert.equal(adaptLead(lead({ status: "converted" })).people[0].lifecycle_stage, "customer")
  assert.equal(b.activities[0].triaged, true, "a lead is already in the pipeline, not an inbox item")
})

test("adapters: a client becomes an Organization with the client role and its contacts become People", () => {
  const client = {
    id: "C1",
    name: "Pat Lee",
    company_name: "River City Health",
    email: "pat@rivercityhealth.test",
    website: "https://rivercityhealth.test",
    status: "active",
    contacts: [{ id: "k1", first_name: "Jo", last_name: "Diaz", email: "jo@rivercityhealth.test", role: "Finance" }],
    created_at: AT,
    updated_at: AT,
  } as unknown as ClientRecord
  const b = adaptClient(client)
  assert.equal(b.organizations[0].domain, "rivercityhealth.test")
  assert.deepEqual(b.organizations[0].roles, ["client"])
  assert.equal(b.people.length, 2)
  assert.ok(b.affiliations.every((a) => a.role === "client" && a.organization_id === "client:C1"))
  assert.equal(adaptClient({ ...client, is_opportunity: true }).organizations.length, 0, "opportunity rows are item 8")
})

test("adapters: an AIM submission keeps its named-database id", () => {
  assert.deepEqual(contactFormLegacyRef({ id: "aimsatx:zz9" }), { collection: "aimsatx/contact_submissions", id: "zz9" })
  assert.deepEqual(contactFormLegacyRef({ id: "abc" }), { collection: "contact_forms", id: "abc" })
  assert.equal(adaptContactForm(contactForm({ id: "aimsatx:zz9", source: "AIM" }), false).activities[0].id, "contact_forms:aimsatx:zz9")
})

test("adapters: a form already handled in the old inbox is not an untriaged item", () => {
  assert.equal(adaptContactForm(contactForm(), true).activities[0].triaged, true)
  assert.equal(adaptContactForm(contactForm({ promotedLeadId: "L1" }), false).activities[0].triaged, true)
  assert.equal(adaptContactForm(contactForm(), false).activities[0].triaged, false)
})

test("assemble: a lead and a form with one email are one Person, with both old ids kept", () => {
  const view = assembleCoreView(emptyBundle(), [adaptLead(lead({ id: "L1" })), adaptContactForm(contactForm(), false)], new Set())
  assert.equal(view.people.length, 1)
  const p = view.people[0]
  assert.deepEqual(p.legacy_refs.map((r) => r.collection).sort(), ["contact_forms", "leads"])
  assert.equal(p.lifecycle_stage, "lead", "the stage only moves forward")
  assert.equal(view.organizations.length, 1, "one domain, one Organization")
  const inbox = inboxOf(view)
  assert.equal(inbox.length, 1)
  assert.equal(inbox[0].person_id, p.id)
})

test("assemble: a stored Person wins over the old record it matches", () => {
  const stored = emptyBundle()
  stored.people.push({
    id: "P1",
    name: "Ana R.",
    emails: ["ana@alamolabs.test"],
    phones: [],
    lifecycle_stage: "contact",
    roles: [],
    consent: consentFromSource("web", AT),
    source: "web",
    visibility: "restricted",
    legacy_refs: [],
    created_at: AT,
    updated_at: AT,
  })
  const view = assembleCoreView(stored, [adaptLead(lead())], new Set())
  assert.equal(view.people.length, 1)
  assert.equal(view.people[0].id, "P1")
  assert.equal(view.people[0].visibility, "restricted")
  assert.equal(view.people[0].lifecycle_stage, "lead")
})

test("assemble: a triage record takes an item out of the inbox; merged-away People point at the kept one", () => {
  const form = adaptContactForm(contactForm(), false)
  const id = form.activities[0].id
  assert.equal(inboxOf(assembleCoreView(emptyBundle(), [form], new Set([id]))).length, 0)
  const stored = emptyBundle()
  const base = { phones: [], lifecycle_stage: "contact" as const, roles: [], consent: consentFromSource("web", AT), source: "web" as const, visibility: "business" as const, legacy_refs: [], created_at: AT, updated_at: AT }
  stored.people.push({ ...base, id: "K", name: "Kept", emails: ["k@x.test", "old@x.test"] })
  stored.people.push({ ...base, id: "M", name: "Merged", emails: ["old@x.test"], merged_into: "K" })
  stored.activities.push({ id: "A1", type: "note", source: "manual", occurred_at: AT, contact: {}, person_id: "M", summary: "n", triaged: true, created_at: AT })
  const view = assembleCoreView(stored, [], new Set())
  assert.deepEqual(view.people.map((p) => p.id), ["K"])
  assert.equal(view.activities[0].person_id, "K")
})

test("identity: matching ignores merged-away records", () => {
  const people = [{ emails: ["a@x.test"], merged_into: "K" }, { emails: ["a@x.test"] }]
  assert.equal(matchPerson(people, "A@x.test"), people[1])
})

// ── 8. Scoring on arrival, one rubric ───────────────────────────────────────────────────────────────────────

test("scoring: an Organization is scored by the shared rubric on arrival", async () => {
  const org = { name: "Alamo Labs", location: "San Antonio, TX", employee_count: 120 }
  const scored = scoreOrganization(org, COHORTS, AT)
  const direct = scoreIcpFit({ orgName: org.name, location: org.location, employeeCount: org.employee_count, cohorts: COHORTS })
  assert.equal(scored.icp_fit_score, direct.fit)
  assert.equal(scored.icp_grade, direct.grade)
  const store = new MemoryStore()
  const created = await ensureOrganization(store, { name: "Alamo Labs", email: "a@alamolabs.test", location: "San Antonio, TX" }, COHORTS)
  assert.equal(typeof created?.icp_fit_score, "number")
  assert.ok(created?.icp_grade)
})

test("scoring: there is no second scorer in the core model", () => {
  for (const f of ["score.ts", "service.ts", "read.ts"]) {
    const src = read(`lib/core-model/${f}`)
    assert.doesNotMatch(src, /function scoreIndustry|function scoreLocation|ICP_DIMENSIONS/, f)
  }
  assert.match(read("lib/core-model/score.ts"), /from "@\/lib\/icp\/rubric"/)
})

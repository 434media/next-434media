/**
 * Offline. The company lookup (V1 item 4, "Then the company lookup") and 434's own company:
 *   1. a domain is looked up once, never twice (stored on the Organization; a concurrent run is refused);
 *   2. free-mail and 434's own domains are skipped;
 *   3. a personal contact, a private one, and the founder's Google Contacts import are never looked up;
 *   4. the daily cap and the per-run cap hold;
 *   5. the grade uses the enriched company (the shared rubric, rescored);
 *   6. the lookup writes only to the Organization, never a Person, and never overwrites a person's value;
 *   7. 434's own domain is never a prospect or client, and is never scored;
 *   8. an Organization's domain can be corrected (the old domain is released), and each read-time Organization takes
 *      its name and domain from one source record (the domain-swap investigation).
 *
 * Run: tsx --test lib/__tests__/company-lookup.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { ApolloPerson } from "../prospecting/apollo"
import type { ClientRecord, Lead } from "../../types/crm-types"
import type { CompanyLookupMark, InboxItem, Organization } from "../../types/core-model"
import {
  fieldsFromApollo,
  isThin,
  lookupCompanies,
  lookupCompany,
  lookupGate,
  type CompanyLookupDeps,
  type CompanyLookupStore,
  type LookupCandidate,
  type LookupLogEntry,
  candidatesFromInbox,
} from "../core-model/company-lookup"
import { isOwnDomain } from "../core-model/identity"
import { adaptClient, adaptLead, emptyBundle } from "../core-model/adapters"
import { assembleCoreView } from "../core-model/assemble"
import { recordArrival } from "../core-model/service"
import { scoreIcpFit } from "../icp/rubric"
import { MemoryStore } from "./helpers/core-memory-store"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")
const AT = "2026-11-14T15:00:00.000Z"

/** The lookup's store over the in-memory core store, with the daily count, the per-domain mark and the log. */
class LookupStore implements CompanyLookupStore {
  core = new MemoryStore()
  days = new Map<string, number>()
  logs: LookupLogEntry[] = []
  writes: string[] = []
  findOrganizationByDomain = (d: string) => this.core.findOrganizationByDomain(d)
  async createOrganization(input: Parameters<MemoryStore["createOrganization"]>[0]) {
    this.writes.push("createOrganization")
    return this.core.createOrganization(input)
  }
  async updateOrganization(id: string, patch: Parameters<MemoryStore["updateOrganization"]>[1]) {
    this.writes.push("updateOrganization")
    return this.core.updateOrganization(id, patch)
  }
  async reserve(orgId: string, day: string, cap: number, at: string) {
    const org = this.core.orgs.get(orgId) as Organization
    const mark = org.company_lookup
    if (mark && mark.status !== "error" && mark.status !== "pending") return "done" as const
    if (mark?.status === "pending") return "in_progress" as const
    const count = this.days.get(day) ?? 0
    if (count >= cap) return "daily_cap" as const
    this.days.set(day, count + 1)
    this.core.orgs.set(orgId, { ...org, company_lookup: { status: "pending", source: "apollo", at, credits: 0 } })
    return "ok" as const
  }
  async log(entry: LookupLogEntry) {
    this.logs.push(entry)
  }
}

/** A store that refuses any method the lookup has no business calling (a Person method above all). */
function guarded(store: LookupStore): CompanyLookupStore {
  const allowed = new Set(["findOrganizationByDomain", "createOrganization", "updateOrganization", "reserve", "log"])
  return new Proxy(store, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && !allowed.has(prop)) throw new Error(`lookup touched ${prop}`)
      const v = Reflect.get(target, prop, receiver)
      return typeof v === "function" ? v.bind(target) : v
    },
  }) as unknown as CompanyLookupStore
}

function apollo(domain: string, over: Partial<NonNullable<ApolloPerson["organization"]>> = {}): ApolloPerson {
  return {
    id: "p1",
    first_name: "Ana",
    organization: {
      id: `apollo-${domain}`,
      name: "Alamo Health Labs",
      website_url: `https://www.${domain}`,
      industry: "hospital & health care",
      estimated_num_employees: 250,
      annual_revenue: 40_000_000,
      city: "San Antonio",
      state: "Texas",
      country: "United States",
      ...over,
    },
  }
}

function setup(opts: { cap?: number; match?: (email: string) => ApolloPerson | null } = {}) {
  const store = new LookupStore()
  const calls: string[] = []
  const deps: CompanyLookupDeps = {
    store: guarded(store),
    enrich: async (email) => {
      calls.push(email)
      return opts.match ? opts.match(email) : apollo(email.split("@")[1])
    },
    cohorts: [],
    now: () => AT,
    dailyCap: opts.cap ?? 20,
  }
  return { store, deps, calls }
}

const arrival = (email: string, over: Partial<LookupCandidate> = {}): LookupCandidate => ({
  email,
  company: "Alamo Labs",
  source: "web",
  relationship: "business",
  ...over,
})

// ── 1. Once per domain ───────────────────────────────────────────────────────────────────────────────────────

test("once: a domain is looked up once, and a second arrival on it spends nothing", async () => {
  const { store, deps, calls } = setup()
  const first = await lookupCompany(deps, arrival("ana@alamolabs.test"), "arrival")
  assert.equal(first.status, "matched")
  const second = await lookupCompany(deps, arrival("ben@alamolabs.test"), "arrival")
  assert.deepEqual(second, { domain: "alamolabs.test", status: "skipped", reason: "already_looked_up" })
  assert.deepEqual(calls, ["ana@alamolabs.test"])
  const org = await store.core.findOrganizationByDomain("alamolabs.test")
  assert.equal(org?.company_lookup?.status, "matched")
  assert.equal(org?.company_lookup?.credits, 1)
})

test("once: a no-match is final too (never retried); a failed call is not, and spends no credit", async () => {
  const none = setup({ match: () => null })
  assert.equal((await lookupCompany(none.deps, arrival("a@quiet.test"), "sweep")).status, "no_match")
  assert.equal((await lookupCompany(none.deps, arrival("b@quiet.test"), "sweep")).status, "skipped")
  assert.equal(none.calls.length, 1)

  const failing = setup()
  failing.deps.enrich = async () => {
    throw new Error("Apollo 500")
  }
  const out = await lookupCompany(failing.deps, arrival("a@flaky.test"), "sweep")
  assert.equal(out.status, "error")
  assert.equal(failing.store.logs[0].credits, 0)
  failing.deps.enrich = async (e) => apollo(e.split("@")[1])
  assert.equal((await lookupCompany(failing.deps, arrival("a@flaky.test"), "sweep")).status, "matched", "an error may be retried")
})

test("once: a lookup in flight (pending) refuses a second run on the same domain", async () => {
  const { store, deps, calls } = setup()
  const org = await store.core.createOrganization({ name: "X", domain: "busy.test", roles: [], visibility: "business", legacy_refs: [] })
  const mark: CompanyLookupMark = { status: "pending", source: "apollo", at: AT, credits: 0 }
  store.core.orgs.set(org.id, { ...org, company_lookup: mark })
  const out = await lookupCompany(deps, arrival("a@busy.test"), "sweep")
  assert.deepEqual(out, { domain: "busy.test", status: "skipped", reason: "in_progress" })
  assert.equal(calls.length, 0)
})

test("once: the result is stored on the Organization claimed by its domain, and the Firestore reserve is a transaction", () => {
  const src = read("lib/core-model/company-lookup-server.ts")
  assert.match(src, /runTransaction/)
  assert.match(src, /COMPANY_LOOKUP_DAYS/)
  assert.match(src, /company_lookup: \{ status: "pending"/)
  assert.match(src, /findOrganizationByDomain: firestoreCoreStore\.findOrganizationByDomain/)
})

test("once: a company that is not thin is not looked up", async () => {
  const { store, deps, calls } = setup()
  await store.core.createOrganization({
    name: "Known Co",
    domain: "known.test",
    industry: "marketing & advertising",
    employee_count: 40,
    roles: [],
    visibility: "business",
    legacy_refs: [],
  })
  assert.deepEqual(await lookupCompany(deps, arrival("a@known.test"), "sweep"), { domain: "known.test", status: "skipped", reason: "not_thin" })
  assert.equal(calls.length, 0)
  assert.equal(isThin({ industry: "x" }), true, "no size and no revenue is thin")
  assert.equal(isThin({ employee_count: 5 }), true, "no industry is thin")
})

// ── 2. Free-mail and 434's own domains ───────────────────────────────────────────────────────────────────────

test("skip: free-mail addresses and 434's own domains are never looked up", async () => {
  const { deps, calls, store } = setup()
  for (const email of ["ana@gmail.com", "ana@yahoo.com", "ana@icloud.com", "marcos@434media.com", "x@send.434media.com"]) {
    const out = await lookupCompany(deps, arrival(email), "sweep")
    assert.equal(out.status, "skipped", email)
  }
  assert.equal(lookupGate(arrival("a@gmail.com")).hasOwnProperty("reason"), true)
  assert.deepEqual(lookupGate(arrival("a@434media.com")), { reason: "own_domain", domain: "434media.com" })
  assert.equal(calls.length, 0)
  assert.equal(store.writes.length, 0, "nothing is even created for a skipped address")
})

// ── 3. Never personal ────────────────────────────────────────────────────────────────────────────────────────

test("personal: a personal or private contact, and the Google Contacts import, are never looked up", async () => {
  const { deps, calls, store } = setup()
  const cases: LookupCandidate[] = [
    arrival("a@friendco.test", { relationship: "personal" }),
    arrival("a@friendco.test", { visibility: "private" }),
    arrival("a@friendco.test", { source: "google_contacts", relationship: "business" }),
  ]
  for (const c of cases) assert.equal((await lookupCompany(deps, c, "sweep")).status, "skipped")
  assert.equal(calls.length, 0)
  assert.equal(store.writes.length, 0)
})

test("personal: an Organization known only from a private contact is not looked up", async () => {
  const { deps, calls, store } = setup()
  await store.core.createOrganization({ name: "Friend Co", domain: "friendco.test", roles: [], visibility: "private", legacy_refs: [] })
  assert.equal((await lookupCompany(deps, arrival("a@friendco.test"), "sweep")).status, "skipped")
  assert.equal(calls.length, 0)
})

test("personal: the sweep's candidates carry the Person's relationship, so a personal inbox entry is gated out", async () => {
  const item = (over: Partial<InboxItem>): InboxItem => ({
    activity: {
      id: "a1",
      type: "google_contact",
      source: "google_contacts",
      occurred_at: AT,
      contact: { email: "pal@palco.test", company: "Pal Co" },
      summary: "",
      triaged: false,
      created_at: AT,
    },
    ...over,
  })
  const cands = candidatesFromInbox([
    item({}),
    item({
      activity: { ...item({}).activity, id: "a2", source: "web", type: "form_submission", relationship: "personal" },
    }),
  ])
  const { deps, calls } = setup()
  const r = await lookupCompanies(deps, cands, { trigger: "sweep", maxPerRun: 10 })
  assert.equal(r.lookedUp, 0)
  assert.equal(calls.length, 0)
})

// ── 4. Caps ──────────────────────────────────────────────────────────────────────────────────────────────────

test("cap: the daily cap holds across runs, and a reached cap ends the run", async () => {
  const { deps, calls, store } = setup({ cap: 2 })
  const batch = ["a@one.test", "a@two.test", "a@three.test", "a@four.test"].map((e) => arrival(e))
  const r = await lookupCompanies(deps, batch, { trigger: "sweep", maxPerRun: 10 })
  assert.equal(r.lookedUp, 2)
  assert.equal(calls.length, 2)
  assert.ok(r.outcomes.some((o) => o.status === "skipped" && o.reason === "daily_cap"))
  const again = await lookupCompanies(deps, [arrival("a@five.test")], { trigger: "sweep", maxPerRun: 10 })
  assert.equal(again.lookedUp, 0, "a second run the same day is still capped")
  assert.equal(store.days.get(AT.slice(0, 10)), 2)
})

test("cap: the per-run cap holds, and a domain twice in one batch is tried once", async () => {
  const { deps, calls } = setup()
  const batch = ["a@one.test", "b@one.test", "a@two.test", "a@three.test"].map((e) => arrival(e))
  const r = await lookupCompanies(deps, batch, { trigger: "sweep", maxPerRun: 2 })
  assert.equal(r.lookedUp, 2)
  assert.deepEqual(calls, ["a@one.test", "a@two.test"])
  assert.ok(r.outcomes.some((o) => o.status === "skipped" && o.reason === "run_cap"))
})

test("cap: every lookup is logged with the credits it spent, and a match also reaches the Apollo credit log", async () => {
  const { deps, store } = setup({ match: (e) => (e.startsWith("hit") ? apollo(e.split("@")[1]) : null) })
  await lookupCompanies(deps, [arrival("hit@one.test"), arrival("miss@two.test")], { trigger: "sweep", maxPerRun: 10 })
  assert.deepEqual(
    store.logs.map((l) => [l.domain, l.status, l.credits]),
    [
      ["one.test", "matched", 1],
      ["two.test", "no_match", 0],
    ],
  )
  const src = read("lib/core-model/company-lookup-server.ts")
  assert.match(src, /enrichByEmail\(email, \{ userEmail: COMPANY_LOOKUP_ACTOR \}\)/, "the credit-log context is passed")
  assert.ok(JSON.parse(read("vercel.json")).crons.some((c: { path: string }) => c.path === "/api/cron/company-lookup"))
})

// ── 5. The grade uses the enriched company ───────────────────────────────────────────────────────────────────

test("grade: the Organization is rescored with the shared rubric on the company Apollo found", async () => {
  const { store, deps } = setup()
  await lookupCompany(deps, arrival("ana@alamolabs.test"), "arrival")
  const org = (await store.core.findOrganizationByDomain("alamolabs.test")) as Organization
  const expected = scoreIcpFit({
    industry: "hospital & health care",
    orgName: "Alamo Labs",
    location: "San Antonio, Texas, United States",
    employeeCount: 250,
    annualRevenue: 40_000_000,
    cohorts: [],
  })
  assert.equal(org.icp_fit_score, expected.fit)
  assert.equal(org.icp_grade, expected.grade)
  const before = scoreIcpFit({ orgName: "Alamo Labs", cohorts: [] })
  assert.ok(expected.fit > before.fit, `enriched fit ${expected.fit} beats the thin fit ${before.fit}`)
})

test("grade: the inbox shows the looked-up company's grade (the stored Organization absorbs the form's by domain)", async () => {
  const { store, deps } = setup()
  await lookupCompany(deps, arrival("ana@alamolabs.test"), "arrival")
  const stored = (await store.core.findOrganizationByDomain("alamolabs.test")) as Organization
  const view = assembleCoreView(
    { ...emptyBundle(), organizations: [stored] },
    [adaptLead({ id: "L1", name: "Ana", company: "Alamo Labs", email: "ana@alamolabs.test", source: "web", status: "new", created_at: AT, updated_at: AT } as Lead)],
    new Set(),
  )
  const act = view.activities[0]
  assert.equal(act.organization_id, stored.id)
  assert.equal(view.organizations.find((o) => o.id === stored.id)?.icp_grade, stored.icp_grade)
})

test("grade: Apollo's company on a different domain fills nothing (mismatch), and the credit is still logged", async () => {
  const { store, deps } = setup({ match: () => apollo("elsewhere.test") })
  const out = await lookupCompany(deps, arrival("ana@alamolabs.test"), "arrival")
  assert.equal(out.status, "mismatch")
  const org = (await store.core.findOrganizationByDomain("alamolabs.test")) as Organization
  assert.equal(org.industry, undefined)
  assert.equal(store.logs[0].credits, 1)
})

// ── 6. Organization only ─────────────────────────────────────────────────────────────────────────────────────

test("organization only: the lookup's store has no Person method, and it only creates or updates the Organization", async () => {
  const { store, deps } = setup()
  await lookupCompany(deps, arrival("ana@alamolabs.test"), "arrival")
  assert.deepEqual(store.writes, ["createOrganization", "updateOrganization"])
  assert.equal(store.core.people.size, 0)
  const src = read("lib/core-model/company-lookup.ts")
  assert.doesNotMatch(src, /updatePerson|createPerson|address_book/)
})

test("organization only: a value a person entered is never overwritten; a real name is kept", () => {
  const org: Organization = {
    id: "o1",
    name: "Alamo Labs",
    domain: "alamolabs.test",
    industry: "Biotech",
    roles: [],
    visibility: "business",
    legacy_refs: [],
    created_at: AT,
    updated_at: AT,
  }
  const f = fieldsFromApollo(org, apollo("alamolabs.test"))
  assert.equal(f.industry, undefined)
  assert.equal(f.name, undefined)
  assert.equal(f.employee_count, 250)
  assert.equal(fieldsFromApollo({ ...org, name: "alamolabs.test" }, apollo("alamolabs.test")).name, "Alamo Health Labs", "a placeholder name is replaced")
})

// ── 7. 434's own company ─────────────────────────────────────────────────────────────────────────────────────

test("own: 434media.com (and its subdomains) is 434's own domain", () => {
  assert.equal(isOwnDomain("434media.com"), true)
  assert.equal(isOwnDomain("send.434media.com"), true)
  assert.equal(isOwnDomain("not434media.com"), false)
})

test("own: a stored record on 434media.com with the prospect role no longer shows as a prospect, and is not scored", () => {
  const stored: Organization = {
    id: "o434",
    name: "434 MEDIA",
    domain: "434media.com",
    roles: ["prospect"],
    icp_fit_score: 0,
    icp_grade: "D",
    visibility: "business",
    legacy_refs: [],
    created_at: AT,
    updated_at: AT,
  }
  const view = assembleCoreView(
    { ...emptyBundle(), organizations: [stored] },
    [adaptLead({ id: "L9", name: "Jesse", company: "434 MEDIA", email: "jesse@434media.com", source: "web", status: "new", created_at: AT, updated_at: AT } as Lead)],
    new Set(),
  )
  const o = view.organizations.find((x) => x.id === "o434") as Organization
  assert.deepEqual(o.roles, [])
  assert.equal(o.own, true)
  assert.equal(o.icp_grade, undefined)
  assert.ok(view.affiliations.every((a) => a.role === "works_at"), "nobody is a prospect of 434")
  assert.equal(stored.roles[0], "prospect", "the stored record itself is untouched")
  assert.match(read("lib/core-model/read.ts"), /o\.own \|\| typeof o\.icp_fit_score/)
})

test("own: a client row or lead on 434media.com never takes the prospect or client role", () => {
  const client = adaptClient({ id: "c1", company_name: "434 MEDIA", email: "marcos@434media.com", status: "active" } as ClientRecord)
  assert.deepEqual(client.organizations[0].roles, [])
  const lead = adaptLead({ id: "L1", name: "Jesse", company: "434", email: "jesse@434media.com", source: "web", status: "new", created_at: AT, updated_at: AT } as Lead)
  assert.deepEqual(lead.organizations[0].roles, [])
})

test("own: an arrival from a 434 address creates no prospect Organization and no prospect link", async () => {
  const store = new MemoryStore()
  const r = await recordArrival(
    store,
    { type: "note", source: "web", occurred_at: AT, contact: { name: "Jesse", email: "jesse@434media.com", company: "434 MEDIA" }, summary: "hi" },
    [],
  )
  assert.deepEqual(r.organization?.roles, [])
  assert.equal(r.organization?.icp_grade, undefined)
  assert.ok([...store.affs.values()].every((a) => a.role === "works_at"))
})

// ── 8. The domain swap ───────────────────────────────────────────────────────────────────────────────────────

test("swap: each read-time Organization takes its name and domain from the same record, never from another", () => {
  // Two clients, each correct: no read path pairs one record's name with the other's domain.
  const a = adaptClient({ id: "a", company_name: "8020 Foundation (weston urban)", website: "8020foundation.com", status: "active" } as ClientRecord)
  const b = adaptClient({ id: "b", company_name: "911 Medical Devices", website: "911medicaldevices.com", status: "active" } as ClientRecord)
  const view = assembleCoreView(emptyBundle(), [a, b], new Set())
  const byName = new Map(view.organizations.map((o) => [o.name, o.domain]))
  assert.equal(byName.get("8020 Foundation (weston urban)"), "8020foundation.com")
  assert.equal(byName.get("911 Medical Devices"), "911medicaldevices.com")
  // A record whose contact email is at the other company gets that company's domain: the data, not the code.
  const crossed = adaptClient({
    id: "c",
    company_name: "8020 Foundation (weston urban)",
    status: "active",
    contacts: [{ id: "k", name: "Pat", email: "pat@911medicaldevices.com" }],
  } as unknown as ClientRecord)
  assert.equal(crossed.organizations[0].domain, "911medicaldevices.com")
})

test("swap: changing a saved Organization's domain releases the old one, and the drawer can edit it", () => {
  const src = read("lib/firestore-organizations.ts")
  assert.match(src, /previous !== domain/)
  assert.match(src, /tx\.delete\(oldClaim\)/)
  assert.match(src, /oldSnap\.data\(\)\?\.organization_id === id/, "only a claim this Organization holds is released")
  const ui = read("components/admin/people/PeopleWorkspace.tsx")
  assert.match(ui, /function DomainEdit/)
  assert.match(ui, /method: "PATCH", body: JSON\.stringify\(\{ domain:/)
})

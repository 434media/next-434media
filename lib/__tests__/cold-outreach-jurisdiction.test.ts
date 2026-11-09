/**
 * Offline. Cold outbound is sent only to prospects in the United States (master 5.3): one US allow-list in
 * lib/prospecting/scorer.ts, failing closed, gates every cold path (security log Entry 40, JUR-1 and JUR-2). Cold
 * leads are "prospected" and "partner"; warm and inbound leads are not gated. A cold lead's gate inputs (source,
 * country, location) are locked against edits. The routes and the sequence engine import Firestore, so their wiring is checked
 * from source: each calls the gate before it sends or enrols.
 *
 * Run: tsx --test lib/__tests__/cold-outreach-jurisdiction.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  COLD_LEAD_SOURCES,
  coldGateEditRefusal,
  coldOutreachGateForLead,
  coldOutreachJurisdiction,
  isColdLocationAllowed,
  isColdOutreachAllowed,
  isOutsideUnitedStates,
  resolveCountryCode,
  scoreCandidate,
} from "../prospecting/scorer"
import type { ApolloPerson } from "../prospecting/apollo"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")

// ── The allow-list ────────────────────────────────────────────────────────────────────────────────────────────────

test("United States variants are allowed", () => {
  for (const v of ["US", "USA", "United States", "united states of america", " u.s.a. ", "U.S.", "us", "Estados Unidos", "Vereinigte Staaten"]) {
    const r = isColdOutreachAllowed(v)
    assert.equal(r.allowed, true, v)
    assert.equal(r.country, "US", v)
  }
})

test("other countries are blocked, by code, English name or native name", () => {
  const cases: Array<[string, string]> = [
    ["DE", "DE"], ["Deutschland", "DE"], ["Germany", "DE"], ["germany ", "DE"],
    ["CA", "CA"], ["Canada", "CA"], ["GB", "GB"], ["UK", "GB"], ["United Kingdom", "GB"], ["England", "GB"],
    ["Mexico", "MX"], ["México", "MX"], ["España", "ES"], ["FR", "FR"], ["Puerto Rico", "PR"],
  ]
  for (const [v, code] of cases) {
    const r = isColdOutreachAllowed(v)
    assert.equal(r.allowed, false, v)
    assert.equal(r.country, code, v)
    assert.match(r.reason, /only to prospects in the United States/, v)
  }
})

test("blank, null and unreadable countries are blocked (fail closed)", () => {
  for (const v of ["", "   ", null, undefined, "Unknown", "Unknown Region", "N/A", "ZZ", "XYZ", "Earth"]) {
    const r = isColdOutreachAllowed(v)
    assert.equal(r.allowed, false, String(v))
    assert.equal(r.country, undefined, String(v))
  }
  assert.equal(resolveCountryCode("Unknown"), null)
})

test("locations: a US state or 'US' reads as the United States; anything else is blocked", () => {
  for (const l of ["Texas, US", "San Antonio, Texas, US", "San Antonio, Texas", "Texas", "New Mexico", "Georgia", "Austin, TX", "United States"]) {
    assert.equal(isColdLocationAllowed(l).allowed, true, l)
    assert.equal(isOutsideUnitedStates(l), false, l)
  }
  // "CA" and "DE" are both state and country codes: unreadable, so blocked.
  for (const l of ["Mexico", "Monterrey, Mexico", "Germany", "Toronto, Canada", "United Kingdom", "Berlin, Deutschland", "Los Angeles, CA", "Wilmington, DE", "San Antonio", "", "Unknown", "Puerto Rico"]) {
    assert.equal(isColdLocationAllowed(l).allowed, false, l)
    assert.equal(isOutsideUnitedStates(l), true, l)
  }
})

// ── Prospecting candidates ────────────────────────────────────────────────────────────────────────────────────────

const person = (over: Partial<ApolloPerson> = {}, org: ApolloPerson["organization"] = {}): ApolloPerson => ({
  id: "p1",
  first_name: "Pat",
  title: "CEO",
  ...over,
  organization: { name: "Example Co", ...org },
})

test("candidate: strict gate needs a US country on the person or the organization, and no non-US one", () => {
  assert.equal(coldOutreachJurisdiction(person({ country: "United States" })).allowed, true)
  assert.equal(coldOutreachJurisdiction(person({}, { country: "US" })).allowed, true)
  assert.equal(coldOutreachJurisdiction(person({ country: "DE" })).allowed, false)
  assert.equal(coldOutreachJurisdiction(person({ country: "Deutschland" })).allowed, false)
  assert.equal(coldOutreachJurisdiction(person({ country: "United States" }, { country: "Canada" })).allowed, false)
  assert.equal(coldOutreachJurisdiction(person()).allowed, false)
  assert.equal(coldOutreachJurisdiction(person({ country: "Unknown" })).allowed, false)
})

test("candidate: at scoring, a blank country is unconfirmed (not excluded); a non-US or unreadable one is excluded", () => {
  const pending = coldOutreachJurisdiction(person(), { blank: "pending" })
  assert.equal(pending.allowed, true)
  assert.equal(pending.pending, true)
  assert.equal(coldOutreachJurisdiction(person({ country: "Unknown" }), { blank: "pending" }).allowed, false)

  const filters = { organization_locations: ["Texas, US"] }
  for (const country of ["DE", "Deutschland", "CA", "UK", "Unknown"]) {
    const s = scoreCandidate(person({ country }), filters, [])
    assert.equal(s.score, -1, country)
    assert.ok(s.excluded, country)
  }
  const blank = scoreCandidate(person(), filters, [])
  assert.notEqual(blank.score, -1)
  assert.ok(blank.reasons.some((r) => r.startsWith("Jurisdiction:")))
  assert.notEqual(scoreCandidate(person({ country: "USA" }), filters, []).score, -1)
})

// ── CRM leads: cold vs warm ───────────────────────────────────────────────────────────────────────────────────────

test("lead: a warm or inbound lead with no country still passes", () => {
  for (const source of ["web", "event", "manual", "newsletter", "referral", "social", undefined]) {
    const r = coldOutreachGateForLead({ source, country: undefined, location: undefined })
    assert.equal(r.allowed, true, String(source))
    assert.equal(r.cold, false, String(source))
  }
  assert.equal(coldOutreachGateForLead({ source: "web", country: "DE" }).allowed, true)
})

test("lead: a prospected (cold) lead must read as the United States", () => {
  const cold = (country?: string, location?: string) => coldOutreachGateForLead({ source: "prospected", country, location })
  assert.equal(cold("US").allowed, true)
  assert.equal(cold(undefined, "San Antonio, Texas").allowed, true)
  for (const [country, location] of [["DE"], ["Canada"], ["GB"], ["Unknown"], [undefined, undefined], [undefined, ""], [undefined, "Toronto, Ontario"], [undefined, "San Antonio"]] as Array<[string?, string?]>) {
    const r = cold(country, location)
    assert.equal(r.allowed, false, `${country} / ${location}`)
    assert.equal(r.cold, true)
  }
  // The stamped country wins over the location.
  assert.equal(cold("DE", "San Antonio, Texas").allowed, false)
})

test("lead: partner (a partner roster or bought list) is cold", () => {
  assert.deepEqual([...COLD_LEAD_SOURCES].sort(), ["partner", "prospected"])
  const partner = (country?: string, location?: string) => coldOutreachGateForLead({ source: "partner", country, location })
  assert.equal(partner("US").allowed, true)
  assert.equal(partner(undefined, "Austin, Texas").allowed, true)
  for (const [country, location] of [["DE"], ["Canada"], ["Unknown"], [undefined, undefined], [undefined, "Toronto, Ontario"]] as Array<[string?, string?]>) {
    const r = partner(country, location)
    assert.equal(r.allowed, false, `${country} / ${location}`)
    assert.equal(r.cold, true)
  }
})

// ── The gate's inputs are locked on cold leads ────────────────────────────────────────────────────────────────────

test("edit lock: source can't move onto or off a cold source", () => {
  assert.ok(coldGateEditRefusal({ source: "prospected" }, { source: "manual" }))
  assert.ok(coldGateEditRefusal({ source: "partner" }, { source: "web" }))
  assert.ok(coldGateEditRefusal({ source: "prospected" }, { source: "partner" }))
  assert.ok(coldGateEditRefusal({ source: "web" }, { source: "prospected" }))
  assert.ok(coldGateEditRefusal({ source: "manual" }, { source: "partner" }))
  assert.equal(coldGateEditRefusal({ source: "web" }, { source: "event" }), null)
  assert.equal(coldGateEditRefusal({ source: "prospected" }, { source: "prospected" }), null)
})

test("edit lock: a cold lead's country and location are locked; a warm lead's are not", () => {
  const cold = { source: "prospected", country: "US", location: "San Antonio, Texas" }
  assert.ok(coldGateEditRefusal(cold, { location: "Berlin, Germany" }))
  assert.ok(coldGateEditRefusal(cold, { location: "" }))
  assert.ok(coldGateEditRefusal(cold, { country: "DE" }))
  assert.ok(coldGateEditRefusal({ source: "partner" }, { location: "Texas" }))
  // Re-sending current values (the drawer saves the whole form) is not a change.
  assert.equal(coldGateEditRefusal(cold, { source: "prospected", location: "San Antonio, Texas " }), null)
  assert.equal(coldGateEditRefusal({ source: "partner", location: undefined }, { source: "partner", location: undefined }), null)
  const warm = { source: "web", location: "Austin, Texas" }
  assert.equal(coldGateEditRefusal(warm, { location: "Berlin, Germany" }), null)
  assert.equal(coldGateEditRefusal(warm, { country: "DE", location: "" }), null)
})

test("the lead PATCH route refuses a locked edit with a 403 before it writes", () => {
  const src = read("app/api/admin/leads/[id]/route.ts")
  const patchFn = src.indexOf("export async function PATCH")
  const lock = src.indexOf("coldGateEditRefusal(current, patch)", patchFn)
  assert.ok(lock > patchFn)
  assert.ok(lock < src.indexOf("updateLead(id, patch)", patchFn))
  assert.match(src.slice(lock, lock + 400), /status: 403/)
})

// ── Wiring: every cold send path calls the gate before it sends ───────────────────────────────────────────────────

test("send-outreach refuses a blocked cold lead with a 403 before any send", () => {
  const src = read("app/api/admin/leads/[id]/send-outreach/route.ts")
  const gate = src.indexOf("coldOutreachGateForLead(lead)")
  assert.ok(gate > 0)
  assert.ok(gate < src.indexOf("getResend()"))
  assert.match(src.slice(gate, gate + 600), /status: 403/)
})

test("sequence enrolment and resume refuse a blocked cold lead before persisting", () => {
  const src = read("app/api/admin/leads/[id]/sequence/route.ts")
  const enroll = src.indexOf('if (action === "enroll")')
  const gate = src.indexOf("coldOutreachGateForLead(lead)", enroll)
  assert.ok(gate > enroll)
  assert.ok(gate < src.indexOf("outreach_sequence: sequence", enroll))
  const resume = src.indexOf('if (action === "resume")')
  assert.ok(resume > 0 && src.indexOf("coldOutreachGateForLead(lead)", resume) > resume)
})

test("every sequence step re-checks jurisdiction before sending", () => {
  const src = read("lib/outreach-sequence.ts")
  const step = src.indexOf("export async function runSequenceStep")
  const check = src.indexOf("jurisdictionStop(lead)", step)
  assert.ok(check > step)
  assert.ok(check < src.indexOf("sendStepOnce", step))
})

test("prospecting approval runs the strict gate before capture and stamps the country", () => {
  const src = read("app/api/admin/prospecting/approve/route.ts")
  const strict = src.indexOf("coldOutreachJurisdiction(person)")
  assert.ok(strict > 0)
  assert.ok(strict < src.indexOf("captureLeadFromProspecting({"))
  assert.match(src, /country: confirmed\.country/)
})

/**
 * Prospecting on icp_cohorts (next-434media#63).
 *
 * The cohort rows here are invented: the real ones are internal and never
 * enter this public repository.
 *
 * Run: tsx --test lib/__tests__/icp-cohorts.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseIcpSource, renderCohorts, withoutArchetypes } from "../prospecting/icp-context"
import { bandFor, matchCohorts } from "../prospecting/cohort-match"
import { computeFunnelKpis } from "../kpis/funnel"
import type { Lead } from "../../types/crm-types"
import { classifyIndustries } from "../prospecting/industry-tags"
import { scoreIcpFit } from "../icp/rubric"
import { scoreCandidate } from "../prospecting/scorer"
import type { OutboundCohort } from "../sor/types.generated"

const read = (f: string) => readFileSync(join(process.cwd(), "lib/prospecting", f), "utf-8")

test("icp-base.md is icp.md without its buyer archetypes", () => {
  const base = read("icp-base.md").replace(/^<!--[\s\S]*?-->\n/, "")
  assert.equal(base, withoutArchetypes(read("icp.md")))
  assert.ok(!base.includes("## Buyer archetypes"))
  assert.ok(base.includes("## Geography") && base.includes("## Negative filters"))
})

test("the ICP source defaults to file", () => {
  assert.equal(parseIcpSource(undefined), "file")
  assert.equal(parseIcpSource(""), "file")
  assert.equal(parseIcpSource("bogus"), "file")
  assert.equal(parseIcpSource("shadow"), "shadow")
  assert.equal(parseIcpSource("cohorts"), "cohorts")
})

const cohort = (over: Partial<OutboundCohort>): OutboundCohort => ({
  key: "cohort-x",
  letter: "A",
  name: "X",
  objective: "o",
  target_profile: [],
  qualification_signals: [],
  proof: [],
  first_pitch: "pitch text",
  signer: "434",
  match: { industries: [], size: null },
  ...over,
})

// Invented rows with the same shape as the real ones.
const COHORTS = [
  cohort({ key: "cohort-a", letter: "A", name: "Aero", match: { industries: ["defense_aerospace", "advanced_manufacturing", "military_veteran"], size: null } }),
  cohort({ key: "cohort-b", letter: "B", name: "Health", match: { industries: ["healthcare_life_sciences"], size: null } }),
  cohort({ key: "cohort-c", letter: "C", name: "Fight", match: { industries: ["sports_fitness_lifestyle", "cpg_consumer"], size: null } }),
  cohort({
    key: "cohort-d",
    letter: "D",
    name: "Scale",
    match: {
      industries: ["nonprofit_mission", "civic_econ_dev", "education_workforce"],
      size: {
        bands: [
          { name: "mid-market", revenue_usd: { gte: 10_000_000, lte: 1_000_000_000 }, employees: { gte: 100, lte: 2500 } },
          { name: "enterprise", revenue_usd: { gt: 1_000_000_000 }, employees: { gt: 2500 } },
        ],
      },
    },
  }),
  cohort({ key: "cohort-e", letter: "E", name: "Agencies", match: { industries: ["marketing_agency"], size: null } }),
]

test("industry text is classified into the vocabulary", () => {
  assert.deepEqual(classifyIndustries("Medical Care"), ["healthcare_life_sciences"])
  assert.deepEqual(classifyIndustries("public relations & communications", "Lonestar PR firm"), ["marketing_agency"])
  assert.deepEqual(classifyIndustries("nonprofit organization management"), ["nonprofit_mission"])
  assert.deepEqual(classifyIndustries("real estate", "Canes"), [])
  assert.deepEqual(classifyIndustries("maintenance"), []) // "ai" never matches inside a word
})

const keys = (m: ReturnType<typeof matchCohorts>) => m.matches.map((x) => x.key)

test("a company carries every cohort it matches", () => {
  // A large health system: B by industry and D by its enterprise band.
  const m = matchCohorts({ industry: "hospital & health care", employeeCount: 12000 }, COHORTS)
  assert.deepEqual(keys(m), ["cohort-b", "cohort-d"])
  assert.equal(m.matches[0].via, "industry")
  assert.equal(m.matches[1].via, "size")
  assert.equal(m.review, undefined)
  // A mid-sized beverage brand: C by industry (consumer brands) and D by employees.
  assert.deepEqual(keys(matchCohorts({ industry: "food & beverages", employeeCount: 900 }, COHORTS)), ["cohort-c", "cohort-d"])
})

test("cohort A covers advanced manufacturing and military health", () => {
  assert.deepEqual(keys(matchCohorts({ industry: "machinery manufacturing", employeeCount: 40 }, COHORTS)), ["cohort-a"])
  assert.deepEqual(
    keys(matchCohorts({ industry: "hospital & health care", company: "Army Medical Center", employeeCount: 40 }, COHORTS)),
    ["cohort-a", "cohort-b"],
  )
  // Software alone is not cohort A: dual-use technology cannot be told apart by industry.
  assert.deepEqual(keys(matchCohorts({ industry: "computer software", employeeCount: 40 }, COHORTS)), [])
})

test("institutions match D by industry, whatever their size (master 6.1)", () => {
  assert.deepEqual(keys(matchCohorts({ industry: "nonprofit organization management", annualRevenue: 4_000_000 }, COHORTS)), ["cohort-d"])
})

test("D's bands: revenue decides when known, else employees", () => {
  const bands = COHORTS[3].match.size!.bands
  assert.deepEqual(bandFor({ annualRevenue: 50_000_000, employeeCount: 20 }, bands), { band: "mid-market", basis: "revenue" })
  assert.deepEqual(bandFor({ annualRevenue: 1_000_000_000 }, bands), { band: "mid-market", basis: "revenue" })
  assert.deepEqual(bandFor({ annualRevenue: 1_000_000_001 }, bands), { band: "enterprise", basis: "revenue" })
  assert.equal(bandFor({ annualRevenue: 5_000_000, employeeCount: 500 }, bands), null) // revenue wins: under the band
  assert.deepEqual(bandFor({ employeeCount: 2500 }, bands), { band: "mid-market", basis: "employees" })
  assert.deepEqual(bandFor({ employeeCount: 2501 }, bands), { band: "enterprise", basis: "employees" })
  assert.equal(bandFor({ employeeCount: 40 }, bands), null)
  assert.equal(bandFor({}, bands), "unknown")
})

test("a software company is D by size when its size is known", () => {
  const m = matchCohorts({ industry: "Software Development", annualRevenue: 30_000_000 }, COHORTS)
  assert.deepEqual(keys(m), ["cohort-d"])
  assert.equal(m.matches[0].via, "size")
})

test("no match and size unknown: review, not no-fit", () => {
  const m = matchCohorts({ industry: "media", company: "Telemundo" }, COHORTS)
  assert.deepEqual(m.matches, [])
  assert.ok(m.review)
})

test("a match elsewhere is not review, even with size unknown", () => {
  const m = matchCohorts({ industry: "hospital & health care" }, COHORTS)
  assert.deepEqual(keys(m), ["cohort-b"])
  assert.equal(m.review, undefined)
})

test("no match and a known size outside the bands: no cohort", () => {
  const m = matchCohorts({ industry: "real estate", employeeCount: 12 }, COHORTS)
  assert.deepEqual(m.matches, [])
  assert.equal(m.review, undefined)
})

test("agencies match E; mid-sized agencies also sit in D's band", () => {
  assert.deepEqual(keys(matchCohorts({ industry: "marketing & advertising", annualRevenue: 40_000_000 }, COHORTS)), ["cohort-d", "cohort-e"])
})

test("ICP match counts decided leads only; review leads are counted beside it", () => {
  const lead = (id: string, fit: number, review?: string) =>
    ({ id, name: id, company: id, email: "", source: "manual", status: "new", score: fit, icp_fit_score: fit, icp_review: review ?? null, activity: [] }) as unknown as Lead
  const kpis = computeFunnelKpis([lead("a", 90), lead("b", 40), lead("c", 57, "size unknown"), lead("d", 57, "size unknown")], [], "now")
  assert.equal(kpis.icpDecided, 2)
  assert.equal(kpis.icpReviewCount, 2)
  assert.equal(kpis.icpMatchRate, 0.5)
})

test("rubric Industry: match 25, no cohort 0, review left out of the score", () => {
  assert.equal(scoreIcpFit({ industry: "hospital & health care", cohorts: COHORTS }).breakdown.industry, 25)
  assert.equal(scoreIcpFit({ industry: "real estate", employeeCount: 12, cohorts: COHORTS }).breakdown.industry, 0)
  const review = scoreIcpFit({ industry: "media", location: "San Antonio, TX", cohorts: COHORTS })
  assert.equal(review.breakdown.industry, undefined)
  assert.ok(review.needsReview)
  assert.equal(review.activeMax, 35) // location 20 + size 15, industry left out
})

test("the search keyword is not the candidate's industry", () => {
  const person = { id: "p", first_name: "A", organization: { name: "Canes", industry: "real estate", estimated_num_employees: 12 } }
  const plain = scoreCandidate(person, {}, COHORTS)
  assert.deepEqual(plain.cohorts, [])
  const keyword = scoreCandidate(person, { q_keywords: "health boxing military" }, COHORTS)
  assert.equal(keyword.breakdown.industry, 0)
  assert.equal(keyword.score, plain.score)
})

test("rendered cohorts carry targeting fields, not pitch or proof", () => {
  const text = renderCohorts([
    cohort({ letter: "B", name: "Health", target_profile: ["Health systems"], qualification_signals: ["Hiring"], revenue_floor: { amount_minor: 1_000_000_000, currency: "USD" } }),
  ])
  assert.ok(text.includes("### Cohort B — Health"))
  assert.ok(text.includes("- Health systems") && text.includes("- Hiring"))
  assert.ok(text.includes("USD 10,000,000"))
  assert.ok(!text.includes("pitch text"))
})

// ── The Firestore reader keeps the match fields (2026-10-09 incident) ──────
// The tests above pass cohort rows straight in; production reads them through
// lib/firestore-icp-cohorts.ts. That reader rebuilt each row field by field and
// dropped `match`, so every company scored as no-cohort. This test runs a row
// through the reader and then the matcher.
test("the Firestore reader keeps match, and the matcher sees it", async () => {
  const { normalize } = await import("../firestore-icp-cohorts")
  const row = normalize("cohort-b", {
    key: "cohort-b",
    letter: "B",
    name: "Health",
    objective: "o",
    target_profile: ["Health systems"],
    qualification_signals: [],
    proof: [],
    first_pitch: "p",
    signer: "434",
    match: { industries: ["healthcare_life_sciences"], size: null },
  })
  assert.deepEqual(row.match, { industries: ["healthcare_life_sciences"], size: null })
  const sized = normalize("cohort-d", {
    letter: "D",
    name: "Scale",
    match: { industries: [], size: { bands: [{ name: "enterprise", employees: { gt: 2500 } }] } },
  })
  assert.equal(sized.match.size?.bands[0].name, "enterprise")
  assert.deepEqual(matchCohorts({ industry: "Medical Care" }, [row]).matches.map((m) => m.key), ["cohort-b"])
  assert.deepEqual(normalize("x", {}).match, { industries: [], size: null })
})

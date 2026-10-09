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
import { cohortTerms, matchCohort } from "../prospecting/cohort-match"
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
  ...over,
})

const COHORTS = [
  cohort({ key: "cohort-a", letter: "A", name: "Aerospace", target_profile: ["Aerospace manufacturers", "Military-health organizations"] }),
  cohort({ key: "cohort-b", letter: "B", name: "Health", target_profile: ["Health systems", "Biotechnology organizations", "Foundations funding health initiatives"] }),
  cohort({ key: "cohort-c", letter: "C", name: "Fight", target_profile: ["Boxing and fight culture", "Texas and Mexico"] }),
]

test("cohort terms drop structure, size and geography words", () => {
  assert.deepEqual(cohortTerms(COHORTS[2]), ["boxing", "fight"])
  assert.ok(!cohortTerms(COHORTS[1]).includes("organization"))
})

test("a word a cohort uses more often wins over the same word elsewhere", () => {
  assert.equal(matchCohort({ industry: "hospital & health care" }, COHORTS)?.key, "cohort-b")
  assert.equal(matchCohort({ industry: "Healthcare" }, COHORTS)?.key, "cohort-b") // prefix match
})

test("no overlap, no match; geography never matches", () => {
  assert.equal(matchCohort({ industry: "real estate", company: "Canes" }, COHORTS), null)
  assert.equal(matchCohort({ industry: "Texas", company: "Me" }, COHORTS), null)
  assert.equal(matchCohort({}, COHORTS), null)
})

test("the match carries the cohort words it hit", () => {
  const m = matchCohort({ industry: "Boxing", company: "Esquina Fight Gear" }, COHORTS)
  assert.equal(m?.key, "cohort-c")
  assert.deepEqual(m?.terms.sort(), ["boxing", "fight"])
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

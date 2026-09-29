/**
 * Tests for connector scope stripping and partner-service staleness.
 *
 * Run: npx tsx --test lib/sor/__tests__/visibility.test.ts
 *
 * node:test rather than a framework: this repository has no test runner, and
 * choosing one is an architectural decision that does not belong inside this
 * task. node:test is in the standard library and needs no config.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { project, projectAll, isReadable, isStale, withStaleFlag, STALE_AFTER_DAYS } from "../visibility"

const record = {
  key: "txmx-boxing",
  name: "TXMX Boxing",
  commercial_model: "Original IP",
  approved_public_description: "A boxing property.",
  published: true,
  source: "master 2.0.26",
  internal_context: "never leaves the building",
  notes: "internal only",
  updated_by: "migration-2.0.26",
}

test("public scope keeps the approved description and drops internal context", () => {
  const out = project("portfolio_records", record, "public")
  assert.equal(out?.approved_public_description, "A boxing property.")
  assert.equal(out?.internal_context, undefined)
  assert.equal(out?.notes, undefined)
  assert.equal(out?.updated_by, undefined)
})

test("internal scope returns the row untouched", () => {
  assert.deepEqual(project("portfolio_records", record, "internal"), record)
})

test("an unpublished record does not exist to a public caller", () => {
  assert.equal(project("portfolio_records", { ...record, published: false }, "public"), null)
  assert.notEqual(project("portfolio_records", { ...record, published: false }, "internal"), null)
})

test("public scope cannot read internal collections at all", () => {
  for (const c of ["icp_cohorts", "qualification_thresholds", "partner_services", "contractors"]) {
    assert.equal(isReadable(c, "public"), false, c)
    assert.equal(project(c, { key: "x" }, "public"), null, c)
    assert.equal(isReadable(c, "internal"), true, c)
  }
})

test("rate card: public scope returns anchors only", () => {
  const lines = [
    { key: "productions-anchor", layer: "public_anchor", amount: { amount_minor: 2500000, currency: "USD" } },
    { key: "platforms-minimum", layer: "fixed_minimum", amount: { amount_minor: 10000000, currency: "USD" } },
    { key: "editing", layer: "internal_cost", amount: { amount_minor: 12500, currency: "USD" }, cost_basis: "$65 (derived)" },
  ]
  const pub = projectAll("rate_card_lines", lines, "public")
  assert.equal(pub.length, 1)
  assert.equal(pub[0].key, "productions-anchor")
  assert.equal(projectAll("rate_card_lines", lines, "internal").length, 3)
})

test("an internal cost line never leaks its cost basis", () => {
  const line = { key: "editing", layer: "internal_cost", cost_basis: "$65 (derived)" }
  assert.equal(project("rate_card_lines", line, "public"), null)
  // and even if the layer were mislabelled, the field itself is stripped
  assert.equal(project("rate_card_lines", { ...line, layer: "public_anchor" }, "public")?.cost_basis, undefined)
})

const NOW = new Date("2026-10-03T12:00:00Z")

test("a partner review is fresh up to 31 days and stale after", () => {
  const fresh = new Date(NOW.getTime() - STALE_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10)
  const old = new Date(NOW.getTime() - (STALE_AFTER_DAYS + 1) * 86_400_000).toISOString().slice(0, 10)
  assert.equal(isStale(fresh, NOW), false)
  assert.equal(isStale(old, NOW), true)
})

test("the Ntooitive snapshot goes stale on the date the README predicts", () => {
  // Last reviewed 2026-09-02; §2.11 allows 31 days.
  assert.equal(isStale("2026-09-02", new Date("2026-10-03T00:00:00Z")), false)
  assert.equal(isStale("2026-09-02", new Date("2026-10-04T00:00:00Z")), true)
})

test("an unknown or unparseable review date is stale, not fresh", () => {
  assert.equal(isStale(undefined, NOW), true)
  assert.equal(isStale(null, NOW), true)
  assert.equal(isStale("not a date", NOW), true)
})

test("withStaleFlag marks each row without mutating it", () => {
  const rows = [{ key: "a", last_reviewed: "2026-09-02" }, { key: "b", last_reviewed: "2026-01-01" }]
  const out = withStaleFlag(rows, new Date("2026-10-04T00:00:00Z"))
  assert.deepEqual(out.map((r) => r.stale), [true, true])
  assert.equal("stale" in rows[0], false)
})

test("staleness does not depend on the time of day the question is asked", () => {
  // The defect this pins: last_reviewed is a date, not a timestamp. Comparing it
  // as an instant made a review flip to stale partway through the 32nd day
  // depending on the hour. Every hour of a given day must give the same answer.
  for (const [day, expected] of [["2026-10-03", false], ["2026-10-04", true]] as const) {
    for (const hour of ["00:00", "06:30", "12:00", "18:45", "23:59"]) {
      assert.equal(
        isStale("2026-09-02", new Date(`${day}T${hour}:00Z`)), expected,
        `${day} ${hour}`
      )
    }
  }
})

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
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { project, projectAll, isReadable, isStale, withStaleFlag, STALE_AFTER_DAYS } from "../visibility"

/**
 * Real rows from the seed, not a hand-written fixture.
 *
 * The first version of these tests invented a record shape with a top-level
 * `published` and a `name` field. Both were wrong — publication is nested at
 * `work_page.published` and the title field is `title` — and the tests passed
 * anyway, because the code was written from the same wrong assumption. A test
 * that shares the code's assumptions cannot find the assumption.
 */
const record = {
  "key": "txmx-boxing",
  "title": "TXMX Boxing",
  "commercial_model": "Original IP",
  "parent_key": null,
  "production_categories": [
    "Platform",
    "Content",
    "Experience"
  ],
  "client_or_partner_as_written": null,
  "role_434": "Owned and produced by 434 MEDIA",
  "founder_credit": {
    "roles": [
      "Creator",
      "Executive Producer",
      "Director"
    ],
    "as_written": "Marcos Resendez — Creator, Executive Producer & Director"
  },
  "collaborator_credits_as_written": null,
  "years": {
    "start": 2025,
    "end": 2025,
    "ongoing": false
  },
  "years_as_written": "2025",
  "operating_status": "Active",
  "work_page": {
    "published": true,
    "reason": null
  },
  "public_url": "https://txmxboxing.com",
  "approved_public_description": "A fight-culture media property spanning original content, live experiences, talent, partnerships, and commerce across Texas and Mexico.",
  "internal_context": null,
  "proof_assets_as_written": "Content library, photography, brand assets, live-event assets, and Rise of a Champion",
  "video": "TXMX DROP TEASER V2.mp4",
  "rights_defaults": {
    "creator": "434 MEDIA",
    "copyright_notice": "© 2026 434 MEDIA",
    "credit_line": "434 MEDIA",
    "usage_terms": "All rights reserved"
  },
  "registered_identifier_as_written": null,
  "restrictions_as_written": null,
  "source": "master 2.0.26 §4.8"
}

const unpublished = {
  "key": "health-cell-state-of-industry",
  "title": "The Health Cell — State of the Industry",
  "commercial_model": "Productions for Brands",
  "parent_key": null,
  "production_categories": [
    "Experience",
    "Content"
  ],
  "client_or_partner_as_written": "The Health Cell",
  "role_434": "Full event production, technical direction, show direction, and post-event content production",
  "founder_credit": {
    "roles": [
      "Executive Producer",
      "Event Producer",
      "Show Director",
      "Stage Director",
      "Technical Director"
    ],
    "as_written": "Marcos Resendez — Executive Producer, Event Producer, Show Director, Stage Director & Technical Director"
  },
  "collaborator_credits_as_written": null,
  "years": null,
  "years_as_written": null,
  "operating_status": "Completed",
  "work_page": {
    "published": false,
    "reason": "the record, its credits, and its proof stand; the card is not carried on the Work page."
  },
  "public_url": null,
  "approved_public_description": "434 delivered full event production for The Health Cell’s flagship annual fundraising event after the client established the program. Work included venue and catering management, project management, front-of-house and back-of-house operations, technical direction, show and stage direction, content capture, editing, and two speaker assets created for year-round organizational promotion.",
  "internal_context": null,
  "proof_assets_as_written": "Event media, photography, recorded program content, and two completed speaker assets",
  "video": null,
  "rights_defaults": null,
  "registered_identifier_as_written": null,
  "restrictions_as_written": null,
  "source": "master 2.0.26 §4.10"
}

test("public scope keeps the approved description and drops internal context", () => {
  const out = project("portfolio_records", record, "public")
  assert.equal(out?.approved_public_description, record.approved_public_description)
  assert.equal(out?.title, record.title)
  assert.equal(out?.internal_context, undefined)
  assert.equal(out?.proof_assets_as_written, undefined)
  assert.equal(out?.restrictions_as_written, undefined)
  assert.equal(out?.updated_by, undefined)
})

test("every field the Work page renders survives the public projection", () => {
  // The page maps these out of the row. Stripping one would blank a card field
  // in production while every test about "internal data" still passed.
  const out = project("portfolio_records", record, "public")!
  for (const f of ["title", "commercial_model", "production_categories", "role_434",
                   "founder_credit", "years_as_written", "operating_status",
                   "rights_defaults", "approved_public_description", "key"]) {
    assert.ok(f in out, `public projection dropped ${f}, which the Work page renders`)
  }
})

test("internal scope returns the row untouched", () => {
  assert.deepEqual(project("portfolio_records", record, "internal"), record)
})

test("an unpublished record does not exist to a public caller", () => {
  assert.equal(unpublished.work_page.published, false)
  assert.equal(project("portfolio_records", unpublished, "public"), null)
  assert.notEqual(project("portfolio_records", unpublished, "internal"), null)
})

test("publication fails closed when work_page is missing or malformed", () => {
  for (const wp of [undefined, null, {}, { published: "true" }, { published: 1 }]) {
    const row = { ...record, work_page: wp }
    assert.equal(project("portfolio_records", row, "public"), null, JSON.stringify(wp))
  }
})

test("public scope cannot read internal collections at all", () => {
  for (const c of ["icp_cohorts", "cohort_rules", "talent_relationships",
                   "qualification_thresholds", "partner_services", "contractors",
                   "pricing_exceptions", "launch_dependencies", "policy_documents"]) {
    assert.equal(isReadable(c, "public"), false, c)
    assert.equal(project(c, { key: "x" }, "public"), null, c)
    assert.equal(isReadable(c, "internal"), true, c)
  }
})

/**
 * Fixtures are synthetic on purpose. This repository is public, and these three
 * lines carried a real gate, a real internal cost and a real cost basis, copied
 * from the rate card — published to anyone, in a file that exists to prove those
 * very figures never reach a public caller.
 *
 * The amounts below are deliberately unreal. What the test asserts is the layer
 * rule and the field stripping, neither of which depends on the number being
 * true. A fixture never carries a figure from the seed; the context repository
 * has a pre-merge check that fails when one does.
 */
test("rate card: public scope returns anchors only", () => {
  const lines = [
    { key: "anchor-example", layer: "public_anchor", amount: { amount_minor: 111100, currency: "USD" } },
    { key: "minimum-example", layer: "fixed_minimum", amount: { amount_minor: 222200, currency: "USD" } },
    { key: "cost-example", layer: "internal_cost", amount: { amount_minor: 333300, currency: "USD" }, cost_basis: "$44 (synthetic)" },
  ]
  const pub = projectAll("rate_card_lines", lines, "public")
  assert.equal(pub.length, 1)
  assert.equal(pub[0].key, "anchor-example")
  assert.equal(projectAll("rate_card_lines", lines, "internal").length, 3)
})

test("an internal cost line never leaks its cost basis", () => {
  const line = { key: "cost-example", layer: "internal_cost", cost_basis: "$44 (synthetic)" }
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

test("core 2.11 rows never read as stale; snapshot and never-route rows do", () => {
  const rows = [
    { key: "c", tier: "core_2_11", last_reviewed: "2026-01-01" },
    { key: "s", tier: "snapshot", last_reviewed: "2026-01-01" },
    { key: "n", tier: "never_route", last_reviewed: "2026-01-01" },
    { key: "c2", tier: "core_2_11", last_reviewed: undefined },
  ]
  const out = withStaleFlag(rows, new Date("2026-10-04T00:00:00Z"))
  assert.deepEqual(out.map((r) => r.stale), [false, true, true, false])
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

/**
 * contractors and pricing_exceptions, read through the scope rules with the real
 * seed rows.
 *
 * The rows are read from the private context repository at run time and never
 * copied here: this repository is public, and a pricing exception carries an
 * agreed price while a contractor row carries a person's contact details. So the
 * assertions are on counts and identity only, and no message prints a field.
 * Where the seed is not reachable (CI has no context checkout) the seed tests
 * skip and say so; the synthetic tests still run.
 *
 * Seed directory: SOR_SEED, else ../434-context/05 System of Record/seed, the
 * same default scripts/sor/load.ts uses.
 */
const SEED = resolve(process.env.SOR_SEED ?? "../434-context/05 System of Record/seed")

const TABLES = [
  { collection: "contractors", seed: "contractors.json", expected: 1 },
  { collection: "pricing_exceptions", seed: "pricing_exceptions.json", expected: 2 },
] as const

for (const t of TABLES) {
  const path = join(SEED, t.seed)
  const skip = existsSync(path) ? false : `seed not reachable at ${path}`

  test(`${t.collection}: a public-scope read of the seeded rows returns nothing`, { skip }, () => {
    const rows = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>[]
    assert.equal(rows.length, t.expected, `${t.collection}: expected ${t.expected} seeded rows`)
    assert.equal(projectAll(t.collection, rows, "public").length, 0, `${t.collection}: public read returned rows`)
    for (const row of rows) {
      assert.ok(project(t.collection, row, "public") === null, `${t.collection}: a row reached public scope`)
    }
  })

  test(`${t.collection}: an internal-scope read returns every seeded row unchanged`, { skip }, () => {
    const rows = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>[]
    const out = projectAll(t.collection, rows, "internal")
    assert.equal(out.length, t.expected, `${t.collection}: internal read returned the wrong number of rows`)
    // Identity, not deep equality: a failing deepEqual would print the row.
    out.forEach((r, i) => assert.ok(r === rows[i], `${t.collection}: internal read altered row ${i}`))
  })

  test(`${t.collection}: synthetic rows follow the same rule`, () => {
    const rows = [{ key: "synthetic-a" }, { key: "synthetic-b" }]
    assert.equal(projectAll(t.collection, rows, "public").length, 0)
    assert.equal(projectAll(t.collection, rows, "internal").length, 2)
  })
}

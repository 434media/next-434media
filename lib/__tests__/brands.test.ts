/**
 * Offline. The Brands area (plan v11.2.1 Step 4 item 2): each brand's status, its onboarding checklist read from what
 * the system can see, and its missing templates. Runs on the brand profile set by ./published-profile.ts (the invented
 * fixture by default). No network, no Firestore.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { published, loadPublishedProfileFirst } from "./published-profile"
import { brandState, missingTemplates, onboardingChecklist, type BrandFacts } from "../content-pipeline/brand-status"
import { seedsDocId } from "../firestore-brands"
import { validateProfile, type BrandProfile } from "../content-pipeline/profile"
import { brandBookProblems, hexColumn, hexOf, parseVisualStandard } from "../content-pipeline/brand-book"
import { bookDigest, brandBookStatus } from "../content-pipeline/brand-book-check"
import { draftToken } from "../content-pipeline/profile-store"

loadPublishedProfileFirst()

const live = (over: Partial<BrandFacts> = {}): BrandFacts => ({
  id: "milcity", label: "MilCityUSA", onRoster: true, brandType: "owned", hasDocument: true,
  identity: { source: "lib/work-records.ts", record: "milcityusa" }, sources: { seeds: "content_pipeline_config/mcu_seeds" },
  published: { versionId: "milcity@v3", profile: published.milcity, publishedAt: "2026-10-20T15:00:00.000Z", publishedBy: "founder@example.com" },
  publishedProblem: null, draftDiffers: false, seeds: { snapshot: "Tracker, modified 2026-10-14", orgs: 12, cohorts: 3, backlog: 4 },
  postsMade: 9, publisherBrands: ["txmx", "vemos", "milcity", "ampd"], brandBook: false, ...over,
})
const metaBrand = published.milcity.posts.metaBrand

test("a brand is live with a valid published version, being set up with only a document, else not started", () => {
  assert.equal(brandState(live()), "live")
  assert.equal(brandState(live({ published: null })), "draft")
  assert.equal(brandState(live({ published: null, hasDocument: false })), "not_started")
})

test("the checklist ticks each SOP step only from what the system can see", (t) => {
  const facts = live({ publisherBrands: [metaBrand] })
  const c = onboardingChecklist(facts)
  assert.deepEqual(c.map(x => x.step), [1, 2, 3, 4, 5, 6, 7])
  const feedGaps = published.milcity.requestKinds.some(k => k.series.some(s => !published.milcity.series[s]?.templates.feed))
  if (feedGaps) t.diagnostic("the profile under test lacks a 4:5 template, so step 3 stays open")
  assert.deepEqual(c.filter(x => x.status === "open").map(x => x.step), feedGaps ? [3] : [])
  assert.match(c[6].detail, /Live as milcity@v3/)
  const bare = onboardingChecklist(live({ identity: null, published: null, publishedProblem: "nothing published yet", seeds: null, sources: { seeds: null }, postsMade: 0 }))
  assert.ok(bare.every(x => x.status === "open"), "nothing is ticked without evidence")
  assert.match(bare[6].detail, /nothing published yet/)
  assert.match(onboardingChecklist(live({ seeds: null }))[3].detail, /not loaded/)
  assert.match(onboardingChecklist(live({ publisherBrands: [] }))[4].detail, /doesn't know yet/)
})

test("missing templates are named as Create names them; a roundup has no 9:16; no brand book is missing too", () => {
  const p = structuredClone(published.milcity) as BrandProfile
  const news = p.requestKinds.find(k => k.kind === "news")!.series[0]
  delete (p.series[news]!.templates as Partial<Record<"feed" | "reels", string>>).reels
  const icymi = p.requestKinds.find(k => k.minStories)
  if (icymi) delete (p.series[icymi.series[0]]!.templates as Partial<Record<"feed" | "reels", string>>).reels
  const m = missingTemplates(p, "MilCityUSA", false)
  assert.ok(m.includes(`No 9:16 ${p.series[news]!.label} template for MilCityUSA yet`))
  assert.ok(!icymi || !m.some(x => x.includes(`9:16 ${p.series[icymi.series[0]]!.label}`)), "a roundup is a 4:5 carousel")
  assert.equal(m[m.length - 1], "No brand book yet for MilCityUSA")
  assert.deepEqual(missingTemplates(null, "TXMX Boxing", false), ["No published profile for TXMX Boxing yet, so no templates are connected", "No brand book yet for TXMX Boxing"])
})

test("the seeds a profile names are read from content_pipeline_config only", () => {
  assert.equal(seedsDocId("content_pipeline_config/mcu_seeds"), "mcu_seeds")
  assert.equal(seedsDocId("mcu_seeds"), "mcu_seeds")
  assert.equal(seedsDocId("crm_clients/abc"), null)
  assert.equal(seedsDocId(null), null)
})

// ── Brand book (Step 4 item 3) ──
const STANDARD = `# Fixture Brand — Visual Standard

**Version 2.0.0 — October 1, 2026**

Status: a draft.

## 1. Scope and authority

About this document, not the design.

## 2. Colour

Two values.

| Name | Hex | Used for |
|---|---|---|
| Fixture Red | \`AA1100\` | Chips |
| Fixture Ink | \`#112233\` | **Text** |

## 3. Frames

### 3.1 Feed

- 1080 × 1350
- *Full-bleed* media

---

## 8. Provenance

Approved once.

## 9. Open

- A question.
`
test("the brand book is parsed from the standard in its own words; scope, provenance and open questions are left out", () => {
  const b = parseVisualStandard(STANDARD, { path: "06 Standards/Fixture_Visual_Standard.md", sha256: "0123456789abcdef" })
  assert.deepEqual(b.standard, { path: "06 Standards/Fixture_Visual_Standard.md", title: "Fixture Brand — Visual Standard", version: "Version 2.0.0 — October 1, 2026", sha256: "0123456789abcdef" })
  assert.deepEqual(b.sections.map(s => s.title), ["2. Colour", "3. Frames"])
  const table = b.sections[0].blocks.find(x => x.kind === "table")!
  assert.deepEqual(table.head, ["Name", "Hex", "Used for"])
  assert.equal(hexColumn(table), 1)
  assert.deepEqual(table.rows!.map(r => hexOf(r.cells[1])), ["#AA1100", "#112233"])
  assert.deepEqual(b.sections[1].blocks, [{ kind: "heading", level: 3, text: "3.1 Feed" }, { kind: "list", items: ["1080 × 1350", "*Full-bleed* media"] }])
  assert.deepEqual(brandBookProblems(b), [])
})

test("a bad brand book never blocks the profile: it is not shown, and Missing says why", () => {
  const parsed = parseVisualStandard(STANDARD, { path: "x.md", sha256: "0123456789abcdef" })
  const book = { ...parsed, digest: bookDigest(parsed) }
  assert.equal(brandBookStatus(book).ok, true)
  // Any visual block, good or bad, leaves the profile valid: editorial fixes still publish.
  for (const visual of [book, { sections: [] }, { ...book, sections: [{ title: "x", blocks: [{ kind: "script", text: "<script>" }] }] }]) assert.deepEqual(validateProfile({ ...published.milcity, visual }), [])
  const bad = brandBookStatus({ ...book, sections: [{ title: "x", blocks: [{ kind: "script", text: "<script>" }] }] })
  assert.ok(!bad.ok && /malformed/.test(bad.reason))
  // Changed by hand after the generator stamped it: not shown.
  const edited = structuredClone(book); edited.sections[0].blocks[0].text = "Three values."
  const hand = brandBookStatus(edited)
  assert.ok(!hand.ok && /no longer matches what the generator made/.test(hand.reason))
  assert.ok(!brandBookStatus(undefined).ok)
  assert.equal(missingTemplates(published.milcity, "MilCityUSA", false, "the book no longer matches").pop(), "No brand book yet for MilCityUSA: the book no longer matches")
})

test("the parser keeps fenced code as written, an escaped pipe in its cell, and numbered and nested lists", () => {
  const md = ["# T", "**Version 1**", "## 2. Rules", "| Rule | Value |", "|---|---|", "| a \\| b | `x\\|y` |", "",
    "1. First", "2. Second", "   - nested under second", "",
    "```", "## not a heading", "| not | a table |", "```", ""].join("\n")
  const b = parseVisualStandard(md, { path: "x.md", sha256: "0123456789abcdef" })
  const [table, list, code] = b.sections[0].blocks
  assert.deepEqual(table.rows, [{ cells: ["a | b", "`x|y`"] }])
  assert.deepEqual(list, { kind: "list", items: ["First", "Second", "nested under second"], depths: [0, 0, 1], ordered: true })
  assert.deepEqual(code, { kind: "code", text: "## not a heading\n| not | a table |" })
  assert.equal(b.sections.length, 1)
  assert.deepEqual(brandBookProblems(b), [])
})

test("the draft token names the draft an editor saw: a new save changes it, and no draft is 'none'", () => {
  const d = { profile: published.milcity, examples: { approved: [], rejected: [] }, updated_by: "a@example.com", updated_at: "2026-10-26T14:00:00.000Z" }
  assert.equal(draftToken(null), "none")
  assert.equal(draftToken(d), draftToken({ ...d }))
  assert.notEqual(draftToken(d), draftToken({ ...d, updated_at: "2026-10-26T14:00:01.000Z" }), "the same content saved again is another draft")
  assert.notEqual(draftToken(d), draftToken({ ...d, examples: { approved: [{ text: "x" }], rejected: [] } }))
})

test("a parsed book is storable in Firestore: no array sits directly inside an array", () => {
  const nested = (v: unknown, inArray = false): boolean => Array.isArray(v) ? inArray || v.some(x => nested(x, true)) : !!v && typeof v === "object" && Object.values(v).some(x => nested(x, false))
  const md = ["# T", "## 2. Colour", "| Name | Hex |", "|---|---|", "| Red | `AA1100` |", "", "- a", "  - b", "", "```", "x", "```"].join("\n")
  assert.equal(nested(parseVisualStandard(md, { path: "x.md", sha256: "0123456789abcdef" })), false)
})

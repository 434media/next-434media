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
import type { BrandProfile } from "../content-pipeline/profile"

loadPublishedProfileFirst()

const live = (over: Partial<BrandFacts> = {}): BrandFacts => ({
  id: "milcity", label: "MilCityUSA", onRoster: true, brandType: "owned", hasDocument: true,
  identity: { source: "lib/work-records.ts", record: "milcityusa" }, sources: { seeds: "content_pipeline_config/mcu_seeds" },
  published: { versionId: "milcity@v3", profile: published.milcity, publishedAt: "2026-10-20T15:00:00.000Z", publishedBy: "founder@x.co" },
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

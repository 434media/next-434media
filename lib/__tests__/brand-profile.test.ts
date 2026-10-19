/**
 * Brand profiles (lib/content-pipeline/profile.ts): the profile in scope (./published-profile.ts: the committed,
 * invented fixture by default, or a real published profile from the database) loads and validates, a profile that
 * fails validation is refused, and nothing the engine needs is missing from it. No model, Canva or web call.
 * Run: tsx --test lib/__tests__/brand-profile.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { loadProfile, profileProblems, validateProfile } from "../content-pipeline/profile"
import { PIPELINE_PROPERTIES, propertyCanGenerate, templatesOf } from "../content-pipeline/properties"
import { SERIES } from "../content-pipeline/series"
import { profileTemplateIds } from "../canva-create"
import { headlineProblems, longestSharedRun, originalityProblems, words } from "../content-pipeline/copy-checks"
import type { SeriesKey } from "../content-pipeline/profile"
import type { FrameCopy } from "../content-pipeline/store"
import { published, loadPublishedProfileFirst } from "./published-profile"

loadPublishedProfileFirst()
const clone = () => structuredClone(published.milcity) as unknown as Record<string, unknown>

test("the brand profile in scope (the fixture, or a real one read from the database) validates, and the engine runs it", () => {
  assert.deepEqual(validateProfile(published.milcity), [])
  const p = loadProfile("milcity", { milcity: published.milcity })
  assert.equal(p.id, "milcity"); assert.equal(p.draftPrefix, "MCU")
  assert.match(published.active.versionId, published.real ? /^(milcity@v\d+|file:[0-9a-f]{16})$/ : /^fixture@v0$/)
  assert.equal(SERIES.dt101.templates.feed, p.series.dt101!.templates.feed)
})

test("the profile's rules are no longer in this public repository", () => {
  for (const f of ["../brand-profiles/milcity.json", "../brand-profiles/manifest.json"]) assert.ok(!existsSync(new URL(f, import.meta.url)), f)
})

test("a profile that fails validation is refused: loadProfile throws and Generate doesn't offer the brand", () => {
  const broken = clone(); delete broken.editorial
  assert.match(validateProfile(broken).join("; "), /editorial is required/)
  assert.throws(() => loadProfile("milcity", { milcity: broken }), /failed validation, so the content pipeline will not run it/)
  assert.deepEqual(profileProblems("txmx", {}), ["no brand profile for txmx"])
  assert.ok(!propertyCanGenerate("txmx", "news", null) && !propertyCanGenerate("milcity", "news", null))
  // A valid profile filed under another brand's id is refused too.
  assert.deepEqual(profileProblems("txmx", { txmx: published.milcity }), ["the profile's id is not txmx"])
  // Unknown keys, unknown formats and a request kind pointing at a missing series are all refused.
  const extra = clone(); extra.slogan = "x"
  assert.match(validateProfile(extra).join("; "), /profile\.slogan is not a profile key/)
  const fmt = clone(); (fmt.series as Record<string, unknown>).podcast = (fmt.series as Record<string, unknown>).news
  assert.match(validateProfile(fmt).join("; "), /series\.podcast: not a format the engine knows/)
  const kinds = clone(); (kinds.requestKinds as { series: string[] }[])[0].series = ["followon_graphicx"]
  assert.match(validateProfile(kinds).join("; "), /requestKinds\[0\]\.series: series defined in this profile/)
  const field = clone(); ((field.series as Record<string, { fields: { perLine?: unknown }[] }>).news.fields[0]).perLine = "15"
  assert.match(validateProfile(field).join("; "), /series\.news\.fields\[0\]\.perLine: 1–200/)
})

test("the Generate panel's templates come from the profile: each request kind with the feed templates its series fill", () => {
  const p = published.milcity
  assert.deepEqual(templatesOf(p), p.requestKinds.map(k => ({ kind: k.kind, label: k.label, templates: k.series.map(x => p.series[x]!.templates.feed), detail: k.detail })))
  // Since profile 1.2.0 an ICYMI roundup fills only its cover; its stories are their published cards (founder, 2026-10-18).
  assert.deepEqual(templatesOf(p).map(t => [t.kind, t.templates.length]), [["news", 1], ["breaking", 1], ["dt101", 1], ["icymi", 1]])
  if (!published.real) assert.deepEqual(templatesOf(p).map(t => t.templates[0]), ["FXtpl01fe", "FXtpl03fe", "FXtpl05fe", "FXtpl06fe"])
  assert.ok(PIPELINE_PROPERTIES.filter(p => p.active).every(p => !profileProblems(p.id, { milcity: published.milcity }).length))
  assert.ok(propertyCanGenerate("milcity", "dt101", published.milcity) && !propertyCanGenerate("txmx", "news", published.milcity))
})

test("every template the profile names is inside the Canva allow-list built from it (plan v11 Step 2: no ids in code)", () => {
  const allowed = profileTemplateIds([published.milcity])
  for (const s of Object.values(SERIES)) for (const id of Object.values(s.templates)) if (id) assert.ok(allowed.has(id), `${s.key}: ${id}`)
})

// ── headline, deck and originality checks (behind the profile's `checks`) ──
const H = { enabled: true, fields: ["headline"], hookFields: ["benefit_headline"], maxCommas: 1, deckField: "deck" }
const O = { enabled: true, headlineMaxRun: 4, captionMaxRun: 12, exempt: ["icymi_cover", "icymi_story"] as SeriesKey[] }
const card = (series: SeriesKey, fields: Record<string, string>): FrameCopy => ({ series, fields })

test("headline checks: the approved cards pass; round 2's punctuation and decks fail", () => {
  // The approved ULTRA and HIMARS hooks, and a News card with an initialism, pass.
  assert.deepEqual(headlineProblems([card("dt101", { benefit_headline: "SEND SUPPLIES.\nNOT A DRIVER.", subject_identifier: "ULTRA / OVERLAND AI" })], H), [])
  assert.deepEqual(headlineProblems([card("dt101", { benefit_headline: "FIRE.\nRELOCATE." })], H), [])
  assert.deepEqual(headlineProblems([card("news", { headline: "U.S. ARMY BACKS 9 C2 SOFTWARE VENDORS", deck: "Awards worth $93.6 million fund I Corps command software." })], H), [])
  // DT101-08 (round 2): one sentence closed with a period, the next left open.
  assert.match(headlineProblems([card("dt101", { benefit_headline: "TAXI SAFE.\nLANDING SECURE" })], H).join(), /punctuate it as one written statement, by its sentences, not line by line/)
  // NEWS-04's deck is fragments; a deck that repeats the headline adds nothing.
  assert.match(headlineProblems([card("news", { headline: "PENTAGON PICKS KBR LASER FOR BASE DEFENSE", deck: "Pentagon picks KBR laser for base defense." })], H).join(), /the deck repeats the headline \("pentagon picks kbr/)
  assert.match(headlineProblems([card("news", { headline: "ARMY BACKS VENDORS.", deck: "One. Two." })], H).join(), /takes no period.*deck must be one sentence/)
  // NEWS-04's deck: fragments joined by a comma, with no closing period.
  assert.match(headlineProblems([card("news", { headline: "KBR FIREFLY PILOT PROGRAM", deck: "KBR Firefly laser pilot for base defense, Xbox controller" })], H).join(), /the deck is one complete sentence ending with a period, not a list of fragments/)
  assert.match(headlineProblems([card("news", { headline: "DRONES DOWN NOW / TROOPS PROTECTED" })], H).join(), /no slash, colon/)
  assert.match(headlineProblems([card("news", { headline: "LASERS, DRONES, BASES" })], H).join(), /more than 1 comma/)
  assert.deepEqual(headlineProblems([card("news", { headline: "A. B." })], { ...H, enabled: false }), [])
})

test("the hook is one container for one hook: punctuated by its sentences, never line by line (founder, 2026-10-18)", () => {
  const hook = (v: string) => headlineProblems([card("dt101", { benefit_headline: v })], H)
  // One sentence across both lines, with or without its closing period, passes; so do the approved punchy statements.
  for (const ok of ["IT FINDS DRONES\nAND STRIKES THEM", "IT FINDS DRONES\nAND STRIKES THEM.", "NO PILOT FLEW\nITS FIRST SORTIE", "SEND SUPPLIES.\nNOT A DRIVER.", "FIRE.\nRELOCATE.", "U.S. TROOPS GET\nA LASER SHIELD"]) assert.deepEqual(hook(ok), [], ok)
  // No period is forced at the end of a line, and a sentence closed early with the next left open fails.
  assert.match(hook("TAXI SAFE.\nLANDING SECURE").join(), /not line by line/)
  assert.match(hook("DRONES DOWN.\nTROOPS SAFE NOW").join(), /not line by line/)
  assert.match(hook("PROTECT TROOPS!\nDRONE DEFENSE").join(), /no slash, colon, semicolon, exclamation or question mark/)
})

test("Breaking freshness is a profile setting: an exact-time window that needs the profile's time zone", () => {
  const p = published.milcity
  const breaking = p.requestKinds.find(k => k.kind === "breaking")!
  assert.ok(Number.isInteger(breaking.freshHours) && breaking.datedByReport === true && typeof p.timeZone === "string")
  // freshHours needs the profile's time zone.
  const noZone: Record<string, unknown> = { ...published.milcity }
  delete noZone.timeZone
  assert.ok(validateProfile(noZone).some(x => /freshHours: 1–168, with the profile's timeZone/.test(x)))
  assert.ok(validateProfile({ ...published.milcity, timeZone: "Central" }).some(x => /timeZone: an IANA time zone/.test(x)))
})

test("originality: a headline or caption copied from the source is rewritten; quotes, names and ICYMI are not", () => {
  const story = { sourceTitle: "Northrop Grumman's YFQ-48A Talon Blue Completes First Autonomous Flight", sourceText: "The YFQ-48A Talon Blue completed its first fully autonomous flight from taxi to landing at Edwards Air Force Base on Oct. 5, the company said in a statement released on Monday." }
  assert.deepEqual(longestSharedRun(words("YFQ-48A TALON BLUE COMPLETES FIRST AUTONOMOUS FLIGHT"), words(story.sourceTitle)).length, 7)
  assert.match(originalityProblems([card("news", { headline: "YFQ-48A TALON BLUE COMPLETES FIRST AUTONOMOUS FLIGHT" })], "x\n\nSource: Northrop Grumman", story, O, ["headline"]).join(), /copies 7 words in a row from the source's headline/)
  assert.deepEqual(originalityProblems([card("news", { headline: "NO PILOT FLIES YFQ-48A ON ITS FIRST SORTIE" })], "x\n\nSource: Northrop Grumman", story, O, ["headline"]), [])
  const copied = "The YFQ-48A Talon Blue completed its first fully autonomous flight from taxi to landing at Edwards Air Force Base on Oct. 5.\n\nSource: Northrop Grumman"
  assert.match(originalityProblems([card("news", { headline: "NO PILOT AT THE CONTROLS" })], copied, story, O, ["headline"]).join(), /caption copies \d+ words in a row/)
  // Quoted and attributed, the same words are a quote, not a copy; the source and credit lines are not prose.
  const quoted = `Northrop Grumman said "the YFQ-48A Talon Blue completed its first fully autonomous flight from taxi to landing at Edwards Air Force Base" this month.\n\nSource: ${story.sourceText}`
  assert.deepEqual(originalityProblems([card("news", { headline: "NO PILOT AT THE CONTROLS" })], quoted, story, O, ["headline"]), [])
  // ICYMI reuses MilCityUSA's own headlines and captions.
  assert.deepEqual(originalityProblems([card("icymi_cover", { headline: story.sourceTitle }), card("icymi_story", { headline: story.sourceTitle })], story.sourceText, story, O, ["headline"]), [])
})

test("the profile turns the headline and originality checks on, and carries headline rules for the writer's prompt", () => {
  const p = published.milcity
  assert.equal(p.checks?.headline?.enabled, true); assert.equal(p.checks?.originality?.enabled, true)
  assert.ok(Number.isInteger(p.checks?.originality?.headlineMaxRun) && Number.isInteger(p.checks?.originality?.captionMaxRun))
  assert.ok((p.headlineRules ?? "").trim().length > 0)
})

test("ICYMI is a profile setting: a fixed cover headline, 3 to 5 stories, and both keys validated (founder, 2026-10-18)", () => {
  const p = published.milcity
  const headline = SERIES.icymi_cover.fields.find(f => f.name === "headline")!
  assert.ok(typeof headline.fixed === "string" && headline.fixed.length <= 60); assert.equal(headline.serverFilled, undefined)
  const icymi = p.requestKinds.find(k => k.kind === "icymi")!
  assert.deepEqual([icymi.series, icymi.minStories, icymi.maxStories], [["icymi_cover"], 3, 5])
  assert.ok(SERIES.icymi_story) // kept for drafts made before 1.2.0
  // A fixed value is text, set by the server: never with serverFilled, allowed or date, and at most 60 characters.
  const fixedBad = clone(); ((fixedBad.series as Record<string, { fields: Record<string, unknown>[] }>).icymi_cover.fields[0]).serverFilled = true
  assert.match(validateProfile(fixedBad).join("; "), /series\.icymi_cover\.fields\[0\]\.fixed: 1–60 characters, not with serverFilled, allowed or date/)
  const fixedLong = clone(); ((fixedLong.series as Record<string, { fields: Record<string, unknown>[] }>).icymi_cover.fields[0]).fixed = "X".repeat(61)
  assert.match(validateProfile(fixedLong).join("; "), /fixed: 1–60 characters/)
  // A roundup's size comes as a pair, 1–10, the minimum at most the maximum.
  const at = (c: Record<string, unknown>) => (c.requestKinds as Record<string, unknown>[]).find(k => k.kind === "icymi")!
  const lone = clone(); delete at(lone).maxStories
  const upside = clone(); at(upside).minStories = 6
  for (const c of [lone, upside]) assert.match(validateProfile(c).join("; "), /minStories and maxStories together, 1–10, minStories at most maxStories/)
})

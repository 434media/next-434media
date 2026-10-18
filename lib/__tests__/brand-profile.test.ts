/**
 * Offline. Brand profiles (lib/content-pipeline/profile.ts): the emitted MilCityUSA profile loads and validates, a
 * profile that fails validation is refused, and nothing the engine needs is missing from it.
 * Run: tsx --test lib/__tests__/brand-profile.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import milcity from "../brand-profiles/milcity.json"
import manifest from "../brand-profiles/manifest.json"
import { loadProfile, profileProblems, validateProfile } from "../content-pipeline/profile"
import { PIPELINE_PROPERTIES, PROPERTY_TEMPLATES, propertyCanGenerate } from "../content-pipeline/properties"
import { SERIES } from "../content-pipeline/series"
import { MCU_BRAND_TEMPLATES } from "../canva-create"
import { headlineProblems, longestSharedRun, originalityProblems, words } from "../content-pipeline/copy-checks"
import type { SeriesKey } from "../content-pipeline/profile"
import type { FrameCopy } from "../content-pipeline/store"

const clone = () => structuredClone(milcity) as unknown as Record<string, unknown>

test("the emitted MilCityUSA profile validates, and the engine runs it", () => {
  assert.deepEqual(validateProfile(milcity), [])
  const p = loadProfile("milcity")
  assert.equal(p.name, "MilCityUSA"); assert.equal(p.draftPrefix, "MCU")
  assert.equal(SERIES.dt101.templates.feed, "EAHYOAJhC_8")
})

test("the generated profile is not hand-edited: it matches the hash its manifest records", () => {
  const bytes = readFileSync(new URL("../brand-profiles/milcity.json", import.meta.url))
  assert.equal(createHash("sha256").update(bytes).digest("hex").slice(0, 16), manifest.profiles.milcity.artifactSha256)
  assert.equal(manifest.profiles.milcity.profileSha256, milcity.profileSha256)
})

test("a profile that fails validation is refused: loadProfile throws and Generate doesn't offer the brand", () => {
  const broken = clone(); delete broken.editorial
  assert.match(validateProfile(broken).join("; "), /editorial is required/)
  assert.throws(() => loadProfile("milcity", { milcity: broken }), /failed validation, so the content pipeline will not run it/)
  assert.deepEqual(profileProblems("txmx"), ["no brand profile for txmx"])
  assert.ok(!PROPERTY_TEMPLATES.txmx && !propertyCanGenerate("txmx", "news"))
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

test("the Generate panel's templates come from the profile, as they were in code", () => {
  assert.deepEqual(PROPERTY_TEMPLATES.milcity, [
    { kind: "news", label: "News", templates: ["EAHXWo1LiF8"], detail: "One story, one card" },
    { kind: "breaking", label: "Breaking News", templates: ["EAHXZAbAA8s"], detail: "Primary source in the last 24 hours" },
    { kind: "dt101", label: "Defense Tech 101", templates: ["EAHYOAJhC_8"], detail: "Benefit-led card, mission-brief caption" },
    // Since profile 1.2.0 an ICYMI roundup fills only its cover; its stories are their published cards (founder, 2026-10-18).
    { kind: "icymi", label: "ICYMI roundup", templates: ["EAHXZPgjqSY"], detail: "Cover + 3–5 published story cards" },
  ])
  assert.ok(PIPELINE_PROPERTIES.filter(p => p.active).every(p => !profileProblems(p.id).length))
})

test("every template a profile names is inside the publisher's Canva allowlist", () => {
  for (const s of Object.values(SERIES)) for (const id of Object.values(s.templates)) if (id) assert.ok(MCU_BRAND_TEMPLATES.has(id), `${s.key}: ${id}`)
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

test("the MilCityUSA profile carries the founder's rulings of 2026-10-18", () => {
  const p = loadProfile("milcity")
  // The hook: one container for one hook; nothing teaches a statement or a period per line.
  assert.match(p.headlineRules ?? "", /The two lines are one container for ONE complete, compelling hook\. The line break is layout, not grammar/)
  assert.match(p.headlineRules ?? "", /never a pattern per line: no period is forced at the end of a line/)
  for (const text of [p.editorial, p.headlineRules ?? ""]) {
    assert.doesNotMatch(text, /SEND SUPPLIES\. \/ NOT A DRIVER\.|FIRE\. \/ RELOCATE\./)
    assert.doesNotMatch(text, /both lines end with a period|a period at the end of every line|punctuated the same way/)
  }
  // The journalism rule, for every template's front card, ICYMI excepted (since 1.2.0: its cover headline is fixed).
  assert.match(p.headlineRules ?? "", /Every headline and hook on the front of a card, in every template \(ICYMI excepted, below\), is compelling journalism/)
  assert.match(p.headlineRules ?? "", /Passing the checks is the floor, not the goal/)
  // The originality limits as built: rewritten at 5+ words (headline) and 13+ (caption).
  assert.equal(p.checks?.originality?.headlineMaxRun, 4); assert.equal(p.checks?.originality?.captionMaxRun, 12)
  // Breaking freshness: 24 hours by an exact time, a same-event report allowed, bylines checked in America/Chicago.
  assert.deepEqual(p.requestKinds.find(k => k.kind === "breaking"), { kind: "breaking", label: "Breaking News", detail: "Primary source in the last 24 hours", series: ["breaking"], code: "BN", freshHours: 24, datedByReport: true })
  assert.equal(p.timeZone, "America/Chicago")
  assert.match(p.editorial, /otherwise a news outlet's report of the same event with an exact time .*if neither shows it is within 24 hours, it is not Breaking, and it may run as News/)
  assert.match(p.editorial, /A visible date-only byline is never enough on its own: it is only a cross-check, and only when it is today in America\/Chicago/)
  // freshHours needs the profile's time zone.
  const noZone: Record<string, unknown> = { ...milcity }
  delete noZone.timeZone
  assert.ok(validateProfile(noZone).some(x => /freshHours: 1–168, with the profile's timeZone/.test(x)))
  assert.ok(validateProfile({ ...milcity, timeZone: "Central" }).some(x => /timeZone: an IANA time zone/.test(x)))
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

test("the MilCityUSA profile turns the checks on and prompts the writer with the headline rules", () => {
  const p = loadProfile("milcity")
  assert.equal(p.checks?.headline?.enabled, true); assert.equal(p.checks?.originality?.headlineMaxRun, 4); assert.equal(p.checks?.originality?.captionMaxRun, 12)
  assert.match(p.headlineRules ?? "", /^HEADLINES, DECKS AND ORIGINALITY/)
  assert.match(p.headlineRules ?? "", /ICYMI is the one exception: its cover headline is a fixed line, and each story after the cover is the card MilCityUSA already published, reused as it is/)
})

test("the simpler ICYMI is in the profile: a fixed cover headline, 3 to 5 stories, and both keys validated (founder, 2026-10-18)", () => {
  const p = loadProfile("milcity")
  assert.equal(p.profileVersion, "1.2.0"); assert.equal(p.rulesVersion, "mcu-rules-2026-10-18.2")
  const headline = SERIES.icymi_cover.fields.find(f => f.name === "headline")!
  assert.equal(headline.fixed, "TOP DEFENSE DEVELOPMENTS"); assert.equal(headline.serverFilled, undefined)
  const icymi = p.requestKinds.find(k => k.kind === "icymi")!
  assert.deepEqual([icymi.series, icymi.minStories, icymi.maxStories], [["icymi_cover"], 3, 5])
  assert.ok(SERIES.icymi_story) // kept for drafts made before 1.2.0
  assert.match(p.editorial, /three to five MCU News or Breaking stories already published in the previous week/)
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

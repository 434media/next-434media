/**
 * Offline. The content pipeline's replay set and harness (scripts/content-replay/): the fixtures are complete, a
 * replayed story runs the real worker from writing to the Canva step against an in-memory store, research stays fixed
 * to the captured story, ICYMI eligibility is the engine's, and holds are sorted the way plan v9 sorts them. The models,
 * the photo search and the images are scripted; nothing reaches a model, a site, Firestore or Canva.
 * Run: tsx --test lib/__tests__/content-replay.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import type { McuAi, ModelCall } from "../content-pipeline/model"
import type { SeriesKey } from "../content-pipeline/series"
import type { MediaCandidate } from "../content-pipeline/sources"
import { FIXED_RESEARCH, holdKinds, passes, replayStory, safetyOf, SAFETY_HOLDS, type ReplayDeps } from "../../scripts/content-replay/core"
import { loadPages, loadStories, storyOf } from "../../scripts/content-replay/fixtures"

const set = loadStories()
const byId = (id: string) => set.stories.find(s => s.id === id)!
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9])
const PHOTO: MediaCandidate = { url: "https://upload.wikimedia.org/striker.jpg", thumbUrl: "https://upload.wikimedia.org/striker.jpg", pageUrl: "https://commons.wikimedia.org/wiki/File:Striker.jpg", title: "XTEND STRIKER drone in flight", description: "U.S. Army photo", width: 3000, height: 2000, license: "Public domain", creator: "U.S. Army photo", credit: "U.S. Army photo / Public domain via Wikimedia Commons", usGovernment: true }

function deps(ai: Partial<McuAi>, calls: ModelCall[] = []): ReplayDeps {
  const base: McuAi = {
    research: async () => { throw new Error("research must not run in a replay") },
    write: async () => { throw new Error("no writer scripted") },
    findPhotoPages: async () => [],
    pickMedia: async () => ({ index: 0, reason: "the subject", ranked: [{ index: 0, box: { x0: 0.3, y0: 0.15, x1: 0.7, y1: 0.65 } }] }),
    checkArtwork: async () => { throw new Error("the artwork check needs the Canva export, which a replay never makes") },
    ...ai,
  }
  return {
    ai: onCall => Object.fromEntries(Object.entries(base).map(([k, fn]) => [k, async (input: never) => { const c: ModelCall = { step: k === "write" ? "write" : k === "pickMedia" ? "photoPick" : k === "findPhotoPages" ? "photoSearch" : "research", model: "scripted" }; calls.push(c); onCall(c); return (fn as (i: never) => unknown)(input) }])) as unknown as McuAi,
    seeds: null,
    fetchPage: async url => { throw new Error(`http_404 ${url}`) },
    fetchImage: async () => ({ bytes: JPEG, mime: "image/jpeg" }),
    searchCommons: async () => [PHOTO],
  }
}

test("every story in the replay set has its pages captured, and its primary page reads as an article", () => {
  assert.ok(set.stories.length >= 18)
  for (const s of set.stories) {
    assert.ok(s.observed.length, `${s.id} records what the gate rounds did`)
    if (s.kind === "icymi") { assert.ok(s.posts?.length, `${s.id} has its posts`); continue }
    const p = loadPages(s.id)
    assert.ok(p, `${s.id} is captured`)
    const story = storyOf(s, p)
    assert.ok(story.sourceText.length >= 400, `${s.id}: readable source text`)
    assert.equal(story.primaryUrl, s.primaryUrl)
  }
})

test("a replayed News story runs writing, the checks and the photo pick, and stops at the Canva step", async () => {
  const calls: ModelCall[] = []
  const run = await replayStory(byId("xtend-striker"), loadPages("xtend-striker"), deps({
    write: async () => ({ frames: [{ series: "news" as SeriesKey, fields: { headline: "XTEND WINS A BIG ARMY DRONE ORDER", deck: "The award follows a top finish in a Pentagon drone competition.", source: "XTEND" }, mediaQuery: "XTEND STRIKER drone" }], caption: "XTEND will supply STRIKER drone systems under the new order.\n\nSource: XTEND, 13OCT26" }),
  }, calls))
  assert.equal(run.end, "review", run.reason ?? "")
  assert.equal(run.status, "designing")
  assert.equal(run.frames[0].fields.date, "13OCT26", "the card is dated as the round dated it")
  assert.equal(run.media[0]?.license, "Public domain")
  assert.ok(!calls.some(c => c.step === "research"))
  const s = { ...safetyOf(run), factErrors: [] }
  assert.deepEqual(s.limits, []); assert.deepEqual(s.unsourced, []); assert.deepEqual(s.rights, ["verified"])
  assert.equal(passes(run, s), true)
  assert.equal(passes(run, { ...s, factErrors: ["XTEND is not an Army supplier — the source names no service"] }), false, "a fact error fails the pass")
})

test("a draft the pipeline would move to another subject is held instead: research is fixed to the captured story", async () => {
  const run = await replayStory(byId("skydio-x10d"), loadPages("skydio-x10d"), deps({
    write: async () => ({ frames: [{ series: "dt101" as SeriesKey, fields: {} }], caption: "", hold: "the Traction line is not on the product page" }),
  }))
  assert.equal(run.end, "held")
  assert.match(run.reason!, /the Traction line is not on the product page/)
  assert.ok(run.reason!.includes(FIXED_RESEARCH))
  assert.deepEqual(holdKinds(run.reason!, run.end), ["writer"])
})

test("ICYMI: the engine picks the week's published stories from the posts, leaving out a REVIEW DRAFT, a roundup and a DT101", async () => {
  let seen: string[] = []
  const run = await replayStory(byId("icymi-week-2026-10-05"), null, deps({
    write: async ({ story }) => { seen = (story.roundup ?? []).map(p => p.title); return { frames: [{ series: "icymi_cover" as SeriesKey, fields: Object.fromEntries(seen.map((_, i) => [`story_0${i + 1}`, `Story ${i + 1} in one row`])) }], caption: "This week in defense tech.\n\nSource: MilCityUSA, 18OCT26" } },
  }))
  assert.deepEqual(run.roundup, seen)
  assert.equal(seen.length, 3)
  assert.ok(!seen.some(t => /REVIEW DRAFT|ICYMI|IGTEST/.test(t)), seen.join(" | "))
})

test("holds are sorted as plan v9 sorts them: safety reasons stay holds, style reasons go to Review with a note", () => {
  const kinds = (r: string) => holdKinds(r, "held")
  assert.deepEqual(kinds("no relevant, licensed photo was found: no candidate shows the subject itself"), ["photo"])
  assert.deepEqual(kinds("the copy still breaks the template rules after two rewrites: Benefit hook: each line at most 16 characters"), ["limits"])
  assert.deepEqual(kinds("the copy still breaks the template rules after two rewrites: these figures are not in the source: $12M"), ["figures"])
  assert.deepEqual(kinds("the copy still breaks the template rules after two rewrites and 3 rewording attempts: the caption copies 16 words in a row from the source (\"…\")"), ["originality"])
  assert.deepEqual(kinds("the copy still breaks the template rules after two rewrites: the DT101 caption must be the mission brief"), ["format"])
  assert.deepEqual(kinds("the copy still breaks the template rules after two rewrites: the headline takes no period"), ["headline"])
  assert.deepEqual(holdKinds("the write step failed 4 times", "failed"), ["error"])
  for (const k of ["photo", "limits", "figures", "subject"] as const) assert.ok(SAFETY_HOLDS.includes(k))
  for (const k of ["originality", "headline", "format"] as const) assert.ok(!SAFETY_HOLDS.includes(k))
})

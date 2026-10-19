/**
 * Offline. The content pipeline (lib/content-pipeline/) against an in-memory store with the real lease rules; the
 * models, Canva, the board write and the web are scripted. Nothing reaches Firestore, Canva, a model or Slack.
 * Ported from the pilot's lib/__tests__/mcu.test.ts (b36e7be): the Slack review and revision tests moved out with
 * those paths; the board write, the one alert per run and the model routing are tested here instead.
 * Run: tsx --test lib/__tests__/content-pipeline.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { SERIES, checkFields, clippedWords, ddmmmyy, fitLines, lineCount, measure, normalizeFields, overLimits, type SeriesKey } from "../content-pipeline/series"
import { runDue, chooseRoundup, closeRoundup, MAX_FIT_ATTEMPTS, RETRY_MS, exactTime, zonedDay, icymiStory, icymiWindow, staleSource, allowsRepresentative, sameSubject, makerOf, searchedPageUsable, unsourcedNumbers, withCredits, imageLabel, mediaQueries, cropFit, choosePhoto, zoomCrop, reviewNotes, DOD_NOTICE, LEASE_MS, type WorkerDeps, type DesignInput, type PostInput, type NoContentInput } from "../content-pipeline/worker"
import { firestorePipelineStore } from "../firestore-content-pipeline"
import { MAX_ATTEMPTS, type McuDraft, type McuJob, type McuStore } from "../content-pipeline/store"
import type { PostRow } from "../content-pipeline/worker"
import { archiveRelevant, assertPublicHttps, federalHost, guardedFetch, isOutlet, siteOrg, imageSize, pageImageCandidate, parsePage, searchNasa, searchOpenverse, usableLicense, type MediaCandidate } from "../content-pipeline/sources"
import { brandDirection, isPhotoDefect, meaningful, readPick, searchResultUrls, servedBy, servedCall, type McuAi, type ModelCall } from "../content-pipeline/model"
import { PIPELINE_MODELS, FALLBACK_MODELS, CALL_FALLBACK, callOptions, outputBudget } from "../content-pipeline/models"
import { seedBrief, seedProblems, type McuSeeds } from "../content-pipeline/seeds"
import { PIPELINE_PROPERTIES, PROPERTY_TEMPLATES, contentPropertyOf, propertyCanGenerate } from "../content-pipeline/properties"
import { BRANDS, CONTENT_PROPERTIES } from "../../components/crm/types"
import { candidateFields, cutOffWords } from "../content-pipeline/series"
import { candidateProblems, copyProblems, MAX_CANDIDATE_BATCHES } from "../content-pipeline/worker"

// ── in-memory store with the Firestore store's lease semantics ──
class MemStore implements McuStore {
  jobs = new Map<string, { job: McuJob; due: boolean; leaseUntil: number; attempts: number }>()
  drafts = new Map<string, { draft: McuDraft; due: boolean; leaseUntil: number; attempts: number }>()
  private col(k: "job" | "draft") { return (k === "job" ? this.jobs : this.drafts) as Map<string, { due: boolean; leaseUntil: number; attempts: number; job?: McuJob; draft?: McuDraft }> }
  async createJob(job: McuJob) { const c = this.jobs.get(job.id); if (c) return { created: false, job: structuredClone(c.job) }; this.jobs.set(job.id, { job: structuredClone(job), due: true, leaseUntil: 0, attempts: 0 }); return { created: true, job } }
  async getJob(id: string) { const j = this.jobs.get(id); return j ? structuredClone(j.job) : null }
  async saveJob(job: McuJob) { this.jobs.get(job.id)!.job = structuredClone(job) }
  async createDraft(d: McuDraft) { if (!this.drafts.has(d.id)) this.drafts.set(d.id, { draft: structuredClone(d), due: true, leaseUntil: 0, attempts: 0 }) }
  async getDraft(id: string) { const d = this.drafts.get(id); return d ? structuredClone(d.draft) : null }
  async saveDraft(d: McuDraft) { this.drafts.get(d.id)!.draft = structuredClone(d) }
  async claim(k: "job" | "draft", id: string, now: number, lease: number) { const r = this.col(k).get(id); if (!r || !r.due || r.leaseUntil > now) return 0; r.leaseUntil = now + lease; r.attempts++; return r.attempts }
  async release(k: "job" | "draft", id: string, due: boolean) { const r = this.col(k).get(id)!; r.leaseUntil = 0; r.due = due; r.attempts = 0 }
  async due(now: number, limit: number) { return [...[...this.jobs].filter(([, v]) => v.due && v.leaseUntil <= now).map(([id]) => ({ kind: "job" as const, id })), ...[...this.drafts].filter(([, v]) => v.due && v.leaseUntil <= now).map(([id]) => ({ kind: "draft" as const, id }))].slice(0, limit) }
  pilotUsed: string[] = [] // ids the pilot already used, as the shared ledgers record them
  async highestDraftNumber(prefix: string) { return Math.max(0, ...[...this.drafts.keys(), ...this.pilotUsed].filter(k => k.startsWith(prefix)).map(k => Number(k.slice(prefix.length, prefix.length + 2)))) }
  async backoff(k: "job" | "draft", id: string, until: number) { this.col(k).get(id)!.leaseUntil = until }
  async choosingDrafts() { return [...this.drafts.values()].filter(v => v.draft.status === "choosing").map(v => v.draft.id) }
  async recentStories(since: string) { return [...this.drafts.values()].map(v => v.draft).filter(d => d.createdAt >= since && d.story).map(d => ({ draftId: d.id, jobId: d.jobId, title: d.story.title, primaryUrl: d.story.primaryUrl })) }
}

const NOW = Date.parse("2026-10-16T18:00:00Z")
const ARMY_TEXT = "WASHINGTON — The U.S. Army awarded contracts worth $93.6 million to nine companies on Oct. 15, 2026 to deliver next-generation command and control software to I Corps. ".repeat(6)
const CANDIDATE: MediaCandidate = { url: "https://upload.wikimedia.org/a.jpg", thumbUrl: "https://upload.wikimedia.org/thumb/a.jpg", pageUrl: "https://commons.wikimedia.org/wiki/File:A.jpg", title: "Soldiers at a command post", description: "U.S. Army photo", width: 3000, height: 2000, license: "Public domain", creator: "U.S. Army photo by Sgt. A", credit: "U.S. Army photo by Sgt. A / Public domain via Wikimedia Commons", usGovernment: true }
/** The DT101 caption in the approved mission-brief shape (validate() checks it). */
const BRIEF = "MISSION BRIEF // NEXT-GEN C2\n\n//Lockheed Martin\n\n📍Bethesda, MD\n\nTech: Command and control\n\nPlatform: Software\n\nGoal: Link sensors and shooters for I Corps.\n\nSource: U.S. Army, 2026-10-15"
/** A subject box that zooms to a clean 4:5 crop of CANDIDATE (3000 × 2000). */
const HERO = { x0: 0.3, y0: 0.15, x1: 0.7, y1: 0.65 }
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9])
const SEEDS: McuSeeds = { purpose: "Invented purpose for tests.", cohorts: ["Builders"], orgs: [{ name: "Example Robotics", site: "example.com", kind: "neo-prime" }, { name: "Example Prime", site: "prime.example", kind: "prime" }, { name: "Example Outlet", site: "news.example", kind: "outlet" }], dt101Backlog: [{ subject: "Widget 9", maker: "Example Robotics", url: "https://example.com/widget" }], dt101Covered: ["HIMARS"], snapshot: "test" }

function job(over: Partial<McuJob> = {}): McuJob {
  return { id: `job-${over.kind ?? "news"}-1`, kind: "news", count: 1, placement: "feed", request: { actorEmail: "marcos@434media.com", actorName: "Marcos" }, status: "researching", drafts: [], createdAt: new Date(NOW).toISOString(), ...over }
}

function world(over: { ai?: Partial<McuAi>; pagePublished?: string; newsFeedHasMedia?: boolean; createDesign?: (i: DesignInput) => void; seeds?: McuSeeds | null } = {}) {
  const store = new MemStore(), designs: DesignInput[] = [], posts: PostInput[] = [], notices: NoContentInput[] = [], alerts: { job: McuJob; drafts: McuDraft[] }[] = [], calls: ModelCall[] = []
  let now = NOW
  const ai: McuAi = {
    research: async ({ count }) => ({ candidates: [{ title: "Army picks nine C2 software vendors", primaryUrl: "https://www.army.mil/article/1", publisher: "U.S. Army", publishedAt: "2026-10-15", whyNow: "The award starts fielding now.", why: "material" }, { title: "Second story", primaryUrl: "https://www.army.mil/article/2", publisher: "U.S. Army", why: "news" }].slice(0, count + 1) }),
    write: async ({ kind }) => ({ frames: [{ series: (kind === "dt101" ? "dt101" : kind === "breaking" ? "breaking" : "news") as SeriesKey, fields: kind === "dt101" ? { benefit_headline: "Link the fight.\nDecide faster.", subject_identifier: "Next-gen C2 / Lockheed Martin" } : { headline: "Army backs 9 C2 software vendors", deck: "Awards worth $93.6 million fund I Corps command software.", source: "ARMY.MIL" } as Record<string, string>, mediaQuery: "Army command post" }], caption: kind === "dt101" ? BRIEF : "The Army awarded $93.6 million to nine companies for command and control software.\n\nSource: U.S. Army, 2026-10-15" }),
    findPhotoPages: async () => [],
    pickMedia: async () => ({ index: 0, reason: "relevant", ranked: [{ index: 0, box: HERO }] }),
    checkArtwork: async () => [],
    ...over.ai,
  }
  const deps: WorkerDeps = {
    store,
    // Each scripted call reports itself the way the Gateway-backed calls do.
    ai: onCall => Object.fromEntries(Object.entries(ai).map(([k, fn]) => [k, async (input: never) => { const c = { step: (k === "write" ? "write" : k === "pickMedia" ? "photoPick" : k === "checkArtwork" ? "artworkCheck" : k === "findPhotoPages" ? "photoSearch" : "research") as ModelCall["step"], model: "scripted", provider: "test" }; calls.push(c); onCall(c); return (fn as (i: never) => unknown)(input) }])) as unknown as McuAi,
    seeds: async () => over.seeds === undefined ? SEEDS : over.seeds,
    content: {
      recentPosts: async () => [{ id: "p1", title: "Old story", status: "posted", caption: "c" }],
      templateFields: async t => { const media = t !== SERIES.news.templates.feed || over.newsFeedHasMedia !== false; return { headline: "text", deck: "text", date: "text", source: "text", ...(media ? { media: "image" } : {}), benefit_headline: "text", subject_identifier: "text", image_context: "text", counter: "text", story_numbers: "text", story_01: "text", story_02: "text", story_03: "text", story_04: "text", story_05: "text" } },
      createDesign: async i => { over.createDesign?.(i); designs.push(structuredClone(i)); return { designId: `DAH${i.requestId.replace(/[^A-Za-z0-9]/g, "").slice(-8)}`, editUrl: "https://www.canva.com/d/edit", viewUrl: "https://www.canva.com/d/view", previewUrls: ["https://export.canva.com/1.jpg"] } },
      writePost: async p => { posts.push(structuredClone(p)); return { postId: `post-${posts.length}`, holds: [] } },
      writeNoContent: async p => { const at = notices.findIndex(n => n.requestId === p.requestId); if (at >= 0) return { postId: `notice-${at + 1}` }; notices.push(structuredClone(p)); return { postId: `notice-${notices.length}` } },
    },
    fetchPage: async url => ({ url, title: "New contract awards support Army C2", text: ARMY_TEXT, ...(over.pagePublished !== "" ? { publishedAt: over.pagePublished ?? "2026-10-16T09:00:00Z" } : {}) }),
    fetchImage: async () => ({ bytes: JPEG, mime: "image/jpeg" }),
    searchCommons: async () => [CANDIDATE],
    notify: async (j, ds) => { alerts.push({ job: structuredClone(j), drafts: structuredClone(ds) }) },
    nowMs: () => now,
  }
  const start = async (j: Partial<McuJob> = {}) => { await store.createJob(job(j)); return runDue(deps, 1e9) }
  return { store, deps, designs, posts, notices, alerts, calls, start, advance: (ms: number) => { now += ms } }
}
const onlyDraft = (w: ReturnType<typeof world>) => [...w.store.drafts.values()][0].draft

test("series limits: DT101 fixed lists, deck two lines, DDMMMYY, unknown fields", () => {
  assert.equal(ddmmmyy("2026-09-14"), "14SEP26")
  assert.equal(lineCount("ARMY BACKS NINE SOFTWARE VENDORS", 17), 2)
  assert.deepEqual(checkFields(SERIES.dt101, { benefit_headline: "FIRE.\nRELOCATE.", subject_identifier: "HIMARS / LOCKHEED MARTIN" }), []) // image label is server-filled
  const bad = checkFields(SERIES.dt101, { benefit_headline: "FIRE AND RELOCATE FAST", subject_identifier: "HIMARS", extra: "y" })
  assert.ok(bad.some(p => /exactly 2 lines/.test(p)) && bad.some(p => /extra is not a field/.test(p)))
  assert.ok(checkFields(SERIES.dt101, { benefit_headline: "SEND SUPPLIES ANYWHERE.\nNOT A DRIVER.", subject_identifier: "ULTRA / OVERLAND AI" }).some(p => /each line at most 16/.test(p)))
  assert.ok(checkFields(SERIES.breaking, { headline: "A", deck: "x ".repeat(70), date: "16OCT26", source: "X" }).some(p => /Deck runs past 2 lines/.test(p)))
  assert.ok(checkFields(SERIES.news, { headline: "A", deck: "B", date: "2026-10-16", source: "X" }).some(p => /DDMMMYY/.test(p)))
})

test("every figure on the card or caption must be in the source; credits and dates are not facts", () => {
  assert.deepEqual(unsourcedNumbers(["$93.6 million to nine companies", "Source: U.S. Army, 2026-10-15"], ARMY_TEXT), [])
  assert.deepEqual(unsourcedNumbers(["$120 million award"], ARMY_TEXT), ["$120 million"])
  const c = withCredits("Body.", [{ ...CANDIDATE, title: "x" }])
  assert.ok(c.endsWith(DOD_NOTICE) && c.includes("Image: U.S. Army photo by Sgt. A")); assert.equal(withCredits(c, [{ ...CANDIDATE, title: "x" }]), c) // idempotent
})

test("one Generate run: research → copy → licensed photo → Canva template → artwork check → a Review post on the board, and one alert", async () => {
  const w = world()
  assert.ok(await w.start({ kind: "dt101" }) >= 6)
  const d = onlyDraft(w)
  assert.equal(d.id, "MCU-DT101-20261016-01"); assert.equal(d.status, "in_review"); assert.equal(d.postId, "post-1")
  const create = w.designs[0]
  assert.equal(create.templateId, "EAHYOAJhC_8"); assert.equal(create.requestId, "admin:MCU-DT101-20261016-01:v1:f1")
  assert.deepEqual(create.text, { benefit_headline: "LINK THE FIGHT.\nDECIDE FASTER.", subject_identifier: "NEXT-GEN C2 / LOCKHEED MARTIN", image_context: "IMAGE: U.S. ARMY" })
  assert.equal(create.image?.url, CANDIDATE.url)
  // The board write carries the design, the caption with its credits, the sources and the photo rights.
  assert.equal(w.posts.length, 1)
  const p = w.posts[0]
  assert.equal(p.requestId, "admin:MCU-DT101-20261016-01:v1"); assert.deepEqual(p.designIds, [d.designs[0].designId]); assert.equal(p.caption, d.caption)
  assert.ok(p.caption.includes("Image: U.S. Army photo by Sgt. A") && p.caption.endsWith(DOD_NOTICE))
  assert.deepEqual(p.links, ["https://www.army.mil/article/1", CANDIDATE.pageUrl])
  assert.match(p.notes, /Photo rights\n- Soldiers at a command post — Public domain, U\.S\. Army photo by Sgt\. A\n {2}https:\/\/commons/)
  assert.match(p.notes, /Source\nNew contract awards support Army C2 — U\.S\. Army, 2026-10-16\nhttps:\/\/www\.army\.mil\/article\/1/)
  assert.ok(p.notes.length <= 4000)
  assert.deepEqual(p.requestedBy, { email: "marcos@434media.com", name: "Marcos" })
  // One alert, after the draft settled; the job is done.
  assert.equal(w.alerts.length, 1); assert.equal(w.alerts[0].drafts[0].postId, "post-1"); assert.equal((await w.store.getJob("job-dt101-1"))!.status, "done")
  // Every model call is recorded on the draft with its step and provider.
  assert.deepEqual([...new Set(d.calls!.map(c => c.step))].sort(), ["artworkCheck", "photoPick", "photoSearch", "research", "write"])
  assert.ok(d.calls!.every(c => c.provider === "test"))
  // A second run finds nothing due and writes nothing again.
  assert.equal(await runDue(w.deps, 1e9), 0); assert.equal(w.posts.length, 1); assert.equal(w.alerts.length, 1)
})

test("draft ids never repeat one the pilot already used today, and every shared-ledger key is prefixed", async () => {
  const w = world()
  // The pilot made MCU-DT101-20261016-01..03 today; its design and post keys are in the shared ledgers.
  w.store.pilotUsed = ["MCU-DT101-20261016-01:v1:f1", "MCU-DT101-20261016-03:v1"]
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.id, "MCU-DT101-20261016-04")
  assert.ok(w.designs.every(x => x.requestId.startsWith("admin:")) && w.posts.every(x => x.requestId.startsWith("admin:")))
})

test("five stories: one research pass, one draft per story, no photo reused across the batch, one alert for all five", async () => {
  const w = world({ ai: { research: async () => ({ candidates: [1, 2, 3, 4, 5].map(n => ({ title: `Story ${n}`, primaryUrl: `https://www.army.mil/article/${n}`, publisher: "U.S. Army", why: "news" })) }) } })
  w.deps.searchCommons = async () => [0, 1, 2, 3, 4, 5].map(i => ({ ...CANDIDATE, pageUrl: `https://commons.wikimedia.org/wiki/File:${i}.jpg`, url: `https://upload.wikimedia.org/${i}.jpg` }))
  await w.start({ kind: "news", count: 5 })
  const drafts = [...w.store.drafts.values()].map(v => v.draft)
  assert.equal(drafts.length, 5); assert.ok(drafts.every(d => d.status === "in_review" && d.postId))
  assert.equal(new Set(drafts.map(d => d.media[0]!.pageUrl)).size, 5)
  assert.equal(w.calls.filter(c => c.step === "research").length, 1)
  assert.equal(w.alerts.length, 1); assert.equal(w.alerts[0].drafts.length, 5)
})

test("Breaking: an announcement older than 24 hours, or with no stated time, is not Breaking — the job holds and says it may run as News", async () => {
  const old = world({ pagePublished: "2026-10-14T09:00:00Z" })
  await old.start({ kind: "breaking" })
  assert.equal(old.store.drafts.size, 0); assert.match((await old.store.getJob("job-breaking-1"))!.note!, /publish time \(2026-10-14T09:00:00Z\) is more than 24 hours old, so it isn't Breaking News; it may run as News/)
  const undated = world({ pagePublished: "" })
  await undated.start({ kind: "breaking" })
  assert.equal(undated.store.drafts.size, 0); assert.match((await undated.store.getJob("job-breaking-1"))!.note!, /shows no publish time, and no news report of the same event shows an exact time within 24 hours, so it isn't Breaking News; it may run as News/)
  // A job that opens no drafts still reports back once, with its reason.
  assert.equal(old.alerts.length, 1); assert.deepEqual(old.alerts[0].drafts, []); assert.equal(undated.alerts.length, 1)
})

test("an exact time is one with a time of day; a date alone never is; a time with no zone is read at its earliest moment", () => {
  assert.equal(exactTime("2026-10-16"), null); assert.equal(exactTime(""), null); assert.equal(exactTime(undefined), null)
  assert.equal(exactTime("2026-10-16T09:00:00Z"), Date.parse("2026-10-16T09:00:00Z"))
  assert.equal(exactTime("2026-10-16T04:00:00-05:00"), Date.parse("2026-10-16T09:00:00Z"))
  assert.equal(exactTime("2026-10-16T09:00:00"), Date.parse("2026-10-15T19:00:00Z")) // UTC+14: never fresher than it is
  assert.equal(zonedDay(Date.parse("2026-10-17T03:00:00Z"), "America/Chicago"), "2026-10-16")
})

test("Breaking freshness, in order: the official page's exact time; else a timed outlet report of the same event; else not Breaking (founder, 2026-10-18)", async () => {
  const PRIMARY = "https://www.army.mil/article/1", REPORT = "https://www.defensenews.com/2026/10/16/army-c2"
  const candidate = { title: "Army picks nine C2 software vendors", primaryUrl: PRIMARY, publisher: "U.S. Army", why: "news", whyNow: "The Army named its I Corps C2 vendors today, which sets who builds the software.", reportUrl: REPORT }
  const make = (official: string, report: string, same = true) => {
    const w = world({ ai: { research: async () => ({ candidates: [candidate] }), sameEvent: async () => ({ same, reason: same ? "the same award" : "an older announcement" }) } })
    w.deps.fetchPage = async url => url === REPORT ? { url, title: "Army awards nine companies C2 software deals", text: ARMY_TEXT, ...(report ? { publishedAt: report } : {}) } : { url, title: "Army awards C2 contracts", text: ARMY_TEXT, ...(official ? { publishedAt: official } : {}) }
    return w
  }
  const note = async (w: ReturnType<typeof world>) => (await w.store.getJob("job-breaking-1"))!.note ?? ""

  // 1. The official page's machine-readable time decides, when it has one.
  const a = make("2026-10-16T09:00:00Z", "")
  await a.start({ kind: "breaking" })
  assert.deepEqual(onlyDraft(a).story.fresh, { at: "2026-10-16T09:00:00.000Z", how: "official" })
  assert.match(reviewNotes(onlyDraft(a)), /How fresh\nThe official page's publish time, 2026-10-16T09:00:00.000Z\./)
  // An official time older than 24 hours is not rescued by a fresh report.
  const old = make("2026-10-15T09:00:00Z", "2026-10-16T12:00:00Z")
  await old.start({ kind: "breaking" })
  assert.equal(old.store.drafts.size, 0); assert.match(await note(old), /more than 24 hours old, so it isn't Breaking News; it may run as News/)

  // 2. A date-only official page, and an outlet's report of the same event with an exact time: Breaking, dated by the
  // report, which is never cited. The date-only byline is today in America/Chicago, so it agrees as a cross-check.
  const b = make("2026-10-16", "2026-10-16T15:30:00Z")
  await b.start({ kind: "breaking" })
  const d = onlyDraft(b)
  assert.deepEqual(d.story.fresh, { at: "2026-10-16T15:30:00.000Z", how: "report", byline: "2026-10-16", bylineToday: true })
  assert.equal(d.story.reportedAt, "2026-10-16"); assert.equal(d.frames[0].fields.date, "16OCT26")
  assert.deepEqual(b.posts[0].links.filter(l => l === REPORT), []) // never cited on the post
  assert.match(reviewNotes(d), /How fresh\nA news outlet's report of the same event, timed 2026-10-16T15:30:00.000Z; the official page shows no time\. The outlet is not cited\. The page's date-only byline, 2026-10-16, is today in America\/Chicago and agrees\./)
  assert.doesNotMatch(reviewNotes(d), /The official page is older/)
  // A byline that isn't today is recorded and not counted; the report still decides.
  const c = make("2026-10-14", "2026-10-16T15:30:00Z")
  await c.start({ kind: "breaking" })
  assert.match(reviewNotes(onlyDraft(c)), /date-only byline, 2026-10-14, is not today in America\/Chicago, so it isn't counted/)

  // 3. Neither shows it: not Breaking, and it may run as News. A date-only byline today is never enough alone, a
  // report with only a date is not an exact time, and a report of a different event doesn't count.
  const e = make("2026-10-16", "")
  await e.start({ kind: "breaking" })
  assert.equal(e.store.drafts.size, 0)
  assert.match(await note(e), /shows only a date \(2026-10-16, today in America\/Chicago, which is a cross-check, never enough on its own\), and no news report of the same event shows an exact time within 24 hours \(the outlet's report shows no exact publish time\), so it isn't Breaking News; it may run as News/)
  const f = make("2026-10-16", "2026-10-16")
  await f.start({ kind: "breaking" })
  assert.match(await note(f), /the outlet's report shows no exact publish time/)
  const g = make("2026-10-16", "2026-10-16T15:30:00Z", false)
  await g.start({ kind: "breaking" })
  assert.match(await note(g), /the official page is not the event the outlet reported \(an older announcement\)/)
  const h = make("2026-10-16", "2026-10-15T12:00:00Z")
  await h.start({ kind: "breaking" })
  assert.match(await note(h), /the outlet's report \(2026-10-15T12:00:00Z\) is more than 24 hours old/)
})

test("every candidate dropped: research runs once more, avoiding them, before the job holds (production, 2026-10-17)", async () => {
  const seen: (string[] | undefined)[] = []
  const w = world({ ai: { research: async input => { seen.push(input.avoid); return seen.length === 1
    ? { candidates: [{ title: "Blocked page story", primaryUrl: "https://blocked.example.com/a", publisher: "X", why: "news" }] }
    : { candidates: [{ title: "Army picks nine C2 software vendors", primaryUrl: "https://www.army.mil/article/1", publisher: "U.S. Army", why: "news" }] } } } })
  const fetchPage = w.deps.fetchPage
  w.deps.fetchPage = async url => url.includes("blocked.") ? Promise.reject(new Error("http_403")) : fetchPage(url)
  await w.start()
  assert.deepEqual(seen, [undefined, ["Blocked page story"]])
  const d = onlyDraft(w)
  assert.equal(d.story.primaryUrl, "https://www.army.mil/article/1"); assert.equal(d.status, "in_review")
  // When the second pass finds nothing either, the job holds with both reasons and reports back.
  const none = world({ ai: { research: async () => ({ candidates: [{ title: "Blocked page story", primaryUrl: "https://blocked.example.com/a", publisher: "X", why: "news" }] }) } })
  none.deps.fetchPage = async () => Promise.reject(new Error("http_403"))
  await none.start()
  const job = (await none.store.getJob("job-news-1"))!
  assert.equal(job.status, "held"); assert.match(job.note!, /^Blocked page story: source page unreachable, unreadable or out of date \(http_403 at https:\/\/blocked\.example\.com\/a\); then: Blocked page story: already tried$/)
  assert.equal(none.alerts.length, 1); assert.equal(none.store.drafts.size, 0)
})

test("no new content: one thorough search, then a notice card in Review with the reason and the sources tried — never a post", async () => {
  const w = world({ ai: { research: async () => ({ candidates: [{ title: "Blocked page story", primaryUrl: "https://blocked.example.com/a", publisher: "X", why: "dt101" }] }) } })
  w.deps.fetchPage = async () => Promise.reject(new Error("http_403"))
  let research = 0
  const r = w.deps.ai
  w.deps.ai = onCall => { const a = r(onCall); return { ...a, research: async i => { research++; return a.research(i) } } }
  await w.start({ kind: "dt101" })
  assert.equal(research, 2) // the first pass, then one pass avoiding what was tried; never more
  assert.equal(w.notices.length, 1); assert.equal(w.posts.length, 0); assert.equal(w.designs.length, 0); assert.equal(w.store.drafts.size, 0)
  const n = w.notices[0]
  assert.equal(n.requestId, "admin:job-dt101-1:no-content"); assert.equal(n.jobId, "job-dt101-1"); assert.match(n.title, /^No new Defense Tech 101 content — 2026-10-16$/)
  assert.deepEqual(n.tried, [{ title: "Blocked page story", url: "https://blocked.example.com/a" }]); assert.match(n.reason, /source page unreachable/)
  const job = (await w.store.getJob("job-dt101-1"))!
  assert.equal(job.status, "held"); assert.equal(job.noContentPostId, "notice-1")
  assert.equal(w.alerts.length, 1); assert.equal(w.alerts[0].job.noContentPostId, "notice-1") // the alert opens the card
  // Nothing searches again: the job is finished.
  assert.equal(await runDue(w.deps, 1e9), 0); assert.equal(research, 2)
})

test("research reads what the search returned: result URLs are collected from the tool output, whatever its shape", () => {
  const steps = [{ toolResults: [{ output: { results: [{ url: "https://www.army.mil/article/1", title: "a" }, { url: "https://www.anduril.com/thunder", excerpts: ["see https://www.anduril.com/thunder."] }] } }] }, { toolResults: [] }, { toolResults: [{ output: "plain text with https://www.darpa.mil/x), and more" }] }]
  assert.deepEqual(searchResultUrls(steps), ["https://www.army.mil/article/1", "https://www.anduril.com/thunder", "https://www.darpa.mil/x"])
})

test("a script-rendered page still gives its text (JSON-LD and meta description), so it isn't dropped as unreadable", () => {
  const body = "Thunder is a Group 5 autonomous attack rotorcraft designed to multiply the combat power of crewed attack aircraft. ".repeat(4)
  const html = `<html><head><title>Thunder | Anduril</title><meta name="description" content="Autonomous attack rotorcraft."><script type="application/ld+json">{"@type":"Product","description":${JSON.stringify(body)}}</script></head><body><div id="root"></div><script>window.__X=1</script></body></html>`
  const p = parsePage("https://www.anduril.com/thunder", html)
  assert.ok(p.text.length >= 400); assert.match(p.text, /^Thunder is a Group 5 autonomous attack rotorcraft/); assert.match(p.text, /Autonomous attack rotorcraft\./)
})

test("an unreadable primary page falls back to another primary page for the same subject; each miss keeps its reason", async () => {
  const w = world({ ai: { research: async () => ({ candidates: [{ title: "Wraith Shield", primaryUrl: "https://www.l3harris.com/all-capabilities/wraith-shield", alternateUrls: ["https://www.army.mil/article/1"], publisher: "L3Harris", why: "dt101" }] }) } })
  const fetchPage = w.deps.fetchPage
  w.deps.fetchPage = async url => url.includes("l3harris") ? Promise.reject(new Error("http_404")) : fetchPage(url)
  await w.start({ kind: "dt101" })
  assert.equal(onlyDraft(w).story.primaryUrl, "https://www.army.mil/article/1")
  const none = world({ ai: { research: async () => ({ candidates: [{ title: "Wraith Shield", primaryUrl: "https://www.l3harris.com/all-capabilities/wraith-shield", publisher: "L3Harris", why: "dt101" }] }) } })
  none.deps.fetchPage = async () => Promise.reject(new Error("http_404"))
  await none.start({ kind: "dt101" })
  assert.match((await none.store.getJob("job-dt101-1"))!.note!, /Wraith Shield: source page unreachable, unreadable or out of date \(http_404 at https:\/\/www\.l3harris\.com\/all-capabilities\/wraith-shield\)/)
})

test("zero candidates gets the search's one retry too, then the notice card (production, 2026-10-17)", async () => {
  let calls = 0
  const w = world({ ai: { research: async () => { calls++; return calls === 1 ? { candidates: [], note: "nothing found" } : { candidates: [{ title: "Army picks nine C2 software vendors", primaryUrl: "https://www.army.mil/article/1", publisher: "U.S. Army", why: "news" }] } } } })
  await w.start()
  assert.equal(calls, 2); assert.equal(onlyDraft(w).status, "in_review")
  let again = 0
  const none = world({ ai: { research: async () => { again++; return { candidates: [], note: "nothing found" } } } })
  await none.start()
  assert.equal(again, 2); assert.equal(none.notices.length, 1); assert.equal(await runDue(none.deps, 1e9), 0); assert.equal(again, 2)
})

test("an unsourced figure is rewritten, and held if it persists — nothing reaches Canva or the board", async () => {
  const w = world({ ai: { write: async () => ({ frames: [{ series: "news" as SeriesKey, fields: { headline: "Army spends $500 million", deck: "Big award.", source: "ARMY.MIL" } }], caption: "The Army spent $500 million." }) } })
  await w.start()
  const d = onlyDraft(w)
  assert.equal(d.status, "held"); assert.match(d.holdReason!, /not in the source: \$500 million/)
  assert.equal(w.designs.length, 0); assert.equal(w.posts.length, 0)
  assert.equal(w.alerts.length, 1); assert.equal(w.alerts[0].drafts[0].status, "held") // the run still reports back
})

test("no relevant licensed photo: the draft holds with the reason and nothing is written to the board", async () => {
  const w = world({ ai: { pickMedia: async () => ({ index: null, reason: "only unrelated images" }) } })
  await w.start()
  const d = onlyDraft(w)
  assert.equal(d.status, "held"); assert.match(d.holdReason!, /no relevant, licensed photo.*only unrelated images/); assert.equal(w.posts.length, 0)
})

test("an interrupted step resumes after its lease and reuses the same Canva request id; repeated failure stops it", async () => {
  let fail = 1
  const w = world({ createDesign: () => { if (fail-- > 0) throw new Error("network") } })
  await w.start()
  const id = [...w.store.drafts.keys()][0]
  assert.equal((await w.store.getDraft(id))!.status, "designing"); assert.equal((await w.store.getDraft(id))!.error, "network")
  assert.equal(await runDue(w.deps), 0) // waiting out the retry delay
  w.advance(RETRY_MS + 1); await runDue(w.deps, 1e9)
  assert.equal((await w.store.getDraft(id))!.status, "in_review")
  assert.deepEqual(w.designs.map(c => c.requestId), [`admin:${id}:v1:f1`])
  assert.equal((await w.store.getDraft(id))!.error, undefined) // cleared once the retry went through

  const broken = world({ createDesign: () => { throw new Error("down") } })
  await broken.start()
  for (let i = 0; i <= MAX_ATTEMPTS + 1; i++) { await runDue(broken.deps, 1e9); broken.advance(LEASE_MS + 1) }
  const d = onlyDraft(broken)
  assert.equal(d.status, "failed"); assert.equal(broken.posts.length, 0); assert.equal(broken.alerts.length, 1)
})

test("a template without a photo field gets the copy and a visible notice instead of a broken call", async () => {
  const w = world({ newsFeedHasMedia: false })
  await w.start()
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(w.designs[0].image, undefined)
  assert.match(w.posts[0].notes, /Not done\n- News feed template has no photo field/)
})

test("ICYMI with no story published in the previous week holds without creating anything", async () => {
  const w = world()
  await w.start({ kind: "icymi" })
  assert.equal(w.store.drafts.size, 0); assert.match((await w.store.getJob("job-icymi-1"))!.note!, /no MCU News or Breaking story was published in the week of 2026-10-05, so there is no ICYMI/)
})

test("sources: licenses, page dates, and only public https hosts", async () => {
  assert.ok(usableLicense("Public domain") && usableLicense("CC BY-SA 4.0") && usableLicense("CC0"))
  assert.ok(!usableLicense("Fair use") && !usableLicense("CC BY-NC 2.0") && !usableLicense(""))
  const p = parsePage("https://www.army.mil/a", `<html><head><title>T</title><meta property="article:published_time" content="2026-10-15T14:00:00Z"><meta property="og:image" content="https://x/y.jpg"></head><body><script>bad()</script><p>Hello &amp; welcome</p></body></html>`)
  assert.equal(p.publishedAt, "2026-10-15T14:00:00Z"); assert.equal(p.image, "https://x/y.jpg"); assert.equal(p.text, "Hello & welcome")
  assert.equal(parsePage("https://x.example/a", "<p>&amp;lt;b&amp;gt; &#8212; &rsquo;&#99999999;</p>").text, "&lt;b&gt; — '&#99999999;") // one pass: no double unescaping
  const resolve = (ips: string[]) => async () => ips
  await assert.rejects(assertPublicHttps("http://www.army.mil/", resolve(["1.2.3.4"])), /https_only/)
  await assert.rejects(assertPublicHttps("https://169.254.169.254/", resolve([])), /not_public/)
  await assert.rejects(assertPublicHttps("https://evil.example/", resolve(["10.0.0.5"])), /not_public/)
  assert.equal((await assertPublicHttps("https://www.army.mil/x", resolve(["23.1.2.3"]))).hostname, "www.army.mil")
})

test("a subject the source can't support is replaced by the pipeline itself, never by asking for a topic (live test, 2026-10-16)", async () => {
  const seen: (string[] | undefined)[] = []
  const w = world({ ai: {
    research: async input => { seen.push(input.avoid); return { candidates: [{ title: "Bumblebee V2 interceptor", primaryUrl: "https://www.army.mil/article/1", publisher: "U.S. Army", why: "dt101" }, { title: "Talon Blue", primaryUrl: "https://www.army.mil/article/2", publisher: "U.S. Army", why: "dt101" }] } },
    write: async ({ story }) => story.title === "Bumblebee V2 interceptor"
      ? { frames: [{ series: "dt101" as SeriesKey, fields: {} }], caption: "", hold: "The source never names the maker." }
      : { frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: "Fly itself.\nBuilt faster.", subject_identifier: "Talon Blue / Northrop Grumman" }, mediaQuery: "Talon Blue" }], caption: BRIEF },
  } })
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(d.story.title, "Talon Blue"); assert.equal(d.autoReplaced, 1)
  assert.deepEqual(seen.at(-1), ["Bumblebee V2 interceptor"])
  assert.ok(d.history.some(h => /couldn't be sourced \(The source never names the maker\); switched to Talon Blue/.test(h.event)))
})

test("DT101 research may add the maker's own page; its text follows the primary's and the review notes link it", async () => {
  const w = world({ ai: { research: async () => ({ candidates: [{ title: "Bumblebee V2 interceptor", primaryUrl: "https://www.army.mil/article/1", publisher: "U.S. Army", why: "dt101", supportingUrls: ["https://maker.example.com/bumblebee", "https://down.example.com/x"] }] }) } })
  const fetchPage = w.deps.fetchPage
  w.deps.fetchPage = async url => url.includes("down.") ? Promise.reject(new Error("unreachable")) : url.includes("maker.") ? { url, title: "Bumblebee V2 — Perennial Autonomy", text: "Perennial Autonomy, headquartered in Austin, Texas, builds the Bumblebee V2 interceptor. ".repeat(4) } : fetchPage(url)
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.deepEqual(d.story.supporting, [{ url: "https://maker.example.com/bumblebee", title: "Bumblebee V2 — Perennial Autonomy" }])
  assert.match(d.story.sourceText, /--- SUPPORTING SOURCE: Bumblebee V2 — Perennial Autonomy \(https:\/\/maker\.example\.com\/bumblebee\) ---\nPerennial Autonomy, headquartered in Austin/)
  assert.match(w.posts[0].notes, /\nAlso: Bumblebee V2 — Perennial Autonomy — https:\/\/maker\.example\.com\/bumblebee/)
  assert.deepEqual(w.posts[0].links, ["https://www.army.mil/article/1", "https://maker.example.com/bumblebee", CANDIDATE.pageUrl])
})

test("a long photo phrase falls back to shorter Commons searches: trimmed phrase, subject, maker (live test, 2026-10-16)", async () => {
  const frame = { series: "dt101" as SeriesKey, fields: { subject_identifier: "SAILDRONE VOYAGER / SAILDRONE" }, mediaQuery: "Saildrone Voyager unmanned surface vehicle at sea, U.S. Navy 4th Fleet Caribbean" }
  assert.deepEqual(mediaQueries(frame, { title: "Saildrone Voyager: 10-meter uncrewed surface vehicle (Saildrone)" }), [
    "Saildrone Voyager unmanned surface vehicle at sea U.S. Navy 4th Fleet Caribbean", "Saildrone Voyager unmanned surface vehicle at", "Saildrone Voyager unmanned",
    "SAILDRONE VOYAGER SAILDRONE", "SAILDRONE VOYAGER", "SAILDRONE", "Saildrone Voyager", "Saildrone Voyager 10-meter uncrewed surface vehicle Saildrone"])
  const searched: string[] = []
  const w = world({ ai: { write: async () => ({ frames: [{ ...frame, fields: { benefit_headline: "Watch the sea.\nNo crew aboard.", subject_identifier: "Saildrone Voyager / Saildrone" } }], caption: BRIEF }) } })
  w.deps.searchCommons = async q => { searched.push(q); return /^SAILDRONE VOYAGER$/i.test(q) ? [CANDIDATE] : [] }
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(d.media[0]!.url, CANDIDATE.url)
  assert.match(searched[0], /4th Fleet Caribbean$/); assert.ok(searched.some(q => /^saildrone voyager$/i.test(q)))
})

test("photo size is read from the file header (JPEG and PNG)", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x9b, 0x03, 0xe8, 0x03, 0, 0, 0, 0])
  assert.deepEqual(imageSize(jpeg), { width: 1000, height: 667 })
  const png = new Uint8Array(24); png.set([0x89, 0x50, 0x4e, 0x47]); png.set([0, 0, 4, 0x38, 0, 0, 5, 0x46], 16)
  assert.deepEqual(imageSize(png), { width: 1080, height: 1350 })
  assert.equal(imageSize(new Uint8Array([1, 2, 3])), null)
})

test("a page's own photo carries its rights: Army credit is public domain; company and courtesy media are flagged", () => {
  const dvids = pageImageCandidate({ url: "https://www.dvidshub.net/image/9500068/panther-avalanche-overland-ai", title: "Panther Avalanche (Overland AI)", image: "https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2601/9500068/1000w_q95.jpg", text: "", description: "The ULTRA is staged for a reconnaissance mission during Panther Avalanche at Fort Bragg, North Carolina, Jan. 29, 2026. (U.S. Army photo by Spc. Nicole Miller)" }, "dvids")!
  assert.equal(dvids.license, "Public domain (U.S. government work)"); assert.equal(dvids.usGovernment, true); assert.equal(dvids.credit, "U.S. Army photo by Spc. Nicole Miller"); assert.equal(dvids.date, "2026-01-29"); assert.equal(dvids.rightsNote, undefined)
  assert.equal(imageLabel({ ...dvids, title: "x" }, "2026-10-16"), "ARCHIVE: U.S. ARMY • 29 JAN 2026")
  const courtesy = pageImageCandidate({ url: "https://www.army.mil/article/1", title: "t", image: "https://www.army.mil/e2/c/images/a.jpg", text: "", description: "The vehicle on test. (Photo courtesy of Overland AI)" }, "source")!
  assert.equal(courtesy.usGovernment, false); assert.equal(courtesy.license, "Courtesy photo"); assert.match(courtesy.rightsNote!, /confirm its terms/)
  const company = pageImageCandidate({ url: "https://www.saildrone.com/press/voyager", title: "Voyager", siteName: "Saildrone", image: "https://www.saildrone.com/v.jpg", text: "" }, "source")!
  assert.equal(company.license, "Official company media"); assert.equal(company.creator, "Saildrone"); assert.match(company.rightsNote!, /saildrone\.com: confirm its terms allow editorial use/)
  assert.equal(pageImageCandidate({ url: "https://x.example.com", title: "t", text: "" }, "source"), null)
})

test("only a federal page's own photo is public domain: state and city .gov, off-site photos and copyright notices are flagged", () => {
  const page = (url: string, image: string, text = "", description = "") => pageImageCandidate({ url, title: "t", image, text, description }, "source")!
  assert.ok(federalHost("www.army.mil") && federalHost("media.defense.gov") && federalHost("www.nasa.gov") && federalHost("www.dvidshub.net") && federalHost("www.fs.fed.us"))
  assert.ok(!federalHost("gov.texas.gov") && !federalHost("www.sanantonio.gov") && !federalHost("tmd.texas.gov") && !federalHost("notdefense.gov.example.com"))
  // A state site's photo: not public domain, no DoD treatment, and the reviewer is told why.
  const state = page("https://gov.texas.gov/news/post/drone-hub", "https://gov.texas.gov/uploads/drone.jpg", "", "(Office of the Governor photo)")
  assert.equal(state.usGovernment, false); assert.equal(state.license, "Government media (confirm terms)"); assert.match(state.rightsNote!, /gov\.texas\.gov is not a federal site, so its photos are not public domain/)
  // A federal page whose share image comes from a contractor's CDN.
  const offsite = page("https://www.army.mil/article/1", "https://cdn.lockheedmartin.com/ifpc.jpg", "", "(U.S. Army photo by Sgt. A)")
  assert.equal(offsite.usGovernment, false); assert.match(offsite.rightsNote!, /served from cdn\.lockheedmartin\.com, not a government media host/)
  // Same site, or DVIDS's image CDN, stays public domain.
  assert.equal(page("https://www.defense.gov/News/1", "https://media.defense.gov/2026/a.jpg", "", "(U.S. Navy photo by PO2 B)").usGovernment, true)
  // A courtesy line far down the page (past the old 4,000-character window) still makes it company media.
  const deep = page("https://www.army.mil/article/2", "https://www.army.mil/e2/a.jpg", `${"Soldiers trained all week. ".repeat(400)}(Photo courtesy of Anduril Industries)`)
  assert.equal(deep.usGovernment, false); assert.equal(deep.license, "Courtesy photo"); assert.equal(deep.creator, "Anduril Industries")
  const notice = page("https://www.af.mil/News/3", "https://www.af.mil/a.jpg", "Story text. © 2026 Boeing. All rights reserved.")
  assert.equal(notice.usGovernment, false); assert.match(notice.rightsNote!, /carries a copyright notice/)
  // DVIDS links its own terms page ("about/copyright") on every public-domain image: that is not a notice.
  assert.equal(page("https://www.dvidshub.net/image/1/x", "https://d34w7g4gy10iej.cloudfront.net/x.jpg", "Terms: https://www.dvidshub.net/about/copyright", "(U.S. Army photo by Spc. C)").usGovernment, true)
  // The credit is the description's, which describes the share photo, not the first one in the article.
  assert.equal(page("https://www.army.mil/article/4", "https://www.army.mil/b.jpg", "(U.S. Army photo by Sgt. Other)", "(U.S. Army photo by Sgt. Right)").credit, "U.S. Army photo by Sgt. Right")
  // The photo search no longer admits a state or city .gov page.
  assert.ok(!searchedPageUsable("https://www.sanantonio.gov/news/x", "x") && searchedPageUsable("https://media.defense.gov/x", "x"))
})

test("sameSubject escapes a designation before matching it (Mk.48 is not Mk-48 or Mkx48)", () => {
  assert.ok(sameSubject("Navy tests Mk.48 torpedo", "the mk.48 heavyweight torpedo was fired"))
  assert.ok(!sameSubject("Navy tests Mk.48 torpedo", "the mkx48 was fired"))
})

test("the crop rule matches the approved card: subject whole, upper 60%, big enough, enough pixels", () => {
  assert.equal(cropFit(1000, 667, { x0: 0.25, y0: 0.05, x1: 0.75, y1: 0.75 }, "feed").ok, true) // ULTRA-like hero subject
  assert.deepEqual(cropFit(1000, 667, { x0: 0.0, y0: 0.2, x1: 0.35, y1: 0.7 }, "feed").problems, ["the 4:5 crop cuts off the subject"])
  assert.ok(cropFit(1080, 1350, { x0: 0.3, y0: 0.7, x1: 0.7, y1: 0.95 }, "feed").problems.includes("the subject sits low, under the text block"))
  assert.ok(cropFit(3000, 2000, { x0: 0.45, y0: 0.4, x1: 0.52, y1: 0.48 }, "feed").problems.includes("the subject is small at phone size"))
  assert.ok(cropFit(760, 900, { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.7 }, "feed").ok)
  assert.ok(cropFit(600, 400, { x0: 0.3, y0: 0.1, x1: 0.7, y1: 0.7 }, "feed").problems.includes("the cropped photo is under 500 px wide"))
  const cands = [{ ...CANDIDATE, width: 1000, height: 667 }, { ...CANDIDATE, pageUrl: "p2", width: 1000, height: 667 }]
  const tiny = { x0: 0.45, y0: 0.4, x1: 0.48, y1: 0.43 } // too small to zoom without going under 600 px of source
  assert.equal(choosePhoto({ index: 0, ranked: [{ index: 0, box: tiny }, { index: 1, box: { x0: 0.25, y0: 0.05, x1: 0.75, y1: 0.75 } }] }, cands, "feed").index, 1)
  // Phase 1b: a photo whose subject can't fit the card is not placed with a note; nothing is chosen.
  const misfit = choosePhoto({ index: 0, ranked: [{ index: 0, box: tiny }] }, cands, "feed")
  assert.equal(misfit.index, null); assert.match("why" in misfit ? misfit.why : "", /no photo of the subject fits the 4:5 card \(#0: the subject is small at phone size\)/)
  assert.ok(choosePhoto({ index: 0, ranked: [{ index: 0, box: { x0: 0, y0: 0.2, x1: 0.3, y1: 0.7 } }] }, cands, "feed").index === 0)
  // The model's bare index, without a subject box, is not a choice (the -05 draft's F-14, 2026-10-17).
  assert.deepEqual(choosePhoto({ index: 0 }, cands, "feed"), { index: null, why: "no candidate shows the subject itself" })
  assert.equal(choosePhoto({ index: null }, cands, "feed").index, null)
})

test("the zoom puts a distant subject into the open space: base at 60% of the card, about 45% tall (Saildrone, 2026-10-16)", () => {
  const box = { x0: 0.42, y0: 0.35, x1: 0.78, y1: 0.65 }
  const c = zoomCrop(2000, 2667, box, "feed")
  assert.ok(Math.abs(c.width * 2000 / (c.height * 2667) - 0.8) < 0.01, "4:5")
  const inCrop = { y0: (box.y0 - c.y) / c.height, y1: (box.y1 - c.y) / c.height, x0: (box.x0 - c.x) / c.width, x1: (box.x1 - c.x) / c.width }
  assert.ok(Math.abs(inCrop.y1 - 0.6) < 0.01, `base at ${inCrop.y1}`); assert.ok(Math.abs(inCrop.y1 - inCrop.y0 - 0.45) < 0.01, "45% of the card tall")
  assert.ok(Math.abs((inCrop.x0 + inCrop.x1) / 2 - 0.5) < 0.01, "centred across"); assert.ok(c.width * 2000 >= 600)
  const edge = zoomCrop(2000, 2667, { x0: 0.85, y0: 0.05, x1: 1, y1: 0.3 }, "feed")
  assert.ok(edge.x + edge.width <= 1.0001 && edge.y >= 0)
  assert.deepEqual(zoomCrop(1000, 667, { x0: 0, y0: 0, x1: 1, y1: 1 }, "feed"), { x: 0.2332, y: 0, width: 0.5336, height: 1 })
  const e = zoomCrop(2000, 2667, box, "feed", false)
  const eIn = { y0: (box.y0 - e.y) / e.height, y1: (box.y1 - e.y) / e.height }
  assert.ok(Math.abs(eIn.y1 - eIn.y0 - 0.62) < 0.01 && Math.abs(eIn.y1 - 0.72) < 0.01, `${eIn.y0}–${eIn.y1}`)
  assert.ok(e.height < c.height, "tighter than with a contextual background")
  const low = zoomCrop(2000, 2667, { x0: 0.42, y0: 0.42, x1: 0.78, y1: 0.75 }, "feed")
  assert.ok(Math.abs(low.y + low.height - 1) < 0.001)
})

test("photos come from the story's pages and DVIDS as well as Commons; the pick is the first whose subject fits the crop", async () => {
  const DVIDS = "https://www.dvidshub.net/image/9500068/panther-avalanche-overland-ai"
  let shownTitles: string[] = []
  const w = world({ ai: {
    findPhotoPages: async () => [DVIDS],
    pickMedia: async ({ candidates }) => { shownTitles = candidates.map(c => `${c.candidate.origin}:${c.candidate.title}`); return { index: 0, reason: "both relevant", ranked: [{ index: 0, box: { x0: 0.45, y0: 0.4, x1: 0.48, y1: 0.43 } }, { index: 1, box: { x0: 0.25, y0: 0.05, x1: 0.75, y1: 0.75 } }] } },
  } })
  const big = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x9b, 0x03, 0xe8, 0x03, 0, 0, 0, 0])
  w.deps.fetchImage = async () => ({ bytes: big, mime: "image/jpeg" })
  w.deps.fetchPage = async url => url === DVIDS
    ? { url, title: "Panther Avalanche (Overland AI)", text: "", image: "https://d1ldvf68ux039x.cloudfront.net/1000w_q95.jpg", description: "ULTRA at Fort Bragg, Jan. 29, 2026. (U.S. Army photo by Spc. Nicole Miller)" }
    : { url, title: "New contract awards support Army C2", text: ARMY_TEXT, publishedAt: "2026-10-16T09:00:00Z", siteName: "Lockheed Martin", image: "https://www.lockheedmartin.com/press.jpg" }
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.deepEqual(shownTitles.slice(0, 2), ["source:New contract awards support Army C2", "dvids:Panther Avalanche (Overland AI)"])
  assert.equal(d.status, "in_review"); assert.equal(d.media[0]!.pageUrl, DVIDS)
  assert.match(d.caption!, /Image: U\.S\. Army photo by Spc\. Nicole Miller/)
  const image = w.designs.at(-1)!.image!
  assert.equal(image.url, "https://d1ldvf68ux039x.cloudfront.net/2000w_q95.jpg") // the larger DVIDS rendition
  assert.deepEqual(image.crop, d.media[0]!.crop); assert.ok(d.media[0]!.crop)
})

test("the artwork check fixes what it can: a photo defect brings the next photo and a new design before the board", async () => {
  let checks = 0
  const second = { ...CANDIDATE, url: "https://upload.wikimedia.org/b.jpg", thumbUrl: "https://upload.wikimedia.org/thumb/b.jpg", pageUrl: "https://commons.wikimedia.org/wiki/File:B.jpg", title: "Vehicle close up" }
  const w = world({ ai: { checkArtwork: async () => checks++ === 0 ? [{ defect: "the subject is hidden under the text block", photo: true }] : [] } })
  w.deps.searchCommons = async () => [CANDIDATE, second]
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(d.mediaRetries, 1); assert.deepEqual(d.avoidMedia, [CANDIDATE.pageUrl]); assert.equal(d.media[0]!.pageUrl, second.pageUrl)
  assert.equal(w.designs.length, 2); assert.match(w.designs[1].requestId, /:m1$/)
  assert.equal(w.posts.length, 1); assert.deepEqual(w.posts[0].designIds, [d.designs[0].designId]); assert.deepEqual(d.qa, [])
})

test("DT101 image label reads like the approved cards", () => {
  assert.equal(imageLabel({ ...CANDIDATE, title: "x", date: "2026-01-29" }, "2026-10-10"), "ARCHIVE: U.S. ARMY • 29 JAN 2026")
  assert.equal(imageLabel({ ...CANDIDATE, title: "x", date: "2026-10-09" }, "2026-10-10"), "IMAGE: U.S. ARMY • 9 OCT 2026")
  assert.equal(imageLabel({ ...CANDIDATE, title: "x", creator: "Northrop Grumman", credit: "Northrop Grumman / CC BY 4.0", usGovernment: false }, "2026-10-10"), "IMAGE: NORTHROP GRUMMAN")
})

test("model settings: text on Haiku 5.5 with Llama 3.3 70B as fallback (plan v8), vision on Sonnet 5.5, routing pinned to zero-retention no-training providers", () => {
  // Founder, 2026-10-18: "Haiku first … Let's lock it in and proceed." Vision moved to its fallback in gate round 1.
  assert.deepEqual(PIPELINE_MODELS, { research: "anthropic/claude-haiku-5.5", write: "anthropic/claude-haiku-5.5", photoSearch: "anthropic/claude-haiku-5.5", photoPick: "anthropic/claude-sonnet-5.5", artworkCheck: "anthropic/claude-sonnet-5.5" })
  assert.deepEqual(FALLBACK_MODELS, { text: "meta/llama-3.3-70b", vision: "anthropic/claude-sonnet-5.5" })
  // Opus 5.5 is no longer a text model or fallback anywhere.
  assert.ok(![...Object.values(PIPELINE_MODELS), ...Object.values(FALLBACK_MODELS), ...Object.values(CALL_FALLBACK)].some(m => /opus/.test(m)))
  assert.deepEqual(CALL_FALLBACK, { research: "meta/llama-3.3-70b", write: "meta/llama-3.3-70b", photoSearch: "meta/llama-3.3-70b", photoPick: "anthropic/claude-sonnet-5.5", artworkCheck: "anthropic/claude-sonnet-5.5" })
  // Haiku keeps the token-trap handling: effort set, thinking never disabled; and the generous budgets stay as they were.
  assert.deepEqual(callOptions("anthropic/claude-haiku-5.5", "medium"), { anthropic: { output_config: { effort: "medium" } }, gateway: { only: ["anthropic", "bedrock", "claudeaws", "vertexAnthropic"], zeroDataRetention: true, disallowPromptTraining: true } })
  assert.equal(outputBudget("anthropic/claude-haiku-5.5", 24_000), 24_000); assert.equal(outputBudget("anthropic/claude-haiku-5.5", 16_000), 16_000)
  // Llama 3.3 70B: Bedrock only (it reports zero retention and no training), and Bedrock caps its output at 8,192.
  assert.deepEqual(callOptions("meta/llama-3.3-70b", "medium"), { gateway: { only: ["bedrock"], zeroDataRetention: true, disallowPromptTraining: true } })
  assert.equal(outputBudget("meta/llama-3.3-70b", 24_000), 8_192)
  // runinfra (no ZDR, may train) is never a route for Nemotron.
  assert.deepEqual(callOptions("nvidia/nemotron-3.5-lightning", "medium"), { gateway: { only: ["deepinfra", "fireworks"], zeroDataRetention: true, disallowPromptTraining: true } })
  // Both qualifying Scout providers, so one at capacity can't stop a run (preview, 2026-10-17).
  assert.deepEqual(callOptions("meta/llama-4-scout", "low"), { gateway: { order: ["deepinfra", "bedrock"], only: ["deepinfra", "bedrock"], zeroDataRetention: true, disallowPromptTraining: true } })
  // The fallbacks keep the token-trap handling (effort, not disabled thinking) and enforce the same retention terms.
  const anthropicOnly = ["anthropic", "bedrock", "claudeaws", "vertexAnthropic"]
  assert.deepEqual(callOptions("anthropic/claude-sonnet-5.5", "low"), { anthropic: { output_config: { effort: "low" } }, gateway: { only: anthropicOnly, zeroDataRetention: true, disallowPromptTraining: true } })
  assert.equal(outputBudget("meta/llama-4-scout", 8_000), 8_000); assert.equal(outputBudget("meta/llama-4-scout", 24_000), 8_192); assert.equal(outputBudget("nvidia/nemotron-3.5-lightning", 24_000), 24_000)
  assert.equal(servedBy({ gateway: { routing: { finalProvider: "fireworks" } } }), "fireworks"); assert.equal(servedBy(undefined), undefined)
})

test("a vision call nobody qualifying can answer goes once to Sonnet 5.5, and the draft's calls record it", async () => {
  const seen: ModelCall[] = [], tried: string[] = []
  const capacity = new Error("The request limited providers for this model and they are currently at capacity")
  const out = await servedCall("photoPick", "meta/llama-4-scout", CALL_FALLBACK.photoPick, c => seen.push(c), async model => { tried.push(model); if (model === "meta/llama-4-scout") throw capacity; return { finishReason: "tool-calls", providerMetadata: { gateway: { routing: { finalProvider: "bedrock" } } }, toolCalls: [{ toolName: "choose_photo", input: { index: 0 } }] } }, r => r.toolCalls[0].input)
  assert.deepEqual(out, { index: 0 }); assert.deepEqual(tried, ["meta/llama-4-scout", "anthropic/claude-sonnet-5.5"])
  assert.equal(seen.length, 1); assert.equal(seen[0].model, "anthropic/claude-sonnet-5.5"); assert.equal(seen[0].fallbackFrom, "meta/llama-4-scout"); assert.match(seen[0].fallbackReason!, /at capacity/)
  // An answer without the required tool call counts as a failure too.
  const noTool = await servedCall("artworkCheck", "meta/llama-4-scout", CALL_FALLBACK.artworkCheck, undefined, async model => ({ finishReason: "stop", model }), r => { if (r.model !== "anthropic/claude-sonnet-5.5") throw new Error("model did not call report_defects"); return "ok" })
  assert.equal(noTool, "ok")
  // A step with no fallback: the error stands and the step retries.
  await assert.rejects(servedCall("write", "nvidia/nemotron-3.5-lightning", undefined, undefined, async () => { throw capacity }, r => r), /at capacity/)
})

test("a text call Haiku 5.5 can't answer goes once to Llama 3.3 70B; when that fails too, it is logged and the step fails with both reasons", async () => {
  const seen: ModelCall[] = [], tried: string[] = [], errors: unknown[][] = []
  const capacity = new Error("The request limited providers for this model and they are currently at capacity")
  const ok = await servedCall("write", PIPELINE_MODELS.write, CALL_FALLBACK.write, c => seen.push(c), async model => { tried.push(model); if (model === "anthropic/claude-haiku-5.5") throw capacity; return { finishReason: "tool-calls", providerMetadata: { gateway: { routing: { finalProvider: "bedrock" } } }, model } }, r => r.model)
  assert.equal(ok, "meta/llama-3.3-70b"); assert.deepEqual(tried, ["anthropic/claude-haiku-5.5", "meta/llama-3.3-70b"])
  assert.equal(seen[0].fallbackFrom, "anthropic/claude-haiku-5.5"); assert.equal(seen[0].provider, "bedrock")
  // Bedrock refusing Llama's forced tool (as it refused Scout's, 2026-10-17): never silent.
  const original = console.error
  console.error = (...a: unknown[]) => { errors.push(a) }
  try {
    await assert.rejects(servedCall("research", PIPELINE_MODELS.research, CALL_FALLBACK.research, undefined, async model => { if (model === "anthropic/claude-haiku-5.5") throw capacity; throw new Error("This model doesn't support the toolConfig.toolChoice.tool field") }, r => r),
      /research: anthropic\/claude-haiku-5\.5 failed \(.*at capacity\); its fallback meta\/llama-3\.3-70b failed too \(This model doesn't support the toolConfig\.toolChoice\.tool field\)/)
  } finally { console.error = original }
  assert.equal(errors.length, 1); assert.equal(errors[0][0], "[content-pipeline] fallback failed")
  assert.deepEqual(JSON.parse(String(errors[0][1])), { step: "research", from: "anthropic/claude-haiku-5.5", to: "meta/llama-3.3-70b", reason: capacity.message, fallbackReason: "This model doesn't support the toolConfig.toolChoice.tool field" })
})

test("a draft on its last attempt shows as failed with its error at once, not as still working", async () => {
  const w = world({ ai: { pickMedia: async () => { throw new Error("every provider at capacity") } } })
  await w.start({ kind: "dt101" })
  for (let i = 0; i < MAX_ATTEMPTS; i++) { w.advance(RETRY_MS + 1); await runDue(w.deps, 1e9) }
  const d = onlyDraft(w)
  assert.equal(d.status, "failed"); assert.match(d.error!, /the media step failed 4 times; last error: every provider at capacity/)
  assert.equal(w.alerts.length, 1); assert.equal(await runDue(w.deps, 1e9), 0)
})

test("properties: the roster's five, only MilCityUSA can generate, and only from templates the worker fills", () => {
  assert.deepEqual(PIPELINE_PROPERTIES.map(p => p.label), ["MilCityUSA", "TXMX Boxing", "VemosVamos", "DEVSA", "Digital Canvas"])
  assert.deepEqual(PIPELINE_PROPERTIES.filter(p => p.active).map(p => p.id), ["milcity"])
  assert.ok(PIPELINE_PROPERTIES.filter(p => !p.active).every(p => p.reason === "No templates connected yet"))
  assert.deepEqual(PROPERTY_TEMPLATES.milcity.map(t => t.kind), ["news", "breaking", "dt101", "icymi"])
  assert.deepEqual(PROPERTY_TEMPLATES.milcity.find(t => t.kind === "dt101")!.templates, [SERIES.dt101.templates.feed])
  assert.ok(propertyCanGenerate("milcity", "dt101")); assert.ok(!propertyCanGenerate("txmx", "news")); assert.ok(!propertyCanGenerate("milcity", "followon_text"))
})

test("photo relevance: archive hits must tie to the story — the Dragon Con 'Hivemind' panel and a logo never reach the pick (production, 2026-10-17)", async () => {
  const hit = (title: string, over: Partial<MediaCandidate> = {}) => ({ ...CANDIDATE, title, description: "", creator: "Someone", usGovernment: false, ...over })
  assert.equal(archiveRelevant(hit("Collin Kelly and Jackson Lanzing, Hivemind Dragon Con September 6 2026 0051.jpg"), "Shield AI"), false)
  assert.equal(archiveRelevant(hit("Hivemind Logo.png"), "Shield AI"), false)
  assert.equal(archiveRelevant(hit("MJK34814 Tina Dalakishvili (Hostages, Berlinale 2017).jpg"), "Shield AI"), false)
  assert.equal(archiveRelevant(hit("V-BAT on the flight line", { description: "Shield AI V-BAT before a demonstration" }), "Shield AI"), true) // names the maker
  assert.equal(archiveRelevant(hit("Hivemind-piloted F-16 test flight"), "Shield AI"), true) // defense context
  assert.equal(archiveRelevant(hit("Soldiers at a command post", { usGovernment: true }), "Lockheed Martin"), true)
  assert.equal(archiveRelevant(hit("U.S. Army insignia", { usGovernment: true }), "Lockheed Martin"), false) // a graphic, not a photo
  // End to end: only the tied hit is shown to the photo pick.
  let shown: string[] = []
  const w = world({ ai: { write: async () => ({ frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: "Fly the jet.\nNo pilot needed.", subject_identifier: "Hivemind / Shield AI" }, mediaQuery: "Hivemind" }], caption: BRIEF }), pickMedia: async ({ candidates }) => { shown = candidates.map(c => c.candidate.title); return { index: 0, reason: "only relevant one", ranked: [{ index: 0, box: HERO }] } } } })
  w.deps.fetchPage = async url => ({ url, title: "t", text: ARMY_TEXT, publishedAt: "2026-10-16T09:00:00Z" }) // no share image
  w.deps.searchCommons = async () => [hit("Collin Kelly, Hivemind Dragon Con September 6 2026 0052.jpg", { pageUrl: "p1", url: "u1" }), hit("Hivemind Logo.png", { pageUrl: "p2", url: "u2" })]
  w.deps.searchMore = async () => [hit("Shield AI Hivemind flies an F-16", { pageUrl: "p3", url: "u3", origin: "openverse" })]
  await w.start({ kind: "dt101" })
  assert.deepEqual(shown, ["Shield AI Hivemind flies an F-16"])
})

test("photo search pages: government and the maker's own site only; news outlets' photos are skipped", () => {
  assert.equal(makerOf({ series: "dt101", fields: { subject_identifier: "ULTRA / OVERLAND AI" } }, { publisher: "U.S. Army" }), "OVERLAND AI")
  assert.equal(makerOf({ series: "news", fields: {} }, { publisher: "U.S. Army" }), "U.S. Army")
  assert.ok(searchedPageUsable("https://www.army.mil/article/1", "Overland AI") && searchedPageUsable("https://www.dvidshub.net/image/1", "x") && searchedPageUsable("https://www.nasa.gov/image-detail/x", "x"))
  assert.ok(searchedPageUsable("https://www.overland.ai/press", "OVERLAND AI") && searchedPageUsable("https://shield.ai/hivemind", "Shield AI"))
  assert.ok(!searchedPageUsable("https://www.defensenews.com/2026/10/x", "Shield AI") && !searchedPageUsable("https://www.gettyimages.com/x", "Shield AI") && !searchedPageUsable("not a url", "x"))
})

test("open archives: Openverse keeps only usable licenses with credit; NASA skips courtesy and copyright items", async () => {
  const json = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })) as never
  const ov = await searchOpenverse("HIMARS", json({ results: [
    { title: "HIMARS live fire", foreign_landing_url: "https://www.flickr.com/photos/a/1", url: "https://live.staticflickr.com/1_b.jpg", creator: "DVIDSHUB", license: "by", license_version: "2.0", source: "flickr", width: 1024, height: 683, filetype: "jpg" },
    { title: "HIMARS parade", foreign_landing_url: "https://www.flickr.com/photos/b/2", url: "https://live.staticflickr.com/2_b.jpg", creator: "Latvijas armija", license: "by-nc-nd", license_version: "2.0", source: "flickr", width: 1024, height: 683 },
    { title: "Tiny", foreign_landing_url: "https://x.example/3", url: "https://x.example/3.jpg", creator: "c", license: "cc0", width: 300, height: 200 },
  ] }))
  assert.equal(ov.length, 1)
  assert.deepEqual({ license: ov[0].license, credit: ov[0].credit, page: ov[0].pageUrl, gov: ov[0].usGovernment, origin: ov[0].origin }, { license: "CC BY 2.0", credit: "DVIDSHUB / CC BY 2.0 via flickr", page: "https://www.flickr.com/photos/a/1", gov: true, origin: "openverse" })
  const nasa = await searchNasa("Artemis", json({ collection: { items: [
    { data: [{ nasa_id: "KSC-1", title: "Artemis I SLS", description: "SLS on the pad.", photographer: "NASA/Ben Smegelsky", date_created: "2022-06-14T00:00:00Z" }] },
    { data: [{ nasa_id: "KSC-2", title: "Launch", description: "Photo courtesy of SpaceX" }] },
  ] } }))
  assert.equal(nasa.length, 1)
  assert.deepEqual({ url: nasa[0].url, page: nasa[0].pageUrl, license: nasa[0].license, credit: nasa[0].credit, date: nasa[0].date }, { url: "https://images-assets.nasa.gov/image/KSC-1/KSC-1~large.jpg", page: "https://images.nasa.gov/details/KSC-1", license: "Public domain (NASA)", credit: "NASA/Ben Smegelsky", date: "2022-06-14" })
})

test("the writer gets MCU's brand direction and the requester's instruction as proactive direction, in every round", async () => {
  const seen: { direction?: string; seeds?: McuSeeds | null }[] = []
  const w = world({ ai: { write: async input => { seen.push({ direction: input.direction, seeds: input.seeds }); return { frames: [{ series: "news" as SeriesKey, fields: { headline: "Army backs 9 C2 software vendors", deck: "Awards worth $93.6 million fund I Corps command software.", source: "ARMY.MIL" } }], caption: "The Army awarded $93.6 million.\n\nSource: U.S. Army, 2026-10-15" } } } })
  await w.start({ topic: "lead with what it means for I Corps soldiers" })
  assert.equal(onlyDraft(w).direction, "lead with what it means for I Corps soldiers")
  assert.ok(seen.length >= 1 && seen.every(s => s.direction === "lead with what it means for I Corps soldiers" && s.seeds?.purpose === SEEDS.purpose))
  assert.match(brandDirection(SEEDS), /^MCU PURPOSE: Invented purpose for tests\.\nWho MCU covers:\n- Builders\n\n$/); assert.equal(brandDirection(null), "")
})

test("seeds: the brief uses them when loaded and says so when not; a malformed set is refused", () => {
  const brief = seedBrief("dt101", SEEDS)
  assert.match(brief, /Example Robotics \(example\.com\)/); assert.match(brief, /Widget 9 — Example Robotics/); assert.match(brief, /already covered: HIMARS/)
  assert.doesNotMatch(seedBrief("news", SEEDS), /Widget 9/)
  assert.match(seedBrief("news", null), /No source seeds are loaded/)
  assert.deepEqual(seedProblems(SEEDS), [])
  assert.ok(seedProblems({ ...SEEDS, orgs: [{ name: "X", site: "x.com", kind: "unknown" }] }).some(p => /^orgs/.test(p)))
  assert.ok(seedProblems({ ...SEEDS, dt101Backlog: [{ subject: "S", maker: "M", url: "http://x" }] }).some(p => /^dt101Backlog/.test(p)))
})

test("review notes stay within the content post's 4,000-character notes field", () => {
  const long: McuDraft = { id: "MCU-NEWS-20261016-01", jobId: "j", kind: "news", placement: "feed", request: { actorEmail: "a@434media.com", actorName: "" }, status: "in_review", version: 1, story: { title: "t", primaryUrl: "https://x.example", publisher: "p", sourceTitle: "s", sourceText: "" }, frames: [], media: [], designs: [], qa: Array.from({ length: 200 }, (_, i) => `check ${i} `.repeat(5)), notices: [], history: [], createdAt: "", updatedAt: "" }
  assert.ok(reviewNotes(long).length <= 4000)
})

// ── Phase 1b: what blocks a fair quality gate (the -05 DT101 draft, production, 2026-10-17) ──
test("recency: News within 7 days and dated; DT101 takes a product page as current but drops a stale article", async () => {
  assert.equal(staleSource("news", "2026-10-10", NOW), null)
  assert.match(staleSource("news", "2026-10-08", NOW)!, /more than 7 days ago/)
  assert.equal(staleSource("news", undefined, NOW), "states no publication date")
  assert.equal(staleSource("dt101", undefined, NOW), null) // the maker's product page
  assert.match(staleSource("dt101", "2025-07-16", NOW)!, /published 2025-07-16, more than 90 days ago/)
  assert.equal(staleSource("breaking", undefined, NOW), null) // Breaking keeps its own 24-hour rule
  // A stale DT101 article falls back to the subject's undated product page.
  const OLD = "https://www.anduril.com/article/anduril-unveils-barracuda-m", PRODUCT = "https://www.anduril.com/barracuda"
  const w = world({ ai: { research: async () => ({ candidates: [{ title: "Barracuda-100M", primaryUrl: OLD, alternateUrls: [PRODUCT], publisher: "Anduril", why: "dt101" }] }) } })
  w.deps.fetchPage = async url => ({ url, title: url === OLD ? "Anduril Unveils Barracuda-M" : "Barracuda", text: ARMY_TEXT, ...(url === OLD ? { publishedAt: "2025-07-16T12:00:00Z" } : {}) })
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.story.primaryUrl, PRODUCT); assert.equal(d.story.publishedAt, undefined)
  // News older than a week drops; with nothing else, the job ends on the notice card and says why.
  const old = world({ pagePublished: "2026-10-01T09:00:00Z", ai: { research: async () => ({ candidates: [{ title: "Old award", primaryUrl: "https://www.army.mil/article/9", publisher: "U.S. Army", why: "news" }] }) } })
  await old.start({ kind: "news" })
  assert.match((await old.store.getJob("job-news-1"))!.note!, /Old award: source page unreachable, unreadable or out of date \(https:\/\/www\.army\.mil\/article\/9 published 2026-10-01, more than 7 days ago\)/)
})

test("card copy uses whole words: a clipped word is rewritten, and a word the source prints is allowed", async () => {
  assert.deepEqual(clippedWords({ benefit_headline: "FAST DEPLOYMENT\nLOW COST PROD", subject_identifier: "BARRACUDA-100M / ANDURIL" }), ["PROD"])
  assert.deepEqual(clippedWords({ headline: "GOV'T BACKS MFG SURGE", source: "DEPT OF WAR" }), ["GOV'T", "MFG"])
  assert.deepEqual(clippedWords({ headline: "HIMARS FIRES. RELOCATES." }), [])
  assert.deepEqual(clippedWords({ headline: "PROD LINE OPENS" }, "The PROD line at the plant"), [])
  let rounds = 0, problems: string[] = []
  const w = world({ ai: { write: async i => { rounds++; problems = i.problems ?? problems; return { frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: rounds === 1 ? "Fast deployment\nLow cost prod" : "Fast deployment\nLow cost build", subject_identifier: "Barracuda / Anduril" }, mediaQuery: "Barracuda" }], caption: BRIEF } } } })
  await w.start({ kind: "dt101" })
  assert.equal(rounds, 2); assert.match(problems.join(";"), /abbreviated words on the card \(PROD\)/)
  assert.equal(onlyDraft(w).frames[0].fields.benefit_headline, "FAST DEPLOYMENT\nLOW COST BUILD")
})

test("the post carries its Property: MilCityUSA on drafts and on the no-new-content card", async () => {
  assert.equal(contentPropertyOf("milcity"), "MilCityUSA"); assert.equal(contentPropertyOf(undefined), "MilCityUSA")
  assert.ok(CONTENT_PROPERTIES.includes("MilCityUSA")); assert.ok(BRANDS.every(b => CONTENT_PROPERTIES.includes(b)))
  assert.ok(!(BRANDS as string[]).includes("MilCityUSA")) // Brand itself is unchanged
  const w = world()
  await w.start({ kind: "dt101", property: "milcity" })
  assert.equal(w.posts[0].property, "MilCityUSA")
  const none = world({ ai: { research: async () => ({ candidates: [], note: "nothing new" }) } })
  await none.start({ kind: "news" })
  assert.equal(none.notices[0].property, "MilCityUSA")
})

test("artwork check: a clipped headline is a text defect and never spends a photo retry; text over a face still does", () => {
  assert.equal(isPhotoDefect("photo", "benefit headline text is clipped"), false) // the 2026-10-17 mislabel
  assert.equal(isPhotoDefect("photo", "subject line text overflows"), false)
  assert.equal(isPhotoDefect("photo", "text over a face"), true)
  assert.equal(isPhotoDefect("photo", "the photo does not show the Barracuda-100M"), true)
  assert.equal(isPhotoDefect("photo", "the 4:5 crop cuts off the subject"), true)
  assert.equal(isPhotoDefect("text", "the subject is cut off"), false) // the area decides first
  assert.equal(isPhotoDefect("layout", "an empty slot is showing"), false)
})

test("photo pick: only exact matches with a subject box count; what the others showed is kept (the -05 F-14)", () => {
  const box = { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.6 }
  const r = readPick({ index: 0, reason: "best available", ranked: [
    { index: 0, shows: "a blurry F-14 in a hangar", match: "related", ...box },
    { index: 1, shows: "Barracuda-100M on a launch rail", match: "exact", ...box },
    { index: 2, shows: "the Barracuda-100M", ...box }, // no match given
    { index: 3, shows: "Barracuda-100M", match: "exact", x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.5 }, // no box
    { index: 9, shows: "out of range", match: "exact", ...box },
  ] }, 4)
  assert.equal(r.index, 1); assert.deepEqual(r.ranked!.map(x => x.index), [1]); assert.equal(r.ranked![0].shows, "Barracuda-100M on a launch rail")
  assert.deepEqual(r.turnedDown, ["#0 related: a blurry F-14 in a hangar", "#2 no match given: the Barracuda-100M", "#3 exact: Barracuda-100M"])
  assert.deepEqual(readPick({ index: 0, reason: "none fit" }, 2), { index: null, reason: "none fit" })
})

test("no photo of the subject fits: the subject is replaced, and its design gets its own Canva request id", async () => {
  let picks = 0
  const w = world({ ai: { pickMedia: async () => ++picks === 1 ? { index: 0, reason: "only a tiny view", ranked: [{ index: 0, box: { x0: 0.45, y0: 0.4, x1: 0.47, y1: 0.42 } }] } : { index: 0, reason: "relevant", ranked: [{ index: 0, box: HERO }] } } })
  w.deps.searchCommons = async () => [{ ...CANDIDATE, width: 1000, height: 667 }]
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(d.autoReplaced, 1); assert.equal(d.story.title, "Second story")
  assert.ok(d.history.some(h => /couldn't be sourced \(no relevant, licensed photo was found \("Army command post"\): no photo of the subject fits the 4:5 card/.test(h.event)))
  assert.equal(w.designs.length, 1); assert.equal(w.designs[0].requestId, "admin:MCU-DT101-20261016-01:v1:f1:r1")
})

// ── Phase 1b, gate round 1 (production, 2026-10-17 18:40Z: seven runs, none reached Review) ──
test("crop: a wide subject may lose its ends when its core stays in frame (the Steelfin render, the NGC2 soldiers)", () => {
  const render = [{ ...CANDIDATE, width: 1200, height: 630 }]
  const wide = { x0: 0.18, y0: 0.03, x1: 0.82, y1: 0.98 }
  assert.equal(choosePhoto({ index: 0, ranked: [{ index: 0, box: wide, context: false }] }, render, "feed").index, null) // round 1: always cut off
  const r = choosePhoto({ index: 0, ranked: [{ index: 0, box: wide, core: { x0: 0.38, y0: 0.15, x1: 0.62, y1: 0.85 }, context: false }] }, render, "feed")
  assert.equal(r.index, 0)
  const scene = [{ ...CANDIDATE, width: 2000, height: 1334 }]
  const s = choosePhoto({ index: 0, ranked: [{ index: 0, box: { x0: 0.06, y0: 0.06, x1: 0.95, y1: 0.9 }, core: { x0: 0.3, y0: 0.1, x1: 0.62, y1: 0.6 } }] }, scene, "feed")
  assert.equal(s.index, 0)
  // The crop is centred on the core, not on the whole subject.
  if (s.index !== null) assert.ok(s.crop.x <= 0.3 && s.crop.x + s.crop.width >= 0.62)
  // A core that the crop still cuts is refused.
  assert.equal(choosePhoto({ index: 0, ranked: [{ index: 0, box: wide, core: { x0: 0.18, y0: 0.15, x1: 0.82, y1: 0.85 }, context: false }] }, render, "feed").index, null)
})

test("photo pick: representative photos count only where the story allows them, after any exact match", () => {
  const box = { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.6 }
  const raw = { index: 0, reason: "r", ranked: [
    { index: 0, shows: "soldiers testing NGC2 on laptops aboard a C-17", match: "representative", ...box, core: { x0: 0.3, y0: 0.2, x1: 2, y1: 0.5 } },
    { index: 1, shows: "the NGC2 command post vehicle", match: "exact", ...box },
  ] }
  const news = readPick(raw, 2, true)
  assert.deepEqual(news.ranked!.map(x => [x.index, !!x.representative]), [[1, false], [0, true]]); assert.equal(news.index, 1)
  assert.deepEqual(news.ranked![1].core, { x0: 0.3, y0: 0.2, x1: 0.8, y1: 0.5 }) // clipped to the subject box
  const dt = readPick(raw, 2, false)
  assert.deepEqual(dt.ranked!.map(x => x.index), [1]); assert.match(dt.turnedDown![0], /^#0 representative:/)
  assert.equal(allowsRepresentative({ series: "news", fields: {} }), true); assert.equal(allowsRepresentative({ series: "icymi_story", fields: {} }), true); assert.equal(allowsRepresentative({ series: "dt101", fields: {} }), false)
})

test("a News draft may go to Review on a representative photo, with a note for the reviewer; DT101 never asks for one", async () => {
  const asked: boolean[] = []
  const w = world({ ai: { pickMedia: async ({ representative }) => { asked.push(!!representative); return { index: 0, reason: "soldiers using it", ranked: [{ index: 0, box: HERO, representative: true, shows: "soldiers testing NGC2" }] } } } })
  await w.start({ kind: "news" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.deepEqual(asked, [true])
  assert.match(d.media[0]!.note!, /Representative photo \(soldiers testing NGC2\), not the event itself/)
  assert.match(w.posts[0].notes, /Representative photo/)
  const dt = world({ ai: { pickMedia: async ({ representative }) => { asked.push(!!representative); return { index: 0, reason: "ok", ranked: [{ index: 0, box: HERO }] } } } })
  await dt.start({ kind: "dt101" })
  assert.equal(asked.at(-1), false)
})

test("repeat stories: a story another draft is working on is refused, across jobs and within a job", async () => {
  const w = world()
  // Another job already opened the first story.
  await w.store.createDraft({ ...structuredClone(onlyDraftShape()), id: "MCU-DT101-20261016-01", jobId: "job-other", story: { title: "Army picks nine C2 software vendors", primaryUrl: "https://www.army.mil/article/1/", publisher: "U.S. Army", sourceTitle: "t", sourceText: "x" } })
  const drafting: string[][] = []
  w.deps.ai = (inner => (onCall: (c: ModelCall) => void) => { const ai = inner(onCall); return { ...ai, research: async (i: Parameters<McuAi["research"]>[0]) => { drafting.push(i.drafting ?? []); return ai.research(i) } } })(w.deps.ai)
  await w.start({ kind: "news" })
  const mine = [...w.store.drafts.values()].map(v => v.draft).filter(d => d.jobId === "job-news-1")
  assert.equal(mine.length, 1); assert.equal(mine[0].story.primaryUrl, "https://www.army.mil/article/2") // the second story, not the taken one
  assert.deepEqual(drafting[0], ["Army picks nine C2 software vendors"])
})
function onlyDraftShape(): McuDraft {
  return { id: "x", jobId: "x", kind: "news", placement: "feed", request: { actorEmail: "a@b.c", actorName: "A" }, status: "in_review", version: 1, story: { title: "", primaryUrl: "", publisher: "", sourceTitle: "", sourceText: "" }, frames: [], media: [], designs: [], qa: [], notices: [], history: [], createdAt: new Date(NOW).toISOString(), updatedAt: new Date(NOW).toISOString() }
}


test("a redirect to plain http is followed over https, and a blocked hop is named", async () => {
  const check = (raw: string) => assertPublicHttps(raw, async () => ["93.184.216.34"])
  const asked: string[] = []
  const fetcher = async (u: URL) => { asked.push(u.toString()); return u.pathname === "/a" ? new Response(null, { status: 301, headers: { location: "http://breakingdefense.example/a/" } }) : new Response("ok", { status: 200 }) }
  const res = await guardedFetch("https://breakingdefense.example/a", fetcher, "text/html", check)
  assert.equal(res.status, 200); assert.deepEqual(asked, ["https://breakingdefense.example/a", "https://breakingdefense.example/a/"])
  const toPrivate = async () => new Response(null, { status: 302, headers: { location: "https://localhost/x" } })
  await assert.rejects(guardedFetch("https://breakingdefense.example/a", toPrivate, "text/html", check), /not_public \(redirect to https:\/\/localhost\/x\)/)
})

// ── Phase 1b, gate round 2 (production, 2026-10-17 19:20Z: four in Review, one News held, Breaking and ICYMI notice cards) ──
test("outlets: never a primary source or a photo source; a site's slogan never becomes the credit", () => {
  assert.equal(isOutlet("https://www.defensenews.com/land/2026/10/16/kbr-firefly/"), true)
  assert.equal(isOutlet("https://news.example/a", ["news.example"]), true) // the seeds' outlets count too
  assert.equal(isOutlet("https://www.l3harris.com/newsroom/press-release/2026/10/vampire"), false)
  assert.equal(pageImageCandidate({ url: "https://www.defensenews.com/a", title: "KBR Firefly", text: "", image: "https://www.defensenews.com/a.jpg", siteName: "Defense News" }, "source"), null)
  assert.equal(searchedPageUsable("https://www.defensenews.com/a", "Defense News"), false) // the publisher fallback can't admit an outlet
  const l3 = pageImageCandidate({ url: "https://www.l3harris.com/newsroom/vampire", title: "VAMPIRE", text: "", image: "https://www.l3harris.com/v.jpg", siteName: "L3Harris® Fast. Forward." }, "source")!
  assert.equal(l3.creator, "L3Harris"); assert.equal(l3.credit, "L3Harris (courtesy)"); assert.equal(imageLabel({ ...CHOSEN, creator: l3.creator, credit: l3.credit, usGovernment: false }), "IMAGE: L3HARRIS")
  assert.equal(siteOrg("Lockheed Martin | Newsroom", "news.lockheedmartin.com"), "Lockheed Martin"); assert.equal(siteOrg(undefined, "www.anduril.com"), "anduril.com")
})
const CHOSEN = { url: "u", pageUrl: "p", title: "t", license: "Official company media", creator: "c", credit: "c", usGovernment: false }

test("research: an outlet's article is skipped for the subject's own page, and a supporting page must be about the subject", async () => {
  const OUTLET = "https://www.defensenews.com/air/2026/10/16/talon-blue/", OWN = "https://news.northropgrumman.com/news/releases/yfq-48a-talon-blue-first-autonomous-flight", RAID = "https://news.northropgrumman.com/news/releases/raid-hunter", HQ = "https://www.northropgrumman.com/who-we-are"
  const w = world({ ai: { research: async () => ({ candidates: [{ title: "YFQ-48A Talon Blue completes first autonomous flight", primaryUrl: OUTLET, alternateUrls: [OWN], supportingUrls: [RAID, HQ], publisher: "Defense News", why: "dt101" }] }) } })
  w.deps.fetchPage = async url => ({ url, title: url === RAID ? "Raid Hunter counter-drone kit" : url === HQ ? "Who we are: Northrop Grumman, Falls Church, Virginia" : "YFQ-48A Talon Blue flies itself", text: url === RAID ? ARMY_TEXT : url === HQ ? `${ARMY_TEXT} Northrop Grumman is headquartered in Falls Church.` : `${ARMY_TEXT} The YFQ-48A Talon Blue.`, publishedAt: "2026-10-16T09:00:00Z" })
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.story.primaryUrl, OWN); assert.deepEqual(d.story.supporting?.map(x => x.url), [HQ])
  // Only an outlet's article: the story is left out, and the reason says why.
  const only = world({ ai: { research: async () => ({ candidates: [{ title: "KBR Firefly", primaryUrl: OUTLET, publisher: "Defense News", why: "news" }], note: "Candidates selected based on relevance and recency." }) } })
  await only.start({ kind: "news" })
  const note = (await only.store.getJob("job-news-1"))!.note!
  assert.match(note, /news outlet's article, not the primary source/); assert.doesNotMatch(note, /Candidates selected/) // no model chatter
  assert.equal(sameSubject("YFQ-48A Talon Blue completes first autonomous flight", "the raid hunter kit"), false)
  assert.equal(sameSubject("L3Harris VAMPIRE Counter-UAS System", "VAMPIRE is a counter-UAS kit by L3Harris"), true)
})

test("a template without a photo field: no photo is searched or required, and the artwork check isn't asked to judge one", async () => {
  let picks = 0, noPhoto: boolean | undefined
  const w = world({ newsFeedHasMedia: false, ai: { pickMedia: async () => { picks++; return { index: null, reason: "none" } }, checkArtwork: async i => { noPhoto = i.noPhoto; return [] } } })
  await w.start({ kind: "news" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(picks, 0); assert.equal(noPhoto, true); assert.deepEqual(d.media, [null])
  assert.ok(d.notices.some(n => /News feed template has no photo field, so no photo was searched for frame 1: connect its photo frame/.test(n)))
  assert.equal(w.designs[0].image, undefined)
})

test("caption and deck rules: the DT101 mission brief, a source line of its own, a deck that is a sentence", async () => {
  const seen: string[][] = []
  let n = 0
  const w = world({ ai: { write: async i => { seen.push(i.problems ?? []); n++; return n === 1
    ? { frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: "Stop the drone.\nGuard the base.", subject_identifier: "Next-gen C2 / Lockheed Martin" } }], caption: "The Army picked a laser.\n\nIt helps.\n\nMore soon. Source: U.S. Army, 2026-10-15" }
    : { frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: "Stop the drone.\nGuard the base.", subject_identifier: "Next-gen C2 / Lockheed Martin" } }], caption: BRIEF } } } })
  await w.start({ kind: "dt101" })
  assert.equal(onlyDraft(w).status, "in_review"); assert.equal(n, 2)
  assert.match(seen[1].join(" | "), /source on a line of its own/); assert.match(seen[1].join(" | "), /must be the mission brief/); assert.match(seen[1].join(" | "), /no "Tech:" line/)
  let m = 0
  const news = world({ ai: { write: async i => { seen.push(i.problems ?? []); m++; return { frames: [{ series: "news" as SeriesKey, fields: { headline: "Army backs C2 vendors", deck: m === 1 ? "Army C2 software pilot for I Corps, nine vendors" : "The Army picked nine vendors for C2 software.", source: "ARMY.MIL" } }], caption: "The Army picked nine C2 software vendors.\n\nSource: U.S. Army, 2026-10-15" } } } })
  await news.start({ kind: "news" })
  assert.equal(m, 2); assert.match(seen.at(-1)!.join(" | "), /the deck must be one complete sentence/)
})

// ── ICYMI, founder ruling (2026-10-17): up to five stories from the previous week, by recency for now ──
test("ICYMI window: the previous Monday-to-Sunday week in Chicago, or the last N days when a super-admin widens it", () => {
  const fri = Date.parse("2026-10-16T18:00:00Z")
  const w = icymiWindow(fri, null)
  assert.equal(new Date(w.startMs).toISOString(), "2026-10-05T05:00:00.000Z"); assert.equal(new Date(w.endMs).toISOString(), "2026-10-12T05:00:00.000Z") // CDT midnights
  const mondayEarly = icymiWindow(Date.parse("2026-10-12T04:30:00Z"), null) // still Sunday night in Chicago
  assert.equal(new Date(mondayEarly.endMs).toISOString(), "2026-10-05T05:00:00.000Z")
  const winter = icymiWindow(Date.parse("2026-12-09T18:00:00Z"), null)
  assert.equal(new Date(winter.startMs).toISOString(), "2026-11-30T06:00:00.000Z") // CST
  const wide = icymiWindow(fri, 14)
  assert.equal(wide.endMs - wide.startMs, 14 * 864e5); assert.equal(wide.label, "the last 14 days")
})


// ── Phase 1b, gate round 3 (production, 2026-10-17 19:53Z: none reached Review) ──
test("a subject switch rewrites everything: the old subject's copy never survives, and copy about another subject is rewritten", async () => {
  let writes = 0
  const RAID = "MISSION BRIEF // RAID HUNTER\n\n//Northrop Grumman\n\nTech: Counter-drone\n\nPlatform: Kit\n\nGoal: Stop drones.\n\nSource: Northrop Grumman, 11AUG26"
  const w = world({ ai: {
    research: async ({ avoid }) => ({ candidates: [avoid?.length ? { title: "Next-gen C2 software for I Corps", primaryUrl: "https://www.army.mil/article/2", publisher: "U.S. Army", why: "dt101" } : { title: "Raid Hunter counter-drone kit", primaryUrl: "https://www.army.mil/article/1", publisher: "U.S. Army", why: "dt101" }] }),
    // First the writer holds the first subject; then, for the new one, it repeats the old mission brief once.
    write: async ({ story }) => { writes++; return writes === 1 ? { frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: "Stop the drone.\nGuard the base.", subject_identifier: "Raid Hunter / Northrop Grumman" } }], caption: RAID, hold: "the source gives no headquarters" } : { frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: "Link the fight.\nDecide faster.", subject_identifier: writes === 2 ? "Raid Hunter / Northrop Grumman" : "Next-gen C2 / Lockheed Martin" } }], caption: writes === 2 ? RAID : BRIEF, ...(story ? {} : {}) } },
  } })
  w.deps.fetchPage = async url => ({ url, title: url.endsWith("/1") ? "Raid Hunter" : "Next-gen C2 software", text: url.endsWith("/1") ? `${ARMY_TEXT} Raid Hunter counter-drone kit.` : `${ARMY_TEXT} Next-gen C2 software for I Corps.`, publishedAt: "2026-10-16T09:00:00Z" })
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(d.autoReplaced, 1); assert.equal(d.story.title, "Next-gen C2 software for I Corps")
  assert.ok(d.caption!.startsWith("MISSION BRIEF // NEXT-GEN C2")); assert.doesNotMatch(d.caption!, /RAID HUNTER/)
  assert.ok(d.history.some(h => /copy written/.test(h.event)))
  assert.equal(writes, 3) // the repeat of the old brief was caught and rewritten
})

test("a writer hold of \"None\" is no hold, and model chatter never reaches a hold reason", async () => {
  assert.equal(meaningful("None"), undefined); assert.equal(meaningful(" n/a. "), undefined); assert.equal(meaningful("null"), undefined)
  assert.equal(meaningful("The source gives no figure for the award."), "The source gives no figure for the award.")
  const w = world({ ai: { write: async () => ({ frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: "Link the fight.\nDecide faster.", subject_identifier: "Next-gen C2 / Lockheed Martin" } }], caption: BRIEF, hold: "None" }) } })
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(d.autoReplaced, undefined)
})

test("the store replaces a draft on save, so a cleared field is cleared in Firestore too", async () => {
  const calls: { data: unknown; opts: unknown }[] = []
  const fakeDb = { collection: () => ({ doc: () => ({ set: async (data: unknown, opts: unknown) => { calls.push({ data, opts }) } }) }) } as unknown as FirebaseFirestore.Firestore
  const store = firestorePipelineStore(fakeDb)
  await store.saveDraft({ ...onlyDraftShape(), caption: undefined })
  await store.saveJob(job())
  assert.deepEqual(calls.map(c => c.opts), [{ mergeFields: ["draft"] }, { mergeFields: ["job"] }])
  assert.equal("caption" in ((calls[0].data as { draft: Record<string, unknown> }).draft), false)
})


test("a pipeline post records the photo it used, with its rights, as pipeline_media", async () => {
  const w = world()
  await w.start({ kind: "news" })
  assert.equal(w.posts.length, 1)
  const [m] = w.posts[0].media
  assert.equal(m.url, CANDIDATE.url); assert.equal(m.pageUrl, CANDIDATE.pageUrl); assert.equal(m.license, CANDIDATE.license); assert.equal(m.credit, CANDIDATE.credit); assert.equal(m.usGovernment, true)
  assert.equal("crop" in m, false); assert.equal("note" in m, false) // the record is the photo and its rights, not the review notes
})
test("News dated by an outlet's recent report of the same event: the official page may be older; the outlet is never cited (founder, 2026-10-18)", async () => {
  const PRIMARY = "https://www.army.mil/article/1", REPORT = "https://www.defensenews.com/2026/10/15/army-c2"
  const candidate = { title: "Army picks nine C2 software vendors", primaryUrl: PRIMARY, publisher: "U.S. Army", why: "news", reportUrl: REPORT, reportPublishedAt: "2026-10-15" }
  const judged: string[] = []
  const make = (same: boolean) => {
    const w = world({ ai: { research: async () => ({ candidates: [candidate] }), sameEvent: async ({ report, primary }) => { judged.push(`${report.url} vs ${primary.url}`); return { same, reason: same ? "the same award" : "the page is the 2024 program launch the report mentions" } } } })
    w.deps.fetchPage = async url => url === REPORT ? { url, title: "Army awards nine companies C2 software deals", text: ARMY_TEXT, publishedAt: "2026-10-15T12:00:00Z" } : { url, title: "Army awards C2 contracts", text: ARMY_TEXT, publishedAt: "2026-09-20T09:00:00Z" }
    return w
  }
  const w = make(true)
  await w.start({ kind: "news" })
  const d = onlyDraft(w)
  assert.equal(d.story.primaryUrl, PRIMARY); assert.equal(d.story.publishedAt, "2026-09-20"); assert.equal(d.story.reportedAt, "2026-10-15")
  assert.equal(d.frames[0].fields.date, "15OCT26") // the card is dated by the report
  assert.deepEqual(w.posts[0].links.filter(l => l === REPORT), []) // never cited on the post
  assert.match(reviewNotes(d), /Dated by a news report\nThe official page is older; a news outlet reported the same event on 2026-10-15/)
  assert.deepEqual(judged, [`${REPORT} vs ${PRIMARY}`])
  // The official page is an older announcement the report only mentions: the story drops, with the reason.
  const no = make(false)
  await no.start({ kind: "news" })
  assert.match((await no.store.getJob("job-news-1"))!.note!, /more than 7 days ago; the official page is not the event the outlet reported \(the page is the 2024 program launch/)
  // A report older than the window doesn't date anything; nor does one that isn't an outlet's.
  const stale = world({ ai: { research: async () => ({ candidates: [{ ...candidate, reportPublishedAt: "2026-10-01" }] }), sameEvent: async () => ({ same: true, reason: "" }) } })
  stale.deps.fetchPage = async url => ({ url, title: "Army awards C2 contracts", text: ARMY_TEXT, publishedAt: url === REPORT ? "2026-10-01T12:00:00Z" : "2026-09-20T09:00:00Z" })
  await stale.start({ kind: "news" })
  assert.match((await stale.store.getJob("job-news-1"))!.note!, /the outlet's report is not from the last 7 days/)
})

test("an official page that refuses the fetch is read through the search tool's extracted text; an outlet never is (founder, 2026-10-18)", async () => {
  const GOV = "https://www.defense.gov/News/Releases/Release/Article/1", read: string[] = []
  const w = world({ ai: { research: async () => ({ candidates: [{ title: "Army picks nine C2 software vendors", primaryUrl: GOV, publisher: "Department of War", why: "news" }] }), readRefusedPage: async url => { read.push(url); return { url, title: "Army awards C2 contracts", text: ARMY_TEXT, publishedAt: "2026-10-16" } } } })
  const fetched = w.deps.fetchPage
  w.deps.fetchPage = async url => { if (url === GOV) throw new Error("http_403"); return fetched(url) }
  await w.start({ kind: "news" })
  const d = onlyDraft(w)
  assert.equal(d.story.primaryUrl, GOV); assert.deepEqual(d.story.readViaSearch, [GOV]); assert.deepEqual(read, [GOV])
  assert.match(reviewNotes(d), /Read through the search tool\nThese official pages refused the pipeline's fetch/)
  // An outlet is skipped before any fetch, and a server error is not a refusal: neither is read through the search.
  const OUT = "https://www.defensenews.com/2026/10/16/x", BROKEN = "https://www.army.mil/article/5"
  const v = world({ ai: { research: async () => ({ candidates: [{ title: "Army picks nine C2 software vendors", primaryUrl: OUT, alternateUrls: [BROKEN], publisher: "Defense News", why: "news" }] }), readRefusedPage: async url => { read.push(url); return null } } })
  v.deps.fetchPage = async url => { throw new Error(url === BROKEN ? "http_500" : "http_403") }
  await v.start({ kind: "news" })
  assert.deepEqual(read, [GOV]) // nothing new was read through the search
  assert.match((await v.store.getJob("job-news-1"))!.note!, /news outlet's article, not the primary source; http_500 at https:\/\/www\.army\.mil\/article\/5/)
})

// ── Phase 1c, gate round 5 (production 5e42ad8, 2026-10-18: text on Claude Haiku 5.5) ──
// The simpler ICYMI (founder, 2026-10-18): one new cover with the fixed headline, then each chosen story's own
// published card exactly as posted; 3 to 5 of the previous week's News and Breaking posts; more than 5 waits for the
// requester's choice; fewer than 3 makes a no-content card.
const ROUNDUP_CAPTION = "This week's top defense developments, in one place.\n\nSource: MilCityUSA"
/** A published News post in the previous week (the week of 2026-10-05 for NOW), newest first by n, with its staged card. */
const published = (n: number, over: Partial<PostRow> = {}): PostRow => ({ id: `p${n}`, title: `MCU-NEWS-2026100${Math.min(9, n)}-01 v1 — STORY ${n}`, status: "posted", publishedUrl: `https://www.instagram.com/milcityusa/p/${n}/`, caption: `Story ${n} caption.\n\nSource: U.S. Army, 2026-10-0${Math.min(9, n)}`, publishedAt: `2026-10-${String(12 - n).padStart(2, "0")}T15:00:00Z`, card: { url: `https://blob.example/content-posts/p${n}-01-page-1.jpg`, sha256: `sha-${n}` }, ...over })
/** A writer that answers only for the cover: one row per story. */
const coverWriter = (rows: (n: number) => string = n => `Story ${n} in one row`) => async (i: { story: { roundup?: unknown[] }; fit?: string[] }) => ({ frames: [{ series: "icymi_cover" as SeriesKey, fields: Object.fromEntries((i.story.roundup ?? []).map((_, k) => [`story_0${k + 1}`, rows(k + 1)])) }], caption: ROUNDUP_CAPTION })

test("ICYMI with 4 eligible posts: one cover with the fixed headline and four rows, then the four published cards as they were posted, in order", async () => {
  const writes: { fit?: string[]; frames?: number }[] = [], picks: string[] = [], checked: string[] = []
  const w = world({ ai: {
    write: async i => { writes.push({ ...(i.fit ? { fit: i.fit } : {}) }); return coverWriter()(i) },
    pickMedia: async ({ story }) => { picks.push(story.title); return { index: 0, reason: "ok", ranked: [{ index: 0, box: HERO }] } },
    checkArtwork: async ({ frame }) => { checked.push(frame.series); return [] },
  } })
  // A DT101 mission brief, an older post, a repeat title and a post with no staged card are left out.
  w.deps.content.recentPosts = async () => [published(1), published(2), published(3), published(4), published(5, { title: "ULTRA explainer", caption: "MISSION BRIEF // ULTRA\n\n//Overland AI" }), published(6, { publishedAt: "2026-09-20T13:00:00Z" }), published(7, { title: published(1).title }), published(8, { card: undefined })]
  await w.start({ kind: "icymi" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review")
  assert.deepEqual(d.story.roundup!.map(r => r.postId), ["p1", "p2", "p3", "p4"])
  // Only the cover is written, filled in Canva and checked; nothing is written, photographed or checked per story.
  assert.equal(d.frames.length, 1); assert.equal(d.frames[0].series, "icymi_cover"); assert.equal(writes.length, 1)
  assert.equal(w.designs.length, 1); assert.deepEqual(checked, ["icymi_cover"]); assert.equal(picks.length, 1)
  const cover = w.designs[0].text
  assert.equal(cover.headline, "TOP DEFENSE DEVELOPMENTS") // the profile's fixed value, never the model's
  assert.deepEqual([cover.story_01, cover.story_04, cover.story_05], ["Story 1 in one row", "Story 4 in one row", " "]) // the unused slot is blanked
  assert.equal(cover.story_numbers, "01\n02\n03\n04") // only the rows used are numbered (EAHYYaSYfJI)
  assert.equal(w.designs[0].templateId, "EAHYYaSYfJI")
  assert.ok(!d.notices.some(n => /ICYMI cover: 4 of 5 story slots used/.test(n)))
  // The board write: the cover's export, then each story's own staged card, exactly as posted, in order.
  assert.equal(w.posts.length, 1)
  assert.deepEqual(w.posts[0].designIds, [d.designs[0].designId])
  assert.deepEqual(w.posts[0].slides, [1, 2, 3, 4].map(n => ({ url: `https://blob.example/content-posts/p${n}-01-page-1.jpg`, label: `story-${n}` })))
  assert.ok([1, 2, 3, 4].every(n => w.posts[0].links.includes(`https://www.instagram.com/milcityusa/p/${n}/`)))
  assert.match(w.posts[0].notes, /Story slides \(each story's published card, reused exactly as posted\)\n1\. MCU-NEWS-20261001-01 v1 — STORY 1 — post p1/)
  // The window is unchanged: the same posts give nothing for a Friday in the week after next.
  assert.ok("hold" in icymiStory([published(1)], icymiWindow(Date.parse("2026-10-23T18:00:00Z"), null)))
})

test("ICYMI with 2 eligible posts: no roundup; a no-content card says why (coordinator's assumption, for the founder to confirm)", async () => {
  const w = world({ ai: { write: async () => { throw new Error("nothing is written") } } })
  w.deps.content.recentPosts = async () => [published(1), published(2)]
  await w.start({ kind: "icymi" })
  assert.equal(w.store.drafts.size, 0); assert.equal(w.posts.length, 0); assert.equal(w.designs.length, 0)
  assert.equal(w.notices.length, 1)
  assert.match(w.notices[0].reason, /^only 2 MCU News or Breaking stories with a published card were published in the week of 2026-10-05, and an ICYMI takes at least 3, so there is no ICYMI$/)
  const j = (await w.store.getJob("job-icymi-1"))!
  assert.equal(j.status, "held"); assert.equal(j.noContentPostId, "notice-1"); assert.equal(w.alerts.length, 1)
})

test("ICYMI with 7 eligible posts: the draft waits for the requester's choice, with an alert and a task; a choice of 3–5 then runs it", async () => {
  const asked: { job: McuJob; draft: McuDraft }[] = []
  const w = world({ ai: { write: coverWriter() } })
  w.deps.content.recentPosts = async () => [1, 2, 3, 4, 5, 6, 7].map(n => published(n))
  w.deps.askChoice = async (job, draft) => { asked.push({ job, draft }); return { taskId: "task-1" } }
  await w.start({ kind: "icymi" })
  let d = onlyDraft(w)
  assert.equal(d.status, "choosing"); assert.equal(d.story.roundup!.length, 7); assert.deepEqual(d.choice, { min: 3, max: 5, taskId: "task-1" })
  assert.equal(asked.length, 1); assert.equal(asked[0].draft.id, d.id)
  assert.equal(w.designs.length, 0); assert.equal(w.posts.length, 0)
  assert.equal(w.alerts.length, 0) // no "drafts ready" until it has run
  assert.match((await w.store.getJob("job-icymi-1"))!.note!, /7 published stories qualify: choose 3–5 of them on the ICYMI draft/)
  assert.equal(await runDue(w.deps, 1e9), 0) // nothing runs while it waits
  // Refused: too many, too few, a repeat, a story not offered, a draft not waiting.
  const at = new Date(NOW).toISOString()
  assert.deepEqual(await chooseRoundup(w.store, d.id, ["p1", "p2", "p3", "p4", "p5", "p6"], "marcos@434media.com", at), { error: "Choose 3–5 stories" })
  assert.deepEqual(await chooseRoundup(w.store, d.id, ["p1", "p2"], "marcos@434media.com", at), { error: "Choose 3–5 stories" })
  assert.deepEqual(await chooseRoundup(w.store, d.id, ["p1", "p1", "p2"], "marcos@434media.com", at), { error: "Choose stories offered on this draft, each once" })
  assert.deepEqual(await chooseRoundup(w.store, d.id, ["p1", "p2", "p9"], "marcos@434media.com", at), { error: "Choose stories offered on this draft, each once" })
  // Chosen out of order: the roundup keeps the posts' order (newest first). The task closes with who chose and when.
  const closed: { taskId: string; note: string }[] = [], tasks = { close: async (taskId: string, note: string) => { closed.push({ taskId, note }) } }
  assert.deepEqual(await chooseRoundup(w.store, d.id, ["p6", "p2", "p4", "p3"], "marcos@434media.com", at, tasks), { ok: true })
  assert.deepEqual(closed, [{ taskId: "task-1", note: `Done: 4 stories chosen by marcos@434media.com at ${at} (p6, p2, p4, p3). The ICYMI draft ${d.id} is running.` }])
  assert.deepEqual(await chooseRoundup(w.store, d.id, ["p1", "p2", "p3"], "marcos@434media.com", at), { error: "This draft is not waiting for a choice" })
  await runDue(w.deps, 1e9)
  d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.deepEqual(d.story.roundup!.map(r => r.postId), ["p2", "p3", "p4", "p6"])
  assert.equal(d.choice!.chosenBy, "marcos@434media.com"); assert.match(d.story.sourceTitle, /^4 published MCU stories from the week of 2026-10-05$/)
  assert.deepEqual(w.posts[0].slides!.map(x => x.url), [2, 3, 4, 6].map(n => `https://blob.example/content-posts/p${n}-01-page-1.jpg`))
  assert.equal(w.designs[0].text.headline, "TOP DEFENSE DEVELOPMENTS"); assert.equal(w.designs[0].text.story_04, "Story 4 in one row"); assert.equal(w.designs[0].text.story_05, " ")
  assert.equal(w.designs[0].text.story_numbers, "01\n02\n03\n04")
  assert.match(w.posts[0].notes, /Chosen by marcos@434media\.com/)
  assert.equal(w.alerts.length, 1); assert.match((await w.store.getJob("job-icymi-1"))!.note!, /4 stories chosen by marcos@434media\.com/)
})

test("the ICYMI cover reuses a story's recorded photo with its rights as approved; links are never read; with none, only the lead story is searched", async () => {
  const record = { url: "https://www.overland.ai/media/ultra.jpg", pageUrl: "https://www.overland.ai/press/ultra", title: "ULTRA on test", license: "Official company media", creator: "Overland AI", credit: "Overland AI (courtesy)", usGovernment: false, rightsNote: "Company media from www.overland.ai: confirm its terms allow editorial use before approving" }
  const pages: string[] = [], searched: string[] = []
  const w = world({ ai: { write: coverWriter() } })
  // The lead story has no record; the second does. Someone has appended a DVIDS page to every post's links.
  w.deps.content.recentPosts = async () => [published(1), published(2, { media: [record] }), published(3)]
  w.deps.fetchPage = async url => { pages.push(url); return { url, title: "t", text: ARMY_TEXT } }
  w.deps.searchCommons = async q => { searched.push(q); return [CANDIDATE] }
  const big = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x07, 0xd0, 0x0b, 0xb8, 0x03, 0, 0, 0, 0]) // 3000 × 2000
  w.deps.fetchImage = async () => ({ bytes: big, mime: "image/jpeg" })
  await w.start({ kind: "icymi" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review")
  assert.equal(d.media[0]!.url, record.url); assert.equal(d.media[0]!.license, "Official company media"); assert.equal(d.media[0]!.usGovernment, false)
  assert.match(d.media[0]!.note!, /confirm its terms allow editorial use before approving\. Reused from the published post p2/)
  assert.equal(pages.length, 0); assert.equal(searched.length, 0) // nothing fetched or searched
  // No story has a record: the cover's photo is searched for the lead story only, and the reviewer is told.
  const w2 = world({ ai: { write: coverWriter(), pickMedia: async ({ story }) => { searched.push(story.title); return { index: 0, reason: "ok", ranked: [{ index: 0, box: HERO }] } } } })
  w2.deps.content.recentPosts = async () => [published(1), published(2), published(3)]
  searched.length = 0
  await w2.start({ kind: "icymi" })
  const d2 = onlyDraft(w2)
  assert.equal(d2.status, "in_review"); assert.deepEqual(searched, ["STORY 1"])
  assert.match(d2.media[0]!.note!, /No story's published post has a recorded photo, so the cover's was searched for: check it against p1/)
})

// Fitting copy (gate round 5). Seasats Lightfish (MCU-DT101-20261018-04) and Anduril EagleEye (-06) were held with
// "Benefit hook: each line at most 16 characters" after two rewrites. Their exact hooks were not recorded outside
// Firestore, so these inputs reconstruct the shape of the failure: a good hook a few characters past 16 on a line.
const LIGHTFISH_TEXT = "SAN DIEGO — Seasats builds the Lightfish, a solar-powered autonomous surface vessel that patrols coastal waters for weeks without a crew. The Lightfish carries cameras and sensors and reports what it sees by satellite. The U.S. Navy has tested Lightfish vessels in exercises this year. ".repeat(4)
const LIGHTFISH_BRIEF = "MISSION BRIEF // LIGHTFISH\n\n//Seasats\n\n📍San Diego, CA\n\nTech: Autonomous surface vessel\n\nPlatform: Solar-powered boat\n\nGoal: Watch coastal waters without a crew aboard.\n\nSource: Seasats, 2026-10-16"
const EAGLEEYE_TEXT = "COSTA MESA, Calif. — Anduril's EagleEye is a mixed-reality helmet system that shows each soldier the same picture of the fight: drones, sensors and teammates on one display. The Army is testing EagleEye with infantry squads. ".repeat(4)
const EAGLEEYE_BRIEF = "MISSION BRIEF // EAGLEEYE\n\n//Anduril\n\n📍Costa Mesa, CA\n\nTech: Mixed-reality helmet\n\nPlatform: Soldier-worn display\n\nGoal: Give every soldier one shared picture of the battle.\n\nSource: Anduril, 2026-10-16"
type WriteIn = Parameters<McuAi["write"]>[0]
function dt101World(subject: { title: string; text: string; brief: string; line: string }, hook: (i: WriteIn, n: number) => string, extra: Partial<McuAi> = {}) {
  const writes: WriteIn[] = []
  const w = world({ ai: {
    research: async () => ({ candidates: [{ title: subject.title, primaryUrl: "https://example.com/product", publisher: subject.line.split(" / ")[1], why: "dt101" }] }),
    write: async i => { writes.push(structuredClone(i)); return { frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: hook(i, writes.length), subject_identifier: i.fit ? "SOMETHING ELSE / ANOTHER MAKER" : subject.line } }], caption: i.fit ? "A caption the fit pass must not take." : subject.brief } },
    ...extra,
  } })
  w.deps.fetchPage = async url => ({ url, title: subject.title, text: subject.text, publishedAt: "2026-10-16T09:00:00Z" })
  return { ...w, writes }
}
const LIGHTFISH = { title: "Seasats Lightfish autonomous surface vessel", text: LIGHTFISH_TEXT, brief: LIGHTFISH_BRIEF, line: "LIGHTFISH / SEASATS" }
const EAGLEEYE = { title: "Anduril EagleEye mixed-reality helmet", text: EAGLEEYE_TEXT, brief: EAGLEEYE_BRIEF, line: "EAGLEEYE / ANDURIL" }

test("round 5, Seasats Lightfish: a rewrite is told the measured line; the shortening-only fit then fits the hook, and nothing else changes", async () => {
  // Three answers a few characters over that no line break can fix (as Haiku's were), then a fit that does.
  const w = dt101World(LIGHTFISH, (i, n) => i.fit ? "It patrols seas\nwith no crew" : n === 1 ? "Solar power keeps\nit on patrol" : "It patrols for weeks\nwith no crew")
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason)
  assert.equal(d.frames[0].fields.benefit_headline, "IT PATROLS SEAS\nWITH NO CREW")
  // The rewrite named the limit, the measured length and the overflowing line.
  assert.ok(w.writes[1].problems!.includes('Benefit hook: each line at most 16 characters, counting letters, spaces and punctuation; line 1 "SOLAR POWER KEEPS" is 17, 1 over'))
  assert.ok(w.writes[2].problems!.includes('Benefit hook: each line at most 16 characters, counting letters, spaces and punctuation; line 1 "IT PATROLS FOR WEEKS" is 20, 4 over'))
  // Then one shortening-only request, about the hook alone; its other answers (subject, caption) were not taken.
  assert.equal(w.writes.length, 4); assert.deepEqual(w.writes[3].fit, ['Benefit hook: each line at most 16 characters, counting letters, spaces and punctuation; line 1 "IT PATROLS FOR WEEKS" is 20, 4 over'])
  assert.equal(w.writes[3].problems, undefined)
  assert.equal(d.frames[0].fields.subject_identifier, "LIGHTFISH / SEASATS"); assert.ok(d.caption!.startsWith(LIGHTFISH_BRIEF))
  assert.deepEqual(w.designs[0].text.benefit_headline, "IT PATROLS SEAS\nWITH NO CREW")
})

test("round 5, Anduril EagleEye: a hook whose words fit two lines with another break is re-broken, with no rewrite and no word changed", async () => {
  const w = dt101World(EAGLEEYE, () => "One helmet shows the\nwhole fight")
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason); assert.equal(w.writes.length, 1)
  assert.equal(d.frames[0].fields.benefit_headline, "ONE HELMET SHOWS\nTHE WHOLE FIGHT")
  // One line written as a single line is set across the two, too: the break is layout, not grammar.
  assert.equal(normalizeFields(SERIES.dt101, { benefit_headline: "It finds drones and strikes them" }).benefit_headline, "IT FINDS DRONES\nAND STRIKES THEM")
})

test("fitting never relaxes a limit or cuts a word: a longer or broken shortening is turned down, and the draft is held after the fit attempts", async () => {
  // Every answer stays over, and the fit answers are longer, then shorter but copying the source's headline.
  const w = dt101World(EAGLEEYE, (i, n) => !i.fit ? "Every soldier sees\nwhat the squad sees" : n === 4 ? "Every single soldier\nsees what the squad sees" : n === 5 ? "Eyes on. Squad\nsees all" : "Each soldier sees\nthe squad view")
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "held"); assert.equal(w.writes.length, 3 + MAX_FIT_ATTEMPTS)
  // The third answer was shorter and kept, but still a character over: the draft is held on it, measured.
  assert.match(d.holdReason!, /^the copy still breaks the template rules after two rewrites and 3 shortening attempts: Benefit hook: each line at most 16 characters, counting letters, spaces and punctuation; line 1 "EACH SOLDIER SEES" is 17, 1 over$/)
  assert.deepEqual(w.writes[3].fit, ['Benefit hook: each line at most 16 characters, counting letters, spaces and punctuation; line 1 "EVERY SOLDIER SEES" is 18, 2 over; line 2 "WHAT THE SQUAD SEES" is 19, 3 over'])
  assert.deepEqual(w.writes[4].fit!.slice(-1), ["the last answer was not shorter: use fewer or shorter words"])
  assert.match(w.writes[5].fit!.slice(-1)[0], /^the last shorter version was turned down because it broke these rules: the hook ends one sentence with a period/)
  // Nothing reaches Canva or the board, and nothing was cut to fit.
  assert.equal(d.frames.length, 0); assert.equal(w.designs.length, 0)
})

test("a problem other than length is held as before, with no fit attempt (no change in behaviour)", async () => {
  // A figure the source doesn't give, beside an overlong hook: the old hold, word for word, after the same 3 writes.
  const w = dt101World({ ...LIGHTFISH, brief: LIGHTFISH_BRIEF.replace("Watch coastal waters", "Watch 400 miles of coast") }, () => "Solar power keeps\nit on patrol")
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "held"); assert.equal(w.writes.length, 3); assert.ok(w.writes.every(x => !x.fit))
  assert.match(d.holdReason!, /^the copy still breaks the template rules after two rewrites: Benefit hook: each line at most 16 characters.*; these figures are not in the source: 400/)
})

test("the same fit logic for every field: a News headline past 3 lines and an ICYMI cover row past its line are shortened the same way", async () => {
  const news = world({ ai: { write: async i => ({ frames: [{ series: "news" as SeriesKey, fields: { headline: i.fit ? "Army backs 9 C2 software vendors" : "Army backs nine command and control software vendors", deck: "Awards worth $93.6 million fund I Corps command software.", source: "ARMY.MIL" } }], caption: "The Army awarded $93.6 million to nine companies for command and control software.\n\nSource: U.S. Army, 2026-10-15" }) } })
  await news.start({ kind: "news" })
  const n = onlyDraft(news)
  assert.equal(n.status, "in_review", n.holdReason); assert.equal(n.frames[0].fields.headline, "ARMY BACKS 9 C2 SOFTWARE VENDORS")
  const row = (k: number, fit?: boolean) => k === 1 && !fit ? "Army backs nine software vendors for its I Corps command" : `Story ${k} in one row`
  const icymi = world({ ai: { write: async i => ({ frames: [{ series: "icymi_cover" as SeriesKey, fields: Object.fromEntries((i.story.roundup ?? []).map((_, k) => [`story_0${k + 1}`, row(k + 1, !!i.fit)])) }], caption: ROUNDUP_CAPTION }) } })
  icymi.deps.content.recentPosts = async () => [published(1), published(2), published(3)]
  await icymi.start({ kind: "icymi" })
  const c = onlyDraft(icymi)
  assert.equal(c.status, "in_review", c.holdReason); assert.equal(c.frames[0].fields.story_01, "Story 1 in one row")
  assert.ok(c.history.some(h => /copy written/.test(h.event)))
})

test("measuring as the card sets it: every character counts once, lines wrap at whole words, and a re-break keeps the words", () => {
  assert.equal(measure("CAFÉ’S"), 6); assert.equal(measure("🛰 UP"), 4)
  assert.deepEqual(overLimits(SERIES.dt101.fields[0], "FIRE.\nRELOCATE."), [])
  assert.deepEqual(overLimits(SERIES.dt101.fields[0], "SEND SUPPLIES ANYWHERE.\nNOT A DRIVER."), ['Benefit hook: each line at most 16 characters, counting letters, spaces and punctuation; line 1 "SEND SUPPLIES ANYWHERE." is 23, 7 over'])
  assert.deepEqual(overLimits(SERIES.news.fields[0], "ARMY BACKS NINE COMMAND AND CONTROL SOFTWARE VENDORS"), ['Headline runs past 3 lines (about 45 characters); shorten it: "ARMY BACKS NINE COMMAND AND CONTROL SOFTWARE VENDORS" is 52 characters and wraps to 5 lines of at most 15'])
  assert.deepEqual(overLimits(SERIES.dt101.fields[1], "A".repeat(41)), ["Subject is 41 characters; at most 40"])
  assert.equal(fitLines("ONE HELMET SHOWS THE\nWHOLE FIGHT", 16, 2), "ONE HELMET SHOWS\nTHE WHOLE FIGHT")
  assert.equal(fitLines("FIRE.\nRELOCATE.", 16, 2), "FIRE.\nRELOCATE.") // the writer's break is kept when it fits
  assert.equal(fitLines("SOLAR POWER KEEPS\nIT ON PATROL", 16, 2), null) // no break fits: the words must be shortened
  assert.equal(fitLines("UNSTOPPABLE", 16, 2), null) // never splits a word
})

test("an ICYMI choice that ends without one closes its task with the reason: closed in the Admin, or replaced by a new request", async () => {
  const closed: { taskId: string; note: string }[] = []
  const w = world({ ai: { write: coverWriter() } })
  w.deps.content.recentPosts = async () => [1, 2, 3, 4, 5, 6].map(n => published(n))
  let tasks = 0
  w.deps.askChoice = async () => ({ taskId: `task-${++tasks}` })
  w.deps.closeChoiceTask = async (taskId, note) => { closed.push({ taskId, note }) }
  // Closed in the Admin: the draft holds with the reason, the job settles, the task closes.
  await w.start({ kind: "icymi" })
  const first = onlyDraft(w), at = new Date(NOW).toISOString()
  assert.deepEqual(await closeRoundup(w.store, first.id, "marcos@434media.com", at, "closed in the Admin", { close: w.deps.closeChoiceTask! }), { ok: true })
  const held = (await w.store.getDraft(first.id))!
  assert.equal(held.status, "held"); assert.equal(held.holdReason, "no stories chosen: closed in the Admin"); assert.equal(held.choice!.closedBy, "marcos@434media.com")
  assert.equal((await w.store.getJob("job-icymi-1"))!.status, "done")
  assert.deepEqual(closed, [{ taskId: "task-1", note: `Closed without a choice by marcos@434media.com at ${at}: closed in the Admin.` }])
  assert.deepEqual(await closeRoundup(w.store, first.id, "marcos@434media.com", at, "again"), { error: "This draft is not waiting for a choice" })
  // Regenerated: a new ICYMI request closes the earlier draft still waiting, and its task, before it opens its own.
  await w.store.createJob(job({ id: "job-icymi-2", kind: "icymi" }))
  await runDue(w.deps, 1e9)
  await w.store.createJob(job({ id: "job-icymi-3", kind: "icymi" }))
  await runDue(w.deps, 1e9)
  const drafts = [...w.store.drafts.values()].map(v => v.draft)
  const second = drafts.find(x => x.jobId === "job-icymi-2")!, third = drafts.find(x => x.jobId === "job-icymi-3")!
  assert.equal(second.status, "held"); assert.equal(second.holdReason, "no stories chosen: regenerated: a new ICYMI request (job-icymi-3) replaced it")
  assert.equal(third.status, "choosing")
  assert.deepEqual(closed.slice(1).map(c => c.taskId), ["task-2"]); assert.match(closed[1].note, /^Closed without a choice by the content pipeline at .*: regenerated: a new ICYMI request \(job-icymi-3\) replaced it\.$/)
})

test("a cover template without the story_numbers field keeps the old notice, and a three-story cover numbers three rows", async () => {
  const w = world({ ai: { write: coverWriter() } })
  w.deps.content.recentPosts = async () => [published(1), published(2), published(3)]
  const fields = w.deps.content.templateFields
  w.deps.content.templateFields = async t => { const f = await fields(t); delete f.story_numbers; return f }
  await w.start({ kind: "icymi" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(d.frames[0].fields.story_numbers, "01\n02\n03")
  assert.equal(w.designs[0].text.story_numbers, undefined) // the template has no such field, so it isn't sent
  assert.ok(d.notices.some(n => /ICYMI cover: 3 of 5 story slots used\. The template prints the numbers 01–05 itself/.test(n)))
})

// ── gate round 6 fixes (2026-10-18) ──
import { publishedPost, labelDefect, MAX_FRESH_ATTEMPTS, REVIEW_DRAFT_TITLE } from "../content-pipeline/worker"
import { originalityFindings } from "../content-pipeline/copy-checks"

test("round 6, ICYMI: the engine decides eligibility (posted, not a review draft, with a card); a writer's hold on a roundup is overruled", async () => {
  // The round-6 shape: a pilot post still titled REVIEW DRAFT, and a post with a link but never published, beside three published ones.
  const marconi = published(4, { title: "MCU-BN-20261009-02 | Marconi … | REVIEW DRAFT" }), unpublished = published(5, { status: "needs_approval" })
  assert.equal(publishedPost(marconi), false); assert.equal(publishedPost(unpublished), false); assert.equal(publishedPost(published(1)), true)
  assert.ok(REVIEW_DRAFT_TITLE.test("x | review-draft")); assert.ok(REVIEW_DRAFT_TITLE.test("MCU-BN-01 | Marconi | REVIEW DRAFT | v2")); assert.ok(!REVIEW_DRAFT_TITLE.test("MCU-NEWS-20261001-01 v1 — ARMY REVIEWS DRAFTING RULES"))
  // A headline that only mentions a review draft is a real story, not the pilot's marker (coordinator's review of #205).
  assert.ok(!REVIEW_DRAFT_TITLE.test("MCU-NEWS-20261016-01 v1 — DOD OPENS REVIEW DRAFT OF CMMC RULE")); assert.equal(publishedPost(published(9, { title: "MCU-NEWS-20261016-01 v1 — DoD opens review draft of CMMC rule" })), true)
  const writes: unknown[] = []
  const w = world({ ai: { write: async i => { writes.push(i); const out = await coverWriter()(i); return writes.length === 1 ? { ...out, hold: "Story 3 (MCU-BN-20261009-02, Marconi) is marked REVIEW DRAFT; only three Approved stories" } : out } } })
  w.deps.content.recentPosts = async () => [published(1), published(2), published(3), marconi, unpublished]
  await w.start({ kind: "icymi" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason)
  assert.deepEqual(d.story.roundup!.map(r => r.postId), ["p1", "p2", "p3"]) // the two are left out in code, never by the model
  assert.equal(writes.length, 1) // the hold was not obeyed and cost no rewrite
  assert.ok(d.history.some(h => /the writer asked to hold the roundup .*overruled: the engine decides which stories qualify/.test(h.event)))
  assert.equal(w.posts[0].slides!.length, 3)
  // With only two truly published, there is no roundup, and the note says so.
  const two = world()
  two.deps.content.recentPosts = async () => [published(1), published(2), marconi, unpublished]
  await two.start({ kind: "icymi" })
  assert.equal(two.store.drafts.size, 0); assert.match(two.notices[0].reason, /^only 2 MCU News or Breaking stories with a published card/)
})

const COPIED = "The U.S. Army awarded contracts worth $93.6 million to nine companies on Oct. 15, 2026 to deliver next-generation command and control software.\n\nSource: U.S. Army, 2026-10-15"
const FRESH = "Nine companies will build command software for I Corps under $93.6 million in Army awards.\n\nSource: U.S. Army, 2026-10-15"
const NEWS_CARD = { headline: "Army backs 9 C2 software vendors", deck: "Awards worth $93.6 million fund I Corps command software.", source: "ARMY.MIL" }
type WriteArgs = Parameters<McuAi["write"]>[0]
function freshWorld(answer: (i: WriteArgs, n: number) => { fields?: Record<string, string>; caption: string }) {
  const writes: WriteArgs[] = []
  const w = world({ ai: { write: async i => { writes.push(structuredClone(i)); const a = answer(i, writes.length); return { frames: [{ series: "news" as SeriesKey, fields: a.fields ?? NEWS_CARD }], caption: a.caption } } } })
  return { ...w, writes }
}

test("round 6, originality: a caption that still copies after two rewrites gets a targeted rewording, shown the copied run, before any hold", async () => {
  assert.ok(originalityFindings([{ series: "news", fields: NEWS_CARD }], COPIED, { sourceTitle: "x", sourceText: ARMY_TEXT }, { enabled: true, headlineMaxRun: 4, captionMaxRun: 12, exempt: [] }, ["headline"]).some(c => c.field === "caption" && c.run.length > 12))
  const w = freshWorld(i => ({ caption: i.fresh ? FRESH : COPIED, ...(i.fresh ? { fields: { ...NEWS_CARD, headline: "Something the pass must not take" } } : {}) }))
  await w.start()
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason)
  assert.equal(w.writes.length, 4); assert.ok(w.writes.slice(0, 3).every(x => !x.fresh))
  assert.match(w.writes[3].fresh![0], /^caption: the caption copies \d+ words in a row from the source \("the u\.s army awarded contracts worth/)
  assert.ok(d.caption!.startsWith(FRESH)); assert.equal(d.frames[0].fields.headline, "ARMY BACKS 9 C2 SOFTWARE VENDORS") // only the named field was taken
})

test("round 6, originality: a copied headline is reworded on its own; the caption and other fields stay; the limits are unchanged", async () => {
  const w = freshWorld(i => i.fresh ? { fields: { ...NEWS_CARD, headline: "Army backs 9 C2 software vendors", deck: "A deck the pass must not take." }, caption: "A caption the pass must not take." } : { fields: { ...NEWS_CARD, headline: "New contract awards support Army C2 vendors" }, caption: NEWS_CARD.deck.replace(/\.$/, "") + ".\n\nSource: U.S. Army, 2026-10-15" })
  await w.start()
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason)
  assert.match(w.writes[3].fresh![0], /^headline: the headline copies 6 words in a row from the source's headline/)
  assert.equal(d.frames[0].fields.headline, "ARMY BACKS 9 C2 SOFTWARE VENDORS"); assert.equal(d.frames[0].fields.deck, NEWS_CARD.deck); assert.ok(d.caption!.startsWith("Awards worth $93.6 million"))
  // Four copied words in a row are still allowed; five are not (the founder's limits, unchanged).
  const lim = { enabled: true, headlineMaxRun: 4, captionMaxRun: 12, exempt: [] as SeriesKey[] }
  assert.equal(originalityFindings([{ series: "news", fields: { headline: "contract awards support Army now" } }], "", { sourceTitle: "New contract awards support Army C2", sourceText: "" }, lim, ["headline"]).length, 0)
  assert.equal(originalityFindings([{ series: "news", fields: { headline: "new contract awards support Army" } }], "", { sourceTitle: "New contract awards support Army C2", sourceText: "" }, lim, ["headline"]).length, 1)
})

test("round 6, originality: rewordings that keep copying are turned down and the draft holds after the attempts, saying so", async () => {
  const w = freshWorld(() => ({ caption: COPIED }))
  await w.start()
  const d = onlyDraft(w)
  assert.equal(d.status, "held"); assert.equal(w.writes.length, 3 + MAX_FRESH_ATTEMPTS)
  assert.match(d.holdReason!, /^the copy still breaks the template rules after two rewrites and 3 rewording attempts: the caption copies/)
  assert.deepEqual(w.writes[4].fresh!.slice(-1), ["the last answer still copied the same run of words: say it differently, in your own words"])
  assert.equal(w.designs.length, 0); assert.equal(w.posts.length, 0)
})

test("round 6, credit: the photo's page publisher is credited, never a stale site name (rtx.com's og:site_name 'United Technologies')", () => {
  assert.equal(siteOrg("United Technologies", "www.rtx.com", "RTX's Raytheon awarded $6.3 billion multi-year contract for SM-3 IB interceptors"), "RTX")
  assert.equal(siteOrg("United Technologies", "www.rtx.com"), "United Technologies") // without the title's evidence it isn't set aside
  // Short or acronym hosts keep their own correct names, never the bare host (coordinator's review of #205).
  for (const [name, host, title] of [["U.S. Air Force", "www.af.mil", "Airmen test new base defense sensors"], ["General Dynamics", "www.gd.com", "General Dynamics awarded Army contract"], ["AeroVironment", "www.avinc.com", "Switchblade 600 delivered to the Army"], ["Mercury Systems", "www.mrcy.com", "Mercury unveils new processing module"], ["Fort Cavazos", "home.army.mil", "III Armored Corps soldiers train at Fort Cavazos"], ["U.S. Department of War", "www.defense.gov", "Secretary visits Pacific allies"]]) {
    assert.equal(siteOrg(name, host, title), name, host)
    assert.equal(imageLabel({ ...CHOSEN, creator: siteOrg(name, host, title) }), `IMAGE: ${name.toUpperCase()}`)
  }
  // Names that agree with their host are kept as written.
  assert.equal(siteOrg("Lockheed Martin | Newsroom", "news.lockheedmartin.com"), "Lockheed Martin")
  assert.equal(siteOrg("General Atomics Aeronautical Systems", "www.ga-asi.com"), "General Atomics Aeronautical Systems")
  assert.equal(siteOrg("DVIDS", "www.dvidshub.net"), "DVIDS"); assert.equal(siteOrg("U.S. Army", "www.army.mil"), "U.S. Army")
  const rtx = pageImageCandidate({ url: "https://www.rtx.com/news/news-center/2026/10/12/coyote", title: "RTX's Raytheon tests Coyote Block 2C with a rocket motor", text: "", image: "https://prd-sc102-cdn.rtx.com/-/media/coyote.jpg", siteName: "United Technologies" }, "source")!
  assert.equal(rtx.creator, "RTX"); assert.equal(rtx.credit, "RTX (courtesy)")
  assert.equal(imageLabel({ ...CHOSEN, creator: rtx.creator, credit: rtx.credit, date: "2026-10-12" }, "2026-10-12"), "IMAGE: RTX • 12 OCT 2026")
})

test("round 6, credit placement: a label that crosses the subject re-zooms the photo above the text block and fills once more; never twice", async () => {
  assert.ok(labelDefect(`The image credit line "IMAGE: UNITED TECHNOLOGIES • 12 OCT 2026" runs across the rocket's nozzle and exhaust.`))
  assert.ok(!labelDefect("the benefit headline text is clipped")); assert.ok(!labelDefect("the image credit is misspelled"))
  // Contrast alone is not a placement defect: a re-zoom can't fix it, so it never spends the refit.
  assert.ok(!labelDefect("the image credit line is low-contrast and hard to read")); assert.ok(!labelDefect("IMAGE: U.S. ARMY label is illegible"))
  const LOW = { x0: 0.4, y0: 0.3, x1: 0.6, y1: 0.6 }, defect = { defect: `The image credit line "IMAGE: U.S. ARMY" runs across the vehicle's wheels.`, photo: false }
  let checks = 0
  const w = world({ ai: { pickMedia: async () => ({ index: 0, reason: "ok", ranked: [{ index: 0, box: LOW }] }), checkArtwork: async () => checks++ === 0 ? [defect] : [] } })
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review"); assert.equal(d.labelRefit, 1); assert.deepEqual(d.qa, [])
  assert.equal(w.designs.length, 2); assert.match(w.designs[1].requestId, /:l1$/)
  const [a, b] = [w.designs[0].image!.crop!, w.designs[1].image!.crop!]
  // The subject's base now sits at half the card's height, above the text block where the label is set.
  const base = (c: typeof a) => (LOW.y1 - c.y) / c.height
  assert.ok(base(a) > 0.55 && Math.abs(base(b) - 0.5) < 0.01, JSON.stringify({ a: base(a), b: base(b) }))
  assert.ok(d.history.some(h => /the image label crosses the subject .* re-zoomed above the text block and is filled again \(1\/1\)/.test(h.event)))
  // A label that still collides goes to review with the defect; no second refit.
  const again = world({ ai: { pickMedia: async () => ({ index: 0, reason: "ok", ranked: [{ index: 0, box: LOW }] }), checkArtwork: async () => [defect] } })
  await again.start({ kind: "dt101" })
  assert.equal(again.designs.length, 2); assert.equal(onlyDraft(again).status, "in_review"); assert.ok(onlyDraft(again).qa.includes(defect.defect))
})

test("round 6, Breaking with no photo of its own: a representative search (people, unit, equipment) runs before the subject is given up", async () => {
  const DV = "https://www.dvidshub.net/image/9600001/office-strategic-capital-director-visits-plant"
  const big = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x9b, 0x03, 0xe8, 0x03, 0, 0, 0, 0])
  const asked: boolean[] = [], picked: number[] = []
  const w = world({ ai: {
    findPhotoPages: async ({ representative }) => { asked.push(!!representative); return representative ? [DV] : [] },
    pickMedia: async ({ candidates }) => { picked.push(candidates.length); return candidates.length ? { index: 0, reason: "the office's director at the plant", ranked: [{ index: 0, box: HERO, representative: true, shows: "the OSC director touring a drug-ingredient plant" }] } : { index: null, reason: "no licensed candidates" } },
  } })
  w.deps.searchCommons = async () => []
  w.deps.fetchImage = async () => ({ bytes: big, mime: "image/jpeg" })
  const page = w.deps.fetchPage
  w.deps.fetchPage = async url => url === DV ? { url, title: "Office of Strategic Capital director visits plant", text: "", image: "https://d1ldvf68ux039x.cloudfront.net/2000w_q95.jpg", description: "The director tours the plant, Oct. 16, 2026. (U.S. Army photo by Spc. A)" } : page(url)
  await w.start({ kind: "breaking" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason)
  assert.deepEqual(asked, [false, true]); assert.deepEqual(picked, [0, 1])
  assert.equal(d.media[0]!.pageUrl, DV); assert.match(d.media[0]!.note!, /Representative photo \(the OSC director touring a drug-ingredient plant\), not the event itself/)
  // Nothing representative either: the hold says both searches ran (and DT101, which never takes one, never asks).
  const none = world({ ai: { findPhotoPages: async ({ representative }) => { asked.push(!!representative); return [] }, pickMedia: async () => ({ index: null, reason: "no licensed candidates" }) } })
  none.deps.searchCommons = async () => []
  await none.start({ kind: "breaking" })
  assert.match(onlyDraft(none).holdReason!, /no relevant, licensed photo was found.*a representative photo \(the people, unit or equipment the story is about\) was searched for too, and none was found/)
  asked.length = 0
  const dt = world({ ai: { findPhotoPages: async ({ representative }) => { asked.push(!!representative); return [] }, pickMedia: async () => ({ index: null, reason: "none" }) } })
  dt.deps.searchCommons = async () => []
  await dt.start({ kind: "dt101" })
  assert.ok(asked.length > 0 && asked.every(x => x === false))
})

test("round 6 review: a replacement subject gets its own label refit (sourceHold resets it, as it resets photo retries)", async () => {
  const LOW = { x0: 0.4, y0: 0.3, x1: 0.6, y1: 0.6 }, label = { defect: `The image credit line "IMAGE: U.S. ARMY" runs across the vehicle.`, photo: false }
  let picks = 0, checks = 0
  // Subject 1: the label collides (refit), then a photo defect sends it back for a photo and none is left, so the
  // subject is replaced. Subject 2: the label collides again, and gets its own refit.
  const w = world({ ai: {
    pickMedia: async () => ++picks === 2 ? { index: null, reason: "nothing else" } : { index: 0, reason: "ok", ranked: [{ index: 0, box: LOW }] },
    checkArtwork: async () => { checks++; return checks === 1 || checks === 3 ? [label] : checks === 2 ? [{ defect: "the subject is cut off", photo: true }] : [] },
  } })
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason); assert.equal(d.autoReplaced, 1); assert.equal(d.labelRefit, 1)
  assert.deepEqual(w.designs.map(x => x.requestId.replace(/^admin:MCU-DT101-20261016-01:v1:f1/, "")), ["", ":l1", ":r1", ":r1:l1"])
})

// ── Plan v9, Phase 1 direction (b): the safety-only hold bar, copy candidates, and the cut-off word ──
// The replay baseline (2026-10-19) put the VAMPIRE hook "STOPS DRONES AT / SEA WITH PREC" on a card: no engine code
// cuts copy, so the writer's shortening answer was taken because it was shorter, and the clipped-word list didn't know it.
const VAMPIRE_TEXT = "MELBOURNE, Fla. — L3Harris VAMPIRE is a self-contained weapons system that stops drones at sea with precision strike. The U.S. Navy selected VAMPIRE to defend ships near the coast. ".repeat(4)
const VAMPIRE = { title: "L3Harris VAMPIRE counter-drone system", text: VAMPIRE_TEXT, brief: "MISSION BRIEF // VAMPIRE\n\n//L3Harris\n\n📍Melbourne, FL\n\nTech: Precision strike\n\nPlatform: Weapons system\n\nGoal: Stop drones at sea for the U.S. Navy.\n\nSource: L3Harris, 2026-10-16", line: "VAMPIRE / L3HARRIS" }

test("v9 (b), cut-off word: a line ending in the start of a source word is caught; a whole word that begins a name is not", () => {
  assert.deepEqual(cutOffWords({ benefit_headline: "STOPS DRONES AT\nSEA WITH PREC" }, VAMPIRE_TEXT), ["PREC"])
  assert.deepEqual(cutOffWords({ headline: "NAVY PICKS PREC" }, VAMPIRE_TEXT), ["PREC"])
  // Only a line's last word: "PREC" mid-line is not where a line ran out.
  assert.deepEqual(cutOffWords({ benefit_headline: "PREC STRIKES\nAT SEA" }, VAMPIRE_TEXT), [])
  // "SEAS" begins "Seasats", a name, not a common word the source prints in lower case.
  assert.deepEqual(cutOffWords({ benefit_headline: "IT PATROLS SEAS\nWITH NO CREW" }, LIGHTFISH_TEXT), [])
  // The subject line, the source and the dates are names and labels, never checked.
  assert.deepEqual(cutOffWords({ subject_identifier: "VAMPIRE / PREC", source: "PREC" }, VAMPIRE_TEXT), [])
  const p = copyProblems([{ series: "dt101", fields: { benefit_headline: "STOPS DRONES AT\nSEA WITH PREC", subject_identifier: "VAMPIRE / L3HARRIS" } }], VAMPIRE.brief, { title: VAMPIRE.title, primaryUrl: "https://www.l3harris.com/vampire", publisher: "L3Harris", sourceTitle: VAMPIRE.title, sourceText: VAMPIRE_TEXT })
  assert.ok(p.safety.includes("cut-off words on the card (PREC): a line ends in part of a word; use whole words, and shorter ones if it must fit"), p.safety.join(" | "))
})

test("v9 (b), cut-off word: the fit pass turns down a shorter hook that ends in part of a word, and never puts it on the card", async () => {
  const w = dt101World(VAMPIRE, (i, n) => !i.fit ? "Stops drones at sea\nwith precision" : n === 4 ? "Stops drones at\nsea with prec" : "Stops drones\nat sea")
  await w.start({ kind: "dt101" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason)
  assert.match(w.writes[4].fit!.slice(-1)[0], /^the last shorter version was turned down because it broke these rules: cut-off words on the card \(PREC\)/)
  assert.equal(d.frames[0].fields.benefit_headline, "STOPS DRONES\nAT SEA"); assert.equal(w.designs[0].text.benefit_headline, "STOPS DRONES\nAT SEA")
  // A writer that keeps cutting a word off is held on it, a safety problem, and nothing reaches Canva.
  const cut = dt101World(VAMPIRE, () => "Stops drones at\nsea with prec")
  await cut.start({ kind: "dt101" })
  assert.equal(onlyDraft(cut).status, "held"); assert.match(onlyDraft(cut).holdReason!, /cut-off words on the card \(PREC\)/); assert.equal(cut.designs.length, 0)
})

test("v9 (b), hold bar: safety problems hold, style problems go to Review with a note for Canva", async () => {
  const story = { title: "Army picks nine C2 software vendors", primaryUrl: "https://www.army.mil/article/1", publisher: "U.S. Army", sourceTitle: "New contract awards support Army C2", sourceText: ARMY_TEXT }
  const caption = "The Army awarded $93.6 million to nine companies for command and control software.\n\nSource: U.S. Army, 2026-10-15"
  const p = copyProblems([{ series: "news", fields: { headline: "ARMY: 9 C2 VENDORS WIN $500 MILLION", deck: "Awards fund I Corps command software", date: "15OCT26", source: "ARMY.MIL" } }], caption, story)
  assert.deepEqual(p.safety, ["these figures are not in the source: $500 MILLION"])
  assert.ok(p.style.some(x => /^the headline takes no slash, colon/.test(x)) && p.style.some(x => /^the deck must be one complete sentence ending with a period/.test(x)), p.style.join(" | "))
  // A headline whose colon survives both rewrites: the draft reaches Review, the note travels to the board's notes.
  const w = world({ ai: { write: async () => ({ frames: [{ series: "news" as SeriesKey, fields: { headline: "Army: 9 C2 vendors picked", deck: NEWS_CARD.deck, source: "ARMY.MIL" } }], caption }) } })
  await w.start({ kind: "news" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason); assert.equal(w.designs.length, 1)
  assert.equal(d.copyNotes!.length, 1); assert.match(d.copyNotes![0], /^the headline takes no slash, colon/)
  assert.match(w.posts[0].notes, /Style notes \(not held: fix through Open in Canva\)\n- the headline takes no slash, colon/)
  assert.ok(d.history.some(h => /copy written \(v1\); to Review with 1 style note/.test(h.event)))
  assert.match(reviewNotes(d), /Style notes/)
})

test("v9 (b), candidates: code measures every candidate and a model picks among those that fit", async () => {
  assert.deepEqual(candidateFields("news"), ["headline", "deck"]); assert.deepEqual(candidateFields("dt101"), ["benefit_headline"]); assert.deepEqual(candidateFields("icymi_cover"), [])
  const picks: Record<string, string>[][] = [], writes: Parameters<McuAi["write"]>[0][] = []
  const w = world({ ai: {
    write: async i => { writes.push(structuredClone(i)); return { frames: [{ series: "news" as SeriesKey, fields: { headline: "Army backs nine command and control software vendors for I Corps", deck: NEWS_CARD.deck, source: "ARMY.MIL" } }], caption: "The Army awarded $93.6 million to nine companies for command and control software.\n\nSource: U.S. Army, 2026-10-15",
      options: [[{ headline: "Army backs 9 C2 software vendors", deck: NEWS_CARD.deck }, { headline: "Army spends $500 million on C2", deck: NEWS_CARD.deck }, { headline: "Army picks nine vendors for C2 work", deck: "Nine firms will build I Corps command software." }]] } },
    pickCopy: async ({ options, fields }) => { picks.push(options); assert.deepEqual(fields, ["headline", "deck"]); return { index: 1, reason: "the clearest verb" } },
  } })
  await w.start({ kind: "news" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason); assert.equal(writes.length, 1) // no rewrite, no fit pass
  // The writer's own (past 3 lines) and the unsourced $500 million are left out; the picker saw the two that fit.
  assert.deepEqual(picks, [[{ headline: "ARMY BACKS 9 C2 SOFTWARE VENDORS", deck: NEWS_CARD.deck }, { headline: "ARMY PICKS NINE VENDORS FOR C2 WORK", deck: "Nine firms will build I Corps command software." }]])
  assert.equal(d.frames[0].fields.headline, "ARMY PICKS NINE VENDORS FOR C2 WORK"); assert.equal(d.frames[0].fields.source, "ARMY.MIL")
  assert.ok(d.history.some(h => /^copy candidates: 4 candidates, 2 fit; chose 4 \("ARMY PICKS NINE VENDORS FOR C2 WORK", "Nine firms/.test(h.event)), d.history.map(h => h.event).join(" | "))
  // A hook offered on one line is set across its two, as the card sets it, before it is measured; a cut word never fits.
  const frame = { series: "dt101" as SeriesKey, fields: { benefit_headline: "x", subject_identifier: "VAMPIRE / L3HARRIS" } }
  const story = { title: VAMPIRE.title, primaryUrl: "https://www.l3harris.com/vampire", publisher: "L3Harris", sourceTitle: VAMPIRE.title, sourceText: VAMPIRE_TEXT }
  const norm = (f: McuDraft["frames"][number]) => ({ ...f, fields: normalizeFields(SERIES.dt101, f.fields) })
  assert.deepEqual(candidateProblems(frame, { benefit_headline: "It stops drones at sea" }, ["benefit_headline"], story, norm), { frame: { ...frame, fields: { benefit_headline: "IT STOPS\nDRONES AT SEA", subject_identifier: "VAMPIRE / L3HARRIS" } }, problems: [] })
  assert.deepEqual(candidateProblems(frame, { benefit_headline: "Stops drones at\nsea with prec" }, ["benefit_headline"], story, norm).problems, ["abbreviated or cut-off words (PREC): use whole words"])
  assert.deepEqual(candidateProblems(frame, { benefit_headline: "It stops every drone\nat sea with precision" }, ["benefit_headline"], story, norm).problems, ['Benefit hook: each line at most 16 characters, counting letters, spaces and punctuation; line 1 "IT STOPS EVERY DRONE" is 20, 4 over; line 2 "AT SEA WITH PRECISION" is 21, 5 over'])
})

test("v9 (b), candidates: when none fits, a new batch is asked for with each one's exact overflow; never a cut word", async () => {
  const writes: Parameters<McuAi["write"]>[0][] = []
  const long = { headline: "Army backs nine command and control software vendors for I Corps", deck: NEWS_CARD.deck }
  const w = world({ ai: { write: async i => { writes.push(structuredClone(i)); const fit = !!i.batch
    return { frames: [{ series: "news" as SeriesKey, fields: { ...(fit ? { headline: "Army backs 9 C2 software vendors", deck: NEWS_CARD.deck } : long), source: "ARMY.MIL" } }], caption: "The Army awarded $93.6 million to nine companies for command and control software.\n\nSource: U.S. Army, 2026-10-15", options: [[fit ? { headline: "Army picks 9 C2 vendors", deck: NEWS_CARD.deck } : { ...long, headline: "Army names nine command and control software vendors for I Corps" }]] } } } })
  await w.start({ kind: "news" })
  const d = onlyDraft(w)
  assert.equal(d.status, "in_review", d.holdReason); assert.equal(writes.length, 2); assert.equal(writes[0].batch, undefined)
  assert.equal(writes[1].batch!.length, 2)
  assert.match(writes[1].batch![0], /^candidate 1 \("ARMY BACKS NINE COMMAND AND CONTROL SOFTWARE VENDORS FOR I CORPS", "Awards worth \$93\.6 million fund I Corps command software\."\): Headline runs past 3 lines \(about 45 characters\); shorten it: ".*" is 64 characters and wraps to \d lines of at most 15$/)
  // Only the candidate fields come from the batch; with no picker, the writer's order stands.
  assert.equal(d.frames[0].fields.headline, "ARMY BACKS 9 C2 SOFTWARE VENDORS"); assert.equal(d.frames[0].fields.source, "ARMY.MIL")
  assert.ok(d.history.some(h => /^copy candidates: 2 candidates after 1 new batch, 2 fit; chose 1 .*the writer's order \(no pick\)$/.test(h.event)), d.history.map(h => h.event).join(" | "))
  // Batches are bounded per write step; past them the writer's first choice goes on to the rewrites and the fit pass.
  const stuck: Parameters<McuAi["write"]>[0][] = []
  const s = world({ ai: { write: async i => { stuck.push(structuredClone(i)); return { frames: [{ series: "news" as SeriesKey, fields: { ...(i.fit ? { headline: "Army backs 9 C2 software vendors" } : long), deck: NEWS_CARD.deck, source: "ARMY.MIL" } }], caption: "The Army awarded $93.6 million to nine companies for command and control software.\n\nSource: U.S. Army, 2026-10-15", ...(i.fit ? {} : { options: [[long]] }) } } } })
  await s.start({ kind: "news" })
  assert.equal(stuck.filter(x => x.batch).length, MAX_CANDIDATE_BATCHES)
  assert.equal(onlyDraft(s).status, "in_review", onlyDraft(s).holdReason); assert.equal(onlyDraft(s).frames[0].fields.headline, "ARMY BACKS 9 C2 SOFTWARE VENDORS")
})

test("v9 (b), writer hold: a hold field that says there is no hold is none, and a real reason still holds (replay, 2026-10-19)", () => {
  for (const v of ["Hold: none.", "Hold: None", "Not held. The headline and hook are drawn from Skydio's F10 announcement; the location line should be verified before publishing.", "No hold — the source supports every field.", "None", "N/A"]) assert.equal(meaningful(v), undefined, v)
  for (const v of ["None of the figures can be verified from the source.", "The source states no headquarters, which the brief requires.", "Not enough detail in the source for a mission brief."]) assert.equal(meaningful(v), v, v)
})

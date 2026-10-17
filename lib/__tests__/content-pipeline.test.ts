/**
 * Offline. The content pipeline (lib/content-pipeline/) against an in-memory store with the real lease rules; the
 * models, Canva, the board write and the web are scripted. Nothing reaches Firestore, Canva, a model or Slack.
 * Ported from the pilot's lib/__tests__/mcu.test.ts (b36e7be): the Slack review and revision tests moved out with
 * those paths; the board write, the one alert per run and the model routing are tested here instead.
 * Run: tsx --test lib/__tests__/content-pipeline.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { SERIES, checkFields, ddmmmyy, lineCount, type SeriesKey } from "../content-pipeline/series"
import { runDue, RETRY_MS, unsourcedNumbers, withCredits, imageLabel, mediaQueries, cropFit, choosePhoto, zoomCrop, reviewNotes, DOD_NOTICE, LEASE_MS, type WorkerDeps, type DesignInput, type PostInput } from "../content-pipeline/worker"
import { MAX_ATTEMPTS, type McuDraft, type McuJob, type McuStore } from "../content-pipeline/store"
import { assertPublicHttps, imageSize, pageImageCandidate, parsePage, usableLicense, type MediaCandidate } from "../content-pipeline/sources"
import { servedBy, servedCall, type McuAi, type ModelCall } from "../content-pipeline/model"
import { PIPELINE_MODELS, FALLBACK_MODELS, CALL_FALLBACK, callOptions, outputBudget } from "../content-pipeline/models"
import { seedBrief, seedProblems, type McuSeeds } from "../content-pipeline/seeds"
import { PIPELINE_PROPERTIES, PROPERTY_TEMPLATES, propertyCanGenerate } from "../content-pipeline/properties"

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
}

const NOW = Date.parse("2026-10-16T18:00:00Z")
const ARMY_TEXT = "WASHINGTON — The U.S. Army awarded contracts worth $93.6 million to nine companies on Oct. 15, 2026 to deliver next-generation command and control software to I Corps. ".repeat(6)
const CANDIDATE: MediaCandidate = { url: "https://upload.wikimedia.org/a.jpg", thumbUrl: "https://upload.wikimedia.org/thumb/a.jpg", pageUrl: "https://commons.wikimedia.org/wiki/File:A.jpg", title: "Soldiers at a command post", description: "U.S. Army photo", width: 3000, height: 2000, license: "Public domain", creator: "U.S. Army photo by Sgt. A", credit: "U.S. Army photo by Sgt. A / Public domain via Wikimedia Commons", usGovernment: true }
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9])
const SEEDS: McuSeeds = { purpose: "Invented purpose for tests.", cohorts: ["Builders"], orgs: [{ name: "Example Robotics", site: "example.com", kind: "neo-prime" }, { name: "Example Prime", site: "prime.example", kind: "prime" }, { name: "Example Outlet", site: "news.example", kind: "outlet" }], dt101Backlog: [{ subject: "Widget 9", maker: "Example Robotics", url: "https://example.com/widget" }], dt101Covered: ["HIMARS"], snapshot: "test" }

function job(over: Partial<McuJob> = {}): McuJob {
  return { id: `job-${over.kind ?? "news"}-1`, kind: "news", count: 1, placement: "feed", request: { actorEmail: "marcos@434media.com", actorName: "Marcos" }, status: "researching", drafts: [], createdAt: new Date(NOW).toISOString(), ...over }
}

function world(over: { ai?: Partial<McuAi>; pagePublished?: string; newsFeedHasMedia?: boolean; createDesign?: (i: DesignInput) => void; seeds?: McuSeeds | null } = {}) {
  const store = new MemStore(), designs: DesignInput[] = [], posts: PostInput[] = [], alerts: { job: McuJob; drafts: McuDraft[] }[] = [], calls: ModelCall[] = []
  let now = NOW
  const ai: McuAi = {
    research: async ({ count }) => ({ candidates: [{ title: "Army picks nine C2 software vendors", primaryUrl: "https://www.army.mil/article/1", publisher: "U.S. Army", publishedAt: "2026-10-15", whyNow: "The award starts fielding now.", why: "material" }, { title: "Second story", primaryUrl: "https://www.army.mil/article/2", publisher: "U.S. Army", why: "news" }].slice(0, count + 1) }),
    write: async ({ kind }) => ({ frames: [{ series: (kind === "dt101" ? "dt101" : kind === "breaking" ? "breaking" : "news") as SeriesKey, fields: kind === "dt101" ? { benefit_headline: "Link the fight.\nDecide faster.", subject_identifier: "Next-gen C2 / Lockheed Martin" } : { headline: "Army backs 9 C2 software vendors", deck: "Awards worth $93.6 million fund I Corps command software.", source: "ARMY.MIL" } as Record<string, string>, mediaQuery: "Army command post" }], caption: "The Army awarded $93.6 million to nine companies for command and control software.\n\nSource: U.S. Army, 2026-10-15" }),
    findPhotoPages: async () => [],
    pickMedia: async () => ({ index: 0, reason: "relevant" }),
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
      templateFields: async t => { const media = t !== SERIES.news.templates.feed || over.newsFeedHasMedia !== false; return { headline: "text", deck: "text", date: "text", source: "text", ...(media ? { media: "image" } : {}), benefit_headline: "text", subject_identifier: "text", image_context: "text" } },
      createDesign: async i => { over.createDesign?.(i); designs.push(structuredClone(i)); return { designId: `DAH${i.requestId.replace(/[^A-Za-z0-9]/g, "").slice(-8)}`, editUrl: "https://www.canva.com/d/edit", viewUrl: "https://www.canva.com/d/view", previewUrls: ["https://export.canva.com/1.jpg"] } },
      writePost: async p => { posts.push(structuredClone(p)); return { postId: `post-${posts.length}`, holds: [] } },
    },
    fetchPage: async url => ({ url, title: "New contract awards support Army C2", text: ARMY_TEXT, ...(over.pagePublished !== "" ? { publishedAt: over.pagePublished ?? "2026-10-16T09:00:00Z" } : {}) }),
    fetchImage: async () => ({ bytes: JPEG, mime: "image/jpeg" }),
    searchCommons: async () => [CANDIDATE],
    notify: async (j, ds) => { alerts.push({ job: structuredClone(j), drafts: structuredClone(ds) }) },
    nowMs: () => now,
  }
  const start = async (j: Partial<McuJob> = {}) => { await store.createJob(job(j)); return runDue(deps, 1e9) }
  return { store, deps, designs, posts, alerts, calls, start, advance: (ms: number) => { now += ms } }
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

test("Breaking: an announcement older than 24 hours, or with no stated time, is not Breaking — the job holds and says why", async () => {
  const old = world({ pagePublished: "2026-10-14T09:00:00Z" })
  await old.start({ kind: "breaking" })
  assert.equal(old.store.drafts.size, 0); assert.match((await old.store.getJob("job-breaking-1"))!.note!, /more than 24 hours ago/)
  const undated = world({ pagePublished: "" })
  await undated.start({ kind: "breaking" })
  assert.equal(undated.store.drafts.size, 0); assert.match((await undated.store.getJob("job-breaking-1"))!.note!, /states no publication time/)
  assert.equal(old.alerts.length + undated.alerts.length, 0)
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

test("ICYMI needs five published stories; fewer holds for Marcos without creating anything", async () => {
  const w = world()
  await w.start({ kind: "icymi" })
  assert.equal(w.store.drafts.size, 0); assert.match((await w.store.getJob("job-icymi-1"))!.note!, /ICYMI needs five/)
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
      : { frames: [{ series: "dt101" as SeriesKey, fields: { benefit_headline: "Fly itself.\nBuilt faster.", subject_identifier: "Talon Blue / Northrop Grumman" }, mediaQuery: "Talon Blue" }], caption: "Caption. Source: U.S. Army, 2026-10-15" },
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
    "SAILDRONE VOYAGER", "SAILDRONE", "Saildrone Voyager", "Saildrone Voyager 10-meter uncrewed surface vehicle Saildrone"])
  const searched: string[] = []
  const w = world({ ai: { write: async () => ({ frames: [{ ...frame, fields: { benefit_headline: "Watch the sea.\nNo crew aboard.", subject_identifier: "Saildrone Voyager / Saildrone" } }], caption: "Caption. Source: U.S. Army, 2026-10-15" }) } })
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

test("the crop rule matches the approved card: subject whole, upper 60%, big enough, enough pixels", () => {
  assert.equal(cropFit(1000, 667, { x0: 0.25, y0: 0.05, x1: 0.75, y1: 0.75 }, "feed").ok, true) // ULTRA-like hero subject
  assert.deepEqual(cropFit(1000, 667, { x0: 0.0, y0: 0.2, x1: 0.35, y1: 0.7 }, "feed").problems, ["the 4:5 crop cuts off the subject"])
  assert.ok(cropFit(1080, 1350, { x0: 0.3, y0: 0.7, x1: 0.7, y1: 0.95 }, "feed").problems.includes("the subject sits low, under the text block"))
  assert.ok(cropFit(3000, 2000, { x0: 0.45, y0: 0.4, x1: 0.52, y1: 0.48 }, "feed").problems.includes("the subject is small at phone size"))
  assert.ok(cropFit(760, 900, { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.7 }, "feed").ok)
  assert.ok(cropFit(600, 400, { x0: 0.3, y0: 0.1, x1: 0.7, y1: 0.7 }, "feed").problems.includes("the cropped photo is under 500 px wide"))
  const cands = [{ ...CANDIDATE, width: 1000, height: 667 }, { ...CANDIDATE, pageUrl: "p2", width: 1000, height: 667 }]
  const tiny = { x0: 0.45, y0: 0.4, x1: 0.48, y1: 0.43 } // too small to zoom without going under 600 px of source
  assert.equal(choosePhoto({ index: 0, ranked: [{ index: 0, box: tiny }, { index: 1, box: { x0: 0.25, y0: 0.05, x1: 0.75, y1: 0.75 } }] }, cands, "feed")!.index, 1)
  assert.match(choosePhoto({ index: 0, ranked: [{ index: 0, box: tiny }] }, cands, "feed")!.note!, /fit the card cleanly \(the subject is small at phone size\)/)
  assert.equal(choosePhoto({ index: 0, ranked: [{ index: 0, box: { x0: 0, y0: 0.2, x1: 0.3, y1: 0.7 } }] }, cands, "feed")!.note, undefined)
  assert.deepEqual(choosePhoto({ index: 0 }, cands, "feed"), { index: 0 })
  assert.equal(choosePhoto({ index: null }, cands, "feed"), null)
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

test("model settings: founder defaults, routing pinned to zero-retention no-training providers, Scout's output cap", () => {
  assert.deepEqual(PIPELINE_MODELS, { research: "nvidia/nemotron-3.5-lightning", write: "nvidia/nemotron-3.5-lightning", photoSearch: "nvidia/nemotron-3.5-lightning", photoPick: "meta/llama-4-scout", artworkCheck: "meta/llama-4-scout" })
  assert.deepEqual(FALLBACK_MODELS, { text: "anthropic/claude-opus-5.5", vision: "anthropic/claude-sonnet-5.5" })
  // runinfra (no ZDR, may train) is never a route for Nemotron.
  assert.deepEqual(callOptions("nvidia/nemotron-3.5-lightning", "medium"), { gateway: { only: ["deepinfra", "fireworks"], zeroDataRetention: true, disallowPromptTraining: true } })
  // Both qualifying Scout providers, so one at capacity can't stop a run (preview, 2026-10-17).
  assert.deepEqual(callOptions("meta/llama-4-scout", "low"), { gateway: { order: ["deepinfra", "bedrock"], only: ["deepinfra", "bedrock"], zeroDataRetention: true, disallowPromptTraining: true } })
  // The fallbacks keep the token-trap handling (effort, not disabled thinking) and enforce the same retention terms.
  const anthropicOnly = ["anthropic", "bedrock", "claudeaws", "vertexAnthropic"]
  assert.deepEqual(callOptions("anthropic/claude-opus-5.5", "medium"), { anthropic: { output_config: { effort: "medium" } }, gateway: { only: anthropicOnly, zeroDataRetention: true, disallowPromptTraining: true } })
  assert.deepEqual(callOptions("anthropic/claude-sonnet-5.5", "low"), { anthropic: { output_config: { effort: "low" } }, gateway: { only: anthropicOnly, zeroDataRetention: true, disallowPromptTraining: true } })
  assert.deepEqual(CALL_FALLBACK, { photoPick: "anthropic/claude-sonnet-5.5", artworkCheck: "anthropic/claude-sonnet-5.5" })
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
  // A text step has no automatic fallback: the error stands and the step retries.
  await assert.rejects(servedCall("write", "nvidia/nemotron-3.5-lightning", CALL_FALLBACK.write, undefined, async () => { throw capacity }, r => r), /at capacity/)
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

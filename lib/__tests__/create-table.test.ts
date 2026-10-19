/**
 * Offline. The Create table (plan v11 Step 2): templates from the published profile, the cells' roles, the text each
 * Canva template gets, the row checks, the media decisions, Human+ on the pipeline's writer, and the Run job's posts.
 * Runs on the brand profile set by ./published-profile.ts (the invented fixture by default). No network, no Firestore.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { published, loadPublishedProfileFirst } from "./published-profile"
import { CREATE_PLATFORMS, cellRoles, createTemplates, ddmmmyy, designText, formatsOf, rowProblems, type CreateRow } from "../content-pipeline/create-table"
import { blobStoreHost, isCreateUpload, mediaKind, transcodeArgs, videoContainer, videoPlan } from "../content-pipeline/create-media"
import { cardSubject } from "../content-pipeline/series"
import { humanPlus, HumanPlusError, type HumanPlusDeps } from "../content-pipeline/human-plus"
import { CreateRowError, createRequestId, runCreateRow, serverRowProblems, type CreateRunDeps } from "../content-pipeline/create-run"
import type { McuAi } from "../content-pipeline/model"
import type { ContentPost } from "../../components/crm/types"

loadPublishedProfileFirst()

const news = () => createTemplates(published.milcity).find(t => t.kind === "news")!
const row = (over: Partial<CreateRow> = {}): CreateRow => ({
  id: "row-0001-abcd", brand: "milcity", kind: "news", referenceLink: "https://www.army.mil/article/1", notes: "",
  media: { url: "https://abc.public.blob.vercel-storage.com/content-create/p.jpg", kind: "image", name: "p.jpg", optimized: "done" },
  platforms: ["instagram_feed", "facebook_feed"], headline: "ARMY FIELDS NEW KIT", subHeadline: "Soldiers test it this week.", caption: "Body.\n\nSource: U.S. Army, 19 Oct 2026",
  date: "2026-10-21", fields: { source: "U.S. Army" }, ...over,
})

test("the table offers each one-card template with a feed or Reels template; a roundup waits for Step 4", () => {
  const kinds = createTemplates(published.milcity).map(t => t.kind)
  assert.ok(kinds.includes("news") && kinds.includes("breaking") && kinds.includes("dt101"))
  assert.ok(!kinds.includes("icymi"), "ICYMI is built from published posts (Step 4)")
  const n = news(), s = published.milcity.series.news!
  assert.equal(n.templates.feed, s.templates.feed)
  assert.equal(n.templates.reels, s.templates.reels || undefined)
  assert.equal(n.media.feed, s.media?.feed ?? undefined)
})

test("the first written field is the Headline, the second the Sub-headline; server-filled and fixed ones never show", () => {
  for (const t of createTemplates(published.milcity)) {
    const r = cellRoles(published.milcity.series[t.series]!)
    assert.equal(t.fields.find(f => f.role === "headline")?.name, r.headline)
    assert.equal(t.fields.find(f => f.role === "subHeadline")?.name, r.subHeadline)
    for (const f of t.fields) assert.ok(!published.milcity.series[t.series]!.fields.find(x => x.name === f.name)!.serverFilled)
  }
})

test("platforms make formats: Instagram and Facebook share one feed and one Reels design", () => {
  assert.deepEqual(formatsOf(["instagram_feed", "facebook_feed"]), [{ format: "feed", platforms: ["instagram", "facebook"] }])
  assert.deepEqual(formatsOf(["facebook_reels", "instagram_feed"]), [{ format: "feed", platforms: ["instagram"] }, { format: "reels", platforms: ["facebook"] }])
  assert.equal(CREATE_PLATFORMS.length, 4)
})

test("the card text goes under the template's own names, or a generic master's headline and deck", () => {
  const t = news()
  const own = designText(t, row(), { headline: "text", deck: "text", date: "text", source: "text", media: "image" })
  assert.deepEqual(own.text, { headline: "ARMY FIELDS NEW KIT", deck: "Soldiers test it this week.", source: "U.S. ARMY", date: "21OCT26" })
  assert.deepEqual(own.unfilled, [])
  // A DT101 row on a generic master: its own field names are missing, so the columns go to headline and deck.
  const dt = createTemplates(published.milcity).find(x => x.kind === "dt101")!
  const generic = designText(dt, { headline: "SEES IN\nTHE DARK", subHeadline: "X10D / Skydio", fields: {}, date: "2026-10-21" }, { headline: "text", deck: "text", maker: "text", date: "text", media: "image" })
  assert.equal(generic.text.headline, "SEES IN\nTHE DARK")
  assert.equal(generic.text.deck, "X10D / SKYDIO")
  // A field the template has no place for is named, so Run job stops rather than fill half a card.
  assert.deepEqual(designText(t, row(), { headline: "text", media: "image" }).unfilled, ["Deck", "Source outlet"])
  assert.equal(ddmmmyy("2026-01-05"), "05JAN26")
})

test("a row runs only when it is complete; the server adds the template's limits", () => {
  const t = news()
  assert.deepEqual(rowProblems(row(), t), [])
  assert.deepEqual(rowProblems(row({ media: null, headline: "", platforms: [] }), t), ["Tick at least one platform", "Write the Headline"])
  assert.ok(rowProblems(row({ media: null }), t).includes("Add media (a photo or a video)"))
  assert.ok(rowProblems(row({ media: { ...row().media!, optimized: "running" } }), t).includes("Wait for the media to finish optimizing"))
  const dt = createTemplates(published.milcity).find(x => x.kind === "dt101")!
  if (!dt.templates.reels) assert.ok(rowProblems(row({ kind: "dt101", platforms: ["instagram_reels"] }), dt).some(p => /no Reels 9:16 template/.test(p)))
  assert.deepEqual(serverRowProblems(row()).problems, [])
  const long = serverRowProblems(row({ headline: "A HEADLINE FAR FAR TOO LONG FOR ANY CARD THIS BRAND HAS EVER PRINTED ON ITS FEED" })).problems
  assert.ok(long.some(p => /Headline/.test(p)), long.join("; "))
  assert.ok(serverRowProblems(row({ caption: "Thanks @someone\n\nSource: X, 1 Jan" })).problems.some(p => /@handle/.test(p)))
})

test("media: photos and Canva's video containers are taken; a phone MP4 or MOV passes through, others are converted", () => {
  assert.equal(mediaKind("image/jpeg"), "image"); assert.equal(mediaKind("video/quicktime"), "video"); assert.equal(mediaKind("image/gif"), null)
  const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, ...[...brand.padEnd(4)].map(c => c.charCodeAt(0))])
  assert.deepEqual(videoContainer(ftyp("qt")), { kind: "isobmff", brand: "qt" })
  assert.deepEqual(videoPlan(ftyp("isom"), 30e6), { action: "passthrough" })
  assert.deepEqual(videoPlan(ftyp("qt"), 30e6), { action: "passthrough" })
  assert.equal(videoPlan(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), 30e6).action, "transcode")
  assert.equal(videoPlan(ftyp("isom"), 600 * 1024 * 1024).action, "refuse")
  assert.ok(transcodeArgs("in.mov", "out.mp4").join(" ").includes("scale='min(1080,iw)':-2,fps=30 -c:v libx264"))
  assert.ok(transcodeArgs("in.mov", "out.mp4").includes("+faststart"))
  const host = blobStoreHost("vercel_blob_rw_AbC123_secret")
  assert.equal(host, "abc123.public.blob.vercel-storage.com")
  assert.ok(isCreateUpload("https://abc123.public.blob.vercel-storage.com/content-create/x.mp4", host))
  assert.ok(!isCreateUpload("https://abc123.public.blob.vercel-storage.com/content-posts/x.mp4", host))
  assert.ok(!isCreateUpload("https://other.public.blob.vercel-storage.com/content-create/x.mp4", host), "another Blob store is refused")
  assert.ok(!isCreateUpload("https://evil.example.com/content-create/x.mp4", host))
  assert.ok(!isCreateUpload("https://abc123.public.blob.vercel-storage.com/content-create/x.mp4", null), "no store configured, nothing is ours")
})

// ── Human+ ──
const SOURCE = "The U.S. Army fielded the new Kestrel counter-drone kit to soldiers at Fort Hood this week. The Kestrel counter-drone kit detects small drones at two kilometers and jams their control links. Soldiers from the 1st Cavalry Division began training on the kit on Monday, the Army said in its announcement. ".repeat(3)
const page = { url: "https://www.army.mil/article/1", title: "Army fields Kestrel counter-drone kit", text: SOURCE, publishedAt: "2026-10-18T12:00:00Z", siteName: "U.S. Army" }
function stubAi(over: Partial<McuAi> = {}): McuAi {
  return {
    research: async () => ({ candidates: [] }),
    findPhotoPages: async () => [],
    write: async () => ({ frames: [{ series: "news", fields: { headline: "ARMY FIELDS KESTREL KIT", deck: "Soldiers begin training on the counter-drone kit.", source: "U.S. ARMY" } }], caption: "The Army put the Kestrel kit in soldiers' hands at Fort Hood.\n\nSource: U.S. Army, 18 Oct 2026" }),
    ...over,
  } as McuAi
}
const hpDeps = (ai: McuAi, fetchPage = async () => page): HumanPlusDeps => ({ ai: () => ai, fetchPage, seeds: async () => null, nowMs: () => Date.parse("2026-10-19T15:00:00Z") })

test("Human+ drafts the cells from the reference link with the pipeline's writer, and never researches another story", async () => {
  let researched = 0
  const ai = stubAi({ research: async () => { researched++; return { candidates: [] } } })
  const r = await humanPlus(hpDeps(ai), { kind: "news", url: page.url, requestedBy: { actorEmail: "a@b.co", actorName: "A" } })
  assert.equal(researched, 0)
  assert.equal(r.source.url, page.url)
  assert.equal(r.hold, undefined, r.hold)
  assert.equal(r.headline, "ARMY FIELDS KESTREL KIT")
  assert.equal(r.subHeadline, "Soldiers begin training on the counter-drone kit.")
  assert.match(r.caption, /^Source: /m)
  assert.equal(r.fields.date, "18OCT26", "the card prints the story's date")
})

test("Human+ reports a writer hold as it is: the person's story is never swapped", async () => {
  let researched = 0
  const ai = stubAi({ research: async () => { researched++; return { candidates: [] } }, write: async () => ({ frames: [], caption: "", hold: "the source does not say what the kit does" }) })
  const r = await humanPlus(hpDeps(ai), { kind: "news", url: page.url, requestedBy: { actorEmail: "a@b.co", actorName: "A" } })
  assert.match(r.hold ?? "", /does not say what the kit does/)
  assert.equal(researched, 0)
})

test("Human+ refuses an unreadable link with a reason the person can act on", async () => {
  await assert.rejects(humanPlus(hpDeps(stubAi(), async () => { throw new Error("http_404") }), { kind: "news", url: page.url, requestedBy: { actorEmail: "a@b.co", actorName: "A" } }), (e: unknown) => e instanceof HumanPlusError && e.status === 400 && /could not be read/.test(e.message))
  await assert.rejects(humanPlus(hpDeps(stubAi(), async () => ({ ...page, text: "short" })), { kind: "news", url: page.url, requestedBy: { actorEmail: "a@b.co", actorName: "A" } }), /no readable article text/)
})

// ── Run job ──
function runDeps() {
  const running = new Set<string>()
  const posts = new Map<string, ContentPost>(), made: { requestId: string; templateId: string; text: Record<string, string>; video?: unknown; image?: unknown }[] = [], exports: string[] = []
  const deps: CreateRunDeps = {
    templateFields: async () => ({ headline: "text", deck: "text", date: "text", source: "text", media: "image" }),
    createDesign: async i => { made.push(i); return { designId: `D${made.length}abcdefgh`, title: i.title, editUrl: "https://canva/e", viewUrl: "https://canva/v", templateId: i.templateId, fields: Object.keys(i.text), previewUrls: [`https://export/${made.length}.jpg`], createdAt: "t" } },
    exportDesign: async (id, as) => { exports.push(`${id}:${as}`); return [`https://export/${id}.${as}`] },
    findByRequestId: async id => [...posts.values()].find(p => p.intake?.requestId === id) ?? null,
    createPost: async p => { const post = { ...p, id: `post${posts.size + 1}`, created_at: "t", updated_at: "t" } as ContentPost; posts.set(post.id, post); return post },
    attachExports: async ({ postId, items, canva }) => { const p = posts.get(postId)!; posts.set(postId, { ...p, assets: items.map(i => ({ url: i.url, kind: i.url.endsWith(".mp4") ? "video" : "image" })), export_fingerprint: "fp", canva_design_id: canva.designId } as ContentPost); return { holds: [] } },
    claimRow: async id => { if (running.has(id)) return false; running.add(id); return true },
    releaseRow: async id => { running.delete(id) },
    now: () => "2026-10-19T15:00:00.000Z",
  }
  return { deps, posts, made, exports, running }
}

test("Run job: one design and one Review post per format, stamped, keyed by the row, with video exported as MP4", async () => {
  const s = runDeps()
  const r = await runCreateRow(s.deps, row({ platforms: ["instagram_feed", "facebook_feed", "instagram_reels"] }), { email: "audrey@x.co", name: "Audrey" })
  assert.deepEqual(r.posts.map(p => p.format), news().templates.reels ? ["feed", "reels"] : ["feed"])
  const feed = [...s.posts.values()].find(p => p.create_format === "feed")!
  assert.equal(feed.status, "needs_approval")
  assert.deepEqual(feed.social_platforms, ["instagram", "facebook"])
  assert.equal(feed.profile_version_id, published.active.versionId)
  assert.equal(feed.create_row_id, "row-0001-abcd")
  assert.equal(feed.date_to_post, "2026-10-21")
  assert.equal(feed.intake?.requestId, createRequestId("row-0001-abcd", "feed"))
  assert.equal(feed.intake?.source, "content-pipeline")
  assert.equal(s.made[0].templateId, news().templates.feed)
  assert.deepEqual(s.made[0].image, { field: news().media.feed, url: row().media!.url, name: "p.jpg" })
  if (news().templates.reels) assert.ok(s.exports.some(e => e.endsWith(":mp4")), "a Reels design is exported as video")
  // A retry reuses the posts it made: no second design.
  const again = await runCreateRow(s.deps, row({ platforms: ["instagram_feed", "facebook_feed", "instagram_reels"] }), { email: "audrey@x.co", name: "Audrey" })
  assert.ok(again.posts.every(p => p.reused))
  assert.equal(s.made.length, r.posts.length)
})

test("Run job: a video row puts the video in the image field and exports MP4 for feed too; an incomplete row is refused", async () => {
  const s = runDeps()
  const video = { url: "https://abc.public.blob.vercel-storage.com/content-create/c.mp4", kind: "video" as const, name: "c.mp4", bytes: 1e7, optimized: "done" }
  await runCreateRow(s.deps, row({ media: video }), { email: "a@x.co", name: "A" })
  assert.deepEqual(s.made[0].video, { field: news().media.feed, url: video.url, name: "c.mp4", bytes: 1e7 })
  assert.equal(s.made[0].image, undefined)
  assert.ok(s.exports[0].endsWith(":mp4"))
  await assert.rejects(runCreateRow(s.deps, row({ caption: "" }), { email: "a@x.co", name: "A" }), /Write the Caption/)
})

test("Run job: two runs of one row at once make one set of designs; the second is refused while the first holds it", async () => {
  const s = runDeps()
  const [a, b] = await Promise.allSettled([
    runCreateRow(s.deps, row(), { email: "a@x.co", name: "A" }),
    runCreateRow(s.deps, row(), { email: "a@x.co", name: "A" }),
  ])
  assert.equal(a.status, "fulfilled")
  assert.ok(b.status === "rejected" && b.reason instanceof CreateRowError && b.reason.status === 409)
  assert.equal(s.made.length, (a as PromiseFulfilledResult<{ posts: unknown[] }>).value.posts.length)
  assert.equal(s.running.size, 0, "the claim is released when the run ends")
})

test("cardSubject: the DT101 masters name the subject in the deck and the company in maker; older cards in subject_identifier", () => {
  assert.deepEqual(cardSubject({ headline: "SEES THROUGH SMOKE AND DARK", deck: "Skydio X10D, a small reconnaissance drone.", maker: "Skydio", domain: "Air", status: "Fielded" }), { subject: "Skydio X10D", maker: "Skydio" })
  assert.deepEqual(cardSubject({ deck: "Coyote Block 2 — a drone interceptor", maker: "RTX" }), { subject: "Coyote Block 2", maker: "RTX" })
  assert.deepEqual(cardSubject({ benefit_headline: "X", subject_identifier: "COYOTE / RAYTHEON" }), { subject: "COYOTE", maker: "RAYTHEON" })
  assert.deepEqual(cardSubject({ headline: "A NEWS HEADLINE", deck: "A deck, with a comma" }), { subject: "", maker: "" })
})

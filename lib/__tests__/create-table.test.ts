/**
 * Offline. The Create table (plan v11 Step 2): templates from the published profile, the cells' roles, the text each
 * Canva template gets, the row checks, the media decisions, Human+ on the pipeline's writer, and the Run job's posts.
 * Runs on the brand profile set by ./published-profile.ts (the invented fixture by default). No network, no Firestore.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { published, loadPublishedProfileFirst } from "./published-profile"
import { CREATE_PLATFORMS, choiceLabel, formatChoices, mediaShapeOf, normalizePlatforms, platformProblems, cellRoles, isHandPosted, platformIdsOf, templateGap, createTemplates, ddmmmyy, designText, exportFileBase, formatsOf, rowProblems, type CreateRow, type RoundupStory } from "../content-pipeline/create-table"
import { PAGE_LINK_MESSAGE, blobStoreHost, dvidsImagePage, isCreateUpload, isPageLink, isPageType, mediaKind, transcodeArgs, videoContainer, videoPlan } from "../content-pipeline/create-media"
import { cardSubject } from "../content-pipeline/series"
import { humanPlus, humanPlusRoundup, HumanPlusError, withoutMediaLines, type HumanPlusDeps } from "../content-pipeline/human-plus"
import { roundupChoices } from "../content-pipeline/roundup"
import { DOD_NOTICE } from "../content-pipeline/worker"
import { CreateRowError, createRequestId, shortExportHolds, replaceRowMedia, runCreateRow, serverRowProblems, type CreateRunDeps } from "../content-pipeline/create-run"
import type { McuAi } from "../content-pipeline/model"
import { guardedContentUpdate, sendBackPlan } from "../owned-meta-publisher"
import { approvalCovers, isApproved } from "../content-pipeline/row-approval"
import type { ContentPost } from "../../components/crm/types"

loadPublishedProfileFirst()

const news = () => createTemplates(published.milcity).find(t => t.kind === "news")!
const row = (over: Partial<CreateRow> = {}): CreateRow => ({
  id: "row-0001-abcd", brand: "milcity", kind: "news", referenceLink: "https://www.army.mil/article/1", notes: "",
  media: { url: "https://abc.public.blob.vercel-storage.com/content-create/p.jpg", kind: "image", name: "p.jpg", optimized: "done" },
  platforms: ["instagram_feed", "facebook_feed"], headline: "ARMY FIELDS NEW KIT", subHeadline: "Soldiers test it this week.", caption: "Body.\n\nSource: U.S. Army, 19 Oct 2026",
  date: "2026-10-21", fields: { source: "U.S. Army" }, ...over,
})

test("the table offers each one-card template with a feed or Reels template, and the ICYMI roundup (Step 4)", () => {
  const kinds = createTemplates(published.milcity).map(t => t.kind)
  assert.ok(kinds.includes("news") && kinds.includes("breaking") && kinds.includes("dt101"))
  assert.ok(kinds.includes("icymi"), "ICYMI is built from published posts (Step 4 item 1)")
  const n = news(), s = published.milcity.series.news!
  assert.equal(n.templates.feed, s.templates.feed)
  assert.equal(n.templates.reels, s.templates.reels || undefined)
  assert.equal(n.media.feed, s.media?.feed ?? undefined)
})

test("the first written field is the Headline, the second the Sub-headline; server-filled and fixed ones never show", () => {
  for (const t of createTemplates(published.milcity)) {
    if (t.roundup) continue // its cells are the story rows (the ICYMI tests)
    const r = cellRoles(published.milcity.series[t.series]!)
    assert.equal(t.fields.find(f => f.role === "headline")?.name, r.headline)
    assert.equal(t.fields.find(f => f.role === "subHeadline")?.name, r.subHeadline)
    for (const f of t.fields) assert.ok(!published.milcity.series[t.series]!.fields.find(x => x.name === f.name)!.serverFilled)
  }
})

test("platforms make formats: Instagram and Facebook share one feed and one Reels design", () => {
  assert.deepEqual(formatsOf(["instagram_feed", "facebook_feed"]), [{ format: "feed", platforms: ["instagram", "facebook"] }])
  assert.deepEqual(formatsOf(["facebook_reels", "instagram_feed"]), [{ format: "feed", platforms: ["instagram"] }, { format: "reels", platforms: ["facebook"] }])
  assert.equal(CREATE_PLATFORMS.length, 7)
})

test("TikTok and YouTube Shorts take the 9:16 design and LinkedIn the 4:5 one; all three are posted by hand", () => {
  assert.deepEqual(formatsOf(["tiktok", "youtube_shorts", "linkedin"]), [{ format: "feed", platforms: ["linkedin"] }, { format: "reels", platforms: ["tiktok", "youtube"] }])
  assert.deepEqual(formatsOf(["instagram_reels", "tiktok"]), [{ format: "reels", platforms: ["instagram", "tiktok"] }])
  assert.deepEqual(CREATE_PLATFORMS.filter(p => p.posting === "hand").map(p => p.id), ["tiktok", "youtube_shorts", "linkedin"])
  assert.ok(isHandPosted("tiktok") && isHandPosted("linkedin") && isHandPosted("youtube") && !isHandPosted("instagram") && !isHandPosted("facebook"))
  assert.deepEqual(platformIdsOf("reels", ["instagram", "youtube"]), ["instagram_reels", "youtube_shorts"])
})

test("a format with no template is a gap with a note: it can't be ticked, and a row asking for it doesn't run", () => {
  const t = { ...news(), templates: { feed: news().templates.feed } }
  assert.equal(templateGap(t, "MilCityUSA", "reels"), `No 9:16 ${t.label} template for MilCityUSA yet`)
  assert.equal(templateGap(t, "MilCityUSA", "feed"), null)
  assert.equal(templateGap(undefined, "MilCityUSA", "reels"), null, "no template chosen yet is not a gap")
  assert.ok(rowProblems(row({ platforms: ["tiktok"] }), t).includes(`${t.label} has no 9:16 template yet`))
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
  if (!dt.templates.reels) assert.ok(rowProblems(row({ kind: "dt101", platforms: ["instagram_reels"] }), dt).some(p => /no 9:16 template/.test(p)))
  assert.deepEqual(serverRowProblems(row()).problems, [])
  const long = serverRowProblems(row({ headline: "A HEADLINE FAR FAR TOO LONG FOR ANY CARD THIS BRAND HAS EVER PRINTED ON ITS FEED" })).problems
  assert.ok(long.some(p => /Headline/.test(p)), long.join("; "))
  assert.ok(serverRowProblems(row({ caption: "Thanks @someone\n\nSource: X, 1 Jan" })).problems.some(p => /@handle/.test(p)))
})

test("media: photos and Canva's video containers are taken; a phone MP4 or MOV passes through, others are converted", () => {
  assert.equal(mediaKind("image/jpeg"), "image"); assert.equal(mediaKind("video/quicktime"), "video"); assert.equal(mediaKind("image/webp"), "image"); assert.equal(mediaKind("image/gif"), "image"); assert.equal(mediaKind("image/svg+xml"), null); assert.equal(mediaKind("text/html; charset=utf-8"), null)
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
const hpDeps = (ai: McuAi, fetchPage: HumanPlusDeps["fetchPage"] = async () => page): HumanPlusDeps => ({ ai: () => ai, fetchPage, seeds: async () => null, nowMs: () => Date.parse("2026-10-19T15:00:00Z") })

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
function runDeps(live: RoundupStory[] = []) {
  const running = new Set<string>()
  const bases: string[] = [], attachCalls: { items: string[]; canvaItems?: number }[] = []
  const posts = new Map<string, ContentPost>(), made: { requestId: string; templateId: string; text: Record<string, string>; video?: unknown; image?: unknown }[] = [], exports: string[] = []
  const deps: CreateRunDeps = {
    templateFields: async () => ({ ...ICYMI_COVER, headline: "text", deck: "text", date: "text", source: "text", media: "image" }),
    createDesign: async i => { made.push(i); return { designId: `D${made.length}abcdefgh`, title: i.title, editUrl: "https://canva/e", viewUrl: "https://canva/v", templateId: i.templateId, fields: Object.keys(i.text), previewUrls: [`https://export/${made.length}.jpg`], createdAt: "t" } },
    exportDesign: async (id, as) => { exports.push(`${id}:${as}`); return [`https://export/${id}.${as}`] },
    findByRequestId: async id => [...posts.values()].find(p => p.intake?.requestId === id) ?? null,
    createPost: async p => { const post = { ...p, id: `post${posts.size + 1}`, created_at: "t", updated_at: "t" } as ContentPost; posts.set(post.id, post); return post },
    updatePost: async (id, u) => { const post = { ...posts.get(id)!, ...u } as ContentPost; posts.set(id, post); return post },
    roundupStories: async () => live,
    attachExports: async ({ postId, items, canva, canvaItems, fileBase, rebind }) => { attachCalls.push({ items: items.map(i => i.url), canvaItems }); const p = posts.get(postId)!; if (p.canva_design_id && p.canva_design_id !== canva.designId && !rebind) throw new Error("bound"); bases.push(fileBase); posts.set(postId, { ...p, assets: items.map(i => ({ url: i.url, kind: i.url.endsWith(".mp4") ? "video" : "image" })), export_fingerprint: "fp", canva_design_id: canva.designId } as ContentPost); return { holds: [] } },
    claimRow: async id => { if (running.has(id)) return false; running.add(id); return true },
    releaseRow: async id => { running.delete(id) },
    // The real send-back plan (owned-meta-publisher sendBackPlan), as firestore-crm sendBackToReview applies it.
    sendBack: async (id, actor) => { const p = posts.get(id)!; posts.set(id, { ...p, ...sendBackPlan(p as unknown as Record<string, unknown>, undefined, actor, "t", "Media replaced").post } as ContentPost) },
    now: () => "2026-10-19T15:00:00.000Z",
  }
  return { deps, posts, made, exports, running, bases, attachCalls }
}

test("Run job: one design and one Review post per format, stamped, keyed by the row, with video exported as MP4", async () => {
  const s = runDeps()
  const r = await runCreateRow(s.deps, row({ platforms: ["instagram_feed", "facebook_feed", "tiktok"] }), { email: "audrey@x.co", name: "Audrey" })
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
  const again = await runCreateRow(s.deps, row({ platforms: ["instagram_feed", "facebook_feed", "tiktok"] }), { email: "audrey@x.co", name: "Audrey" })
  assert.ok(again.posts.every(p => p.reused))
  assert.equal(s.made.length, r.posts.length)
})

test("Run job: TikTok and Shorts ride the 9:16 design, LinkedIn the 4:5 one, each post carrying its hand-posted platforms", async (t) => {
  if (!news().templates.reels) return t.skip("the profile under test has no 9:16 News template")
  const s = runDeps()
  const r = await runCreateRow(s.deps, row({ media: { url: "https://abc.public.blob.vercel-storage.com/content-create/c.mp4", kind: "video", name: "c.mp4", bytes: 1e7, optimized: "done" }, platforms: ["linkedin", "tiktok", "youtube_shorts", "instagram_reels", "facebook_reels"] }), { email: "a@x.co", name: "A" })
  assert.deepEqual(r.posts.map(p => p.format), ["feed", "reels"])
  const posts = [...s.posts.values()]
  assert.deepEqual(posts.find(p => p.create_format === "feed")!.social_platforms, ["linkedin"])
  assert.deepEqual(posts.find(p => p.create_format === "reels")!.social_platforms, ["instagram", "facebook", "tiktok", "youtube"])
  assert.ok(s.exports.some(e => e.endsWith(":mp4")), "the 9:16 design is exported as video, as TikTok and Shorts need")
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

test("Media cell: a web-page link (YouTube, an article) gets the plain page message; a direct file link does not", () => {
  assert.ok(isPageLink("https://www.youtube.com/watch?v=BaER7Txge2s"))
  assert.ok(isPageLink("https://youtu.be/BaER7Txge2s") && isPageLink("https://www.instagram.com/reel/abc/"))
  assert.ok(!isPageLink("https://news.inbox.eu/w/img/b0/ca/b0ca9649ff4bf2bc92-800x0.webp"))
  assert.ok(!isPageLink("https://notyoutube.com.example.org/clip.mp4"))
  assert.ok(isPageType("text/html; charset=utf-8") && !isPageType("image/webp"))
  assert.match(PAGE_LINK_MESSAGE, /^That's a web page, not a media file\./)
})

test("Human+: no Photo or credit line about the source's photo, since the person supplies the media", () => {
  const caption = "MISSION BRIEF // COYOTE BLOCK 2C+RM\n\n//Raytheon\n\nTech: Counter-drone interceptor\n\nSource: Janes, 12 October 2026. Photo: Raytheon Coyote 2C+RM during a test flight in July 2026 at Dugway Proving Ground, Utah.\n\nImage: U.S. Army photo by Sgt. A\n\nThe appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement."
  assert.equal(withoutMediaLines(caption), "MISSION BRIEF // COYOTE BLOCK 2C+RM\n\n//Raytheon\n\nTech: Counter-drone interceptor\n\nSource: Janes, 12 October 2026.")
  const plain = "Raytheon has begun field testing.\n\nSource: Janes, Oct. 12, 2026"
  assert.equal(withoutMediaLines(plain), plain)
})

test("Human+: only a line that starts with a media label goes; other text with the same words is kept whole", () => {
  const tax = "Veterans can claim the federal tax credit: up to $7,500 for a qualifying EV.\n\nSource: IRS, 14 Oct 2026"
  assert.equal(withoutMediaLines(tax), tax)
  const video = "Watch the video: link in bio.\n\nSource: U.S. Army, 18 Oct 2026"
  assert.equal(withoutMediaLines(video), video)
  assert.equal(withoutMediaLines("The Army fielded it.\n\nCredit: Raytheon\n\nVideo: U.S. Army footage\n\nSource: Janes, 12 Oct 2026. Image: Raytheon"), "The Army fielded it.\n\nSource: Janes, 12 Oct 2026.")
})

test("Human+: a photo pasted from DVIDS keeps its credit and the DoW notice; the person's own photo gets neither", async () => {
  assert.equal(dvidsImagePage("https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2601/9500068/1000w_q95.jpg"), "https://www.dvidshub.net/image/9500068")
  assert.equal(dvidsImagePage("https://www.dvidshub.net/image/9500068/coyote-launch"), "https://www.dvidshub.net/image/9500068")
  assert.equal(dvidsImagePage("https://news.inbox.eu/w/img/b0/ca/b0ca9649ff4bf2bc92-800x0.webp"), null)
  assert.equal(dvidsImagePage(undefined), null)
  const dvidsPage = { url: "https://www.dvidshub.net/image/9500068/coyote-launch", title: "Coyote launch", text: "", image: "https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2601/9500068/1000w_q95.jpg", description: "A Coyote launches at Yuma Proving Ground, Ariz., Jan. 29, 2026. (U.S. Army photo by Mark Schauer)" }
  const ai = stubAi({ write: async () => ({ frames: [{ series: "news", fields: { headline: "ARMY FIELDS KESTREL KIT", deck: "Soldiers train.", source: "U.S. ARMY" } }], caption: "The Army put the Kestrel kit in soldiers' hands.\n\nSource: U.S. Army, 18 Oct 2026. Photo: a soldier at Fort Hood" }) })
  const fetchPage = async (u: string) => u.startsWith("https://www.dvidshub.net/") ? dvidsPage : page
  const input = { kind: "news" as const, url: page.url, requestedBy: { actorEmail: "a@b.co", actorName: "A" } }
  const fromDvids = await humanPlus(hpDeps(ai, fetchPage), { ...input, mediaFrom: dvidsPage.image })
  assert.equal(fromDvids.caption, `The Army put the Kestrel kit in soldiers' hands.\n\nSource: U.S. Army, 18 Oct 2026.\n\nImage: U.S. Army photo by Mark Schauer\n\n${DOD_NOTICE}`)
  const own = await humanPlus(hpDeps(ai, fetchPage), { ...input, mediaFrom: "https://news.inbox.eu/w/img/b0/ca/b0ca9649ff4bf2bc92-800x0.webp" })
  assert.equal(own.caption, "The Army put the Kestrel kit in soldiers' hands.\n\nSource: U.S. Army, 18 Oct 2026.")
  const unread = await humanPlus(hpDeps(ai, async (u: string) => { if (u.includes("dvidshub")) throw new Error("http_503"); return page }), { ...input, mediaFrom: dvidsPage.image })
  assert.ok(unread.caption.endsWith(`\n\n${DOD_NOTICE}`))
  assert.ok(unread.notes.some(n => /could not be read for the photo's credit/.test(n)))
})

test("Run job after the row changed: a new design on the same post, never the old one (the TEST / 0:05 design)", async () => {
  const s = runDeps()
  const first = await runCreateRow(s.deps, row(), { email: "a@x.co", name: "A" })
  const changed = await runCreateRow(s.deps, row({ headline: "ARMY FIELDS NEWER KIT", caption: "New body." }), { email: "a@x.co", name: "A" })
  assert.equal(changed.posts[0].reused, false)
  assert.equal(changed.posts[0].postId, first.posts[0].postId, "the same post takes the new design")
  assert.notEqual(changed.posts[0].designId, first.posts[0].designId)
  assert.notEqual(s.made[0].requestId, s.made[1].requestId, "the Canva ledger is keyed by what the design is made from")
  const post = s.posts.get(changed.posts[0].postId)!
  assert.equal(post.social_copy, "New body.")
  assert.match(post.title, /NEWER KIT$/)
  // The same text again reuses it; new media makes another.
  assert.ok((await runCreateRow(s.deps, row({ headline: "ARMY FIELDS NEWER KIT", caption: "New body." }), { email: "a@x.co", name: "A" })).posts.every(p => p.reused))
  const media = { ...row().media!, url: "https://abc.public.blob.vercel-storage.com/content-create/q.jpg" }
  assert.equal((await runCreateRow(s.deps, row({ headline: "ARMY FIELDS NEWER KIT", caption: "New body.", media }), { email: "a@x.co", name: "A" })).posts[0].reused, false)
  assert.equal(s.made.length, 3)
})

test("Run job: a post already out isn't given a new design; the board title leaves the format out; files are named for people", async () => {
  const s = runDeps()
  const r = await runCreateRow(s.deps, row(), { email: "a@x.co", name: "A" })
  const post = s.posts.get(r.posts[0].postId)!
  assert.doesNotMatch(post.title, /Feed 4:5|Reels 9:16/)
  assert.match(s.bases[0], /^[a-z0-9]+-2026-10-21-army-fields-new-kit$/)
  s.posts.set(post.id, { ...post, status: "posted" })
  await assert.rejects(runCreateRow(s.deps, row({ headline: "CHANGED" }), { email: "a@x.co", name: "A" }), (e: unknown) => e instanceof CreateRowError && e.status === 409)
  assert.equal(exportFileBase("MilCityUSA", "2026-10-21", "¿Qué es SDOH? — A Look"), "milcityusa-2026-10-21-que-es-sdoh-a-look")
  assert.equal(exportFileBase("x", "not a date", ""), "x")
})

test("Run job: a post made before designs were hashed that is already out is reused, not refused", async () => {
  const s = runDeps()
  const r = await runCreateRow(s.deps, row(), { email: "a@x.co", name: "A" })
  const post = s.posts.get(r.posts[0].postId)!
  s.posts.set(post.id, { ...post, status: "posted", create_input_hash: undefined })
  const again = await runCreateRow(s.deps, row(), { email: "a@x.co", name: "A" })
  assert.ok(again.posts.every(p => p.reused)); assert.equal(s.made.length, 1)
})

// ── Replace media (Step 3 part 4) ──
test("Replace media: every size is filled again with the same text and the new media, on the same posts, still in Review", async () => {
  const s = runDeps()
  const platforms = ["instagram_feed", "facebook_feed", "tiktok"]
  const first = await runCreateRow(s.deps, row({ platforms }), { email: "a@x.co", name: "A" })
  const feed = s.posts.get(first.posts[0].postId)!
  assert.deepEqual(feed.create_text, { brand: "milcity", kind: "news", headline: "ARMY FIELDS NEW KIT", subHeadline: "Soldiers test it this week.", fields: { source: "U.S. Army", date: "21OCT26" } })
  // An approval, and a caption and date edited in the drawer, before the media is replaced.
  for (const p of s.posts.values()) s.posts.set(p.id, { ...p, status: "approved", social_copy: "Edited.", date_to_post: "2026-10-23" })
  const video = { url: "https://abc.public.blob.vercel-storage.com/content-create/new.mp4", kind: "video" as const, name: "new.mp4", bytes: 2e7, optimized: "done" }
  const made = s.made.length, before = new Map([...s.posts.values()].map(p => [p.id, p]))
  const r = await replaceRowMedia(s.deps, "row-0001-abcd", feed.create_text!, video, { email: "a@x.co", name: "A" })
  assert.deepEqual(r.posts.map(p => p.postId), first.posts.map(p => p.postId), "the same posts take the new designs")
  assert.ok(r.posts.every(p => !p.reused))
  assert.equal(s.made.length, made + first.posts.length, "one new design per size")
  const fresh = s.made.slice(made)
  assert.ok(fresh.every(d => d.video && (d.video as { url: string }).url === video.url), "the new video goes in every template")
  assert.equal(fresh[0].text[Object.keys(fresh[0].text).find(k => /head/.test(k))!], "ARMY FIELDS NEW KIT", "the same card text")
  assert.ok(s.exports.slice(-first.posts.length).every(e => e.endsWith(":mp4")))
  for (const id of r.posts.map(p => p.postId)) {
    const p = s.posts.get(id)!
    assert.equal(p.social_copy, "Edited.", "the caption is left as it is")
    assert.equal(p.date_to_post, "2026-10-23")
    assert.notEqual(p.create_input_hash, before.get(id)!.create_input_hash, "the re-run hash moves with the media")
    // The real update (owned-meta-publisher guardedContentUpdate) voids an approval when the files change.
    const was = before.get(id)!
    assert.equal(guardedContentUpdate({ ...was, owned_meta: { batchId: "b", started: false } } as unknown as Record<string, unknown>, { assets: p.assets }).status, "needs_approval")
    assert.equal(guardedContentUpdate({ ...was, approvals: [{ decision: "approved", export_fingerprint: "fp" }] } as unknown as Record<string, unknown>, { assets: p.assets }).status, "needs_approval")
  }
  // The same media again reuses the designs; the claim is released.
  assert.ok((await replaceRowMedia(s.deps, "row-0001-abcd", feed.create_text!, video, { email: "a@x.co", name: "A" })).posts.every(p => p.reused))
  assert.equal(s.running.size, 0)
})

test("Replace media: refused, with nothing made, when a size is already out or the row has no template-made posts", async () => {
  const s = runDeps()
  const first = await runCreateRow(s.deps, row(), { email: "a@x.co", name: "A" })
  const post = s.posts.get(first.posts[0].postId)!
  const photo = { ...row().media!, url: "https://abc.public.blob.vercel-storage.com/content-create/other.jpg" }
  s.posts.set(post.id, { ...post, status: "posted" })
  const made = s.made.length
  await assert.rejects(replaceRowMedia(s.deps, "row-0001-abcd", post.create_text!, photo, { email: "a@x.co", name: "A" }), (e: unknown) => e instanceof CreateRowError && e.status === 409)
  await assert.rejects(replaceRowMedia(s.deps, "row-9999-none", post.create_text!, photo, { email: "a@x.co", name: "A" }), /One-off/)
  await assert.rejects(replaceRowMedia(s.deps, "row-0001-abcd", { ...post.create_text!, kind: "no_such_kind" }, photo, { email: "a@x.co", name: "A" }), /no longer has the template/)
  assert.equal(s.made.length, made)
})

test("Replace media: a failure part-way never leaves one size changed beside another still approved", async (t) => {
  if (!news().templates.reels) return t.skip("the profile under test has no 9:16 News template")
  const s = runDeps()
  const first = await runCreateRow(s.deps, row({ platforms: ["linkedin", "tiktok"] }), { email: "a@x.co", name: "A" })
  assert.equal(first.posts.length, 2)
  // Both sizes approved for hand posting, bound to their files.
  for (const p of s.posts.values()) s.posts.set(p.id, { ...p, status: "approved", approvals: [{ decision: "approved", export_fingerprint: "fp", by_name: "A", by_email: "a@x.co", at: "t" }] } as unknown as ContentPost)
  const text = s.posts.get(first.posts[0].postId)!.create_text!
  // Files go through the real guard; the second size's files fail to store.
  let attaches = 0
  s.deps.attachExports = async ({ postId, items, canva }) => {
    if (++attaches === 2) throw new Error("Blob down")
    const p = s.posts.get(postId)!
    const updates = guardedContentUpdate(p as unknown as Record<string, unknown>, { assets: items.map(i => ({ url: i.url, kind: "image" })), export_fingerprint: "fp2", canva_design_id: canva.designId })
    s.posts.set(postId, { ...p, ...updates } as ContentPost)
    return { holds: [] }
  }
  const photo = { ...row().media!, url: "https://abc.public.blob.vercel-storage.com/content-create/new.jpg" }
  await assert.rejects(replaceRowMedia(s.deps, "row-0001-abcd", text, photo, { email: "a@x.co", name: "A" }), /Blob down/)
  for (const p of s.posts.values()) {
    assert.equal(isApproved(p), false, `${p.create_format} is back in Review`)
    assert.equal(approvalCovers(p), false, `${p.create_format} can't go out on the old approval`)
  }
  assert.equal(s.running.size, 0)
})

test("Replace media: the card keeps its printed date when the post date was changed in the drawer", async () => {
  const s = runDeps()
  const first = await runCreateRow(s.deps, row(), { email: "a@x.co", name: "A" })
  const post = s.posts.get(first.posts[0].postId)!
  assert.equal(post.create_text!.fields.date, "21OCT26")
  s.posts.set(post.id, { ...post, date_to_post: "2026-11-05" })
  const photo = { ...row().media!, url: "https://abc.public.blob.vercel-storage.com/content-create/other.jpg" }
  await replaceRowMedia(s.deps, "row-0001-abcd", post.create_text!, photo, { email: "a@x.co", name: "A" })
  assert.equal(s.made.at(-1)!.text.date, "21OCT26")
  await assert.rejects(replaceRowMedia(s.deps, "row-0001-abcd", { ...post.create_text!, fields: {} }, photo, { email: "a@x.co", name: "A" }), /printed date/)
})

// ── One size per platform per row (Step 3 part 5) ──
const VIDEO = { url: "https://abc.public.blob.vercel-storage.com/content-create/c.mp4", kind: "video" as const, name: "c.mp4", bytes: 1e7, optimized: "done" }

test("each platform's sizes follow the media: a photo is 4:5 on Instagram and Facebook; a video a 9:16 Reel, or a 4:5 Reel", () => {
  assert.deepEqual(formatChoices("instagram", "photo"), ["feed"])
  assert.deepEqual(formatChoices("facebook", "photo"), ["feed"])
  assert.deepEqual(formatChoices("instagram", "video"), ["reels", "feed"], "9:16 Reel first: the default")
  assert.deepEqual(formatChoices("facebook", "video"), ["reels", "feed"])
  for (const shape of ["photo", "video"] as const) {
    assert.deepEqual(formatChoices("tiktok", shape), ["reels"])
    assert.deepEqual(formatChoices("youtube", shape), ["reels"])
    assert.deepEqual(formatChoices("linkedin", shape), ["feed"])
  }
  assert.equal(choiceLabel("instagram", "reels", "video"), "9:16 Reel")
  assert.equal(choiceLabel("instagram", "feed", "video"), "4:5 Reel")
  assert.equal(choiceLabel("facebook", "feed", "video"), "4:5 video", "Facebook posts a 4:5 video as a Page video, not a Reel")
  assert.equal(choiceLabel("facebook", "reels", "video"), "9:16 Reel")
  assert.equal(choiceLabel("instagram", "feed", "photo"), "4:5")
  assert.equal(mediaShapeOf(null), "photo")
  assert.equal(mediaShapeOf(VIDEO), "video")
})

test("ticks are fitted to one size per platform: kept when allowed, the default when not, reset when photo and video swap", () => {
  const all = CREATE_PLATFORMS.map(p => p.id)
  assert.deepEqual(normalizePlatforms(all, "photo"), ["instagram_feed", "facebook_feed", "tiktok", "youtube_shorts", "linkedin"])
  assert.deepEqual(normalizePlatforms(["instagram_feed", "facebook_reels"], "video"), ["instagram_feed", "facebook_reels"], "a 4:5 Reel choice is kept")
  assert.deepEqual(normalizePlatforms(["instagram_feed", "facebook_feed"], "video", undefined, true), ["instagram_reels", "facebook_reels"], "a new video defaults to 9:16 Reels")
  assert.deepEqual(normalizePlatforms(["instagram_reels", "tiktok"], "photo"), ["instagram_feed", "tiktok"])
  assert.deepEqual(normalizePlatforms(["instagram_reels"], "video", f => f === "feed"), ["instagram_feed"], "no 9:16 template: the 4:5 Reel")
  assert.deepEqual(normalizePlatforms(["tiktok"], "video", f => f === "feed"), [], "TikTok with no 9:16 template is dropped")
})

test("a row with a platform at two sizes, or at a size its media doesn't take, can't run", () => {
  const t = news()
  assert.deepEqual(platformProblems(["instagram_feed", "instagram_reels"], "video"), ["Instagram is ticked at two sizes; a platform gets one size per row"])
  assert.deepEqual(platformProblems(["facebook_reels"], "photo"), ["Facebook takes a photo at 4:5 only"])
  assert.deepEqual(platformProblems(["instagram_reels", "facebook_feed", "tiktok", "linkedin"], "video"), [])
  assert.ok(rowProblems(row({ platforms: ["instagram_feed", "instagram_reels"] }), t).some(p => /two sizes/.test(p)))
  assert.ok(rowProblems(row({ platforms: ["instagram_reels"] }), t).some(p => /takes a photo at 4:5 only/.test(p)))
  assert.ok(!rowProblems(row({ media: VIDEO, platforms: ["instagram_reels", "facebook_feed"] }), t).some(p => /size|takes a/.test(p)))
})

test("Run job: the server refuses two sizes for one platform before anything is made, and stamps the media on each post", async () => {
  const s = runDeps()
  await assert.rejects(runCreateRow(s.deps, row({ media: VIDEO, platforms: ["instagram_feed", "instagram_reels"] }), { email: "a@x.co", name: "A" }), (e: unknown) => e instanceof CreateRowError && e.problems.some(p => /two sizes/.test(p)))
  assert.equal(s.made.length, 0)
  await runCreateRow(s.deps, row({ platforms: ["instagram_feed", "facebook_feed"] }), { email: "a@x.co", name: "A" })
  assert.equal([...s.posts.values()][0].create_media, "photo")
})

test("Replace media: a photo can't replace the video of a 9:16 size that goes to Instagram or Facebook", async (t) => {
  if (!news().templates.reels) return t.skip("the profile under test has no 9:16 News template")
  const s = runDeps()
  const first = await runCreateRow(s.deps, row({ media: VIDEO, platforms: ["instagram_reels", "facebook_reels", "linkedin"] }), { email: "a@x.co", name: "A" })
  const text = s.posts.get(first.posts[0].postId)!.create_text!
  const made = s.made.length
  const photo = { url: "https://abc.public.blob.vercel-storage.com/content-create/p2.jpg", kind: "image" as const, name: "p2.jpg", optimized: "done" }
  await assert.rejects(replaceRowMedia(s.deps, "row-0001-abcd", text, photo, { email: "a@x.co", name: "A" }), /Reels 9:16 size goes to Instagram and Facebook, which take a photo at 4:5 only/)
  assert.equal(s.made.length, made, "nothing is made")
})

test("a video export at Canva's default 5 s page timing is flagged in Review; a full-length one or a photo isn't", () => {
  assert.match(shortExportHolds("feed", VIDEO, [{ duration: 5 }])[0], /Feed 4:5 video is only 0:05 long: the template's page timing/)
  assert.deepEqual(shortExportHolds("feed", VIDEO, [{ duration: 42.4 }]), [])
  assert.deepEqual(shortExportHolds("feed", { kind: "image" }, [{ duration: 5 }]), [], "a photo card exported as MP4 is meant to be short")
  assert.deepEqual(shortExportHolds("reels", VIDEO, []), [], "a reused export isn't measured again")
})

// ── ICYMI (Step 4 item 1) ──
const icymi = () => createTemplates(published.milcity).find(t => t.kind === "icymi")!
const ICYMI_COVER = { headline: "text", story_numbers: "text", date: "text", story_01: "text", story_02: "text", story_03: "text", story_04: "text", story_05: "text", media: "image" }
const STORIES: RoundupStory[] = ["a1", "b2", "c3", "d4"].map((id, i) => ({ postId: id, title: `Story ${i + 1}`, card: `https://abc.public.blob.vercel-storage.com/content-posts/${id}-card.jpg`, publishedAt: `2026-10-1${5 - i}T14:00:00Z` }))
const icymiRow = (over: Partial<CreateRow> = {}) => row({ kind: "icymi", referenceLink: "", headline: "", subHeadline: "", platforms: ["instagram_feed", "facebook_feed"], caption: "Last week on the brand.", fields: { story_01: "Army fields new kit", story_02: "Navy tests drone", story_03: "Air Force picks jet" }, roundup: ["a1", "b2", "c3"], ...over })

test("ICYMI: a 4:5 roundup template with the profile's size and fixed headline; its cells are the story rows", () => {
  const t = icymi(), k = published.milcity.requestKinds.find(x => x.kind === "icymi")!, s = published.milcity.series.icymi_cover!
  assert.deepEqual(t.roundup, { min: k.minStories, max: Math.min(k.maxStories!, t.fields.length), headline: s.fields.find(f => f.fixed)!.fixed })
  assert.deepEqual(Object.keys(t.templates), ["feed"], "a carousel has no 9:16 size")
  assert.ok(t.fields.length && t.fields.every(f => f.role === "story" && /^story_0\d$/.test(f.name)), "headline, numbers and date are the server's")
})

test("ICYMI: the cover gets its fixed headline, a row and a number per ticked story, and nothing past the last", () => {
  const { text, unfilled } = designText(icymi(), icymiRow(), ICYMI_COVER)
  assert.deepEqual(unfilled, [])
  assert.equal(text.headline, icymi().roundup!.headline)
  assert.equal(text.story_numbers, "01\n02\n03")
  assert.equal(text.story_03, "Air Force picks jet")
  assert.equal(text.story_04, undefined)
  assert.equal(text.date, "21OCT26")
})

test("ICYMI: a row runs with min–max ticked stories, a row for each, a photo cover and 4:5 only", () => {
  const t = icymi()
  assert.deepEqual(rowProblems(icymiRow(), t), [])
  assert.match(rowProblems(icymiRow({ roundup: ["a1", "b2"] }), t).join(), /Tick 3–5 published stories/)
  assert.match(rowProblems(icymiRow({ fields: { story_01: "x", story_02: "y" } }), t).join(), /Write Story 3/)
  assert.match(rowProblems(icymiRow({ platforms: ["instagram_reels"] }), t).join(), /no 9:16 size/)
  assert.match(rowProblems(icymiRow({ media: { url: "https://abc.public.blob.vercel-storage.com/content-create/v.mp4", kind: "video", name: "v.mp4", optimized: "done" } }), t).join(), /takes a photo, not a video/)
  assert.match(rowProblems(icymiRow({ media: null }), t).join(), /cover's photo/)
})

test("ICYMI: the list is last week's posted News and Breaking posts with a card; drafts, explainers and roundups are left out", () => {
  const post = (id: string, over: Partial<ContentPost>): ContentPost => ({ id, title: `${published.milcity.shortName} News — Story ${id}`, status: "posted", social_copy: `Story ${id}. Source: x`, tags: published.milcity.posts.tag, posted_at: "2026-10-14T15:00:00Z", assets: [{ url: `https://blob/${id}.jpg`, kind: "image" }], create_text: { brand: "milcity", kind: "news", headline: `HEADLINE ${id}`, subHeadline: "", fields: {} }, ...over } as ContentPost)
  const posts = [post("p1", {}), post("p2", { posted_at: "2026-10-15T15:00:00Z" }), post("p3", { posted_at: "2026-10-16T15:00:00Z" }),
    post("draft", { status: "needs_approval" }), post("old", { posted_at: "2026-10-01T15:00:00Z" }), post("nocard", { assets: [] }),
    post("dt", { title: `${published.milcity.shortName} Tech Explainer — X` }), post("icy", { title: `${published.milcity.shortName} ICYMI roundup — 3 stories` })]
  const monday = Date.parse("2026-10-19T15:00:00Z")
  const c = roundupChoices(posts, monday, null)
  assert.equal(c.hold, undefined, c.hold)
  assert.deepEqual(c.stories.map(x => x.postId), ["p3", "p2", "p1"], "newest first")
  assert.equal(c.stories[0].headline, "HEADLINE p3")
  assert.equal(c.stories[0].card, "https://blob/p3.jpg")
  assert.match(roundupChoices(posts.slice(0, 2), monday, null).hold ?? "", /takes at least 3/)
})

test("ICYMI Run job: the cover then each ticked story's published card, checked again on the server, bound to the cover", async () => {
  const s = runDeps(STORIES)
  const r = await runCreateRow(s.deps, icymiRow(), { email: "audrey@x.co", name: "Audrey" })
  assert.deepEqual(r.posts.map(p => p.format), ["feed"])
  const post = [...s.posts.values()][0]
  assert.deepEqual(post.roundup_slides?.map(x => x.postId), ["a1", "b2", "c3"])
  assert.equal(post.canva_design_id, r.posts[0].designId)
  assert.deepEqual(s.attachCalls[0].items.slice(1), STORIES.slice(0, 3).map(x => x.card))
  assert.equal(s.attachCalls[0].canvaItems, 1, "only the cover is the design's page")
  assert.equal(s.made[0].templateId, icymi().templates.feed)
  assert.equal(s.made[0].text.story_numbers, "01\n02\n03")
  assert.match(post.title, /ICYMI|roundup/i)
  assert.deepEqual(post.create_text?.roundup, ["a1", "b2", "c3"])
  // A story that left the window since it was ticked: refused, nothing made.
  const stale = runDeps(STORIES.slice(1))
  await assert.rejects(runCreateRow(stale.deps, icymiRow(), { email: "a@b.co", name: "A" }), (e: unknown) => e instanceof CreateRowError && e.status === 409 && /no longer a live post/.test(e.message))
  assert.equal(stale.made.length, 0)
})

test("ICYMI Replace media: the new cover photo, and the same published cards after it", async () => {
  const s = runDeps(STORIES)
  await runCreateRow(s.deps, icymiRow(), { email: "audrey@x.co", name: "Audrey" })
  const post = [...s.posts.values()][0]
  const media = { url: "https://abc.public.blob.vercel-storage.com/content-create/q.jpg", kind: "image" as const, name: "q.jpg", optimized: "done" }
  await replaceRowMedia(s.deps, "row-0001-abcd", post.create_text!, media, { email: "a@b.co", name: "A" })
  const last = s.attachCalls[s.attachCalls.length - 1]
  assert.deepEqual(last.items.slice(1), STORIES.slice(0, 3).map(x => x.card))
  assert.equal(last.canvaItems, 1)
  await assert.rejects(replaceRowMedia(s.deps, "row-0001-abcd", post.create_text!, { ...media, kind: "video", url: "https://abc.public.blob.vercel-storage.com/content-create/v.mp4" }, { email: "a@b.co", name: "A" }), /takes a photo, not a video/)
})

test("ICYMI Human+: the writer drafts the story rows and caption from the ticked posts; nothing is read from the web", async () => {
  let fetched = 0
  const ai = stubAi({ write: async () => ({ frames: [{ series: "icymi_cover", fields: { story_01: "Army fields new kit", story_02: "Navy tests drone", story_03: "Air Force picks jet" } }], caption: "Three stories from last week.\n\nSource: the brand's posts, 12–18 Oct 2026" }) })
  const items = STORIES.slice(0, 3).map(x => ({ postId: x.postId, title: x.title, caption: `${x.title} caption.`, card: { url: x.card } }))
  const r = await humanPlusRoundup({ ai: () => ai, seeds: async () => null, nowMs: () => Date.parse("2026-10-19T15:00:00Z") }, { kind: "icymi", items, window: "the week of 2026-10-12", requestedBy: { actorEmail: "a@b.co", actorName: "A" } })
  assert.equal(fetched, 0)
  assert.equal(r.hold, undefined, r.hold)
  assert.equal(r.fields.story_02, "Navy tests drone")
  assert.equal(r.fields.story_04, undefined)
  assert.equal(r.fields.headline, undefined, "the fixed headline is never the writer's")
  assert.match(r.caption, /^Three stories from last week\./)
})

test("ICYMI Run job: a re-run resumes with the slides its post already holds, even after the window moved", async () => {
  const s = runDeps(STORIES)
  await runCreateRow(s.deps, icymiRow(), { email: "audrey@x.co", name: "Audrey" })
  // Monday: the window has moved on and none of the ticked stories is listed any more.
  s.deps.roundupStories = async () => []
  const again = await runCreateRow(s.deps, icymiRow(), { email: "audrey@x.co", name: "Audrey" })
  assert.ok(again.posts.every(p => p.reused), "the same design and post, no 409")
  // Changed ticks are new choices, checked against the window as it is now.
  await assert.rejects(runCreateRow(s.deps, icymiRow({ roundup: ["a1", "b2", "d4"], fields: { story_01: "a", story_02: "b", story_03: "d" } }), { email: "audrey@x.co", name: "Audrey" }), /no longer a live post/)
})

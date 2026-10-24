/**
 * Offline. The approval drawer (plan v11.1 Step 3): a Create row's variations approved together, bound to the files
 * shown — through the publisher for Instagram and Facebook, by export fingerprint for hand-posted platforms.
 * No network, no Firestore: storage and the publisher are fakes.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { addedConflicts, allowedPlatforms, platformConflicts, approvalCovers, approveRow, awaitingApproval, canvaDesignIdFromLink, futureDated, parsePages, resolveCanvaDesignLink, todayIn, exportAs, frozen, platformsFor, prepareChoices, readiness, RowApprovalError, shownOf, type ApproveRowDeps } from "../content-pipeline/row-approval"
import type { ContentPost } from "../../components/crm/types"
import type { MetaBatch } from "../owned-meta-publisher"

const FP_FEED = "a".repeat(64), FP_REELS = "b".repeat(64), FP_LINKEDIN = "c".repeat(64)
const post = (over: Partial<ContentPost>): ContentPost => ({
  id: "p", user: "Audrey", date_created: "2026-10-20", status: "needs_approval", title: "MCU News · Feed 4:5 — HEADLINE", links: [],
  assets: [{ url: "https://x.public.blob.vercel-storage.com/content-posts/1.jpg", kind: "image", sha256: "s1" }], social_platforms: ["instagram", "facebook"],
  social_copy: "Caption.", date_to_post: "2026-10-22", canva_design_id: "DAGabc123", export_fingerprint: FP_FEED, create_row_id: "row-0001-abcd", create_format: "feed",
  intake: { requestId: "admin:create:row-0001-abcd:feed", metaBrand: "milcity", requestedBy: "a@x.co", at: "t", source: "content-pipeline" },
  profile_version_id: "milcity@v3", created_at: "t", updated_at: "t", ...over,
})
const feed = post({ id: "feed" })
const reels = post({ id: "reels", create_format: "reels", export_fingerprint: FP_REELS, social_platforms: ["instagram", "facebook", "tiktok"], assets: [{ url: "https://x.public.blob.vercel-storage.com/content-posts/2.mp4", kind: "video", sha256: "s2" }] })
const linkedin = post({ id: "li", export_fingerprint: FP_LINKEDIN, social_platforms: ["linkedin"], canva_design_id: "DAGli0001" })
// One size per platform per row (Step 3 part 5): beside a 4:5 that goes to Instagram and Facebook, the 9:16 goes by hand.
const reelsHand = post({ ...reels, social_platforms: ["tiktok", "youtube"] })

function fakes(rows: ContentPost[], opts: { holds?: Record<string, string>; filesFp?: Record<string, string>; secondRead?: ContentPost[]; failDecide?: string } = {}) {
  const calls: string[] = []
  let reads = 0
  const deps: ApproveRowDeps = {
    listRow: async () => (reads++ && opts.secondRead) || rows,
    prepare: async (id, c) => { calls.push(`prepare:${id}:${c.format}:${c.placements.instagram}/${c.placements.facebook}`); return { id: `b-${id}`, hash: `h-${id}`, manifest: { revision: 1, assets: [{ sha256: id }], captions: c.captions } } as unknown as MetaBatch },
    preflight: b => ({ instagram: opts.holds?.[b.id] ?? null, facebook: null }),
    decide: async (id, rev, hash) => { if (opts.failDecide === id) throw new Error("Review changed"); calls.push(`decide:${id}:${rev}:${hash}`); return {} as MetaBatch },
    approveHand: async (id, shown) => { if (opts.failDecide === id) throw new Error("Review changed"); calls.push(`hand:${id}:${shown.fingerprint.slice(0, 1)}`) },
    fingerprintOf: s => opts.filesFp?.[s[0]] ?? rows.find(r => r.id === s[0])!.export_fingerprint!,
  }
  return { deps, calls }
}
const shown = (...ps: ContentPost[]) => Object.fromEntries(ps.map(p => [p.id, shownOf(p)]))
const NO_AI = { aiGenerated: false }

test("a row's variations are approved together: publisher manifests prepared, then each approval bound to its hash", async () => {
  const f = fakes([feed, reelsHand, linkedin])
  const out = await approveRow(f.deps, "row-0001-abcd", shown(feed, reelsHand, linkedin), NO_AI)
  assert.deepEqual(f.calls, ["prepare:feed:still:feed/feed", "decide:feed:1:h-feed", "hand:reels:b", "hand:li:c"])
  assert.deepEqual(out.map(o => `${o.postId}:${o.via}`), ["feed:publisher", "reels:publisher", "li:hand"].map(x => x === "reels:publisher" ? "reels:hand" : x))
  const g = fakes([reels, linkedin])
  await approveRow(g.deps, "row-0001-abcd", shown(reels, linkedin), NO_AI)
  assert.deepEqual(g.calls, ["prepare:reels:video:reels/reels", "decide:reels:1:h-reels", "hand:li:c"])
})

test("nothing is approved unless every variation is ready, and the reasons are named", async () => {
  const noDesign = post({ id: "nd", canva_design_id: undefined })
  const f = fakes([feed, noDesign])
  await assert.rejects(approveRow(f.deps, "r", shown(feed, noDesign), NO_AI), (e: unknown) => e instanceof RowApprovalError && e.problems.some(p => /Attach a Canva design/.test(p)))
  assert.deepEqual(f.calls, [], "no manifest is prepared and nothing is approved")
  assert.equal(readiness(post({ assets: [] })), "The design isn't exported yet; use Refresh from Canva")
  assert.match(readiness(post({ social_platforms: ["instagram"] }))!, /Instagram and Facebook together/)
  assert.equal(readiness(post({ social_platforms: ["instagram", "facebook", "linkedin"] })), null)
})

test("approval binds what was shown: a changed design, a changed row, or different files read stop it before any approval", async () => {
  const f = fakes([feed, reelsHand])
  await assert.rejects(approveRow(f.deps, "r", { ...shown(feed, reelsHand), feed: { ...shownOf(feed), fingerprint: "f".repeat(64) } }, NO_AI), /changed since it was shown/)
  await assert.rejects(approveRow(f.deps, "r", { ...shown(feed, reelsHand), feed: { ...shownOf(feed), caption: "Old caption." } }, NO_AI), /changed since it was shown/)
  await assert.rejects(approveRow(f.deps, "r", { ...shown(feed, reelsHand), reels: { ...shownOf(reelsHand), platforms: ["tiktok"] } }, NO_AI), /changed since it was shown/)
  await assert.rejects(approveRow(f.deps, "r", shown(feed), NO_AI), /row changed/)
  const g = fakes([feed, reelsHand], { filesFp: { feed: "0".repeat(64) } })
  await assert.rejects(approveRow(g.deps, "r", shown(feed, reelsHand), NO_AI), /files read for approval differ/)
  assert.ok(!g.calls.some(c => c.startsWith("decide")))
})

test("a format hold from the publisher's preflight stops the whole row before any approval", async () => {
  const f = fakes([reels, linkedin], { holds: { "b-reels": "Instagram Reel export is outside the reviewed limits" } })
  await assert.rejects(approveRow(f.deps, "r", shown(reels, linkedin), NO_AI), (e: unknown) => e instanceof RowApprovalError && /Reels 9:16, Instagram/.test(e.problems[0]))
  assert.ok(!f.calls.some(c => c.startsWith("decide")))
})

test("a variation with no platforms stays out; approved ones aren't approved twice", async () => {
  const off = post({ id: "off", social_platforms: [] }), done = post({ id: "done", status: "approved", social_platforms: ["linkedin"], approvals: [{ decision: "approved", by_name: "A", by_email: "a@x.co", at: "t", export_fingerprint: FP_FEED }] })
  const f = fakes([feed, off, done])
  await approveRow(f.deps, "r", shown(feed), NO_AI)
  assert.deepEqual(f.calls, ["prepare:feed:still:feed/feed", "decide:feed:1:h-feed"])
  await assert.rejects(approveRow(fakes([done]).deps, "r", {}, NO_AI), /Nothing in this row/)
})

test("an edit made after the manifests were prepared stops the row before any approval", async () => {
  const edited = post({ id: "feed", social_copy: "Edited by someone else." })
  const f = fakes([feed, reelsHand], { secondRead: [edited, reelsHand] })
  await assert.rejects(approveRow(f.deps, "r", shown(feed, reelsHand), NO_AI), /changed since it was shown/)
  assert.ok(!f.calls.some(c => c.startsWith("decide")))
})

test("a failure while approving says what was approved", async () => {
  const f = fakes([feed, reelsHand], { failDecide: "reels" })
  await assert.rejects(approveRow(f.deps, "r", shown(feed, reelsHand), NO_AI), /Approved before it stopped: Feed 4:5/)
})

test("an approval covers the current files: a hand approval must name them; anything already out is frozen", () => {
  const handFp = post({ social_platforms: ["linkedin"], status: "approved", approvals: [{ decision: "approved", by_name: "A", by_email: "a@x.co", at: "t", export_fingerprint: FP_FEED }] })
  assert.ok(approvalCovers(handFp))
  assert.ok(!approvalCovers({ ...handFp, export_fingerprint: FP_REELS }), "new files after approval are not approved")
  assert.ok(!approvalCovers({ ...handFp, approvals: [] }), "a status set from the post drawer's menu is not an approval")
  assert.ok(awaitingApproval({ ...handFp, approvals: [] }))
  assert.ok(approvalCovers(post({ status: "approved", owned_meta: { batchId: "b", hash: "h", started: false } })))
  const partly = post({ social_platforms: ["tiktok", "youtube"], status: "approved", hand_posts: [{ platform: "tiktok", url: "https://tiktok.com/@x/video/1", by: "a", at: "t", export_fingerprint: FP_FEED }] })
  assert.ok(frozen(partly) && !awaitingApproval(partly), "once one hand post is out, the variation is fixed")
  assert.ok(frozen(post({ owned_meta: { batchId: "b", hash: "h", started: true } })))
})

test("an AI video says whether it is photorealistic; a still never carries that declaration", () => {
  assert.equal(prepareChoices(reels, { aiGenerated: true, aiRealisticMedia: true }).aiRealisticMedia, true)
  assert.equal(prepareChoices(reels, { aiGenerated: true }).aiRealisticMedia, false)
  assert.equal("aiRealisticMedia" in prepareChoices(reels, NO_AI), false)
  assert.equal("aiRealisticMedia" in prepareChoices(feed, { aiGenerated: true, aiRealisticMedia: true }), false)
})

test("publisher choices follow the files: carousel, 4:5 video shared to the grid, 9:16 Reel; captions are the post's", () => {
  const carousel = prepareChoices(post({ assets: [{ url: "u1", kind: "image" }, { url: "u2", kind: "image" }] }), NO_AI)
  assert.equal(carousel.format, "carousel")
  const feedVideo = prepareChoices(post({ assets: [{ url: "u", kind: "video" }] }), { aiGenerated: true, aiRealisticMedia: false })
  assert.deepEqual([feedVideo.format, feedVideo.placements, feedVideo.instagramShareToFeed, feedVideo.aiGenerated], ["video", { instagram: "reels", facebook: "video" }, true, true])
  const reel = prepareChoices(reels, NO_AI)
  assert.deepEqual([reel.placements, reel.instagramShareToFeed, reel.brand, reel.publicHostingApproved], [{ instagram: "reels", facebook: "reels" }, false, "milcity", true])
  assert.deepEqual(reel.captions, { instagram: "Caption.", facebook: "Caption." })
})

test("routing and Canva links: 9:16 takes TikTok and Shorts, 4:5 takes LinkedIn; a design link gives its id", () => {
  assert.deepEqual(platformsFor("reels"), ["instagram", "facebook", "tiktok", "youtube"])
  assert.deepEqual(platformsFor("feed"), ["instagram", "facebook", "linkedin"])
  assert.equal(canvaDesignIdFromLink("https://www.canva.com/design/DAGxYz12AbC/abcDEF/edit?utm_content=x"), "DAGxYz12AbC")
  assert.equal(canvaDesignIdFromLink("DAGxYz12AbC"), "DAGxYz12AbC")
  assert.equal(canvaDesignIdFromLink("https://evil.example/design/DAGxYz12AbC/edit"), null)
  assert.equal(canvaDesignIdFromLink("http://www.canva.com/design/DAGxYz12AbC/edit"), null)
  assert.equal(exportAs(reels), "mp4")
  assert.equal(exportAs(feed), "jpg")
  assert.equal(exportAs({ create_format: "feed", assets: [] }, "reels"), "mp4")
})

test("a canva.link share link is followed to its design, only through Canva's own hosts", async () => {
  const hops: string[] = []
  const redirects: Record<string, string> = { "https://canva.link/abc123": "https://www.canva.com/design/DAGxyz789/AbCd/edit?utm_source=share" }
  const fetcher = (async (u: URL) => { hops.push(u.toString()); const to = redirects[u.toString()]; return new Response(null, { status: to ? 307 : 404, headers: to ? { location: to } : {} }) }) as typeof fetch
  assert.equal(await resolveCanvaDesignLink("https://canva.link/abc123", fetcher), "DAGxyz789")
  assert.equal(await resolveCanvaDesignLink("https://www.canva.com/design/DAGdirect1/view", fetcher), "DAGdirect1")
  assert.equal(hops.length, 1, "a full design link needs no request")
  redirects["https://canva.link/evil"] = "https://evil.example/design/DAGxyz789/edit"
  assert.equal(await resolveCanvaDesignLink("https://canva.link/evil", fetcher), null)
  assert.equal(await resolveCanvaDesignLink("https://canva.link/gone", fetcher), null)
  assert.equal(await resolveCanvaDesignLink("http://canva.link/abc123", fetcher), null)
  assert.equal(await resolveCanvaDesignLink("https://bit.ly/abc", fetcher), null)
})

test("pages for a format, and a post dated after today", () => {
  assert.deepEqual(parsePages("2"), [2])
  assert.deepEqual(parsePages("1, 3"), [1, 3])
  for (const bad of ["", "0", "a", "1,1", "1.5"]) assert.equal(parsePages(bad), null, bad)
  assert.equal(todayIn("America/Chicago", new Date("2026-10-22T03:30:00Z")), "2026-10-21", "evening in San Antonio is still that day")
  assert.equal(futureDated({ date_to_post: "2026-10-22" }, "2026-10-21"), true)
  assert.equal(futureDated({ date_to_post: "2026-10-21" }, "2026-10-21"), false)
  assert.equal(futureDated({ date_to_post: undefined }, "2026-10-21"), false)
})

// ── One size per platform per row (Step 3 part 5) ──
test("approval refuses a row that would send two sizes to one platform, before any manifest, and on the second read", async () => {
  const f = fakes([feed, reels])
  await assert.rejects(approveRow(f.deps, "r", shown(feed, reels), NO_AI), (e: unknown) => e instanceof RowApprovalError && e.problems.some(p => /Instagram is ticked on Feed 4:5 and Reels 9:16/.test(p)) && e.problems.some(p => /^Facebook/.test(p)))
  assert.deepEqual(f.calls, [], "nothing is prepared or approved")
  // Someone ticks Instagram on the 9:16 while the row is being approved.
  const g = fakes([feed, reelsHand], { secondRead: [feed, { ...reelsHand, social_platforms: ["tiktok", "youtube"] }, post({ id: "one-off", social_platforms: ["instagram"], status: "posted" })] })
  await assert.rejects(approveRow(g.deps, "r", shown(feed, reelsHand), NO_AI), /Instagram is ticked on 2 Feed 4:5 designs/)
  assert.ok(!g.calls.some(c => c.startsWith("decide")))
})

test("platform conflicts count what is already out and the drawer's unsaved ticks; a photo's 9:16 never offers Instagram or Facebook", () => {
  const out = post({ id: "out", status: "posted", social_platforms: ["instagram", "facebook"] })
  assert.equal(platformConflicts([out, reelsHand]).length, 0)
  assert.equal(platformConflicts([out, reels]).length, 2, "a size already out still holds its platforms")
  assert.deepEqual(platformConflicts([feed, reelsHand], { reels: ["instagram", "tiktok"] }), ["Instagram is ticked on Feed 4:5 and Reels 9:16; a platform gets one size per row, so untick it on one"])
  assert.deepEqual(platformConflicts([feed, { ...reels, archived: true }]), [], "an archived size doesn't count")
  assert.deepEqual(allowedPlatforms({ create_format: "reels", create_media: "photo" }), ["tiktok", "youtube"])
  assert.deepEqual(allowedPlatforms({ create_format: "reels", create_media: "video" }), ["instagram", "facebook", "tiktok", "youtube"])
  assert.deepEqual(allowedPlatforms({ create_format: "feed", create_media: "photo" }), ["instagram", "facebook", "linkedin"])
  assert.deepEqual(allowedPlatforms({ create_format: "reels" }), ["instagram", "facebook", "tiktok", "youtube"], "an older post allows all")
})

test("a drawer edit is refused only for a conflict it adds: a row made before the rule can still change its caption or untick one size", () => {
  assert.deepEqual(addedConflicts([feed, reels], {}), [], "a caption-only edit on a conflicted row")
  assert.deepEqual(addedConflicts([feed, reels], { reels: ["tiktok"] }), [], "unticking the conflict")
  assert.equal(addedConflicts([feed, reelsHand], { reels: ["instagram", "tiktok"] }).length, 1, "ticking Instagram on a second size")
  assert.equal(addedConflicts([feed, { ...reels, social_platforms: ["instagram", "tiktok"] }], { reels: ["instagram", "facebook", "tiktok"] }).length, 1, "a new conflict beside an old one")
})

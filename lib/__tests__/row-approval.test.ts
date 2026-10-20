/**
 * Offline. The approval drawer (plan v11.1 Step 3): a Create row's variations approved together, bound to the files
 * shown — through the publisher for Instagram and Facebook, by export fingerprint for hand-posted platforms.
 * No network, no Firestore: storage and the publisher are fakes.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { approveRow, canvaDesignIdFromLink, exportAs, platformsFor, prepareChoices, readiness, RowApprovalError, type ApproveRowDeps } from "../content-pipeline/row-approval"
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

function fakes(rows: ContentPost[], opts: { holds?: Record<string, string>; filesFp?: Record<string, string> } = {}) {
  const calls: string[] = []
  const deps: ApproveRowDeps = {
    listRow: async () => rows,
    prepare: async (id, c) => { calls.push(`prepare:${id}:${c.format}:${c.placements.instagram}/${c.placements.facebook}`); return { id: `b-${id}`, hash: `h-${id}`, manifest: { revision: 1, assets: [{ sha256: id }] } } as unknown as MetaBatch },
    preflight: b => ({ instagram: opts.holds?.[b.id] ?? null, facebook: null }),
    decide: async (id, rev, hash) => { calls.push(`decide:${id}:${rev}:${hash}`); return {} as MetaBatch },
    approveHand: async (id, fp) => { calls.push(`hand:${id}:${fp.slice(0, 1)}`) },
    fingerprintOf: s => opts.filesFp?.[s[0]] ?? rows.find(r => r.id === s[0])!.export_fingerprint!,
  }
  return { deps, calls }
}
const shown = (...ps: ContentPost[]) => Object.fromEntries(ps.map(p => [p.id, p.export_fingerprint!]))

test("a row's variations are approved together: publisher manifests prepared, then each approval bound to its hash", async () => {
  const f = fakes([feed, reels, linkedin])
  const out = await approveRow(f.deps, "row-0001-abcd", shown(feed, reels, linkedin), false)
  assert.deepEqual(f.calls, ["prepare:feed:still:feed/feed", "prepare:reels:video:reels/reels", "decide:feed:1:h-feed", "decide:reels:1:h-reels", "hand:li:c"])
  assert.deepEqual(out.map(o => `${o.postId}:${o.via}`), ["feed:publisher", "reels:publisher", "li:hand"])
})

test("nothing is approved unless every variation is ready, and the reasons are named", async () => {
  const noDesign = post({ id: "nd", canva_design_id: undefined })
  const f = fakes([feed, noDesign])
  await assert.rejects(approveRow(f.deps, "r", shown(feed, noDesign), false), (e: unknown) => e instanceof RowApprovalError && e.problems.some(p => /Attach a Canva design/.test(p)))
  assert.deepEqual(f.calls, [], "no manifest is prepared and nothing is approved")
  assert.equal(readiness(post({ assets: [] })), "The design isn't exported yet; use Refresh from Canva")
  assert.match(readiness(post({ social_platforms: ["instagram"] }))!, /Instagram and Facebook together/)
  assert.equal(readiness(post({ social_platforms: ["instagram", "facebook", "linkedin"] })), null)
})

test("approval binds what was shown: a changed design, a changed row, or different files read stop it before any approval", async () => {
  const f = fakes([feed, reels])
  await assert.rejects(approveRow(f.deps, "r", { ...shown(feed, reels), feed: "f".repeat(64) }, false), /changed since it was shown/)
  await assert.rejects(approveRow(f.deps, "r", shown(feed), false), /row changed/)
  const g = fakes([feed, reels], { filesFp: { feed: "0".repeat(64) } })
  await assert.rejects(approveRow(g.deps, "r", shown(feed, reels), false), /files read for approval differ/)
  assert.ok(!g.calls.some(c => c.startsWith("decide")))
})

test("a format hold from the publisher's preflight stops the whole row before any approval", async () => {
  const f = fakes([feed, reels], { holds: { "b-reels": "Instagram Reel export is outside the reviewed limits" } })
  await assert.rejects(approveRow(f.deps, "r", shown(feed, reels), false), (e: unknown) => e instanceof RowApprovalError && /Reels 9:16, Instagram/.test(e.problems[0]))
  assert.ok(!f.calls.some(c => c.startsWith("decide")))
})

test("a variation with no platforms stays out; approved ones aren't approved twice", async () => {
  const off = post({ id: "off", social_platforms: [] }), done = post({ id: "done", status: "approved" })
  const f = fakes([feed, off, done])
  await approveRow(f.deps, "r", shown(feed), false)
  assert.deepEqual(f.calls, ["prepare:feed:still:feed/feed", "decide:feed:1:h-feed"])
  await assert.rejects(approveRow(fakes([done]).deps, "r", {}, false), /Nothing in this row/)
})

test("publisher choices follow the files: carousel, 4:5 video shared to the grid, 9:16 Reel; captions are the post's", () => {
  const carousel = prepareChoices(post({ assets: [{ url: "u1", kind: "image" }, { url: "u2", kind: "image" }] }), false)
  assert.equal(carousel.format, "carousel")
  const feedVideo = prepareChoices(post({ assets: [{ url: "u", kind: "video" }] }), true)
  assert.deepEqual([feedVideo.format, feedVideo.placements, feedVideo.instagramShareToFeed, feedVideo.aiGenerated], ["video", { instagram: "reels", facebook: "video" }, true, true])
  const reel = prepareChoices(reels, false)
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

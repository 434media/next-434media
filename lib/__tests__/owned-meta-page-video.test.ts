/**
 * Offline. Facebook Page videos (placement "video") are verified from the video once Meta has processed it, and
 * re-checked while it is processing (2026-11-17: every MilCityUSA Page video since 10/29 was read once, before Meta
 * finished, and left as needs_reconciliation). A completed post takes the time it was published. Invented ids only.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { createMetaProvider, type MetaPublishingEvidence } from "../instagram-publishing"
import { publishedAtOf, draftBatch, type MetaManifest } from "../owned-meta-publisher"
import { assetDigest } from "../owned-meta-assets"

const bytes = Buffer.from("video")
function manifest(): MetaManifest {
  const asset = { name: "v.mp4", url: "https://approved.public.blob.vercel-storage.com/content-posts/12345678-1234-1234-1234-123456789abc.mp4", sha256: assetDigest(bytes), size: bytes.length, mime: "video/mp4" as const, width: 1080, height: 1350, duration: 120, provenance: { source: "test", templateRevision: "v1", generator: "none", metadata: "unverified" as const } }
  return { schema: 1, revision: 1, brand: "milcity", format: "video", assets: [asset], captions: { instagram: "IG", facebook: "FB" }, destinations: { appId: "1", pageId: "2", instagramId: "3", apiVersion: "v26.0" }, placements: { instagram: "reels", facebook: "video" }, instagramShareToFeed: false, aiGenerated: false, publicHostingApproved: true } as MetaManifest
}
const evidence = (m: MetaManifest): MetaPublishingEvidence => ({ verifiedAt: "2026-10-09T00:00:00Z", credentialKind: "system_user_page", appId: m.destinations.appId, pageId: m.destinations.pageId, instagramId: m.destinations.instagramId })

/** The published collection never lists the video; the video node answers with `video`. */
function provider(m: MetaManifest, video: Record<string, unknown>) {
  const fetcher = (async (url: URL) => Response.json(url.pathname.endsWith("/published_posts") ? { data: [] } : video)) as unknown as typeof fetch
  return createMetaProvider({ accessToken: "fake", evidence: evidence(m), beforeMutation: async () => { throw Error("must not mutate") }, fetcher })
}

test("a processed, published Page video owned by the Page verifies, with an absolute facebook.com link", async () => {
  const m = manifest()
  const v = await provider(m, { published: true, status: { video_status: "ready" }, permalink_url: "/milcity/videos/555/", from: { id: "2" } }).verify(m, "facebook", "555")
  assert.deepEqual([v.verified, v.permalink], [true, "https://www.facebook.com/milcity/videos/555/"])
})

test("a Page video still processing is pending, so it is checked again", async () => {
  const m = manifest()
  const v = await provider(m, { published: false, status: { video_status: "processing", processing_phase: { status: "in_progress" } }, from: { id: "2" } }).verify(m, "facebook", "555")
  assert.deepEqual([v.verified, v.pending], [false, true])
})

test("a Page video in error, or owned by another Page, is left for a person", async () => {
  const m = manifest()
  const err = await provider(m, { status: { video_status: "error" }, from: { id: "2" } }).verify(m, "facebook", "555")
  const other = await provider(m, { published: true, status: { video_status: "ready" }, permalink_url: "/x/videos/555/", from: { id: "9" } }).verify(m, "facebook", "555")
  assert.deepEqual([err.verified, err.pending, other.verified, other.pending], [false, undefined, false, undefined])
})

test("a completed post is dated by its earliest final publication", () => {
  const b = draftBatch("b", manifest())
  b.jobs.instagram.finalIntent = { id: "i", at: "2026-11-13T21:10:00.000Z" }
  b.jobs.facebook.finalIntent = { id: "f", at: "2026-11-13T21:10:52.324Z" }
  assert.equal(publishedAtOf(b), "2026-11-13T21:10:00.000Z")
  assert.equal(publishedAtOf(draftBatch("c", manifest())), undefined)
})

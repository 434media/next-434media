import { readFile } from "node:fs/promises"
import { vendorBook, type BrandBook } from "./content-pipeline/brand-book"
import { hashShareToken, isShareToken, shareState } from "./brand-share"
import type { BrandShare, BrandShareStore } from "./firestore-brand-shares"

/**
 * Opening a shared brand book's link (plan v11.2.1 Step 4 item 4, and item 6's downloads): the one check the page, its
 * previews and its zip all make. The token is looked up by its hash; an unknown, expired, revoked or failed share, or a
 * pinned version with no showable book, is null, and every caller refuses the same way. Only the vendor's copy of the
 * book leaves here: its internal blocks are dropped before anything renders or is offered for download.
 */
export interface OpenedShare { share: BrandShare; book: BrandBook; label: string; versionId: string; expiresAt: string; store: BrandShareStore }

export async function openShare(token: string, now: Date = new Date()): Promise<OpenedShare | null> {
  if (!isShareToken(token)) return null
  const fixture = process.env.BRAND_SHARE_FIXTURE
  if (fixture) return openFixture(fixture, token, now)
  const [{ firestoreBrandShares }, { pinnedBook }] = await Promise.all([import("./firestore-brand-shares"), import("./brand-share-deps")])
  const store = firestoreBrandShares()
  const share = await store.byTokenHash(hashShareToken(token))
  if (!share || shareState(share, now) !== "active" || share.status !== "sent") return null
  const pinned = await pinnedBook(share.brand_id, share.version_n)
  if (!pinned) return null
  return { share, book: vendorBook(pinned.book), label: pinned.label, versionId: share.version_id, expiresAt: share.expires_at, store }
}

/**
 * Local work only, refused in production: BRAND_SHARE_FIXTURE names a JSON file of
 * `{ "shares": { "<token>": {expires_at, revoked?} }, "brand_id", "label", "version_id", "visual": <a profile's visual block> }`
 * (an exported profile version's `profile.visual`, kept outside this repository). Views and downloads are logged, not stored.
 */
async function openFixture(file: string, token: string, now: Date): Promise<OpenedShare | null> {
  if (process.env.NODE_ENV === "production") throw new Error("BRAND_SHARE_FIXTURE is for local work only")
  const f = JSON.parse(await readFile(file, "utf8")) as { shares: Record<string, { expires_at: string; revoked?: boolean }>; brand_id: string; label: string; version_id: string; visual: BrandBook }
  const s = f.shares[token]
  if (!s) return null
  const share = { id: `fixture-${token.slice(0, 6)}`, brand_id: f.brand_id, brand_label: f.label, version_id: f.version_id, version_n: 0, status: "sent", revoked: !!s.revoked, expires_at: s.expires_at } as BrandShare
  if (shareState(share, now) !== "active") return null
  const log = (what: string) => async (...a: unknown[]) => { console.log(`[fixture share] ${what}`, ...a) }
  const store = { recordView: log("view"), recordDownload: log("download") } as unknown as BrandShareStore
  return { share, book: vendorBook(f.visual), label: f.label, versionId: f.version_id, expiresAt: s.expires_at, store }
}

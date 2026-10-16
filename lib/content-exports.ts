import { createHash, randomUUID } from "node:crypto"
import type { Asset, ContentPost } from "../components/crm/types"
import { assetDigest, measureExport, MAX_SOURCE_BYTES } from "./owned-meta-assets"
import { MetaBlocked } from "./owned-meta-publisher"
import { CanvaBlocked, isCanvaDesignId } from "./canva-connect"

/**
 * Staging: Canva design → measured, hashed JPEG exports in the existing public
 * Blob store, attached to the content record BEFORE any approval is recorded.
 *
 * Canva stays the permanent creative source. What lands in Blob is the exact
 * byte set the publisher will later re-verify (`verifyAssetBytes`), under the
 * same `content-posts/<uuid>-…` path the ingest route already uses, so
 * `assertApprovedBlobUrl` accepts it without widening its rule. Nothing here
 * writes a publisher batch, an approval or a Meta object.
 *
 * Idempotent: an identical export (same ordered SHA-256 set) is recognised and
 * the existing Blob objects are reused, so a retried stage never duplicates.
 */
export interface StagedExport { fingerprint: string; assets: Asset[]; reused: boolean; jobId: string }
export interface ExportDownloader { (url: string): Promise<Uint8Array> }
export interface BlobWriter { (pathname: string, bytes: Uint8Array, contentType: string): Promise<{ url: string }> }

export function exportFingerprint(hashes: string[]): string { return createHash("sha256").update(hashes.join("\n")).digest("hex") }

/** Downloads one Canva export URL into memory within the publisher's byte bound. */
export function canvaDownloader(fetcher: typeof fetch = fetch): ExportDownloader {
  return async (url) => {
    const u = new URL(url)
    if (u.protocol !== "https:" || u.username || u.password) throw new CanvaBlocked("Refusing a non-HTTPS Canva download URL")
    const response = await fetcher(u, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(60_000) })
    if (!response.ok || !response.body) throw new CanvaBlocked(`Canva download failed (HTTP ${response.status})`)
    if (Number(response.headers.get("content-length") || 0) > MAX_SOURCE_BYTES) throw new CanvaBlocked("Export exceeds the 64 MiB server safety bound")
    const chunks: Uint8Array[] = []; let size = 0
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength
      if (size > MAX_SOURCE_BYTES) { await response.body.cancel().catch(() => {}); throw new CanvaBlocked("Export exceeds the 64 MiB server safety bound") }
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }
}

export async function stageCanvaExport(args: {
  post: Pick<ContentPost, "id" | "assets" | "archived" | "owned_meta" | "canva_design_id">
  designId: string
  jobId: string
  urls: string[]
  download: ExportDownloader
  writeBlob: BlobWriter
  /** Public Blob origins the publisher accepts (OWNED_META_SOURCE_ORIGINS). */
  allowedOrigins: string[]
  now?: () => string
}): Promise<StagedExport> {
  const { post } = args
  if (!isCanvaDesignId(args.designId)) throw new CanvaBlocked("Invalid Canva design id")
  if (post.archived) throw new MetaBlocked("Archived content cannot be staged")
  if (post.owned_meta?.started) throw new MetaBlocked("Publishing already started; create a separately reviewed revision instead of restaging")
  if (post.canva_design_id && post.canva_design_id !== args.designId) throw new MetaBlocked(`This record is bound to Canva design ${post.canva_design_id}; use a different record for ${args.designId}`)
  if (!args.urls.length || args.urls.length > 10) throw new MetaBlocked("Expected 1–10 export pages")

  const measured: { bytes: Uint8Array; sha256: string; width: number; height: number }[] = []
  for (const url of args.urls) {
    const bytes = await args.download(url)
    const m = measureExport(bytes)
    if (m.mime !== "image/jpeg") throw new MetaBlocked("Canva export is not a JPEG; Instagram requires JPEG")
    measured.push({ bytes, sha256: assetDigest(bytes), width: m.width, height: m.height })
  }
  const fingerprint = exportFingerprint(measured.map(m => m.sha256))

  // Reuse: an existing identical ordered set means the Blob objects already exist.
  const existing = post.assets.filter(a => a.source === "canva" && a.canvaDesignId === args.designId && a.sha256)
  if (existing.length === measured.length && existing.every((a, i) => a.sha256 === measured[i].sha256 && a.url.startsWith("https://"))) {
    return { fingerprint, assets: existing, reused: true, jobId: args.jobId }
  }

  const assets: Asset[] = []
  for (const [i, m] of measured.entries()) {
    const pathname = `content-posts/${randomUUID()}-${args.designId}-p${String(i + 1).padStart(2, "0")}.jpg`
    const { url } = await args.writeBlob(pathname, m.bytes, "image/jpeg")
    const u = new URL(url)
    if (!args.allowedOrigins.includes(u.origin)) throw new MetaBlocked("Blob store origin is not in OWNED_META_SOURCE_ORIGINS; the publisher would reject this export")
    assets.push({ url, kind: "image", source: "canva", width: m.width, height: m.height, sha256: m.sha256, bytes: m.bytes.byteLength, canvaDesignId: args.designId, canvaExportJobId: args.jobId, page: i + 1 })
  }
  return { fingerprint, assets, reused: false, jobId: args.jobId }
}

/** Aspect facts for the reviewer; the publisher's preflight remains the gate. */
export function describeStagedAssets(assets: Asset[]): { pages: number; aspects: string[]; uniformAspect: boolean; instagramFeedOk: boolean } {
  const ratios = assets.map(a => (a.width && a.height ? a.width / a.height : NaN))
  const first = ratios[0]
  const uniform = ratios.every(r => Number.isFinite(r) && Math.abs(r - first) <= 0.001)
  const feedOk = ratios.every(r => r >= 4 / 5 - 1e-9 && r <= 1.91 + 1e-9)
  return { pages: assets.length, aspects: ratios.map(r => (Number.isFinite(r) ? r.toFixed(4) : "unknown")), uniformAspect: uniform, instagramFeedOk: feedOk }
}

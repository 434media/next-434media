import type { Asset, Brand, ContentPost } from "@/components/crm/types"
import { createHash } from "node:crypto"
import { assetDigest, measureExport } from "./owned-meta-assets"
import { META_FORMAT_RULES } from "./owned-meta-formats"
import { isExcludedPostId, MetaBlocked, type MetaBrand } from "./owned-meta-publisher"

/**
 * Content lookup, creation and export attachment for the publisher's machine surface.
 * Storage and network are injected; this module performs no I/O of its own.
 * Attaching exports replaces the post's assets through the existing guarded update,
 * which invalidates any unstarted draft — approval always binds the final files.
 */
export interface Principal { email: string; name?: string }
export interface IntakeDeps {
  listPosts(): Promise<ContentPost[]>
  getPost(id: string): Promise<ContentPost | null>
  findByRequestId(requestId: string): Promise<ContentPost | null>
  findByCanvaDesignId(designId: string): Promise<ContentPost | null>
  createPost(data: Omit<ContentPost, "id" | "created_at" | "updated_at">): Promise<ContentPost>
  setAssets(id: string, assets: Asset[], record: { export_fingerprint: string; export_staged_at: string; canva_design_id?: string }): Promise<ContentPost>
  fetchExport(url: string): Promise<{ bytes: Uint8Array; contentType: string }>
  storeExport(bytes: Uint8Array, filename: string, contentType: string): Promise<string>
  now(): string
}

// Only roster brands that exist in the CRM's Brand type are mapped; others stay "" and are
// carried in intake.metaBrand. Identifiers are never renamed to match display names.
const CRM_BRAND: Partial<Record<MetaBrand, Brand>> = { txmx: "TXMX Boxing", vemos: "Vemos Vamos" }

export interface PostSummary { id: string; title: string; status: string; brand: string; dateToPost?: string; assets: number; publisher: "none" | "draft" | "approved" | "started"; excluded: boolean; publishedUrl?: string; canvaDesignId?: string; exportFingerprint?: string }
export function summarizePost(p: ContentPost): PostSummary {
  return {
    id: p.id, title: p.title, status: p.status, brand: p.platform || p.intake?.metaBrand || "",
    ...(p.date_to_post ? { dateToPost: p.date_to_post } : {}), assets: p.assets?.length || 0,
    publisher: !p.owned_meta ? "none" : p.owned_meta.started ? "started" : p.status === "approved" ? "approved" : "draft",
    excluded: excluded(p), ...(p.published_url ? { publishedUrl: p.published_url } : {}),
    ...(p.canva_design_id ? { canvaDesignId: p.canva_design_id } : {}), ...(p.export_fingerprint ? { exportFingerprint: p.export_fingerprint } : {}),
  }
}
function excluded(p: ContentPost) { return isExcludedPostId(p.id) || !!p.owned_meta_external }

/** SHA-256 of the ordered file hashes: names the exact export set a review covers (from draft #186). */
export function exportFingerprint(hashes: string[]): string { return createHash("sha256").update(hashes.join("\n")).digest("hex") }

export async function findPosts(deps: IntakeDeps, input: { query?: string; canvaDesignId?: string; includeArchived?: boolean; limit?: number }): Promise<PostSummary[]> {
  if (input.canvaDesignId) { const bound = await deps.findByCanvaDesignId(input.canvaDesignId); return bound && (input.includeArchived || !bound.archived) ? [summarizePost(bound)] : [] }
  const q = (input.query || "").trim().toLowerCase()
  if (!q) throw new MetaBlocked("Search text or a Canva design id required")
  const exact = /^[A-Za-z0-9_-]{8,128}$/.test(q) ? await deps.getPost((input.query || "").trim()) : null
  const all = (await deps.listPosts()).filter(p => input.includeArchived || !p.archived)
  const matches = all.filter(p => p.id !== exact?.id && [p.title, p.social_copy, p.tags].some(v => typeof v === "string" && v.toLowerCase().includes(q)))
  return [...(exact ? [exact] : []), ...matches].slice(0, Math.min(input.limit ?? 10, 25)).map(summarizePost)
}

/** Idempotent on requestId: a repeated request returns the post it already created. */
export async function createPost(deps: IntakeDeps, principal: Principal, input: { requestId: string; title: string; brand: MetaBrand; caption: string; dateToPost?: string; notes?: string; canvaDesignId?: string }): Promise<{ created: boolean; post: PostSummary; similar: PostSummary[] }> {
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(input.requestId)) throw new MetaBlocked("A stable requestId (8–128 characters) is required so a repeated request cannot create a second post")
  const title = input.title.trim()
  if (!title || title.length > 200) throw new MetaBlocked("Title required (at most 200 characters)")
  if (input.dateToPost && !/^\d{4}-\d{2}-\d{2}$/.test(input.dateToPost)) throw new MetaBlocked("dateToPost must be YYYY-MM-DD")
  const existing = await deps.findByRequestId(input.requestId)
  if (existing) return { created: false, post: summarizePost(existing), similar: [] }
  // A design already bound to a live record is that record (from draft #186): never a second post for one design.
  const bound = input.canvaDesignId ? await deps.findByCanvaDesignId(input.canvaDesignId) : null
  if (bound && !bound.archived) return { created: false, post: summarizePost(bound), similar: [] }
  const lower = title.toLowerCase()
  const similar = (await deps.listPosts()).filter(p => !p.archived && p.title?.trim().toLowerCase() === lower).map(summarizePost)
  const now = deps.now()
  const post = await deps.createPost({
    user: principal.name || "", date_created: now.slice(0, 10), platform: CRM_BRAND[input.brand] || "", status: "in_progress", title,
    ...(input.dateToPost ? { date_to_post: input.dateToPost } : {}), ...(input.notes ? { notes: input.notes.slice(0, 4000) } : {}),
    social_copy: input.caption, links: [], assets: [], tags: input.brand, social_platforms: ["instagram", "facebook"],
    intake: { requestId: input.requestId, metaBrand: input.brand, requestedBy: principal.email, at: now },
  })
  return { created: true, post: summarizePost(post), similar }
}

/** Refuses missing, archived, posted or excluded posts — before any export or download is started. */
export async function assertAttachable(deps: IntakeDeps, postId: string): Promise<ContentPost> {
  const post = await deps.getPost(postId)
  if (!post || post.archived) throw new MetaBlocked("Content post not found")
  if (excluded(post) || post.status === "posted" || post.published_url) throw new MetaBlocked("This post is already published or excluded from the publisher; its media cannot be replaced")
  return post
}
export interface ExportItem { url: string; label?: string }
export interface AttachResult { post: PostSummary; assets: { url: string; mime: string; width: number; height: number; duration?: number; bytes: number }[]; holds: string[]; fingerprint: string; reused: boolean }
/**
 * Fetches each export (SSRF-guarded by the injected fetcher), measures it from bytes,
 * stores it under the existing content-posts/<uuid>-name convention and replaces the
 * post's assets in the given order. Nothing is stored for the post if any item fails.
 */
export async function attachExports(deps: IntakeDeps, input: { postId: string; items: ExportItem[]; randomId: () => string; canva?: { designId: string; pages?: number[] } }): Promise<AttachResult> {
  if (!input.items.length || input.items.length > META_FORMAT_RULES.instagramCarousel.maxItems) throw new MetaBlocked("Attach 1–10 exports in carousel order")
  const post = await assertAttachable(deps, input.postId)
  if (input.canva && post.canva_design_id && post.canva_design_id !== input.canva.designId) throw new MetaBlocked(`This post is bound to Canva design ${post.canva_design_id}; use another post for ${input.canva.designId}`)
  const measured: { bytes: Uint8Array; sha256: string; mime: string; width: number; height: number; duration?: number; name: string }[] = []
  for (const [i, item] of input.items.entries()) {
    let fetched: { bytes: Uint8Array; contentType: string }
    try { fetched = await deps.fetchExport(item.url) } catch { throw new MetaBlocked(`Export ${i + 1} could not be fetched from a public https URL`) }
    const m = measureExport(fetched.bytes) // signature-based; rejects anything but JPEG/PNG/MP4
    const ext = m.mime === "image/jpeg" ? "jpg" : m.mime === "image/png" ? "png" : "mp4"
    const label = (item.label || `export-${i + 1}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `export-${i + 1}`
    measured.push({ bytes: fetched.bytes, sha256: assetDigest(fetched.bytes), ...m, name: `${String(i + 1).padStart(2, "0")}-${label}.${ext}` })
  }
  const fingerprint = exportFingerprint(measured.map(m => m.sha256))
  // A retried attach of the identical ordered files reuses the stored copies and leaves any draft untouched.
  if (post.export_fingerprint === fingerprint && post.assets.length === measured.length && post.assets.every((a, i) => a.sha256 === measured[i].sha256)) {
    return { post: summarizePost(post), assets: post.assets.map((a, i) => ({ url: a.url, mime: measured[i].mime, width: measured[i].width, height: measured[i].height, bytes: measured[i].bytes.byteLength })), holds: holdsFor(measured), fingerprint, reused: true }
  }
  const stored: Asset[] = []
  for (const [i, m] of measured.entries()) {
    const url = await deps.storeExport(m.bytes, `content-posts/${input.randomId()}-${m.name}`, m.mime)
    stored.push({ url, kind: m.mime === "video/mp4" ? "video" : "image", source: input.canva ? "canva" : "upload", width: m.width, height: m.height, sha256: m.sha256, bytes: m.bytes.byteLength,
      ...(input.canva ? { canvaDesignId: input.canva.designId, page: input.canva.pages?.[i] ?? i + 1 } : {}) })
  }
  const updated = await deps.setAssets(post.id, stored, { export_fingerprint: fingerprint, export_staged_at: deps.now(), ...(input.canva ? { canva_design_id: input.canva.designId } : {}) })
  return { post: summarizePost(updated), assets: stored.map((a, i) => ({ url: a.url, mime: measured[i].mime, width: measured[i].width, height: measured[i].height, ...(measured[i].duration ? { duration: measured[i].duration } : {}), bytes: measured[i].bytes.byteLength })), holds: holdsFor(measured), fingerprint, reused: false }
}
function holdsFor(measured: { bytes: Uint8Array; mime: string; width: number; height: number }[]): string[] {
  const holds = [...new Set(measured.flatMap(m => m.mime === "image/png" ? ["Instagram requires JPEG: export these designs from Canva as JPG and attach again before approval"] : m.mime === "image/jpeg" && m.bytes.byteLength > META_FORMAT_RULES.instagramImage.maxBytes ? ["Instagram images must be at most 8 MB"] : []))]
  const first = measured[0].width / measured[0].height
  if (measured.length > 1 && measured.some(m => Math.abs(m.width / m.height - first) > 0.001)) holds.push("Carousel items differ in aspect ratio; Instagram would crop later items to the first")
  return holds
}

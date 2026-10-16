import type { ContentPost } from "../components/crm/types"
import type { ContentAuth, ContentScope } from "./content-mcp-auth"
import { findReusableRecord, matchContentRecords, summarizeRecord } from "./content-records"
import { stageCanvaExport, describeStagedAssets, canvaDownloader, type BlobWriter, type StagedExport } from "./content-exports"
import { createCanvaClient, CanvaBlocked, isCanvaDesignId } from "./canva-connect"
import { MetaBlocked, META_BRANDS, type MetaBrand, type MetaBatch, type MetaDestination } from "./owned-meta-publisher"
import { checkReviewedFormat, hasAiCaptionDisclosure } from "./owned-meta-formats"
import { ownedMetaActionBody, runOwnedMetaAction, ownedMetaStatus, ownedMetaConnectionReport, ownedMetaCredentialHealth, sourceOrigins, OwnedMetaActionError, type OwnedMetaActor } from "./owned-meta-actions"

/**
 * The content MCP tools, written against injectable data access so the whole
 * surface runs offline in tests. app/api/content/mcp/route.ts binds `deps` to
 * Firestore, Blob and Canva; nothing in this file imports them.
 *
 * Every tool returns a plain JSON object. Failures are returned, not thrown,
 * with `ok: false`, a stable `code`, and a sentence the agent can relay. The
 * three outcomes Smartie must keep apart are explicit on every result:
 *   - `ok: false, code: "not_authorized"`   — this token may not do this
 *   - `ok: false, code: "blocked"`          — the publisher refused; nothing was sent
 *   - `ok: true,  publication: "uncertain"` — a final call was made and its outcome is unknown
 */
export interface ContentToolDeps {
  listPosts(): Promise<ContentPost[]>
  getPost(id: string): Promise<ContentPost | null>
  findByDesign(designId: string): Promise<ContentPost | null>
  createPost(input: Omit<ContentPost, "id" | "created_at" | "updated_at">): Promise<ContentPost>
  attachStaged(id: string, designId: string, staged: StagedExport): Promise<ContentPost>
  canva(): ReturnType<typeof createCanvaClient> | null
  writeBlob: BlobWriter
  fetcher: typeof fetch
  isSuperAdmin(email: string): Promise<boolean>
  decide(id: string, expectedRevision: number, expectedHash: string, decision: "approved" | "rejected", reviewer: { email: string; name: string }, note: string): Promise<MetaBatch>
  runAction: typeof runOwnedMetaAction
  status: typeof ownedMetaStatus
  connection: typeof ownedMetaConnectionReport
  credentialHealth: typeof ownedMetaCredentialHealth
  allowedOrigins(): string[]
}

export type ToolResult = { ok: true; [k: string]: unknown } | { ok: false; code: "not_authorized" | "not_found" | "blocked" | "invalid" | "unavailable"; message: string; [k: string]: unknown }

const fail = (code: Exclude<ToolResult, { ok: true }>["code"], message: string, extra: Record<string, unknown> = {}): ToolResult => ({ ok: false, code, message, ...extra })
export function requireScope(auth: ContentAuth | undefined, scope: ContentScope): ToolResult | null {
  if (!auth) return fail("not_authorized", "No verified token on this request")
  if (!auth.scopes.includes(scope)) return fail("not_authorized", `This token lacks the ${scope} scope`, { scopes: auth.scopes })
  return null
}
function actorOf(auth: ContentAuth, superAdmin: boolean): OwnedMetaActor | null {
  if (!auth.email) return null
  return { email: auth.email, superAdmin, founder: auth.email === "marcos@434media.com" }
}
function jobView(batch: MetaBatch, d: MetaDestination) {
  const j = batch.jobs[d]
  return { status: j.status, remoteId: j.remoteId ?? null, permalink: j.permalink ?? null, verifiedAt: j.verifiedAt ?? null, blocker: j.blocker ?? null, uncertain: !!j.finalIntent && !j.remoteId && j.status !== "verified" && j.status !== "operator_confirmed", lastError: j.lastError ?? null }
}
export function batchView(batch: MetaBatch) {
  const jobs = { instagram: jobView(batch, "instagram"), facebook: jobView(batch, "facebook") }
  const complete = Object.values(jobs).every(j => j.status === "verified" || j.status === "operator_confirmed")
  const uncertain = Object.values(jobs).some(j => j.uncertain || j.status === "needs_reconciliation")
  return { batchId: batch.id, revision: batch.manifest.revision, hash: batch.hash, brand: batch.manifest.brand, format: batch.manifest.format, approved: !!batch.approval && !batch.revoked, approvedBy: batch.approval?.by ?? null, claim: batch.claim ?? null, jobs, publication: complete ? "complete" : uncertain ? "uncertain" : Object.values(jobs).some(j => j.status === "manual_required") ? "partial" : "pending" }
}
function mapActionError(error: unknown): ToolResult {
  if (error instanceof OwnedMetaActionError) return fail(error.status === 403 ? "not_authorized" : error.status === 404 ? "not_found" : error.status === 423 ? "unavailable" : "blocked", error.message, { ...(error.batch ? { batch: batchView(error.batch) } : {}), ...(error.providerError ? { providerError: error.providerError } : {}) })
  if (error instanceof MetaBlocked) return fail("blocked", error.message)
  if (error instanceof CanvaBlocked) return fail(error.code === "not_connected" || error.code === "unauthorized" ? "unavailable" : "blocked", error.message, { canvaCode: error.code ?? null })
  return fail("blocked", "The publisher stopped; inspect saved state before retrying")
}

export function createContentTools(deps: ContentToolDeps) {
  return {
    async find_content_records(auth: ContentAuth | undefined, q: { id?: string; canva_design_id?: string; title?: string; status?: ContentPost["status"][] }): Promise<ToolResult> {
      const denied = requireScope(auth, "content:read"); if (denied) return denied
      if (q.id) { const p = await deps.getPost(q.id); return { ok: true, records: p && !p.archived ? [summarizeRecord(p)] : [] } }
      if (q.canva_design_id && !q.title && !q.status?.length) { const p = await deps.findByDesign(q.canva_design_id); return { ok: true, records: p ? [summarizeRecord(p)] : [] } }
      const matches = matchContentRecords(await deps.listPosts(), { canvaDesignId: q.canva_design_id, title: q.title, status: q.status }).slice(0, 20)
      return { ok: true, records: matches.map(summarizeRecord), truncated: matches.length === 20 }
    },

    async create_content_record(auth: ContentAuth | undefined, input: { title: string; canva_design_id: string; user: string; social_platforms: ContentPost["social_platforms"]; platform?: ContentPost["platform"]; social_copy?: string; notes?: string; date_to_post?: string }): Promise<ToolResult> {
      const denied = requireScope(auth, "content:write"); if (denied) return denied
      if (!isCanvaDesignId(input.canva_design_id)) return fail("invalid", "canva_design_id is not a Canva design id")
      if (!input.title?.trim()) return fail("invalid", "title is required")
      const byDesign = await deps.findByDesign(input.canva_design_id)
      const existing = byDesign ?? findReusableRecord(await deps.listPosts(), { canvaDesignId: input.canva_design_id, title: input.title })
      if (existing) return { ok: true, reused: true, record: summarizeRecord(existing), note: existing.status === "posted" ? "This record is already posted; do not republish or replace it" : "An existing record matched; reuse it" }
      const created = await deps.createPost({ title: input.title.trim(), user: input.user, date_created: new Date().toISOString().slice(0, 10), status: "to_do", links: [], assets: [], social_platforms: input.social_platforms, canva_design_id: input.canva_design_id, ...(input.platform ? { platform: input.platform } : {}), ...(input.social_copy ? { social_copy: input.social_copy } : {}), ...(input.notes ? { notes: input.notes } : {}), ...(input.date_to_post ? { date_to_post: input.date_to_post } : {}) } as Omit<ContentPost, "id" | "created_at" | "updated_at">)
      return { ok: true, reused: false, record: summarizeRecord(created) }
    },

    async stage_canva_export(auth: ContentAuth | undefined, input: { content_post_id: string; canva_design_id: string; quality?: number }): Promise<ToolResult> {
      const denied = requireScope(auth, "content:write"); if (denied) return denied
      const post = await deps.getPost(input.content_post_id)
      if (!post || post.archived) return fail("not_found", "Content record not found")
      if (post.status === "posted") return fail("blocked", "This record is already posted; staging is refused so it cannot be republished")
      const canva = deps.canva()
      if (!canva) return fail("unavailable", "Canva is not configured on the server (CANVA_CLIENT_ID/CANVA_CLIENT_SECRET)")
      try {
        const { jobId, urls } = await canva.exportJpg(input.canva_design_id, { quality: input.quality })
        const staged = await stageCanvaExport({ post, designId: input.canva_design_id, jobId, urls, download: canvaDownloader(deps.fetcher), writeBlob: deps.writeBlob, allowedOrigins: deps.allowedOrigins() })
        const updated = staged.reused ? post : await deps.attachStaged(post.id, input.canva_design_id, staged)
        return { ok: true, reused: staged.reused, export_fingerprint: staged.fingerprint, export_job_id: jobId, pages: staged.assets.length, review: describeStagedAssets(staged.assets), record: summarizeRecord(staged.reused ? post : updated) }
      } catch (error) { return mapActionError(error) }
    },

    async prepare_meta_batch(auth: ContentAuth | undefined, input: { content_post_id: string; expected_fingerprint: string; brand: MetaBrand; format: "still" | "carousel" | "video"; captions: { instagram: string; facebook: string }; ai_generated: boolean; instagram_share_to_feed?: boolean; template_revision?: string }): Promise<ToolResult> {
      const denied = requireScope(auth, "content:write"); if (denied) return denied
      if (!auth?.email) return fail("not_authorized", "An identified person must prepare a review")
      if (!META_BRANDS.includes(input.brand)) return fail("invalid", "Unknown brand")
      const post = await deps.getPost(input.content_post_id)
      if (!post || post.archived) return fail("not_found", "Content record not found")
      if (post.status === "posted") return fail("blocked", "This record is already posted; a new batch is refused")
      if (!post.export_fingerprint || post.export_fingerprint !== input.expected_fingerprint) return fail("blocked", "expected_fingerprint does not match the staged export; stage first and pass the fingerprint it returned", { export_fingerprint: post.export_fingerprint ?? null })
      if (input.ai_generated && !hasAiCaptionDisclosure(input.captions.facebook)) return fail("blocked", "AI-generated content needs an explicit AI disclosure in the Facebook caption (for example 'Made with AI')")
      const body = ownedMetaActionBody.parse({ action: "prepare", brand: input.brand, format: input.format, captions: input.captions, placements: { instagram: input.format === "video" ? "reels" : "feed", facebook: input.format === "video" ? "reels" : "feed" }, aiGenerated: input.ai_generated, instagramShareToFeed: input.instagram_share_to_feed ?? false, publicHostingApproved: true, templateRevision: input.template_revision ?? `canva:${post.canva_design_id ?? "unknown"}` })
      try {
        const batch = await deps.runAction(post.id, body, { email: auth.email, superAdmin: await deps.isSuperAdmin(auth.email), founder: auth.email === "marcos@434media.com" })
        const preflight = { instagram: checkReviewedFormat(batch.manifest, "instagram"), facebook: checkReviewedFormat(batch.manifest, "facebook") }
        return { ok: true, batch: batchView(batch), preflight, next: "The founder approves this exact revision and hash with approve_meta_batch" }
      } catch (error) { return mapActionError(error) }
    },

    async approve_meta_batch(auth: ContentAuth | undefined, input: { content_post_id: string; expected_revision: number; expected_hash: string; decision: "approved" | "rejected"; note?: string }): Promise<ToolResult> {
      const denied = requireScope(auth, "content:approve"); if (denied) return denied
      if (!auth?.email || !await deps.isSuperAdmin(auth.email)) return fail("not_authorized", "Approval is recorded only for a CRM super admin identified by the token")
      if (input.decision === "rejected" && !input.note?.trim()) return fail("invalid", "A note is required when rejecting")
      try {
        const batch = await deps.decide(input.content_post_id, input.expected_revision, input.expected_hash, input.decision, { email: auth.email, name: auth.email }, input.note?.trim() || "")
        return { ok: true, batch: batchView(batch) }
      } catch (error) { return mapActionError(error instanceof Error && !(error instanceof MetaBlocked) ? new MetaBlocked("Review changed or already decided; reload the exact publisher manifest") : error) }
    },

    async publish_meta_batch(auth: ContentAuth | undefined, input: { content_post_id: string; batch_id: string; hash: string }): Promise<ToolResult> {
      const denied = requireScope(auth, "meta:publish"); if (denied) return denied
      if (!auth?.email) return fail("not_authorized", "Publishing runs are attributed; this token carries no identity")
      const post = await deps.getPost(input.content_post_id)
      if (!post || post.archived) return fail("not_found", "Content record not found")
      if (!post.owned_meta) return fail("blocked", post.status === "posted" ? "This record was posted outside the publisher; it is excluded from API publishing" : "No publisher batch; prepare and approve first")
      const actor = actorOf(auth, await deps.isSuperAdmin(auth.email))!
      try {
        const batch = await deps.runAction(post.id, ownedMetaActionBody.parse({ action: "execute", batchId: input.batch_id, hash: input.hash }), actor)
        const view = batchView(batch)
        const unsupported = (["instagram", "facebook"] as const).filter(d => batch.jobs[d].status === "manual_required").map(d => ({ destination: d, reason: batch.jobs[d].blocker }))
        return { ok: true, batch: view, publication: view.publication, unsupported, note: view.publication === "uncertain" ? "A final publish call was made and its outcome is unknown. Do not retry; use check_meta_connection and reconcile_meta_batch." : view.publication === "pending" ? "Processing or not yet final; call publish_meta_batch again to continue — it resumes saved containers and never repeats a final publish" : undefined }
      } catch (error) { return mapActionError(error) }
    },

    async reconcile_meta_batch(auth: ContentAuth | undefined, input: { content_post_id: string; batch_id: string; hash: string; destination: MetaDestination }): Promise<ToolResult> {
      const denied = requireScope(auth, "meta:publish"); if (denied) return denied
      if (!auth?.email) return fail("not_authorized", "Reconciliation is attributed; this token carries no identity")
      try {
        const batch = await deps.runAction(input.content_post_id, ownedMetaActionBody.parse({ action: "reconcile", batchId: input.batch_id, hash: input.hash, destination: input.destination }), actorOf(auth, await deps.isSuperAdmin(auth.email))!)
        return { ok: true, batch: batchView(batch) }
      } catch (error) { return mapActionError(error) }
    },

    async record_manual_publication(auth: ContentAuth | undefined, input: { content_post_id: string; batch_id: string; hash: string; destination: MetaDestination; remote_id: string; permalink: string }): Promise<ToolResult> {
      const denied = requireScope(auth, "content:approve"); if (denied) return denied
      if (!auth?.email || !await deps.isSuperAdmin(auth.email)) return fail("not_authorized", "Exact-post manual evidence is recorded only by a CRM super admin")
      try {
        const batch = await deps.runAction(input.content_post_id, ownedMetaActionBody.parse({ action: "manual-confirm", batchId: input.batch_id, hash: input.hash, destination: input.destination, remoteId: input.remote_id, permalink: input.permalink, confirmExact: true }), { email: auth.email, superAdmin: true, founder: auth.email === "marcos@434media.com" })
        return { ok: true, batch: batchView(batch) }
      } catch (error) { return mapActionError(error) }
    },

    async get_meta_batch_status(auth: ContentAuth | undefined, input: { content_post_id: string }): Promise<ToolResult> {
      const denied = requireScope(auth, "meta:read"); if (denied) return denied
      try {
        const s = await deps.status(input.content_post_id, { email: auth?.email ?? "", superAdmin: false, founder: false })
        return { ok: true, enabled: s.enabled, archived: s.archived, batch: batchView(s.batch) }
      } catch (error) { return mapActionError(error) }
    },

    async check_meta_connection(auth: ContentAuth | undefined, input: { content_post_id: string }): Promise<ToolResult> {
      const denied = requireScope(auth, "meta:read"); if (denied) return denied
      try { const r = await deps.connection(input.content_post_id); return { ok: true, diagnostics: r.diagnostics, batch: batchView(r.batch) } } catch (error) { return mapActionError(error) }
    },

    async check_meta_credentials(auth: ContentAuth | undefined, input: { brand: MetaBrand }): Promise<ToolResult> {
      const denied = requireScope(auth, "meta:read"); if (denied) return denied
      if (!META_BRANDS.includes(input.brand)) return fail("invalid", "Unknown brand")
      try { return { ok: true, ...(await deps.credentialHealth(input.brand)) } } catch (error) { return mapActionError(error) }
    },

    async check_canva_connection(auth: ContentAuth | undefined): Promise<ToolResult> {
      const denied = requireScope(auth, "meta:read"); if (denied) return denied
      const canva = deps.canva()
      if (!canva) return { ok: true, configured: false, connected: false, note: "CANVA_CLIENT_ID/CANVA_CLIENT_SECRET are not set" }
      return { ok: true, configured: true, ...(await canva.health()), allowedBlobOrigins: deps.allowedOrigins().length }
    },
  }
}
export type ContentTools = ReturnType<typeof createContentTools>
export { sourceOrigins }

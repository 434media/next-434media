import { z } from "zod"
import { createOwnedMetaDraft, getContentPostById, ownedMetaStore, blockOwnedMetaPermission, ownedMetaPermissionBlocked, ownedMetaRuntimeEnabled } from "./firestore-crm"
import { runOwnedMeta, guardFacebookRetryDispatch, validateMetaMutationBoundary, resetUnpublishedPreparation, assertOperatorSettlement, confirmStoppedRun, MetaBlocked, MetaPermissionError, META_BRANDS, type MetaBrand, type MetaManifest, type MetaAsset, type MetaBatch } from "./owned-meta-publisher"
import { readTrustedAsset, assertApprovedBlobUrl, assetDigest, verifyAssetBytes, measureExport } from "./owned-meta-assets"
import { createMetaProvider } from "./instagram-publishing"
import { checkOwnedMetaConnection, type MetaConnectionReport } from "./owned-meta-connection"
import { recordCronRun } from "./cron-auth"
import { OWNED_META_GRAPH_VERSION } from "./owned-meta-formats"
import { safeMetaError, type SafeMetaError } from "./owned-meta-errors"

/**
 * The publisher's actions, shared by the admin route and the content MCP route.
 * Everything here existed in app/api/admin/crm/content-posts/[id]/owned-meta/
 * route.ts; it moved so a second caller cannot drift from the first. Behaviour
 * is unchanged: same gates, same evidence writes, same error mapping.
 */
export const ownedMetaActionBody = z.object({
  action: z.enum(["prepare", "execute", "reconcile", "manual-confirm", "confirm-stopped-run", "reset-preparation", "release-preparation", "recover-facebook"]),
  brand: z.enum(META_BRANDS).optional(), format: z.enum(["still", "carousel", "video"]).optional(),
  captions: z.object({ instagram: z.string(), facebook: z.string() }).optional(),
  placements: z.object({ instagram: z.enum(["feed", "reels"]), facebook: z.enum(["feed", "video", "reels"]) }).optional(),
  instagramShareToFeed: z.boolean().optional(), aiGenerated: z.boolean().optional(), publicHostingApproved: z.boolean().optional(),
  templateRevision: z.string().default("unknown"), batchId: z.string().default(""), hash: z.string().default(""),
  destination: z.enum(["instagram", "facebook"]).optional(), remoteId: z.string().default(""), permalink: z.string().default(""),
  expectedAttemptId: z.string().default(""), acceptDuplicateRisk: z.boolean().default(false),
  expectedClaim: z.string().default(""), evidence: z.string().max(2000).default(""), confirmExact: z.boolean().default(false), confirmTerminated: z.boolean().default(false),
})
export type OwnedMetaActionBody = z.infer<typeof ownedMetaActionBody>

/** Who is acting. Derived from an admin session or a verified MCP token; never from request data. */
export interface OwnedMetaActor { email: string; superAdmin: boolean; founder: boolean }

export class OwnedMetaActionError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409 | 423 | 500, public readonly batch?: MetaBatch, public readonly providerError?: SafeMetaError) { super(message); this.name = "OwnedMetaActionError" }
}

// This route is unusable on previews even if they share production Firestore.
export async function deploymentEnabled() { return process.env.VERCEL_ENV === "production" && await ownedMetaRuntimeEnabled() }
export async function brandEnabled(brand: MetaBrand) { return process.env.VERCEL_ENV === "production" && await ownedMetaRuntimeEnabled(brand) }
export function sourceOrigins() { return (process.env.OWNED_META_SOURCE_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean) }

export async function ownedMetaStatus(id: string, actor: OwnedMetaActor) {
  const r = await ownedMetaStore().read(id)
  return { enabled: await deploymentEnabled(), batch: r.batch, archived: r.archived, canRecover: actor.founder }
}

/** GET-only observation of the configured Page/IG identity and saved container, never persisted. */
export async function ownedMetaConnectionReport(id: string): Promise<{ diagnostics: MetaConnectionReport; batch: MetaBatch }> {
  const r = await ownedMetaStore().read(id)
  const { getOwnedMetaPublishingConfig } = await import("./instagram-config")
  const config = getOwnedMetaPublishingConfig(r.batch.manifest.brand)
  const diagnostics = await checkOwnedMetaConnection({ batch: r.batch, config, runtime: { globalEnabled: await deploymentEnabled(), brandEnabled: await brandEnabled(r.batch.manifest.brand), permissionBlocked: await ownedMetaPermissionBlocked(r.batch.manifest.brand, config.evidence.verifiedAt) } })
  const current = await ownedMetaStore().read(id)
  if (current.batch.id !== r.batch.id || current.batch.hash !== r.batch.hash) throw new OwnedMetaActionError("Batch changed during connection check; reload", 409, current.batch)
  return { diagnostics, batch: current.batch }
}

/**
 * Credential health for a brand without a batch: configuration presence, the
 * runtime switches, and a read-only `/debug_token` style self-check through
 * `/me`. Reports facts about the credential, never the credential.
 */
export async function ownedMetaCredentialHealth(brand: MetaBrand, fetcher: typeof fetch = fetch): Promise<{
  brand: MetaBrand; configured: boolean; reason?: string; identity?: { appId: string; pageId: string; instagramId: string; apiVersion: string }
  evidenceVerifiedAt?: string; runtime: { production: boolean; globalEnabled: boolean; brandEnabled: boolean; permissionBlocked: boolean | null }
  token?: { outcome: "readable" | "failed" | "unavailable"; observedPageId?: string; matchesConfigured?: boolean; expiresAt?: string | null; scopes?: string[]; error?: SafeMetaError }
}> {
  const production = process.env.VERCEL_ENV === "production"
  const runtime = { production, globalEnabled: await deploymentEnabled(), brandEnabled: await brandEnabled(brand), permissionBlocked: null as boolean | null }
  if (!production) return { brand, configured: false, reason: "Publishing credentials are production-only", runtime }
  const { getOwnedMetaPublishingConfig } = await import("./instagram-config")
  let config: ReturnType<typeof getOwnedMetaPublishingConfig>
  try { config = getOwnedMetaPublishingConfig(brand) } catch (error) { return { brand, configured: false, reason: error instanceof Error ? error.message : "Not configured", runtime } }
  runtime.permissionBlocked = await ownedMetaPermissionBlocked(brand, config.evidence.verifiedAt)
  const identity = { appId: config.appId, pageId: config.pageId, instagramId: config.instagramId, apiVersion: OWNED_META_GRAPH_VERSION }
  const token: NonNullable<Awaited<ReturnType<typeof ownedMetaCredentialHealth>>["token"]> = { outcome: "unavailable" }
  try {
    // debug_token needs an app token we do not hold; `/me` with the Page credential is the supported self-read.
    const url = new URL(`https://graph.facebook.com/${OWNED_META_GRAPH_VERSION}/me`); url.searchParams.set("fields", "id")
    const response = await fetcher(url, { method: "GET", headers: { authorization: `Bearer ${config.accessToken}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) { token.outcome = "failed"; token.error = safeMetaError(response.status, body, "facebook", "connection", config.accessToken) }
    else {
      const id = body && typeof body === "object" && "id" in body ? (body as { id: unknown }).id : undefined
      if (typeof id === "string" && /^\d+$/.test(id)) { token.outcome = "readable"; token.observedPageId = id; token.matchesConfigured = id === config.pageId }
    }
  } catch { token.outcome = "unavailable" }
  return { brand, configured: true, identity, evidenceVerifiedAt: config.evidence.verifiedAt, runtime, token }
}

export async function prepareOwnedMeta(id: string, body: OwnedMetaActionBody): Promise<MetaBatch> {
  const brand = body.brand
  if (!brand || !META_BRANDS.includes(brand) || !await brandEnabled(brand)) throw new MetaBlocked("Brand is disabled")
  if (!body.format || !body.captions || !body.placements || typeof body.aiGenerated !== "boolean" || typeof body.instagramShareToFeed !== "boolean" || typeof body.publicHostingApproved !== "boolean") throw new MetaBlocked("Complete review choices required")
  const post = await getContentPostById(id)
  if (!post || post.archived || !post.assets.length) throw new MetaBlocked("Save the approved export references on the content post first")
  const { getOwnedMetaIdentity } = await import("./instagram-config")
  const assets: MetaAsset[] = []
  for (const [i, a] of post.assets.entries()) {
    const bytes = await readTrustedAsset(a.url, sourceOrigins())
    const measured = measureExport(bytes)
    assets.push({ name: `export-${i + 1}`, url: assertApprovedBlobUrl(a.url, sourceOrigins()), sha256: assetDigest(bytes), size: bytes.byteLength, ...measured, provenance: { source: a.source || "unknown", templateRevision: body.templateRevision || "unknown", generator: a.model || "unknown", metadata: "unverified" } })
    verifyAssetBytes(assets[i], bytes)
    // A staged export carries its own measured identity; a drift here means the record changed after staging.
    if (a.sha256 && a.sha256 !== assets[i].sha256) throw new MetaBlocked("Staged export hash does not match the stored bytes; restage before review")
  }
  const manifest: Omit<MetaManifest, "revision"> = { schema: 1, brand, format: body.format, assets, captions: body.captions, destinations: getOwnedMetaIdentity(brand), placements: body.placements, instagramShareToFeed: body.instagramShareToFeed, aiGenerated: body.aiGenerated, publicHostingApproved: body.publicHostingApproved }
  return createOwnedMetaDraft(id, manifest)
}

/** Every non-prepare action. Throws OwnedMetaActionError with the HTTP status the admin route always returned. */
export async function runOwnedMetaAction(id: string, body: OwnedMetaActionBody, actor: OwnedMetaActor): Promise<MetaBatch> {
  if (process.env.VERCEL_ENV !== "production") throw new OwnedMetaActionError("Previews cannot write publisher data", 423)
  if (body.action === "recover-facebook" && !actor.founder) throw new OwnedMetaActionError("Founder recovery required", 403)
  if (!await deploymentEnabled() && !["reconcile", "manual-confirm", "confirm-stopped-run"].includes(body.action)) throw new OwnedMetaActionError("Publisher disabled", 423)
  const startedAt = new Date().toISOString(), runId = crypto.randomUUID()
  let brand: MetaBrand | undefined
  let batchId: string | undefined
  try {
    if (body.action === "prepare") { brand = body.brand; return await prepareOwnedMeta(id, body) }
    const store = ownedMetaStore(), record = await store.read(id)
    brand = record.batch.manifest.brand
    batchId = record.batch.id
    if (body.batchId !== record.batch.id || body.hash !== record.batch.hash) throw new MetaBlocked("Displayed batch changed; reload before acting")
    if (body.action === "confirm-stopped-run") {
      if (!actor.superAdmin || body.confirmTerminated !== true || typeof body.evidence !== "string") throw new MetaBlocked("Super-admin must confirm observed run termination, not elapsed time")
      await store.update(id, r => { if (r.batch.id !== record.batch.id) throw new MetaBlocked("Revision changed"); confirmStoppedRun(r, body.expectedClaim, actor.email, body.evidence, new Date().toISOString()); return { next: r, result: null } })
      return (await store.read(id)).batch
    }
    if (body.action === "manual-confirm") {
      if (!actor.superAdmin || body.confirmExact !== true || !/^\d+(?:_\d+)?$/.test(body.remoteId || "")) throw new MetaBlocked("Exact-post super-admin confirmation required")
      const d = body.destination
      if (d !== "instagram" && d !== "facebook") throw new MetaBlocked("Destination required")
      const url = new URL(body.permalink), host = d === "instagram" ? "instagram.com" : "facebook.com"
      if (url.protocol !== "https:" || ![host, `www.${host}`].includes(url.hostname)) throw new MetaBlocked("Platform permalink required")
      await store.update(id, r => {
        assertOperatorSettlement(r, record.batch.id)
        const j = r.batch.jobs[d]
        if (r.batch.id !== record.batch.id || !r.batch.approval || j.status === "verified" || j.status === "operator_confirmed" || (!j.finalIntent && j.status !== "manual_required")) throw new MetaBlocked("This job is not awaiting exact-post manual evidence")
        j.status = "operator_confirmed"; j.remoteId = body.remoteId; j.permalink = url.toString(); j.verifiedAt = new Date().toISOString()
        j.manualEvidence = { by: actor.email, at: j.verifiedAt, approvedHash: r.batch.hash, confirmation: "Operator inspected this exact published account, exports, item order, captions and required AI label; not API verification" }
        r.batch.claim = null
        return { next: r, result: null }
      })
      return (await store.read(id)).batch
    }
    if (body.action === "reset-preparation") {
      const d = body.destination
      if (d !== "instagram" && d !== "facebook") throw new MetaBlocked("Destination required")
      await store.event(id, record.batch.id, { kind: "operator_reset_unpublished_preparation", destination: d, runId, at: new Date().toISOString(), preparation: record.batch.jobs[d].preparation })
      await store.update(id, r => { if (r.batch.id !== body.batchId) throw new MetaBlocked("Batch changed"); resetUnpublishedPreparation(r, d); return { next: r, result: null } })
      return (await store.read(id)).batch
    }
    const { getOwnedMetaPublishingConfig } = await import("./instagram-config")
    // Reconciliation can run with a disabled brand, but never in preview; use the existing credential only.
    const config = getOwnedMetaPublishingConfig(brand)
    const localEnabled = async () => await brandEnabled(brand!) && !await ownedMetaPermissionBlocked(brand!, config.evidence.verifiedAt)
    const verifyUrls = async (urls: string[]) => {
      for (const url of urls) { const asset = record.batch.manifest.assets.find(a => a.url === url); if (!asset) throw new MetaBlocked("URL is not bound to this approval"); verifyAssetBytes(asset, await readTrustedAsset(url, sourceOrigins())) }
    }
    const provider: ReturnType<typeof createMetaProvider> = createMetaProvider({ accessToken: config.accessToken, evidence: config.evidence, beforeMutation: async (urls = []) => {
      await validateMetaMutationBoundary({ enabled: localEnabled, read: () => store.read(id), batchId: record.batch.id, runId, verify: () => verifyUrls(urls.length ? urls : record.batch.manifest.assets.map(a => a.url)) })
    }, beforeFinalDispatch: async (_m, d) => {
      const current = await store.read(id), job = current.batch.jobs[d]
      if (!job.retry) return
      if (body.action !== "recover-facebook" || d !== "facebook") throw new MetaBlocked("Owner recovery action required")
      await guardFacebookRetryDispatch({ id, batchId: record.batch.id, runId, store, enabled: localEnabled, check: (manifest, earliest) => provider.checkFacebookRetry(manifest, earliest) })
    } })
    if (body.action === "reconcile") {
      const d = body.destination
      if (d !== "instagram" && d !== "facebook") throw new MetaBlocked("Destination required")
      assertOperatorSettlement(record, record.batch.id)
      const job = record.batch.jobs[d]
      const remoteId = job.remoteId
      if (!remoteId || !/^\d+(?:_\d+)?$/.test(remoteId)) throw new MetaBlocked("No persisted final ID; use the exact-post manual evidence action for an unknown outcome")
      const result = await provider.verify(record.batch.manifest, d, remoteId)
      if (!result.verified || !result.permalink) throw new MetaBlocked(result.blocker || "Remote result is not verified; do not retry publishing")
      await store.update(id, r => { assertOperatorSettlement(r, record.batch.id); r.batch.jobs[d] = { ...r.batch.jobs[d], remoteId, status: "verified", permalink: result.permalink, verifiedAt: new Date().toISOString() }; r.batch.claim = null; return { next: r, result: null } })
      return (await store.read(id)).batch
    }
    if (body.action === "release-preparation") {
      // Explicit recovery only. An old worker loses its claim and cannot checkpoint/finalize.
      await store.update(id, r => { if (r.batch.id !== body.batchId || r.batch.claim !== body.expectedClaim || Object.values(r.batch.jobs).some(j => j.finalIntent)) throw new MetaBlocked("Cannot release a final-publication claim"); r.batch.claim = null; return { next: r, result: null } })
      return (await store.read(id)).batch
    }
    if (body.action !== "execute" && body.action !== "recover-facebook") throw new MetaBlocked("Unknown action")
    const batch = await runOwnedMeta({ id, runId, store, provider, enabled: localEnabled,
      ...(body.action === "recover-facebook" ? { facebookRecovery: { expectedAttemptId: body.expectedAttemptId, actor: actor.email, evidence: body.evidence, acceptDuplicateRisk: body.acceptDuplicateRisk } } : {}), resolveAssets: async b => {
        if (!await localEnabled()) throw new MetaBlocked("Brand disabled")
        const urls = b.manifest.assets.map(a => a.url)
        await verifyUrls(urls)
        if (!await localEnabled() || (await store.read(id)).archived) throw new MetaBlocked("Publishing stopped during asset validation")
        return urls
      } })
    const finishedAt = new Date().toISOString(), complete = Object.values(batch.jobs).every(j => j.status === "verified" || j.status === "operator_confirmed")
    await recordCronRun({ job: "owned-meta-publish", startedAt, finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), status: complete ? "success" : "partial", message: complete ? "Both destinations complete; inspect per-job evidence type" : "Operator continuation required", detail: { postId: id, batchId: batch.id, runId, actor: actor.email, evidence: { instagram: batch.jobs.instagram.status, facebook: batch.jobs.facebook.status } } })
    return batch
  } catch (error) {
    if (error instanceof OwnedMetaActionError) throw error
    const detail = error instanceof MetaBlocked || error instanceof MetaPermissionError ? error.detail : undefined
    if (detail && batchId) {
      // Evidence only: never take another run's claim or overwrite newer failure evidence.
      await ownedMetaStore().update(id, r => {
        if (r.batch.id !== batchId || r.batch.claim && r.batch.claim !== runId) return { result: null }
        const job = r.batch.jobs[detail.destination]
        if (job.lastError && Date.parse(job.lastError.at) > Date.parse(detail.at)) return { result: null }
        job.lastError = detail
        return { next: r, result: null }
      }).catch(() => {})
    }
    if (body.action === "execute" || body.action === "recover-facebook") {
      const finishedAt = new Date().toISOString()
      await recordCronRun({ job: "owned-meta-publish", startedAt, finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), status: "error", message: "Publisher stopped; inspect saved state before retrying", detail: { postId: id, runId, actor: actor.email, ...(batchId ? { batchId } : {}), ...(detail ? { providerError: detail } : {}) } })
    }
    if (error instanceof MetaPermissionError && brand) await blockOwnedMetaPermission(brand)
    const message = error instanceof MetaBlocked || error instanceof MetaPermissionError ? error.message : "Publisher failed; inspect saved state before retrying"
    const saved = batchId ? await ownedMetaStore().read(id).catch(() => null) : null
    throw new OwnedMetaActionError(message, error instanceof MetaPermissionError ? 403 : error instanceof MetaBlocked ? 409 : 500, saved?.batch.id === batchId ? saved?.batch : undefined, detail)
  }
}

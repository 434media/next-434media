import { createHash } from "node:crypto"

export const META_BRANDS = ["txmx", "vemos", "milcity", "ampd"] as const
export type MetaBrand = typeof META_BRANDS[number]
export type MetaDestination = "instagram" | "facebook"
export type MetaFormat = "still" | "carousel" | "video"
export interface MetaAsset {
  name: string
  sha256: string
  size: number
  mime: "image/jpeg" | "image/png" | "video/mp4"
  width: number
  height: number
  duration?: number
  provenance: { source: string; templateRevision: string; generator: string; metadata: "present" | "absent" | "unverified" }
}
export interface MetaManifest {
  schema: 1
  revision: number
  brand: MetaBrand
  format: MetaFormat
  assets: MetaAsset[]
  captions: Record<MetaDestination, string>
  destinations: { appId: string; pageId: string; instagramId: string; apiVersion: string }
  placements: { instagram: "feed" | "reels"; facebook: "feed" | "video" | "reels" }
  instagramShareToFeed: boolean
  aiGenerated: boolean
  publicHostingApproved: boolean
}
export interface MetaJob {
  status: "ready" | "processing" | "final_started" | "verified" | "operator_confirmed" | "manual_required" | "needs_reconciliation"
  preparation: Record<string, string>
  finalIntent?: { id: string; at: string }
  remoteId?: string
  permalink?: string
  verifiedAt?: string
  blocker?: string
  manualEvidence?: { by: string; at: string; approvedHash: string; confirmation: string }
}
export interface MetaBatch {
  id: string
  manifest: MetaManifest
  hash: string
  approval?: { by: string; at: string; hash: string }
  revoked?: boolean
  claim?: string | null
  jobs: Record<MetaDestination, MetaJob>
  stoppedRuns?: { id: string; by: string; at: string; evidence: string }[]
  publicAssets: string[]
}
export interface MetaRecord { archived: boolean; revision: number; batch: MetaBatch }
export interface MetaStore {
  read(id: string): Promise<MetaRecord>
  update<T>(id: string, fn: (record: MetaRecord) => { next?: MetaRecord; result: T }): Promise<T>
  event(id: string, batchId: string, detail: { kind: string; runId: string; destination?: MetaDestination; at: string; preparation?: Record<string,string>; remoteId?: string }): Promise<void>
}
export interface MetaProvider {
  preflight(manifest: MetaManifest, destination: MetaDestination): string | null
  prepare(manifest: MetaManifest, destination: MetaDestination, urls: string[], saved: Record<string, string>, checkpoint: (key: string, value: string) => Promise<void>): Promise<{ ready: boolean; preparation: Record<string, string> }>
  publish(manifest: MetaManifest, destination: MetaDestination, urls: string[], preparation: Record<string, string>): Promise<string>
  verify(manifest: MetaManifest, destination: MetaDestination, remoteId: string): Promise<{ verified: boolean; permalink?: string; blocker?: string }>
}
export class MetaBlocked extends Error { constructor(message: string) { super(message); this.name = "MetaBlocked" } }
export class MetaPermissionError extends Error { constructor() { super("Publishing permission failed; this brand needs a new permission check"); this.name = "MetaPermissionError" } }
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}
export function manifestHash(value: MetaManifest): string { return createHash("sha256").update(canonicalJson(value)).digest("hex") }
export function validateManifest(value: unknown): asserts value is MetaManifest {
  const m = value as MetaManifest
  if (!m || m.schema !== 1 || !Number.isSafeInteger(m.revision) || m.revision < 1 || !META_BRANDS.includes(m.brand)) throw new MetaBlocked("Invalid manifest identity")
  if (!["still", "carousel", "video"].includes(m.format) || !Array.isArray(m.assets) || !m.assets.length) throw new MetaBlocked("Invalid media format")
  if (m.format !== "carousel" && m.assets.length !== 1 || m.format === "carousel" && m.assets.length < 2) throw new MetaBlocked("Invalid asset count")
  if (typeof m.instagramShareToFeed !== "boolean" || typeof m.aiGenerated !== "boolean" || typeof m.publicHostingApproved !== "boolean") throw new MetaBlocked("Explicit AI and public hosting choices required")
  for (const a of m.assets) {
    if (!a || typeof a.name !== "string" || !a.name || !/^[a-f0-9]{64}$/.test(a.sha256) || !Number.isSafeInteger(a.size) || a.size < 1 || !["image/jpeg", "image/png", "video/mp4"].includes(a.mime) || !Number.isFinite(a.width) || a.width <= 0 || !Number.isFinite(a.height) || a.height <= 0) throw new MetaBlocked("Invalid asset identity or metadata")
    if (a.mime === "video/mp4" && (!Number.isFinite(a.duration) || a.duration! <= 0)) throw new MetaBlocked("Video duration required")
    if (!a.provenance || !["present", "absent", "unverified"].includes(a.provenance.metadata) || [a.provenance.source, a.provenance.templateRevision, a.provenance.generator].some(v => typeof v !== "string")) throw new MetaBlocked("Provenance must be explicit, including unknown values")
  }
  if (m.format === "still" && m.assets[0].mime === "video/mp4" || m.format === "video" && m.assets[0].mime !== "video/mp4") throw new MetaBlocked("Format does not match asset")
  if (!m.captions || [m.captions.instagram, m.captions.facebook].some(v => typeof v !== "string")) throw new MetaBlocked("Both captions required")
  if (!m.destinations || [m.destinations.appId, m.destinations.pageId, m.destinations.instagramId].some(v => typeof v !== "string" || !/^\d+$/.test(v)) || !/^v\d+\.\d+$/.test(m.destinations.apiVersion)) throw new MetaBlocked("Verified destinations required")
  if (!m.placements || m.placements.instagram !== (m.format === "video" ? "reels" : "feed") || (m.format !== "video" ? m.placements.facebook !== "feed" : !["video", "reels"].includes(m.placements.facebook))) throw new MetaBlocked("Placement does not match format")
}
export function draftBatch(id: string, manifest: MetaManifest): MetaBatch {
  validateManifest(manifest)
  return { id, manifest, hash: manifestHash(manifest), jobs: { instagram: { status: "ready", preparation: {} }, facebook: { status: "ready", preparation: {} } }, publicAssets: [] }
}
export function assertApproved(r: MetaRecord): void {
  validateManifest(r.batch.manifest)
  if (r.archived || r.batch.revoked || r.revision !== r.batch.manifest.revision || !r.batch.manifest.publicHostingApproved || !r.batch.approval || r.batch.approval.hash !== manifestHash(r.batch.manifest) || r.batch.hash !== r.batch.approval.hash) throw new MetaBlocked("Current immutable approval required")
}
/** Pure: no environment, token, storage or network access. */
export function dryRun(r: MetaRecord): { batchId: string; hash: string; destinations: MetaDestination[] } {
  assertApproved(r)
  return { batchId: r.batch.id, hash: r.batch.hash, destinations: ["instagram", "facebook"] }
}
/** Generic writers cannot impersonate the publisher or mutate frozen creative. */
export function guardedContentUpdate(existing: Record<string, unknown>, updates: Record<string, unknown>): Record<string, unknown> {
  if (Object.keys(updates).some(k => k.startsWith("owned_meta") || k === "archived")) throw new MetaBlocked("Publisher fields are server-owned")
  const relevant = ["assets", "social_copy", "social_platforms", "platform", "tags", "date_to_post"]
  if (existing.owned_meta && relevant.some(k => k in updates && canonicalJson(updates[k]) !== canonicalJson(existing[k]))) {
    if ((existing.owned_meta as { started?: boolean }).started) throw new MetaBlocked("Publishing batch is frozen; create a separately reviewed revision")
    return { ...updates, owned_meta_revision: Number(existing.owned_meta_revision || 0) + 1, owned_meta: null, status: "needs_approval" }
  }
  return updates
}
/** Atomic claim + persisted IDs; no lease, elapsed-time takeover or automatic final retry. */
export async function runOwnedMeta(args: {
  id: string; runId: string; store: MetaStore; provider: MetaProvider
  enabled: (brand: MetaBrand) => Promise<boolean>
  upload: (batch: MetaBatch) => Promise<string[]>
  now?: () => string
}): Promise<MetaBatch> {
  const { id, runId, store, provider } = args
  const now = args.now ?? (() => new Date().toISOString())
  const initial = await store.read(id)
  assertApproved(initial)
  if (!await args.enabled(initial.batch.manifest.brand)) throw new MetaBlocked("Publishing disabled for this brand")
  // Per-format checks are local capability evidence, not a new permissions API call.
  const blockers = Object.fromEntries((["instagram", "facebook"] as const).map(d => [d, provider.preflight(initial.batch.manifest, d)]))
  await store.update(id, r => {
    assertApproved(r)
    if (r.batch.id !== initial.batch.id || r.batch.claim) throw new MetaBlocked("Post already claimed or revision changed; use reconcile")
    r.batch.claim = runId
    return { next: r, result: null }
  })
  const mutate = async (fn: (r: MetaRecord) => void, allowArchived = false) => store.update(id, r => {
    if (r.batch.id !== initial.batch.id || r.batch.claim !== runId) throw new MetaBlocked("Claim changed; no further dispatch allowed")
    if (!allowArchived) assertApproved(r)
    fn(r)
    return { next: r, result: null }
  })
  try {
    let r = await store.read(id)
    if (!r.batch.publicAssets.length && Object.values(blockers).some(x => !x)) {
      if (!await args.enabled(r.batch.manifest.brand)) throw new MetaBlocked("Publishing disabled")
      const urls = await args.upload(r.batch)
      await mutate(current => { current.batch.publicAssets = urls })
    }
    for (const destination of ["instagram", "facebook"] as const) {
      r = await store.read(id)
      if (r.batch.claim !== runId || r.batch.id !== initial.batch.id) throw new MetaBlocked("Stopped run cannot dispatch another destination")
      let job = r.batch.jobs[destination]
      if (job.status === "verified" || job.status === "operator_confirmed") continue
      if (blockers[destination]) {
        await mutate(current => { current.batch.jobs[destination].status = "manual_required"; current.batch.jobs[destination].blocker = blockers[destination]! })
        continue
      }
      if (job.finalIntent) {
        if (job.remoteId) {
          const v = await provider.verify(r.batch.manifest, destination, job.remoteId)
          await mutate(current => { const j = current.batch.jobs[destination]; if (v.verified && v.permalink) { j.status = "verified"; j.permalink = v.permalink; j.verifiedAt = now(); delete j.blocker } else { j.status = "needs_reconciliation"; j.blocker = v.blocker || "Remote outcome unverified" } }, true)
        }
        continue // NEVER issue a second final publication.
      }
      if (!await args.enabled(r.batch.manifest.brand)) throw new MetaBlocked("Publishing disabled")
      let prepared: { ready: boolean; preparation: Record<string,string> }
      try {
      prepared = await provider.prepare(r.batch.manifest, destination, r.batch.publicAssets, job.preparation, async (key, value) => {
        await mutate(current => { if (current.batch.jobs[destination].finalIntent) throw new MetaBlocked("Final intent already recorded"); current.batch.jobs[destination].preparation[key] = value })
      })
      await mutate(current => { current.batch.jobs[destination].preparation = prepared.preparation; current.batch.jobs[destination].status = "processing" })
      } catch (error) {
        if (error instanceof MetaPermissionError) throw error
        await mutate(current => { current.batch.jobs[destination].status = "manual_required"; current.batch.jobs[destination].blocker = "Preparation failed; operator may reset unpublished preparation and retry" })
        continue
      }
      if (!prepared.ready) continue
      if (!await args.enabled(r.batch.manifest.brand)) throw new MetaBlocked("Publishing disabled")
      await mutate(current => {
        const j = current.batch.jobs[destination]
        if (j.finalIntent) throw new MetaBlocked("Final publication already attempted")
        j.finalIntent = { id: `${runId}:${destination}`, at: now() }
        j.status = "final_started"
      })
      await store.event(id, initial.batch.id, { kind: "final_publish_intent", destination, runId, at: now() })
      try {
        // Recheck local switch immediately before final dispatch. Permissions are NOT audited here.
        if (!await args.enabled(r.batch.manifest.brand)) throw new MetaBlocked("Disabled after final intent; reconcile before retry")
        const latest = await store.read(id); assertApproved(latest)
        if (latest.batch.claim !== runId || latest.batch.id !== initial.batch.id) throw new MetaBlocked("Claim changed before dispatch")
        const remoteId = await provider.publish(r.batch.manifest, destination, r.batch.publicAssets, prepared.preparation)
        try {
        await store.update(id,current=>{
          if(current.batch.id!==initial.batch.id || current.batch.jobs[destination].finalIntent?.id!==`${runId}:${destination}`) return {result:null}
          const j=current.batch.jobs[destination]
          if(j.remoteId && j.remoteId!==remoteId){j.status="needs_reconciliation";j.blocker="Conflicting remote IDs; review retained attempt evidence"}
          else if(!j.manualEvidence)j.remoteId=remoteId
          return {next:current,result:null}
        })
        } catch(error) {
          await store.event(id,initial.batch.id,{kind:"remote_final_observed",destination,runId,at:now(),remoteId}).catch(() => {})
          throw error
        }
        await store.event(id,initial.batch.id,{kind:"remote_final_observed",destination,runId,at:now(),remoteId}).catch(() => {}) // auxiliary log cannot discard a persisted final ID
        const observed=await store.read(id)
        if(observed.batch.claim!==runId)return observed.batch // stopped run may record evidence, never dispatch again

        const result = await provider.verify(r.batch.manifest, destination, remoteId)
        await mutate(current => {
          job = current.batch.jobs[destination]
          if (result.verified && result.permalink) { job.status = "verified"; job.permalink = result.permalink; job.verifiedAt = now(); delete job.blocker }
          else { job.status = "needs_reconciliation"; job.blocker = result.blocker || "Published result needs review" }
        }, true)
      } catch (error) {
        await mutate(current => { const j = current.batch.jobs[destination]; j.status = "needs_reconciliation"; j.blocker = "Final publication may have happened; do not repeat" }, true)
        if (error instanceof MetaPermissionError) throw error
      }
    }
  } finally {
    // Final intent, not a time-based claim, prevents duplicate final publication.
    await store.update(id, r => r.batch.id === initial.batch.id && r.batch.claim === runId ? { next: { ...r, batch: { ...r.batch, claim: null } }, result: null } : { result: null })
  }
  return (await store.read(id)).batch
}

/** Operator reset can abandon unused containers only, never a recorded public outcome. */
export function resetUnpublishedPreparation(record: MetaRecord, destination: MetaDestination): void {
  const j=record.batch.jobs[destination]
  if(record.batch.claim || j.finalIntent || j.remoteId || j.manualEvidence || ["verified","operator_confirmed"].includes(j.status)) throw new MetaBlocked("Cannot reset active, uncertain or completed publication")
  record.batch.jobs[destination]={status:"ready",preparation:{}}
}
export function assertOperatorSettlement(record: MetaRecord, expectedBatchId: string): void {
  if(record.batch.id!==expectedBatchId || record.batch.claim) throw new MetaBlocked("Wait for the active run to stop before operator reconciliation")
}

/** Human-observed termination, never elapsed-time inference. Final intents survive. */
export function confirmStoppedRun(record: MetaRecord, expectedClaim: string, actor: string, evidence: string, at: string): void {
  if(!expectedClaim || record.batch.claim!==expectedClaim || !actor || evidence.trim().length<20) throw new MetaBlocked("Exact stopped run and observed termination evidence required")
  record.batch.stoppedRuns=[...(record.batch.stoppedRuns || []),{id:expectedClaim,by:actor,at,evidence:evidence.trim()}]
  record.batch.claim=null
}

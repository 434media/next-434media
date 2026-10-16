import { createOwnedMetaDraft, getContentPostById, ownedMetaStore, blockOwnedMetaPermission, ownedMetaPermissionBlocked, ownedMetaRuntimeEnabled } from "@/lib/firestore-crm"
import { runOwnedMeta, guardFacebookRetryDispatch, validateMetaMutationBoundary, MetaBlocked, MetaPermissionError, type MetaBatch, type MetaBrand, type MetaManifest, type MetaAsset, type MetaRecord, type MetaStore, type MetaDestination, type FacebookRecovery } from "@/lib/owned-meta-publisher"
import { readTrustedAsset, assertApprovedBlobUrl, assetDigest, verifyAssetBytes, measureExport } from "@/lib/owned-meta-assets"
import { createMetaProvider } from "@/lib/instagram-publishing"
import { recordCronRun } from "@/lib/cron-auth"

/**
 * One wiring of the existing publisher, shared by the admin route, the Slack tool
 * route and the continuation cron. Safety logic stays in owned-meta-publisher.ts.
 */

// Previews are unusable even if they share production Firestore.
export async function ownedMetaDeploymentEnabled() { return process.env.VERCEL_ENV === "production" && await ownedMetaRuntimeEnabled() }
export async function ownedMetaBrandEnabled(brand: MetaBrand) { return process.env.VERCEL_ENV === "production" && await ownedMetaRuntimeEnabled(brand) }
export function ownedMetaSourceOrigins() { return (process.env.OWNED_META_SOURCE_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean) }

export interface PrepareChoices {
  brand: MetaBrand; format: MetaManifest["format"]; captions: MetaManifest["captions"]; placements: MetaManifest["placements"]
  instagramShareToFeed: boolean; aiGenerated: boolean; publicHostingApproved: boolean; templateRevision: string
}
/** Measures the post's saved exports and creates an unapproved, immutable draft batch. */
export async function prepareOwnedMetaBatch(id: string, c: PrepareChoices): Promise<MetaBatch> {
  if (!await ownedMetaBrandEnabled(c.brand)) throw new MetaBlocked("Brand is disabled")
  const post=await getContentPostById(id)
  if (!post || post.archived || !post.assets.length) throw new MetaBlocked("Save the approved export references on the content post first")
  // A post already published elsewhere is never prepared again (owner-reported or manual posting).
  if (post.status==="posted" || post.published_url || post.owned_meta_external) throw new MetaBlocked("This post is already published or excluded from the publisher")
  const {getOwnedMetaIdentity}=await import("@/lib/instagram-config")
  const assets:MetaAsset[]=[]
  for (const [i,a] of post.assets.entries()) {
    const bytes=await readTrustedAsset(a.url,ownedMetaSourceOrigins())
    const measured=measureExport(bytes)
    assets.push({name:`export-${i+1}`,url:assertApprovedBlobUrl(a.url,ownedMetaSourceOrigins()),sha256:assetDigest(bytes),size:bytes.byteLength,...measured,provenance:{source:a.source || "unknown",templateRevision:c.templateRevision || "unknown",generator:a.model || "unknown",metadata:"unverified"}})
    verifyAssetBytes(assets[i],bytes)
  }
  const manifest:Omit<MetaManifest,"revision">={schema:1,brand:c.brand,format:c.format,assets,captions:c.captions,destinations:getOwnedMetaIdentity(c.brand),placements:c.placements,instagramShareToFeed:c.instagramShareToFeed,aiGenerated:c.aiGenerated,publicHostingApproved:c.publicHostingApproved}
  return createOwnedMetaDraft(id,manifest)
}

/** Builds the provider with every existing mutation-boundary and final-dispatch guard. */
export async function ownedMetaProviderFor(args: { id: string; record: MetaRecord; runId: string; store: MetaStore; recovery: boolean }) {
  const { id, record, runId, store } = args
  const brand=record.batch.manifest.brand
  const {getOwnedMetaPublishingConfig}=await import("@/lib/instagram-config")
  // Uses the existing brand credential only. Reconciliation can run with a disabled brand, never in preview.
  const config=getOwnedMetaPublishingConfig(brand)
  const localEnabled=async () => await ownedMetaBrandEnabled(brand) && !await ownedMetaPermissionBlocked(brand,config.evidence.verifiedAt)
  const verifyUrls=async (urls: string[]) => {
    for(const url of urls){const asset=record.batch.manifest.assets.find(a=>a.url===url);if(!asset)throw new MetaBlocked("URL is not bound to this approval");verifyAssetBytes(asset,await readTrustedAsset(url,ownedMetaSourceOrigins()))}
  }
  const provider:ReturnType<typeof createMetaProvider>=createMetaProvider({accessToken:config.accessToken,evidence:config.evidence,beforeMutation:async(urls=[])=>{
    await validateMetaMutationBoundary({enabled:localEnabled,read:()=>store.read(id),batchId:record.batch.id,runId,
      verify:()=>verifyUrls(urls.length?urls:record.batch.manifest.assets.map(a=>a.url))})
  },beforeFinalDispatch:async(_m,d)=>{
    const current=await store.read(id),job=current.batch.jobs[d]
    if(!job.retry)return
    if(!args.recovery || d!=="facebook")throw new MetaBlocked("Owner recovery action required")
    await guardFacebookRetryDispatch({id,batchId:record.batch.id,runId,store,enabled:localEnabled,check:(manifest,earliest)=>provider.checkFacebookRetry(manifest,earliest)})
  }})
  return { provider, localEnabled, verifyUrls, config }
}

/** Execute (or founder recovery) through the unchanged state machine, with the existing run log. */
export async function executeOwnedMeta(args: { id: string; runId: string; record: MetaRecord; store: MetaStore; trigger: string; facebookRecovery?: FacebookRecovery; only?: MetaDestination[] }): Promise<MetaBatch> {
  const { id, runId, record, store } = args
  const startedAt=new Date().toISOString()
  const { provider, localEnabled, verifyUrls } = await ownedMetaProviderFor({ id, record, runId, store, recovery: !!args.facebookRecovery })
  const batch=await runOwnedMeta({id,runId,store,provider,enabled:localEnabled,
    ...(args.facebookRecovery?{facebookRecovery:args.facebookRecovery}:{}),...(args.only?{only:args.only}:{}),resolveAssets:async b=>{
    if (!await localEnabled()) throw new MetaBlocked("Brand disabled")
    const urls=b.manifest.assets.map(a=>a.url)
    await verifyUrls(urls)
    if(!await localEnabled() || (await store.read(id)).archived)throw new MetaBlocked("Publishing stopped during asset validation")
    return urls
  }})
  const finishedAt=new Date().toISOString(),complete=Object.values(batch.jobs).every(j=>j.status==="verified"||j.status==="operator_confirmed")
  await recordCronRun({job:"owned-meta-publish",startedAt,finishedAt,durationMs:Date.parse(finishedAt)-Date.parse(startedAt),status:complete?"success":"partial",message:complete?"Both destinations complete; inspect per-job evidence type":"Operator continuation required",detail:{postId:id,batchId:batch.id,runId,trigger:args.trigger,evidence:{instagram:batch.jobs.instagram.status,facebook:batch.jobs.facebook.status}}})
  return batch
}

/** Evidence only: never takes another run's claim or overwrites newer failure evidence. */
export async function recordOwnedMetaFailure(args: { id: string; runId: string; batchId?: string; brand?: MetaBrand; error: unknown; startedAt: string; run: boolean; trigger: string }): Promise<{ message: string; status: number; detail?: ReturnType<typeof detailOf> }> {
  const detail=detailOf(args.error)
  if (detail && args.batchId) {
    await ownedMetaStore().update(args.id,r=>{
      if(r.batch.id!==args.batchId || r.batch.claim && r.batch.claim!==args.runId) return {result:null}
      const job=r.batch.jobs[detail.destination]
      if(job.lastError && Date.parse(job.lastError.at)>Date.parse(detail.at)) return {result:null}
      job.lastError=detail
      return {next:r,result:null}
    }).catch(()=>{})
  }
  if (args.run) {
    const finishedAt=new Date().toISOString()
    await recordCronRun({job:"owned-meta-publish",startedAt:args.startedAt,finishedAt,durationMs:Date.parse(finishedAt)-Date.parse(args.startedAt),status:"error",message:"Publisher stopped; inspect saved state before retrying",detail:{postId:args.id,runId:args.runId,trigger:args.trigger,...(args.batchId?{batchId:args.batchId}:{}),...(detail?{providerError:detail}:{})}})
  }
  if(args.error instanceof MetaPermissionError && args.brand) await blockOwnedMetaPermission(args.brand)
  const message=args.error instanceof MetaBlocked || args.error instanceof MetaPermissionError ? args.error.message : "Publisher failed; inspect saved state before retrying"
  return { message, status: args.error instanceof MetaPermissionError?403:args.error instanceof MetaBlocked?409:500, ...(detail?{detail}:{}) }
}
function detailOf(error: unknown) { return error instanceof MetaBlocked || error instanceof MetaPermissionError ? error.detail : undefined }

/** GET-only credential/connection health for one post's brand. No persistence, no mutation. */
export async function ownedMetaHealth(id: string) {
  const { checkOwnedMetaConnection } = await import("@/lib/owned-meta-connection")
  const { getOwnedMetaPublishingConfig } = await import("@/lib/instagram-config")
  const record = await ownedMetaStore().read(id), brand = record.batch.manifest.brand
  let config: ReturnType<typeof getOwnedMetaPublishingConfig>
  try { config = getOwnedMetaPublishingConfig(brand) } catch { return { brand, credential: "missing_or_unverified" as const } }
  const permissionBlocked = await ownedMetaPermissionBlocked(brand, config.evidence.verifiedAt)
  const report = await checkOwnedMetaConnection({ batch: record.batch, config, runtime: { globalEnabled: await ownedMetaDeploymentEnabled(), brandEnabled: await ownedMetaBrandEnabled(brand), permissionBlocked } })
  const { credentialState } = await import("@/lib/owned-meta-tool")
  return { brand, credential: credentialState(report), permissionBlocked, evidenceVerifiedAt: config.evidence.verifiedAt, report }
}

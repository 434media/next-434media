import { z } from "zod"
import { NextResponse, type NextRequest } from "next/server"
import { getSession, isAuthorizedAdmin, canSend, isCrmSuperAdmin } from "@/lib/auth"
import { createOwnedMetaDraft, getContentPostById, ownedMetaStore, blockOwnedMetaPermission, ownedMetaPermissionBlocked } from "@/lib/firestore-crm"
import { runOwnedMeta, resetUnpublishedPreparation, assertOperatorSettlement, confirmStoppedRun, MetaBlocked, MetaPermissionError, META_BRANDS, type MetaBrand, type MetaManifest, type MetaAsset } from "@/lib/owned-meta-publisher"
import { readTrustedAsset, assetDigest, verifyAssetBytes, uploadApprovedAsset, getMetaUploadAccessToken, measureExport } from "@/lib/owned-meta-upload"
import { createMetaProvider } from "@/lib/instagram-publishing"
import { recordCronRun } from "@/lib/cron-auth"

const actionBody = z.object({
  action: z.enum(["prepare", "execute", "reconcile", "manual-confirm", "confirm-stopped-run", "reset-preparation", "release-preparation"]),
  brand: z.enum(META_BRANDS).optional(), format: z.enum(["still", "carousel", "video"]).optional(),
  captions: z.object({ instagram: z.string(), facebook: z.string() }).optional(),
  placements: z.object({ instagram: z.enum(["feed", "reels"]), facebook: z.enum(["feed", "video", "reels"]) }).optional(),
  instagramShareToFeed: z.boolean().optional(), aiGenerated: z.boolean().optional(), publicHostingApproved: z.boolean().optional(),
  templateRevision: z.string().default("unknown"), batchId: z.string().default(""), hash: z.string().default(""),
  destination: z.enum(["instagram", "facebook"]).optional(), remoteId: z.string().default(""), permalink: z.string().default(""),
  expectedClaim: z.string().default(""), evidence: z.string().default(""), confirmExact: z.boolean().default(false), confirmTerminated: z.boolean().default(false),
})

export const runtime = "nodejs"
// This route is unusable on previews even if they share production Firestore.
function deploymentEnabled() { return process.env.VERCEL_ENV === "production" && process.env.OWNED_META_PUBLISHING_ENABLED === "true" }
function brandEnabled(brand: MetaBrand) { return deploymentEnabled() && process.env[`OWNED_META_ENABLED_${brand.toUpperCase()}`] === "true" }
function sourceOrigins() { return (process.env.OWNED_META_SOURCE_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean) }
async function authorize() {
  const session=await getSession()
  if (!session) return { error:"Unauthorized",status:401 as const }
  if (!isAuthorizedAdmin(session.email) || !canSend(session.role) && !await isCrmSuperAdmin(session.email)) return { error:"Publishing role required",status:403 as const }
  return { session }
}
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({enabled:false})
  const auth=await authorize(); if ("error" in auth) return NextResponse.json({error:auth.error},{status:auth.status})
  const {id}=await ctx.params
  try {
    const r=await ownedMetaStore().read(id)
    const index=req.nextUrl.searchParams.get("asset")
    if(index!==null){
      const i=Number(index),a=r.batch.manifest.assets[i]
      if(!Number.isInteger(i)||!a||req.nextUrl.searchParams.get("hash")!==r.batch.hash)throw new MetaBlocked("Review asset changed")
      const post=await getContentPostById(id),source=post?.assets[i]
      if(!source)throw new MetaBlocked("Review source unavailable")
      const bytes=await readTrustedAsset(source.url,sourceOrigins());verifyAssetBytes(a,bytes)
      let offset=0
      const stream=new ReadableStream<Uint8Array>({pull(controller){if(offset>=bytes.length){controller.close();return}controller.enqueue(bytes.subarray(offset,offset+64*1024));offset+=64*1024}})
      return new Response(stream,{headers:{"content-type":a.mime,"cache-control":"private, no-store","x-content-type-options":"nosniff"}})
    }
    return NextResponse.json({enabled:deploymentEnabled(),batch:r.batch,archived:r.archived})
  }
  catch { return NextResponse.json({enabled:deploymentEnabled(),batch:null,error:"Review unavailable"},{status:404}) }
}
export async function POST(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({error:"Previews cannot write publisher data"},{status:423})
  const auth=await authorize(); if ("error" in auth) return NextResponse.json({error:auth.error},{status:auth.status})
  const {id}=await ctx.params
  let body:z.infer<typeof actionBody>
  try { body=actionBody.parse(await req.json()) } catch { return NextResponse.json({error:"Invalid JSON"},{status:400}) }
  if (!deploymentEnabled() && !["reconcile","manual-confirm","confirm-stopped-run"].includes(body.action)) return NextResponse.json({error:"Publisher disabled"},{status:423})
  const startedAt=new Date().toISOString(),runId=crypto.randomUUID()
  let brand:MetaBrand|undefined
  try {
    if (body.action === "prepare") {
      brand=body.brand
      if (!brand || !META_BRANDS.includes(brand) || !brandEnabled(brand)) throw new MetaBlocked("Brand is disabled")
      if (!body.format || !body.captions || !body.placements || typeof body.aiGenerated!=="boolean" || typeof body.instagramShareToFeed!=="boolean" || typeof body.publicHostingApproved!=="boolean") throw new MetaBlocked("Complete review choices required")
      const post=await getContentPostById(id)
      if (!post || post.archived || !post.assets.length) throw new MetaBlocked("Save the approved export references on the content post first")
      const {getOwnedMetaIdentity}=await import("@/lib/instagram-config")
      const assets:MetaAsset[]=[]
      for (const [i,a] of post.assets.entries()) {
        const bytes=await readTrustedAsset(a.url,sourceOrigins())
        const measured=measureExport(bytes)
        assets.push({name:`export-${i+1}`,sha256:assetDigest(bytes),size:bytes.byteLength,...measured,provenance:{source:a.source || "unknown",templateRevision:body.templateRevision || "unknown",generator:a.model || "unknown",metadata:"unverified"}})
        verifyAssetBytes(assets[i],bytes)
      }
      const manifest:Omit<MetaManifest,"revision">={schema:1,brand,format:body.format,assets,captions:body.captions,destinations:getOwnedMetaIdentity(brand),placements:body.placements,instagramShareToFeed:body.instagramShareToFeed,aiGenerated:body.aiGenerated,publicHostingApproved:body.publicHostingApproved}
      const batch=await createOwnedMetaDraft(id,manifest)
      return NextResponse.json({batch})
    }
    const store=ownedMetaStore(),record=await store.read(id)
    brand=record.batch.manifest.brand
    if (body.batchId!==record.batch.id || body.hash!==record.batch.hash) throw new MetaBlocked("Displayed batch changed; reload before acting")
    if(body.action === "confirm-stopped-run") {
      if(!await isCrmSuperAdmin(auth.session.email) || body.confirmTerminated!==true || typeof body.evidence!=="string")throw new MetaBlocked("Super-admin must confirm observed run termination, not elapsed time")
      await store.update(id,r=>{if(r.batch.id!==record.batch.id)throw new MetaBlocked("Revision changed");confirmStoppedRun(r,body.expectedClaim,auth.session.email,body.evidence,new Date().toISOString());return{next:r,result:null}})
      return NextResponse.json({batch:(await store.read(id)).batch})
    }
    if (body.action === "manual-confirm") {
      if (!await isCrmSuperAdmin(auth.session.email) || body.confirmExact !== true || !/^\d+(?:_\d+)?$/.test(body.remoteId || "")) throw new MetaBlocked("Exact-post super-admin confirmation required")
      const d=body.destination
      if (d!=="instagram" && d!=="facebook") throw new MetaBlocked("Destination required")
      const url=new URL(body.permalink),host=d==="instagram"?"instagram.com":"facebook.com"
      if (url.protocol!=="https:" || ![host,`www.${host}`].includes(url.hostname)) throw new MetaBlocked("Platform permalink required")
      await store.update(id,r=>{
        assertOperatorSettlement(r,record.batch.id)
        const j=r.batch.jobs[d]
        if (r.batch.id!==record.batch.id || !r.batch.approval || j.status==="verified" || j.status==="operator_confirmed" || (!j.finalIntent && j.status!=="manual_required")) throw new MetaBlocked("This job is not awaiting exact-post manual evidence")
        j.status="operator_confirmed";j.remoteId=body.remoteId;j.permalink=url.toString();j.verifiedAt=new Date().toISOString()
        j.manualEvidence={by:auth.session.email,at:j.verifiedAt,approvedHash:r.batch.hash,confirmation:"Operator inspected this exact published account, exports, item order, captions and required AI label; not API verification"}
        r.batch.claim=null
        return {next:r,result:null}
      })
      return NextResponse.json({batch:(await store.read(id)).batch})
    }
    if (body.action === "reset-preparation") {
      const d=body.destination
      if(d!=="instagram"&&d!=="facebook")throw new MetaBlocked("Destination required")
      await store.event(id,record.batch.id,{kind:"operator_reset_unpublished_preparation",destination:d,runId,at:new Date().toISOString(),preparation:record.batch.jobs[d].preparation})
      await store.update(id,r=>{if(r.batch.id!==body.batchId)throw new MetaBlocked("Batch changed");resetUnpublishedPreparation(r,d);return{next:r,result:null}})
      return NextResponse.json({batch:(await store.read(id)).batch})
    }
    const {getOwnedMetaPublishingConfig}=await import("@/lib/instagram-config")
    // Reconciliation can run with a disabled brand, but never in preview; use the existing credential only.
    const config=getOwnedMetaPublishingConfig(brand,body.action==="reconcile" ? {...process.env,OWNED_META_PUBLISHING_ENABLED:"true",[`OWNED_META_ENABLED_${brand.toUpperCase()}`]:"true"} : process.env)
    const localEnabled=async () => brandEnabled(brand!) && !await ownedMetaPermissionBlocked(brand!,config.evidence.verifiedAt)
    const provider=createMetaProvider({accessToken:config.accessToken,evidence:config.evidence,beforeMutation:async()=>{if (!await localEnabled()) throw new MetaBlocked("Brand disabled or permission check required"); const r=await store.read(id);if(r.archived || r.batch.revoked || r.batch.id!==record.batch.id || r.batch.claim!==runId) throw new MetaBlocked("Current claim required")}})
    if (body.action==="reconcile") {
      const d=body.destination
      if (d!=="instagram" && d!=="facebook") throw new MetaBlocked("Destination required")
      assertOperatorSettlement(record,record.batch.id)
      const job=record.batch.jobs[d]
      const remoteId=job.remoteId
      if (!remoteId || !/^\d+(?:_\d+)?$/.test(remoteId)) throw new MetaBlocked("No persisted final ID; use the exact-post manual evidence action for an unknown outcome")
      const result=await provider.verify(record.batch.manifest,d,remoteId)
      if (!result.verified || !result.permalink) throw new MetaBlocked(result.blocker || "Remote result is not verified; do not retry publishing")
      await store.update(id,r=>{assertOperatorSettlement(r,record.batch.id);r.batch.jobs[d]={...r.batch.jobs[d],remoteId,status:"verified",permalink:result.permalink,verifiedAt:new Date().toISOString()}; r.batch.claim=null;return{next:r,result:null}})
      return NextResponse.json({batch:(await store.read(id)).batch})
    }
    if (body.action==="release-preparation") {
      // Explicit recovery only. An old worker loses its claim and cannot checkpoint/finalize.
      await store.update(id,r=>{if(r.batch.id!==body.batchId || r.batch.claim!==body.expectedClaim || Object.values(r.batch.jobs).some(j=>j.finalIntent))throw new MetaBlocked("Cannot release a final-publication claim");r.batch.claim=null;return{next:r,result:null}})
      return NextResponse.json({batch:(await store.read(id)).batch})
    }
    if (body.action!=="execute") throw new MetaBlocked("Unknown action")
    const post=await getContentPostById(id)
    if (!post) throw new MetaBlocked("Content unavailable")
    let uploadToken:Promise<string>|undefined
    const batch=await runOwnedMeta({id,runId,store,provider,enabled:localEnabled,upload:async b=>{
      if (!await localEnabled()) throw new MetaBlocked("Brand disabled")
      const urls:string[]=[]
      for (let i=0;i<b.manifest.assets.length;i++) {
        const a=b.manifest.assets[i], source=post.assets[i]
        if (!source) throw new MetaBlocked("Export source missing")
        const bytes=await readTrustedAsset(source.url,sourceOrigins());verifyAssetBytes(a,bytes)
        if (!await localEnabled() || (await store.read(id)).archived) throw new MetaBlocked("Publishing stopped before public upload")
        urls.push(await uploadApprovedAsset({batch:b,asset:a,bytes,accessToken:()=>uploadToken ||= getMetaUploadAccessToken()}))
      }
      return urls
    }})
    const finishedAt=new Date().toISOString(),complete=Object.values(batch.jobs).every(j=>j.status==="verified"||j.status==="operator_confirmed")
    await recordCronRun({job:"owned-meta-publish",startedAt,finishedAt,durationMs:Date.parse(finishedAt)-Date.parse(startedAt),status:complete?"success":"partial",message:complete?"Both destinations complete; inspect per-job evidence type":"Operator continuation required",detail:{postId:id,batchId:batch.id,runId,evidence:{instagram:batch.jobs.instagram.status,facebook:batch.jobs.facebook.status}}})
    return NextResponse.json({batch})
  } catch(error) {
    if(error instanceof MetaPermissionError && brand) await blockOwnedMetaPermission(brand)
    const message=error instanceof MetaBlocked || error instanceof MetaPermissionError ? error.message : "Publisher failed; inspect saved state before retrying"
    return NextResponse.json({error:message},{status:error instanceof MetaPermissionError?403:error instanceof MetaBlocked?409:500})
  }
}

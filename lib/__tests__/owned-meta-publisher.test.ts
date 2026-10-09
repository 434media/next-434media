/** Offline only. Run with tsx --test; all transport/persistence is injected. */
import { test } from "node:test"
import assert from "node:assert/strict"
import { draftBatch, manifestHash, dryRun, resetUnpublishedPreparation, assertOperatorSettlement, confirmStoppedRun, runtimePublishingEnabled, validateMetaMutationBoundary, runOwnedMeta, guardedContentUpdate, type MetaManifest, type MetaRecord, type MetaStore, type MetaProvider, type MetaDestination } from "../owned-meta-publisher"
import { createMetaProvider, checkMetaCapability, type MetaPublishingEvidence } from "../instagram-publishing"
import { assetDigest, assertApprovedBlobUrl, verifyAssetBytes, readTrustedAsset, measureExport } from "../owned-meta-assets"

const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,4,56,0,0,5,70])
function manifest(format:MetaManifest["format"]="still",ai=false):MetaManifest {
  const asset={name:"test.png",url:"https://approved.public.blob.vercel-storage.com/content-posts/12345678-1234-1234-1234-123456789abc.png",sha256:assetDigest(png),size:png.length,mime:"image/jpeg" as const,width:1080,height:1350,provenance:{source:"test",templateRevision:"v1",generator:"none",metadata:"unverified" as const}}
  return {schema:1,revision:1,brand:"milcity",format,assets:format==="carousel"?[asset,{...asset,name:"second.png"}]:format==="video"?[{...asset,mime:"video/mp4",duration:5,width:1080,height:1920}]:[asset],captions:{instagram:"IG exact",facebook:"FB exact"},destinations:{appId:"1",pageId:"2",instagramId:"3",apiVersion:"v26.0"},placements:{instagram:format==="video"?"reels":"feed",facebook:format==="video"?"reels":"feed"},instagramShareToFeed:false,aiGenerated:ai,publicHostingApproved:true}
}
function record(m=manifest()):MetaRecord {const batch=draftBatch("batch-1",m);batch.approval={by:"reviewer@example.test",at:"2026-10-09T00:00:00Z",hash:batch.hash};return{archived:false,revision:1,batch}}
class Store implements MetaStore {
  value:MetaRecord; version=0; conflicts=0; events:unknown[]=[]
  constructor(r=record()){this.value=structuredClone(r)}
  async read(){return structuredClone(this.value)}
  async update<T>(_id:string,fn:(r:MetaRecord)=>{next?:MetaRecord;result:T}):Promise<T>{for(;;){const version=this.version,{next,result}=fn(structuredClone(this.value));await new Promise(r=>setImmediate(r));if(version!==this.version){this.conflicts++;continue}if(next){this.value=next;this.version++}return result}}
  async event(...args:unknown[]){this.events.push(args)}
}
function fakeProvider(options:{failFinal?:MetaDestination;notReady?:MetaDestination}={}):MetaProvider&{calls:string[]} {const calls:string[]=[];return {calls,preflight:()=>null,prepare:async(_m,d,_u,p,save)=>{calls.push(`prepare:${d}`);await save("container",d==="instagram"?"11":"22");return{ready:options.notReady!==d,preparation:{...p,container:d==="instagram"?"11":"22"}}},publish:async(_m,d)=>{calls.push(`publish:${d}`);if(d===options.failFinal)throw new Error("lost response");return d==="instagram"?"101":"202"},verify:async(_m,d)=>({verified:true,permalink:`https://www.${d}.com/p/verified`})}}
const run=(store:Store,provider:MetaProvider,runId="r",enabled=true)=>runOwnedMeta({id:"p",runId,store,provider,enabled:async()=>enabled,resolveAssets:async b=>b.manifest.assets.map(a=>a.url),now:()=>"2026-10-09T00:00:00Z"})
function evidence(m:MetaManifest):MetaPublishingEvidence{return{verifiedAt:"2026-10-09T00:00:00Z",credentialKind:"system_user_page",appId:m.destinations.appId,pageId:m.destinations.pageId,instagramId:m.destinations.instagramId}}


test("disabled and pure dry-run perform zero external effects",async()=>{const s=new Store(),p=fakeProvider();assert.equal(dryRun(s.value).hash,s.value.batch.hash);await assert.rejects(run(s,p,"r",false),/disabled/);assert.deepEqual(p.calls,[]);assert.equal(s.version,0)})
test("hash binds both captions, account, item order, AI flag and feed-sharing option",()=>{const m=manifest("carousel"),h=manifestHash(m);for(const change of [(x:MetaManifest)=>x.captions.facebook="changed",(x:MetaManifest)=>x.destinations.pageId="99",(x:MetaManifest)=>x.assets.reverse(),(x:MetaManifest)=>x.aiGenerated=true,(x:MetaManifest)=>x.instagramShareToFeed=true]){const x=structuredClone(m);change(x);assert.notEqual(manifestHash(x),h)}})
test("legacy status or changed approval cannot qualify",()=>{const r=record();delete r.batch.approval;assert.throws(()=>dryRun(r),/approval/);const edited=record();edited.batch.manifest.captions.instagram="new";assert.throws(()=>dryRun(edited),/approval/)})
test("one transaction claim defeats simultaneous clicks",async()=>{const s=new Store(),p=fakeProvider();const result=await Promise.allSettled([run(s,p,"a"),run(s,p,"b")]);assert.equal(result.filter(x=>x.status==="rejected").length,1);assert.equal(p.calls.filter(x=>x==="publish:instagram").length,1);assert.equal(p.calls.filter(x=>x==="publish:facebook").length,1);assert.ok(s.conflicts>0)})
test("unknown final outcome never resends; successful other destination remains untouched",async()=>{const s=new Store(),p=fakeProvider({failFinal:"instagram"});await run(s,p);await run(s,p,"again");assert.equal(p.calls.filter(x=>x==="publish:instagram").length,1);assert.equal(p.calls.filter(x=>x==="publish:facebook").length,1);assert.equal(s.value.batch.jobs.instagram.status,"needs_reconciliation");assert.equal(s.value.batch.jobs.facebook.status,"verified")})
test("processing is explicitly resumed; known container is checkpointed",async()=>{const s=new Store(),p=fakeProvider({notReady:"instagram"});await run(s,p);assert.equal(s.value.batch.jobs.instagram.preparation.container,"11");assert.equal(s.value.batch.jobs.instagram.status,"processing");assert.equal(s.value.batch.claim,null);assert.ok(!p.calls.includes("publish:instagram"))})
test("archive between preparation and final dispatch prevents publication",async()=>{const s=new Store(),p=fakeProvider();const original=p.prepare;p.prepare=async(...args)=>{const r=await original(...args);s.value.archived=true;return r};await assert.rejects(run(s,p));assert.ok(!p.calls.some(x=>x.startsWith("publish:")));assert.equal(s.value.batch.approval?.by,"reviewer@example.test")})
test("generic writer cannot forge fields; relevant edits invalidate and started work freezes",()=>{assert.throws(()=>guardedContentUpdate({}, {owned_meta:{}}),/server-owned/);assert.deepEqual(guardedContentUpdate({owned_meta:{started:false},owned_meta_revision:1,social_copy:"a"},{social_copy:"b"}),{social_copy:"b",owned_meta_revision:2,owned_meta:null,status:"needs_approval"});assert.throws(()=>guardedContentUpdate({owned_meta:{started:true},assets:[]},{assets:[{}]}),/frozen/);assert.deepEqual(guardedContentUpdate({owned_meta:{started:true}},{comments:[]}),{comments:[]})})
test("all six platform/format capabilities remain represented; AI FB photo alone holds",()=>{for(const format of ["still","carousel","video"] as const){const m=manifest(format);for(const d of ["instagram","facebook"] as const)assert.equal(checkMetaCapability(m,d,evidence(m)),null)}const m=manifest("still",true);assert.equal(checkMetaCapability(m,"instagram",evidence(m)),null);assert.match(checkMetaCapability(m,"facebook",evidence(m))!,/manual/);const wrong=evidence(m);wrong.pageId="4";assert.match(checkMetaCapability(m,"instagram",wrong)!,/verification/)})
test("reviewed numeric limits cannot be raised by environment evidence",()=>{const m=manifest();m.assets[0].size=8_000_001;assert.match(checkMetaCapability(m,"instagram",Object.assign(evidence(m),{formats:{maxBytes:1e12}}))!,/8 MB/);const carousel=manifest("carousel");carousel.assets=Array.from({length:11},()=>carousel.assets[0]);assert.match(checkMetaCapability(carousel,"instagram",evidence(carousel))!,/10 carousel/);const reel=manifest("video");reel.assets[0].duration=91;assert.match(checkMetaCapability(reel,"facebook",evidence(reel))!,/3–90/)})
test("existing Blob URL is reused with exact bytes; there is no upload operation",async()=>{const a={...manifest().assets[0],mime:"image/png" as const};let requests=0;const fetcher=(async(_url:unknown,init?:RequestInit)=>{requests++;assert.equal(init?.redirect,"error");assert.notEqual(init?.method,"POST");return new Response(png)}) as typeof fetch;const url=assertApprovedBlobUrl(a.url,["https://approved.public.blob.vercel-storage.com"]);verifyAssetBytes(a,await readTrustedAsset(url,["https://approved.public.blob.vercel-storage.com"],fetcher));assert.equal(url,a.url);assert.equal(requests,1)})
test("wrong Blob store, redirects and changed bytes fail closed",async()=>{const a={...manifest().assets[0],mime:"image/png" as const};assert.throws(()=>assertApprovedBlobUrl(a.url,["https://other.public.blob.vercel-storage.com"]),/approved-store/);assert.throws(()=>assertApprovedBlobUrl("https://approved.public.blob.vercel-storage.com/content-posts/mutable.png",["https://approved.public.blob.vercel-storage.com"]),/UUID/);assert.throws(()=>verifyAssetBytes(a,Buffer.from("wrong")),/changed/);let calls=0;await assert.rejects(readTrustedAsset("http://127.0.0.1/private",[],(async()=>{calls++;return new Response()}) as typeof fetch));assert.equal(calls,0)})
test("actual PNG dimensions are measured from bytes",()=>{assert.deepEqual(measureExport(png),{mime:"image/png",width:1080,height:1350})})

test("IG carousel AI flag goes on parent only; non-AI omits it",async()=>{for(const ai of [false,true]){const m=manifest("carousel",ai),calls:{path:string;body:URLSearchParams}[]=[];let n=10;const provider=createMetaProvider({accessToken:"fake",evidence:evidence(m),beforeMutation:async()=>{},fetcher:(async(url,init)=>{if(init?.method==="POST"){calls.push({path:new URL(String(url)).pathname,body:new URLSearchParams(init.body as URLSearchParams)});return Response.json({id:String(n++)})}return Response.json({status_code:"FINISHED"})}) as typeof fetch});await provider.prepare(m,"instagram",["https://example.test/a","https://example.test/b"],{},async()=>{});assert.equal(calls.length,3);assert.equal(calls[0].body.has("is_ai_generated"),false);assert.equal(calls[1].body.has("is_ai_generated"),false);assert.equal(calls[2].body.get("is_ai_generated"),ai?"true":null)}})
test("FB still and multi-photo endpoints are final publishing; preparation is unpublished",async()=>{for(const format of ["still","carousel"] as const){const m=manifest(format),calls:{path:string;body:URLSearchParams}[]=[];let n=10;const provider=createMetaProvider({accessToken:"fake",evidence:evidence(m),beforeMutation:async()=>{},fetcher:(async(url,init)=>{calls.push({path:new URL(String(url)).pathname,body:new URLSearchParams(init?.body as URLSearchParams)});return Response.json({id:String(n++),post_id:"2_55"})}) as typeof fetch});const prepared=await provider.prepare(m,"facebook",m.assets.map(()=>"https://example.test/a"),{},async()=>{});assert.equal(calls.length,format==="still"?0:2);for(const call of calls)assert.equal(call.body.get("published"),"false");await provider.publish(m,"facebook",["https://example.test/a"],prepared.preparation);assert.ok(calls.at(-1)!.path.endsWith(format==="still"?"/photos":"/feed"));if(format==="still")assert.equal(calls.at(-1)!.body.get("published"),"true")}})
test("verification requires membership in exact account published collection",async()=>{const m=manifest();const provider=createMetaProvider({accessToken:"fake",evidence:evidence(m),beforeMutation:async()=>{throw Error("must not mutate")},fetcher:(async()=>Response.json({data:[]})) as typeof fetch});assert.equal((await provider.verify(m,"facebook","2_55")).verified,false)})

test("late preparation cannot dispatch after operator releases/reclaims its claim",async()=>{const s=new Store(),p=fakeProvider();const original=p.prepare;p.prepare=async(...args)=>{const out=await original(...args);s.value.batch.claim="replacement";return out};await assert.rejects(run(s,p),/Claim changed/);assert.ok(!p.calls.some(x=>x.startsWith("publish:")));assert.equal(s.value.batch.claim,"replacement")})
test("disable after preparation prevents final publication",async()=>{const s=new Store(),p=fakeProvider();let enabled=true;const original=p.prepare;p.prepare=async(...args)=>{const out=await original(...args);enabled=false;return out};await assert.rejects(runOwnedMeta({id:"p",runId:"r",store:s,provider:p,enabled:async()=>enabled,resolveAssets:async()=>["https://example.test/a"]}),/disabled/);assert.ok(!p.calls.some(x=>x.startsWith("publish:")))})
test("safe preparation failure on IG does not prevent Facebook progress",async()=>{const s=new Store(),p=fakeProvider();const original=p.prepare;p.prepare=async(...args)=>{if(args[1]==="instagram")throw Error("expired container");return original(...args)};await run(s,p);assert.equal(s.value.batch.jobs.instagram.status,"manual_required");assert.equal(s.value.batch.jobs.facebook.status,"verified")})
test("operator-confirmed manual job never publishes again",async()=>{const r=record();r.batch.jobs.facebook.status="operator_confirmed";r.batch.jobs.facebook.remoteId="2_77";const s=new Store(r),p=fakeProvider();await run(s,p);assert.ok(!p.calls.includes("publish:facebook"));assert.equal(s.value.batch.jobs.facebook.remoteId,"2_77")})
test("MP4 dimensions and duration are read from boxes rather than supplied values",()=>{const box=(kind:string,payload:Buffer)=>{const h=Buffer.alloc(8);h.writeUInt32BE(payload.length+8);h.write(kind,4);return Buffer.concat([h,payload])};const tkhd=Buffer.alloc(84);tkhd.writeInt32BE(65536,40);tkhd.writeInt32BE(65536,56);tkhd.writeUInt32BE(1080*65536,76);tkhd.writeUInt32BE(1920*65536,80);const hdlr=Buffer.alloc(12);hdlr.write("vide",8);const mdhd=Buffer.alloc(24);mdhd.writeUInt32BE(1000,12);mdhd.writeUInt32BE(5875,16);const mp4=Buffer.concat([box("ftyp",Buffer.from("isom0000")),box("moov",box("trak",Buffer.concat([box("tkhd",tkhd),box("mdia",Buffer.concat([box("hdlr",hdlr),box("mdhd",mdhd)]))])))]);assert.deepEqual(measureExport(mp4),{mime:"video/mp4",width:1080,height:1920,duration:5.875});assert.throws(()=>measureExport(mp4.subarray(0,30)),/MP4|metadata/)})
test("Facebook video request preserves conditional AI label; policy can hold unsupported placements",async()=>{for(const ai of [false,true]){const m=manifest("video",ai);m.placements.facebook="video";let request:URLSearchParams|undefined;const p=createMetaProvider({accessToken:"fake",evidence:evidence(m),beforeMutation:async()=>{},fetcher:(async(_u,init)=>{request=new URLSearchParams(init?.body as URLSearchParams);return Response.json({id:"55"})}) as typeof fetch});await p.publish(m,"facebook",["https://example.test/video"],{});assert.equal(request?.get("is_ai_generated"),ai?"true":null);assert.equal(request?.get("published"),"true")}})


test("manual completion cannot be reset into a duplicate publish",async()=>{const r=record();r.batch.jobs.facebook={status:"operator_confirmed",preparation:{},remoteId:"2_88",manualEvidence:{by:"reviewer",at:"now",approvedHash:r.batch.hash,confirmation:"exact post"}};assert.throws(()=>resetUnpublishedPreparation(r,"facebook"),/completed/);const s=new Store(r),p=fakeProvider();await run(s,p);assert.ok(!p.calls.includes("publish:facebook"))})
test("operator settlement cannot clear an active run's claim",()=>{const r=record();r.batch.claim="active";assert.throws(()=>assertOperatorSettlement(r,r.batch.id),/active run/);assert.equal(r.batch.claim,"active")})


test("crashed final claim requires observed termination and preserves intent",()=>{const r=record();r.batch.claim="dead";r.batch.jobs.instagram.finalIntent={id:"dead:instagram",at:"then"};assert.throws(()=>confirmStoppedRun(r,"dead","reviewer","waiting","now"),/evidence/);confirmStoppedRun(r,"dead","reviewer","Runtime invocation confirmed terminated in run log","now");assert.equal(r.batch.claim,null);assert.equal(r.batch.jobs.instagram.finalIntent.id,"dead:instagram");assert.equal(r.batch.stoppedRuns?.[0].by,"reviewer")})
test("delayed old final response is retained but cannot dispatch another destination",async()=>{const s=new Store(),p=fakeProvider();const original=p.publish;p.publish=async(...args)=>{const id=await original(...args);await s.update("p",r=>{confirmStoppedRun(r,"r","reviewer","Observed request termination recorded by operator","now");return{next:r,result:null}});return id};await run(s,p);assert.equal(s.value.batch.jobs.instagram.remoteId,"101");assert.ok(!p.calls.includes("publish:facebook"));assert.ok(s.events.some(e=>JSON.stringify(e).includes("remote_final_observed")))})


test("auxiliary observation logging failure does not lose a known final ID",async()=>{const s=new Store(),p=fakeProvider();s.event=async(...args:unknown[])=>{if(JSON.stringify(args).includes("remote_final_observed"))throw Error("log unavailable")};await run(s,p);assert.equal(s.value.batch.jobs.instagram.remoteId,"101");assert.equal(s.value.batch.jobs.instagram.status,"verified");assert.equal(s.value.batch.jobs.facebook.remoteId,"202")})

test("actual preview handlers stop before authentication, storage and provider work",async()=>{
  const previous=process.env
  process.env={NODE_ENV:"test",VERCEL_ENV:"preview"}
  try {
    const route=await import("../../app/api/admin/crm/content-posts/[id]/owned-meta/route")
    const ctx={params:Promise.resolve({id:"offline-preview-test"})}
    const get=await route.GET(new Request("http://localhost/offline") as never,ctx)
    const post=await route.POST(new Request("http://localhost/offline",{method:"POST",body:'{"action":"execute"}'}) as never,ctx)
    assert.equal(get.status,200);assert.deepEqual(await get.json(),{enabled:false})
    assert.equal(post.status,423)
  } finally {process.env=previous}
})


test("runtime kill state is fail-closed globally and per brand",()=>{assert.equal(runtimePublishingEnabled(undefined,"milcity"),false);assert.equal(runtimePublishingEnabled({enabled:true},"milcity"),false);assert.equal(runtimePublishingEnabled({enabled:true,brands:{milcity:true}},"milcity"),true);assert.equal(runtimePublishingEnabled({enabled:false,brands:{milcity:true}},"milcity"),false)})
test("existing manual posted records and generation fields are unchanged",()=>{const updates={status:"posted",published_url:"https://www.instagram.com/p/manual",posted_at:"now",comments:[]};assert.deepEqual(guardedContentUpdate({status:"approved"},updates),updates);const generated={assets:[],generation_status:"completed",generation_request_id:"existing-job"};assert.deepEqual(guardedContentUpdate({},generated),generated)})
test("publishing credentials have no analytics-token fallback",async()=>{const previous=process.env;process.env={NODE_ENV:"test"};try{const {getOwnedMetaPublishingConfig}=await import("../instagram-config");const m=manifest(),env={VERCEL_ENV:"production",INSTAGRAM_APP_ID:"1",FACEBOOK_PAGE_ID_MILCITY:"2",INSTAGRAM_BUSINESS_ACCOUNT_ID_MILCITY:"3",INSTAGRAM_ACCESS_TOKEN_MILCITY:"fake-analytics-token",OWNED_META_EVIDENCE_MILCITY:JSON.stringify(evidence(m))};assert.throws(()=>getOwnedMetaPublishingConfig("milcity",env),/credential/);assert.equal(getOwnedMetaPublishingConfig("milcity",{...env,OWNED_META_TOKEN_MILCITY:"fake-publishing-token"}).accessToken,"fake-publishing-token");assert.throws(()=>getOwnedMetaPublishingConfig("milcity",{...env,OWNED_META_TOKEN_MILCITY:"fake",OWNED_META_EVIDENCE_MILCITY:JSON.stringify({...evidence(m),formats:{}})}),/evidence/)}finally{process.env=previous}})

test("Firestore runtime switch is reread each time and read failures disable",async()=>{const previous=process.env;process.env={NODE_ENV:"test",VERCEL_ENV:"production"};try{const {ownedMetaRuntimeEnabled}=await import("../firestore-crm");let reads=0;const read=async()=>{reads++;if(reads===3)throw Error("unavailable");return{enabled:true,brands:{milcity:reads===1}}};assert.equal(await ownedMetaRuntimeEnabled("milcity",read),true);assert.equal(await ownedMetaRuntimeEnabled("milcity",read),false);assert.equal(await ownedMetaRuntimeEnabled("milcity",read),false);assert.equal(reads,3)}finally{process.env=previous}})
test("cached asset URLs are still revalidated on manual resume",async()=>{const s=new Store(),p=fakeProvider({notReady:"instagram"});let reads=0;const execute=()=>runOwnedMeta({id:"p",runId:"r"+reads,store:s,provider:p,enabled:async()=>true,resolveAssets:async b=>{reads++;return b.manifest.assets.map(a=>a.url)}});await execute();await execute();assert.equal(reads,2)})


test("archive or stopped claim during byte verification prevents dispatch",async()=>{for(const change of [(r:MetaRecord)=>{r.archived=true},(r:MetaRecord)=>{r.batch.claim=null}]){const r=record();r.batch.claim="r";let dispatched=false;await assert.rejects(async()=>{await validateMetaMutationBoundary({enabled:async()=>true,read:async()=>structuredClone(r),batchId:r.batch.id,runId:"r",verify:async()=>change(r)});dispatched=true});assert.equal(dispatched,false)}})

// Connection diagnostics share the production credential boundary, but no write capability.
test("connection check is GET-only, bounded, and leaves uncertain publication untouched",async()=>{
  const {checkOwnedMetaConnection}=await import("../owned-meta-connection")
  const r=record();r.batch.jobs.instagram.preparation.container="11";r.batch.jobs.instagram.status="processing"
  r.batch.jobs.facebook.status="needs_reconciliation";r.batch.jobs.facebook.finalIntent={id:"prior:facebook",at:"2026-10-09T17:11:03Z"}
  const before=JSON.stringify(r),calls:string[]=[]
  const result=await checkOwnedMetaConnection({batch:r.batch,config:{...r.batch.manifest.destinations,accessToken:"fake-private-token"},runtime:{globalEnabled:false,brandEnabled:false,permissionBlocked:true},fetcher:(async(url,init)=>{
    const u=new URL(String(url));calls.push(u.pathname);assert.equal(init?.method,"GET");assert.equal(init?.body,undefined);assert.equal(init?.redirect,"error");assert.equal(init?.cache,"no-store");assert.equal(u.searchParams.has("access_token"),false)
    if(u.pathname.endsWith("/me"))return Response.json({id:"2",access_token:"fake-private-token"})
    if(u.pathname.endsWith("/2"))return Response.json({id:"2",instagram_business_account:{id:"3"},access_token:"fake-private-token"})
    if(u.pathname.endsWith("/11"))return Response.json({status_code:"FINISHED",secret:"fake-private-token"})
    assert.equal(u.searchParams.get("limit"),"25")
    return Response.json({data:[{id:"2_99",message:"FB exact",caption:"IG exact",access_token:"fake-private-token"}],paging:{next:"https://untrusted.test/token"}})
  }) as typeof fetch})
  assert.equal(calls.length,5);assert.equal(JSON.stringify(r),before);assert.deepEqual(result.facebook.candidateIds,["2_99"])
  assert.equal(result.container.containerStatus,"FINISHED");assert.equal(result.permissions,"unverified");assert.equal(result.relationship.matchesConfigured,true);assert.equal(result.identity.matchesConfigured,true)
  assert.equal(result.runtime.permissionBlocked,true);assert.ok(!JSON.stringify(result).includes("fake-private-token"));assert.ok(!JSON.stringify(result).includes("FB exact"))
})
test("connection provider errors discard raw bodies, credential echoes and invalid trace IDs",async()=>{
  const {checkOwnedMetaConnection}=await import("../owned-meta-connection")
  const r=record(),secret="PRIVATE_TOKEN_12345678"
  const result=await checkOwnedMetaConnection({batch:r.batch,config:{...r.batch.manifest.destinations,accessToken:secret},runtime:{globalEnabled:true,brandEnabled:true,permissionBlocked:true},fetcher:(async()=>Response.json({error:{code:200,error_subcode:999,fbtrace_id:secret,message:secret,url:`https://x.test/${secret}`},access_token:secret},{status:403})) as typeof fetch})
  assert.equal(result.facebook.error?.httpStatus,403);assert.equal(result.facebook.error?.code,200);assert.equal(result.facebook.error?.subcode,999)
  assert.equal(result.facebook.error?.traceId,undefined);assert.ok(!JSON.stringify(result).includes(secret));assert.equal(result.container.outcome,"unavailable")
})
test("connection does not follow pagination, accept invalid saved paths, or claim missing post absence",async()=>{
  const {checkOwnedMetaConnection}=await import("../owned-meta-connection")
  const r=record();r.batch.jobs.instagram.preparation.container="https://untrusted.test/path"
  let calls=0
  const result=await checkOwnedMetaConnection({batch:r.batch,config:{...r.batch.manifest.destinations,accessToken:"fake"},runtime:{globalEnabled:false,brandEnabled:false,permissionBlocked:true},fetcher:(async()=>{calls++;return Response.json({data:Array.from({length:26},(_,i)=>({id:String(i+1),message:i===25?"FB exact":"other"})),paging:{next:"https://untrusted.test/"}})}) as typeof fetch})
  assert.equal(calls,4);assert.deepEqual(result.facebook.candidateIds,[]);assert.equal(result.container.outcome,"unavailable")
})
test("connection transport and malformed payload errors never echo secrets",async()=>{
  const {checkOwnedMetaConnection}=await import("../owned-meta-connection")
  const r=record(),secret="secret-response-body"
  for(const fetcher of [(async()=>{throw Error(secret)}) as typeof fetch,(async()=>new Response(secret)) as typeof fetch]) {
    const result=await checkOwnedMetaConnection({batch:r.batch,config:{...r.batch.manifest.destinations,accessToken:secret},runtime:{globalEnabled:false,brandEnabled:false,permissionBlocked:true},fetcher})
    assert.equal(result.facebook.outcome,"unavailable");assert.ok(!JSON.stringify(result).includes(secret))
  }
})
test("failed final Facebook publication retains safe detail and final intent alongside processing Instagram",async()=>{
  const s=new Store(),m=s.value.batch.manifest,secret="PRIVATE_TOKEN_12345678",requests:string[]=[]
  const p=createMetaProvider({accessToken:secret,evidence:evidence(m),beforeMutation:async()=>{},fetcher:(async(url,init)=>{
    const u=new URL(String(url));requests.push(`${init?.method}:${u.pathname}`)
    if(u.pathname.endsWith("/photos"))return Response.json({error:{code:200,error_subcode:123,fbtrace_id:"SafeTrace_1234",message:secret}},{status:403})
    if(init?.method==="POST")return Response.json({id:"11"})
    return Response.json({status_code:"IN_PROGRESS"})
  }) as typeof fetch})
  await assert.rejects(run(s,p),/permission/)
  assert.equal(s.value.batch.jobs.instagram.status,"processing");assert.equal(s.value.batch.jobs.instagram.preparation.container,"11")
  assert.equal(s.value.batch.jobs.facebook.status,"needs_reconciliation");assert.ok(s.value.batch.jobs.facebook.finalIntent)
  assert.equal(s.value.batch.jobs.facebook.remoteId,undefined);assert.equal(s.value.batch.claim,null)
  assert.equal(s.value.batch.jobs.facebook.lastError?.code,200);assert.equal(s.value.batch.jobs.facebook.lastError?.operation,"publish")
  assert.ok(!JSON.stringify(s.value).includes(secret));assert.equal(requests.filter(x=>x.endsWith("/photos")).length,1)
})
test("diagnostics route is owner-gated before reads and never reaches POST mutation handlers",async()=>{
  const {readFileSync}=await import("node:fs")
  const source=readFileSync("app/api/admin/crm/content-posts/[id]/owned-meta/route.ts","utf8")
  const get=source.slice(source.indexOf("export async function GET"),source.indexOf("export async function POST"))
  assert.ok(get.indexOf('process.env.VERCEL_ENV !== "production"')<get.indexOf("authorize()"))
  assert.ok(get.indexOf("connection && !await isCrmSuperAdmin")<get.indexOf("ownedMetaStore().read"))
  assert.ok(!/blockOwnedMetaPermission\(|recordCronRun\(|\.update\(|\.event\(|\.set\(|createOwnedMetaDraft\(/.test(get))
  assert.match(get,/cache-control.*private, no-store/)
})
test("safe error fields reject vendor text, numeric strings and URL traces",async()=>{
  const {safeMetaError}=await import("../owned-meta-errors")
  for(const trace of ["https://vendor.test/private", "secret token", "x".repeat(65)]) {
    const detail=safeMetaError(403,{error:{code:"200",error_subcode:"123",fbtrace_id:trace,message:"never expose"}},"facebook","publish","secret")
    assert.equal(detail.code,undefined);assert.equal(detail.subcode,undefined);assert.equal(detail.traceId,undefined);assert.ok(!JSON.stringify(detail).includes("never expose"))
  }
})
test("observed account mismatch is reported without treating read access as publishing permission",async()=>{
  const {checkOwnedMetaConnection}=await import("../owned-meta-connection")
  const r=record()
  const result=await checkOwnedMetaConnection({batch:r.batch,config:{...r.batch.manifest.destinations,accessToken:"fake"},runtime:{globalEnabled:true,brandEnabled:true,permissionBlocked:true},fetcher:(async url=>{
    const path=new URL(String(url)).pathname
    return Response.json(path.endsWith("/me")?{id:"999"}:path.endsWith("/2")?{id:"2",instagram_business_account:{id:"888"}}:{data:[]})
  }) as typeof fetch})
  assert.equal(result.identity.matchesConfigured,false);assert.equal(result.relationship.matchesConfigured,false);assert.equal(result.permissions,"unverified");assert.equal(result.runtime.permissionBlocked,true)
})
test("connection UI aborts on dismissal, prevents concurrent checks and reads current batch after probes",async()=>{
  const {readFileSync}=await import("node:fs")
  const ui=readFileSync("components/crm/ContentDetailDrawer.tsx","utf8")
  assert.match(ui,/key=\{post.id\}/);assert.match(ui,/connectionRequest.current\?\.abort\(\)/)
  assert.match(ui,/if\(connectionRequest.current\)return/);assert.match(ui,/if\(controller.signal.aborted\)return/)
  const route=readFileSync("app/api/admin/crm/content-posts/[id]/owned-meta/route.ts","utf8")
  const get=route.slice(route.indexOf("export async function GET"),route.indexOf("export async function POST"))
  assert.ok(get.indexOf("const current=await ownedMetaStore().read(id)")>get.indexOf("await checkOwnedMetaConnection"))
  assert.match(get,/diagnostics,batch:current.batch/)
})
test("diagnostic persistence cannot replace a permission failure after archive or claim change",async()=>{
  const {MetaPermissionError}=await import("../owned-meta-publisher")
  for(const change of [(r:MetaRecord)=>{r.archived=true},(r:MetaRecord)=>{r.batch.claim="other-run"}]) {
    const s=new Store(),p=fakeProvider(),failure=new MetaPermissionError({destination:"instagram",operation:"prepare",httpStatus:403,code:200,at:"2026-10-09T18:00:00Z"})
    p.prepare=async()=>{change(s.value);throw failure}
    await assert.rejects(run(s,p),e=>e===failure)
    assert.equal(s.value.batch.jobs.instagram.finalIntent,undefined)
    assert.ok(!p.calls.some(c=>c.startsWith("publish:")))
    if(s.value.archived)assert.equal(s.value.batch.jobs.instagram.lastError?.code,200)
    else assert.equal(s.value.batch.claim,"other-run")
  }
})
test("saved final ID readback failure retains safe detail without another final publication",async()=>{
  const {MetaPermissionError}=await import("../owned-meta-publisher")
  const r=record();r.batch.jobs.instagram.finalIntent={id:"original:instagram",at:"earlier"};r.batch.jobs.instagram.remoteId="123";r.batch.jobs.instagram.status="needs_reconciliation"
  const s=new Store(r),p=fakeProvider(),failure=new MetaPermissionError({destination:"instagram",operation:"verify",httpStatus:403,code:200,at:"2026-10-09T18:00:00Z"})
  p.verify=async()=>{throw failure}
  await assert.rejects(run(s,p),e=>e===failure)
  assert.equal(s.value.batch.jobs.instagram.lastError?.operation,"verify");assert.equal(s.value.batch.jobs.instagram.remoteId,"123")
  assert.equal(s.value.batch.jobs.instagram.finalIntent?.id,"original:instagram");assert.equal(s.value.batch.claim,null);assert.deepEqual(p.calls,[])
})

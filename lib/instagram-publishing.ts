import { safeMetaError, type MetaOperation } from "./owned-meta-errors"
import { checkReviewedFormat, OWNED_META_GRAPH_VERSION } from "./owned-meta-formats"
import { MetaBlocked, MetaPermissionError, type MetaDestination, type MetaManifest, type MetaProvider, type FacebookRetryRead } from "./owned-meta-publisher"

export interface MetaPublishingEvidence {
  verifiedAt: string
  credentialKind: "system_user_page"
  appId: string
  pageId: string
  instagramId: string
}
export function checkMetaCapability(m: MetaManifest, d: MetaDestination, e: MetaPublishingEvidence): string | null {
  if (!e || e.credentialKind!=="system_user_page" || !Number.isFinite(Date.parse(e.verifiedAt)) || ["appId","pageId","instagramId"].some(k=>e[k as "appId"|"pageId"|"instagramId"]!==m.destinations[k as "appId"|"pageId"|"instagramId"]))return "First-live permission/account verification required"
  return checkReviewedFormat(m,d)
}
interface PublishedItem { id: string; message?: string; created_time?: string; permalink?: string; permalink_url?: string; attachments?: { data?: { target?: { id?: string } }[] } }
interface GraphResponse {
  id?: string; post_id?: string; video_id?: string; upload_url?: string; success?: boolean
  error?: { code?: number }; status_code?: string; status?: { processing_phase?: { status?: string } }
  data?: PublishedItem[]; is_ai_generated?: boolean
  paging?: { next?: string; cursors?: { after?: string } }
}
export function createMetaProvider(args: { accessToken: string; evidence: MetaPublishingEvidence; fetcher?: typeof fetch; beforeMutation: (urls?: string[]) => Promise<void>; beforeFinalDispatch?: (manifest: MetaManifest, destination: MetaDestination) => Promise<void> }): MetaProvider & { checkFacebookRetry: (m: MetaManifest, intentAt: string) => Promise<FacebookRetryRead> } {
  const fetcher = args.fetcher ?? fetch
  const graphFor = (destination: MetaDestination, operation: MetaOperation, finalGuard?: () => Promise<void>) => async (path: string, values: Record<string, unknown> = {}, method: "GET" | "POST" = "GET") => {
    if (!/^\d+(?:_\d+)?(\/(media|media_publish|photos|feed|videos|video_reels|published_posts))?$/.test(path)) throw new MetaBlocked("Unrecognized Meta endpoint")
    if (method === "POST") await args.beforeMutation([values.url,values.image_url,values.video_url,values.file_url].filter((v):v is string=>typeof v==="string"))
    const url = new URL(`https://graph.facebook.com/${OWNED_META_GRAPH_VERSION}/${path}`)
    const params = new URLSearchParams()
    for (const [k,v] of Object.entries(values)) if (v !== undefined) params.set(k, typeof v === "object" ? JSON.stringify(v) : String(v))
    if (method === "GET") url.search = params.toString()
    if (method === "POST") await finalGuard?.()
    const response = await fetcher(url, { method, headers: { authorization: `Bearer ${args.accessToken}` }, ...(method === "POST" ? { body: params } : {}), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) })
    const data = await response.json().catch(() => ({})) as GraphResponse
    if (!response.ok) {
      const detail = safeMetaError(response.status, data, destination, operation, args.accessToken)
      if ([10,190,200].includes(detail.code || 0) || response.status === 401 || response.status === 403) throw new MetaPermissionError(detail)
      // Never put vendor bodies/URLs/tokens in exceptions or operational logs.
      throw new MetaBlocked(`Meta request failed (HTTP ${response.status}); inspect persisted phase before retry`, detail)
    }
    return data
  }
  const id = (value: unknown): string => { if (typeof value !== "string" || !/^\d+(?:_\d+)?$/.test(value)) throw new MetaBlocked("Meta returned no usable identifier"); return value }
  return {
    preflight: (m,d) => checkMetaCapability(m,d,args.evidence),
    async prepare(m,d,urls,saved,checkpoint) {
      const graph = graphFor(d,"prepare")
      const p = { ...saved }
      const keep = async (key: string, value: string) => { await checkpoint(key,value); p[key] = value }
      const ai = m.aiGenerated ? { is_ai_generated: true } : {}
      if (d === "instagram") {
        if (m.format === "carousel") {
          for (let i=0;i<m.assets.length;i++) {
            const key = `child_${i}`
            if (!p[key]) { const video = m.assets[i].mime === "video/mp4"; const r = await graph(`${m.destinations.instagramId}/media`, { is_carousel_item: true, ...(video ? { media_type: "VIDEO", video_url: urls[i] } : { image_url: urls[i] }) }, "POST"); await keep(key,id(r.id)) }
            const state = await graph(p[key], { fields: "status_code" })
            if (state.status_code !== "FINISHED") { if (["ERROR","EXPIRED"].includes(state.status_code || "")) throw new MetaBlocked("Instagram child failed/expired; operator review required"); return { ready: false, preparation: p } }
          }
        }
        if (!p.container) {
          const media = m.format === "carousel" ? { media_type: "CAROUSEL", children: m.assets.map((_,i)=>p[`child_${i}`]).join(",") } : m.format === "video" ? { media_type: "REELS", video_url: urls[0], share_to_feed: m.instagramShareToFeed } : { image_url: urls[0] }
          const r = await graph(`${m.destinations.instagramId}/media`, { ...media, caption: m.captions.instagram, ...ai }, "POST")
          await keep("container",id(r.id))
        }
        const state = await graph(p.container,{ fields: "status_code" })
        if (["ERROR","EXPIRED"].includes(state.status_code || "")) throw new MetaBlocked("Instagram container failed/expired; operator review required")
        return { ready: state.status_code === "FINISHED", preparation: p }
      }
      if (m.format === "carousel") {
        for (let i=0;i<urls.length;i++) if (!p[`photo_${i}`]) { const r = await graph(`${m.destinations.pageId}/photos`, { url: urls[i], published: false }, "POST"); await keep(`photo_${i}`,id(r.id)) }
      } else if (m.format === "video" && m.placements.facebook === "reels") {
        if (!p.video || !p.upload_url) {
          const r = await graph(`${m.destinations.pageId}/video_reels`, { upload_phase: "start" }, "POST")
          if (!r.upload_url) throw new MetaBlocked("Facebook returned no upload URL")
          const upload = new URL(r.upload_url)
          if (upload.protocol !== "https:" || upload.hostname !== "rupload.facebook.com" || upload.search || upload.username || upload.password || !upload.pathname.endsWith(`/${id(r.video_id)}`)) throw new MetaBlocked("Unrecognized Facebook upload URL")
          await keep("video",id(r.video_id))
          await keep("upload_url",upload.toString())
        }
        if (!p.uploaded) {
          await args.beforeMutation([urls[0]])
          const response = await fetcher(p.upload_url, { method: "POST", headers: { authorization: `OAuth ${args.accessToken}`, file_url: urls[0] }, redirect: "error" })
          if (!response.ok) { const detail=safeMetaError(response.status, await response.json().catch(()=>({})), d, "prepare", args.accessToken); if ([401,403].includes(response.status) || [10,190,200].includes(detail.code || 0)) throw new MetaPermissionError(detail); throw new MetaBlocked("Facebook unpublished video upload failed",detail) }
          await keep("uploaded","true")
        }
        const state = await graph(p.video, { fields: "status" })
        if (state.status?.processing_phase?.status !== "complete") return { ready:false, preparation:p }
      }
      return { ready:true, preparation:p }
    },
    async publish(m,d,urls,p) {
      const graph = graphFor(d,"publish",()=>args.beforeFinalDispatch?.(m,d) ?? Promise.resolve())
      const ai = m.aiGenerated ? { is_ai_generated: true } : {}
      if (d === "instagram") return id((await graph(`${m.destinations.instagramId}/media_publish`,{ creation_id:p.container },"POST")).id)
      if (m.format === "still") { const r = await graph(`${m.destinations.pageId}/photos`,{ url:urls[0], caption:m.captions.facebook,published:true },"POST"); return id(r.post_id || r.id) }
      if (m.format === "carousel") return id((await graph(`${m.destinations.pageId}/feed`,{ message:m.captions.facebook,attached_media:m.assets.map((_,i)=>({media_fbid:p[`photo_${i}`]})) },"POST")).id)
      if (m.placements.facebook === "video") return id((await graph(`${m.destinations.pageId}/videos`,{ file_url:urls[0],description:m.captions.facebook,published:true,...ai },"POST")).id)
      const r = await graph(`${m.destinations.pageId}/video_reels`,{ upload_phase:"finish",video_id:p.video,video_state:"PUBLISHED",description:m.captions.facebook,...ai },"POST")
      if (r.success !== true) throw new MetaBlocked("Facebook final result unconfirmed")
      return id(p.video)
    },
    async checkFacebookRetry(m,intentAt) {
      if(m.format!=="still" || m.placements.facebook!=="feed") throw new MetaBlocked("Recovery collection coverage supports Facebook still/feed only")
      const started=Date.now(), intent=Date.parse(intentAt)
      if(!Number.isFinite(intent) || intent>started || started-intent>7*24*60*60*1000) throw new MetaBlocked("Recovery needs a valid final intent within the last seven days")
      const since=Math.floor(intent/1000)-300, until=Math.floor(started/1000)+1
      const graph=graphFor("facebook","verify"), seen=new Set<string>()
      const normalize=(s:string)=>s.normalize("NFKC").replace(/\s+/g," ").trim()
      const caption=normalize(m.captions.facebook)
      let after:string|undefined, items=0
      for(let pages=1;pages<=10;pages++) {
        if(Date.now()-started>30_000) throw new MetaBlocked("Recovery read took too long; no final publication dispatched")
        const listing=await graph(`${m.destinations.pageId}/published_posts`,{fields:"id,message,created_time",limit:100,since,until,...(after?{after}:{})})
        if(!Array.isArray(listing.data) || listing.error) throw new MetaBlocked("Recovery read is incomplete; no final publication dispatched")
        for(const item of listing.data) {
          if(!item || typeof item.id!=="string" || !new RegExp(`^${m.destinations.pageId}_\\d+$`).test(item.id) || !Number.isFinite(Date.parse(item.created_time || ""))) throw new MetaBlocked("Recovery read contains unusable ownership/time evidence")
          items++
          const time=Date.parse(item.created_time!)
          if(time<since*1000 || time>until*1000) throw new MetaBlocked("Recovery collection did not honor the requested time window")
          // Missing captions cannot rule a candidate out. Matching is deliberately conservative.
          if(typeof item.message!=="string" || !caption || normalize(item.message)===caption) throw new MetaBlocked("Possible matching Facebook post found; inspect the Page and reconcile instead of retrying")
        }
        if(listing.paging!==undefined && (!listing.paging || typeof listing.paging!=="object" || Array.isArray(listing.paging))) throw new MetaBlocked("Malformed recovery pagination")
        if(!listing.paging?.next) {
          if(listing.data.length>=100) throw new MetaBlocked("Full recovery page lacks continuation evidence")
          if(listing.paging && listing.paging.next!==undefined) throw new MetaBlocked("Malformed recovery pagination")
          if(Date.now()-started>30_000) throw new MetaBlocked("Recovery read took too long")
          return {checkedAt:new Date().toISOString(),since:new Date(since*1000).toISOString(),until:new Date(until*1000).toISOString(),pages,items,outcome:"no_candidate_observed"}
        }
        const cursor=listing.paging.cursors?.after
        if(typeof listing.paging.next!=="string" || typeof cursor!=="string" || !cursor || cursor.length>4096 || seen.has(cursor)) throw new MetaBlocked("Recovery pagination is incomplete or repeated")
        seen.add(cursor);after=cursor // Never follow a provider URL or persist its token-bearing query.
      }
      throw new MetaBlocked("Recovery read reached its page bound; absence is unproven")
    },
    async verify(m,d,remoteId) {
      const graph = graphFor(d,"verify")
      // Membership in the destination's published collection is state AND ownership evidence.
      // A direct media lookup/permalink alone can describe an unpublished upload.
      const listing = await graph(`${d === "instagram" ? m.destinations.instagramId : m.destinations.pageId}/${d === "instagram" ? "media" : "published_posts"}`, { fields: d === "instagram" ? "id,permalink" : "id,permalink_url,attachments{target{id}}", limit: 100 })
      const published = (listing.data || []).find((item) => item.id === remoteId || d === "facebook" && item.attachments?.data?.some((a) => a.target?.id === remoteId))
      if (!published) return { verified:false,blocker:"Exact remote ID not found in the account's published collection; use operator evidence if needed" }
      const r: GraphResponse = m.aiGenerated ? await graph(remoteId,{fields:"id,is_ai_generated"}) : {}
      const link = d === "instagram" ? published.permalink : published.permalink_url
      let u: URL; try { if (!link) throw new Error("missing permalink"); u = new URL(link) } catch { return { verified:false,blocker:"Published permalink unavailable" } }
      const host = d === "instagram" ? "instagram.com" : "facebook.com"
      if (u.protocol !== "https:" || !(u.hostname === host || u.hostname === `www.${host}`)) return { verified:false,blocker:"Untrusted permalink" }
      if (m.aiGenerated && r.is_ai_generated !== true) return { verified:false,blocker:"AI disclosure needs a manual platform check/toggle; do not republish" }
      return { verified:true,permalink:u.toString() }
    },
  }
}

import { MetaBlocked, MetaPermissionError, type MetaDestination, type MetaManifest, type MetaProvider } from "./owned-meta-publisher"

export interface MetaFormatCapability {
  mimeTypes: string[]
  maxBytes: number
  maxItems: number
  minAspect: number
  maxAspect: number
  maxDuration: number
  aiLabel: boolean
}
export interface MetaPublishingEvidence {
  verifiedAt: string
  credentialKind: "system_user_page"
  appId: string
  pageId: string
  instagramId: string
  apiVersion: string
  formats: Record<string, MetaFormatCapability>
  facebookReelAiPhase?: "finish"
}
export function capabilityKey(m: MetaManifest, d: MetaDestination): string { return `${d}:${m.format}:${m.placements[d]}` }
export function checkMetaCapability(m: MetaManifest, d: MetaDestination, e: MetaPublishingEvidence): string | null {
  if (!e || e.credentialKind !== "system_user_page" || !Number.isFinite(Date.parse(e.verifiedAt)) || Object.entries(m.destinations).some(([k,v]) => e[k as keyof MetaPublishingEvidence] !== v)) return "First-live permission/account verification required"
  const c = e.formats[capabilityKey(m,d)]
  if (!c || !Array.isArray(c.mimeTypes) || !Number.isFinite(c.maxBytes) || c.maxBytes <= 0 || !Number.isSafeInteger(c.maxItems) || c.maxItems < 1 || !Number.isFinite(c.minAspect) || c.minAspect <= 0 || !Number.isFinite(c.maxAspect) || c.maxAspect < c.minAspect || !Number.isFinite(c.maxDuration) || c.maxDuration < 0) return "This API format needs verified limits before publishing"
  if (m.aiGenerated && (d === "facebook" && m.format !== "video" || !c.aiLabel || d === "facebook" && m.placements.facebook === "reels" && e.facebookReelAiPhase !== "finish")) return "AI disclosure requires manual platform handling for this post"
  if (d === "facebook" && m.format === "carousel" && m.assets.some(a => a.mime === "video/mp4")) return "Facebook organic multi-photo posts require stills; approve a different rendition"
  if (m.assets.length > c.maxItems || m.assets.some(a => !c.mimeTypes.includes(a.mime) || a.size > c.maxBytes || a.width/a.height < c.minAspect || a.width/a.height > c.maxAspect || a.duration !== undefined && a.duration > c.maxDuration)) return "Approved export is outside the verified format limits; do not crop or substitute"
  return null
}
interface PublishedItem { id: string; permalink?: string; permalink_url?: string; attachments?: { data?: { target?: { id?: string } }[] } }
interface GraphResponse {
  id?: string; post_id?: string; video_id?: string; upload_url?: string; success?: boolean
  error?: { code?: number }; status_code?: string; status?: { processing_phase?: { status?: string } }
  data?: PublishedItem[]; is_ai_generated?: boolean
}
export function createMetaProvider(args: { accessToken: string; evidence: MetaPublishingEvidence; fetcher?: typeof fetch; beforeMutation: () => Promise<void> }): MetaProvider {
  const fetcher = args.fetcher ?? fetch
  const graph = async (path: string, values: Record<string, unknown> = {}, method: "GET" | "POST" = "GET") => {
    if (!/^\d+(?:_\d+)?(\/(media|media_publish|photos|feed|videos|video_reels|published_posts))?$/.test(path)) throw new MetaBlocked("Unrecognized Meta endpoint")
    if (method === "POST") await args.beforeMutation()
    const url = new URL(`https://graph.facebook.com/${args.evidence.apiVersion}/${path}`)
    const params = new URLSearchParams()
    for (const [k,v] of Object.entries(values)) if (v !== undefined) params.set(k, typeof v === "object" ? JSON.stringify(v) : String(v))
    if (method === "GET") url.search = params.toString()
    const response = await fetcher(url, { method, headers: { authorization: `Bearer ${args.accessToken}` }, ...(method === "POST" ? { body: params } : {}), redirect: "error", cache: "no-store" })
    const data = await response.json().catch(() => ({})) as GraphResponse
    if (!response.ok) {
      if ([10,190,200].includes(data.error?.code || 0) || response.status === 401 || response.status === 403) throw new MetaPermissionError()
      // Never put vendor bodies/URLs/tokens in exceptions or operational logs.
      throw new MetaBlocked(`Meta request failed (HTTP ${response.status}); inspect persisted phase before retry`)
    }
    return data
  }
  const id = (value: unknown): string => { if (typeof value !== "string" || !/^\d+(?:_\d+)?$/.test(value)) throw new MetaBlocked("Meta returned no usable identifier"); return value }
  return {
    preflight: (m,d) => checkMetaCapability(m,d,args.evidence),
    async prepare(m,d,urls,saved,checkpoint) {
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
          await args.beforeMutation()
          const response = await fetcher(p.upload_url, { method: "POST", headers: { authorization: `OAuth ${args.accessToken}`, file_url: urls[0] }, redirect: "error" })
          if (!response.ok) { if ([401,403].includes(response.status)) throw new MetaPermissionError(); throw new MetaBlocked("Facebook unpublished video upload failed") }
          await keep("uploaded","true")
        }
        const state = await graph(p.video, { fields: "status" })
        if (state.status?.processing_phase?.status !== "complete") return { ready:false, preparation:p }
      }
      return { ready:true, preparation:p }
    },
    async publish(m,d,urls,p) {
      const ai = m.aiGenerated ? { is_ai_generated: true } : {}
      if (d === "instagram") return id((await graph(`${m.destinations.instagramId}/media_publish`,{ creation_id:p.container },"POST")).id)
      if (m.format === "still") { const r = await graph(`${m.destinations.pageId}/photos`,{ url:urls[0], message:m.captions.facebook,published:true },"POST"); return id(r.post_id || r.id) }
      if (m.format === "carousel") return id((await graph(`${m.destinations.pageId}/feed`,{ message:m.captions.facebook,attached_media:m.assets.map((_,i)=>({media_fbid:p[`photo_${i}`]})) },"POST")).id)
      if (m.placements.facebook === "video") return id((await graph(`${m.destinations.pageId}/videos`,{ file_url:urls[0],description:m.captions.facebook,published:true,...ai },"POST")).id)
      const r = await graph(`${m.destinations.pageId}/video_reels`,{ upload_phase:"finish",video_id:p.video,video_state:"PUBLISHED",description:m.captions.facebook,...ai },"POST")
      if (r.success !== true) throw new MetaBlocked("Facebook final result unconfirmed")
      return id(p.video)
    },
    async verify(m,d,remoteId) {
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

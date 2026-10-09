import { OWNED_META_GRAPH_VERSION } from "./owned-meta-formats"
import { safeMetaError, type SafeMetaError } from "./owned-meta-errors"
import type { MetaBatch, MetaDestination } from "./owned-meta-publisher"

export interface MetaReadCheck {
  outcome: "readable" | "failed" | "unavailable"
  error?: SafeMetaError
  candidateIds?: string[]
  observedPageId?: string
  observedInstagramId?: string
  matchesConfigured?: boolean
  containerStatus?: "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED" | "UNKNOWN"
}
export interface MetaConnectionReport {
  checkedAt: string
  configured: { appId: string; pageId: string; instagramId: string }
  configurationMatchesBatch: boolean
  runtime: { globalEnabled: boolean; brandEnabled: boolean; permissionBlocked: boolean }
  identity: MetaReadCheck
  relationship: MetaReadCheck
  facebook: MetaReadCheck
  instagram: MetaReadCheck
  container: MetaReadCheck
  permissions: "unverified"
}

/** Bounded, GET-only observation. Has no persistence or mutation capability. */
export async function checkOwnedMetaConnection(args: {
  batch: MetaBatch
  config: { accessToken: string; appId: string; pageId: string; instagramId: string }
  runtime: MetaConnectionReport["runtime"]
  fetcher?: typeof fetch
}): Promise<MetaConnectionReport> {
  const { batch, config } = args
  const numeric = (v: unknown): v is string => typeof v === "string" && /^\d+(?:_\d+)?$/.test(v)
  if (![config.appId, config.pageId, config.instagramId].every(numeric)) throw new Error("Invalid configured account identifiers")
  const fetcher = args.fetcher ?? fetch
  const read = async (path: string, fields: string, destination: MetaDestination, collection = false): Promise<{ check: MetaReadCheck; data?: Record<string, unknown> }> => {
    // No caller-provided URL, pagination URL, or mutation method is accepted.
    if (path !== "me" && !/^\d+(?:_\d+)?(?:\/(?:media|published_posts))?$/.test(path)) return { check: { outcome: "unavailable" } }
    const url = new URL(`https://graph.facebook.com/${OWNED_META_GRAPH_VERSION}/${path}`)
    url.searchParams.set("fields", fields)
    if (collection) url.searchParams.set("limit", "25")
    try {
      const response = await fetcher(url, { method: "GET", headers: { authorization: `Bearer ${config.accessToken}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) return { check: { outcome: "failed", error: safeMetaError(response.status, body, destination, "connection", config.accessToken) } }
      if (!body || typeof body !== "object" || Array.isArray(body)) return { check: { outcome: "unavailable" } }
      return { check: { outcome: "readable" }, data: body as Record<string, unknown> }
    } catch { return { check: { outcome: "unavailable" } } } // Never echo transport errors (may contain credentials/URLs).
  }
  const collection = async (destination: MetaDestination): Promise<MetaReadCheck> => {
    const facebook = destination === "facebook"
    const result = await read(`${facebook ? config.pageId : config.instagramId}/${facebook ? "published_posts" : "media"}`, facebook ? "id,message" : "id,caption", destination, true)
    if (result.check.outcome !== "readable") return result.check
    if (!Array.isArray(result.data?.data)) return { outcome: "unavailable" }
    const caption = batch.manifest.captions[destination]
    // Exact-caption matches are candidates for human inspection, never proof of the approved asset or absence.
    const candidateIds = result.data.data.slice(0, 25).flatMap(item => {
      if (!item || typeof item !== "object") return []
      const row = item as Record<string, unknown>
      return numeric(row.id) && row[facebook ? "message" : "caption"] === caption ? [row.id] : []
    })
    return { outcome: "readable", candidateIds }
  }
  const savedContainer = batch.jobs.instagram.preparation.container
  const container = async (): Promise<MetaReadCheck> => {
    if (!numeric(savedContainer)) return { outcome: "unavailable" }
    const result = await read(savedContainer, "status_code", "instagram")
    if (result.check.outcome !== "readable") return result.check
    const state = result.data?.status_code
    const allowed = ["FINISHED", "IN_PROGRESS", "ERROR", "EXPIRED", "PUBLISHED"] as const
    return { outcome: "readable", containerStatus: allowed.find(s => s === state) ?? "UNKNOWN" }
  }
  const identity = async (): Promise<MetaReadCheck> => {
    const result = await read("me", "id", "facebook")
    if (result.check.outcome !== "readable") return result.check
    const id = result.data?.id
    return numeric(id) ? { outcome: "readable", observedPageId: id, matchesConfigured: id === config.pageId } : { outcome: "unavailable" }
  }
  const relationship = async (): Promise<MetaReadCheck> => {
    const result = await read(config.pageId, "id,instagram_business_account", "facebook")
    if (result.check.outcome !== "readable") return result.check
    const linked = result.data?.instagram_business_account
    const ig = linked && typeof linked === "object" && "id" in linked ? linked.id : undefined
    const page = result.data?.id
    return numeric(page) && numeric(ig) ? { outcome: "readable", observedPageId: page, observedInstagramId: ig, matchesConfigured: page === config.pageId && ig === config.instagramId } : { outcome: "unavailable" }
  }
  const [facebook, instagram, saved, observedIdentity, observedRelationship] = await Promise.all([collection("facebook"), collection("instagram"), container(), identity(), relationship()])
  return {
    checkedAt: new Date().toISOString(), configured: { appId: config.appId, pageId: config.pageId, instagramId: config.instagramId },
    configurationMatchesBatch: (["appId", "pageId", "instagramId"] as const).every(k => config[k] === batch.manifest.destinations[k]),
    runtime: args.runtime, identity: observedIdentity, relationship: observedRelationship, facebook, instagram, container: saved, permissions: "unverified",
  }
}

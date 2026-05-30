// Shared asset-ingest helper (server-only): fetch a remote media URL and stream
// it into Vercel Blob, returning a structured Asset. Used by the Higgsfield
// generation webhook to store completed outputs. The existing
// /api/admin/crm/content-posts/ingest-asset route does the same inline for
// admin paste-URL ingestion; this lib is the reusable core for server-to-server
// callers (webhooks) that have no admin session.

import { put } from "@vercel/blob"
import crypto from "crypto"
import type { Asset, AssetSource, MediaKind } from "@/components/crm/types"

const MAX_BYTES = 200 * 1024 * 1024 // 200MB

function kindFromContentType(ct: string): MediaKind | null {
  if (ct.startsWith("video/")) return "video"
  if (ct.startsWith("image/")) return "image"
  return null
}

// Block internal hosts to reduce SSRF surface — asset URLs are public CDN /
// generation outputs, never localhost/private ranges/metadata.
export function isSafeRemoteUrl(raw: string): URL | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null
  const host = u.hostname.toLowerCase()
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host === "169.254.169.254" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null
  }
  return u
}

export interface IngestOptions {
  source?: AssetSource
  prompt?: string
  higgsfieldJobId?: string
  model?: string
}

export type IngestResult =
  | { ok: true; asset: Asset }
  | { ok: false; status: number; error: string }

// Fetch the asset at `rawUrl` and stream it into Blob. Returns a structured
// Asset on success, or a typed error (no throwing) so callers stay simple.
export async function ingestAssetFromUrl(
  rawUrl: string,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const safeUrl = isSafeRemoteUrl((rawUrl ?? "").trim())
  if (!safeUrl) {
    return { ok: false, status: 400, error: "A valid public http(s) asset URL is required" }
  }

  let res: Response
  try {
    res = await fetch(safeUrl.toString(), { redirect: "follow" })
  } catch {
    return { ok: false, status: 502, error: "Could not fetch the asset URL" }
  }
  if (!res.ok || !res.body) {
    return { ok: false, status: 502, error: `Source returned ${res.status} ${res.statusText}` }
  }

  const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  const kind = kindFromContentType(contentType)
  if (!kind) {
    return {
      ok: false,
      status: 415,
      error: `Unsupported media type "${contentType || "unknown"}" — must be image or video`,
    }
  }

  const declaredLen = Number(res.headers.get("content-length") || "0")
  if (declaredLen && declaredLen > MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Asset too large (${(declaredLen / 1024 / 1024).toFixed(0)}MB)`,
    }
  }

  const pathName = safeUrl.pathname.split("/").pop() || "asset"
  const extFromType = contentType.split("/")[1]?.replace("quicktime", "mov") || "bin"
  const baseName = pathName.includes(".")
    ? pathName.replace(/[^a-zA-Z0-9.-]/g, "_")
    : `${pathName.replace(/[^a-zA-Z0-9.-]/g, "_")}.${extFromType}`
  const filename = `content-posts/${crypto.randomUUID()}-${baseName}`

  let blobUrl: string
  try {
    const blob = await put(filename, res.body, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    })
    blobUrl = blob.url
  } catch {
    return { ok: false, status: 500, error: "Failed to store the asset" }
  }

  const asset: Asset = {
    url: blobUrl,
    kind,
    source: opts.source === "higgsfield" ? "higgsfield" : "upload",
    ...(opts.prompt ? { prompt: opts.prompt } : {}),
    ...(opts.higgsfieldJobId ? { higgsfieldJobId: opts.higgsfieldJobId } : {}),
    ...(opts.model ? { model: opts.model } : {}),
  }
  return { ok: true, asset }
}

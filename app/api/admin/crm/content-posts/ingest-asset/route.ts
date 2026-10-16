import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { put } from "@vercel/blob"
import crypto from "crypto"
import { isSafeRemoteUrl, fetchAllowingSafeRedirects } from "@/lib/safe-remote-fetch"
import type { Asset, AssetSource, MediaKind } from "@/components/crm/types"

// POST /api/admin/crm/content-posts/ingest-asset
// Body: { url, source?, prompt?, higgsfieldJobId?, model? }
//
// Phase 3 — server-side asset ingestion. Fetches a finished asset from a URL
// (a Higgsfield output, or any reachable source) and streams it into Vercel
// Blob, returning a structured Asset with kind + provenance. Because the bytes
// are fetched server-side, this sidesteps the ~4.5MB inbound-body limit that
// caps the direct browser→/api/upload/crm path — the way to bring in video.
//
// This is mechanism-agnostic: whether generation runs via the Higgsfield CLI or
// API, it returns a URL, and this route turns that URL into a stored Asset.

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_BYTES = 200 * 1024 * 1024 // 200MB — generous for video; Blob allows far more
const ALLOWED_PREFIXES = ["image/", "video/"]

interface IngestBody {
  url?: string
  source?: AssetSource
  prompt?: string
  higgsfieldJobId?: string
  model?: string
}

function kindFromContentType(ct: string): MediaKind | null {
  if (ct.startsWith("video/")) return "video"
  if (ct.startsWith("image/")) return "image"
  return null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  let body: IngestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const safe = await isSafeRemoteUrl((body.url ?? "").trim())
  if (!safe) {
    return NextResponse.json(
      { error: "A valid public http(s) asset URL is required" },
      { status: 400 },
    )
  }
  const safeUrl = safe.url

  // Fetch the remote asset — redirects are followed manually and re-validated,
  // and the socket is pinned to the validated IP (no DNS-rebinding).
  let res: Response
  try {
    res = await fetchAllowingSafeRedirects(safe.url, safe.addresses)
  } catch (err) {
    console.error("[ingest-asset] fetch failed:", err)
    return NextResponse.json({ error: "Could not fetch the asset URL" }, { status: 502 })
  }
  if (!res.ok || !res.body) {
    return NextResponse.json(
      { error: `Source returned ${res.status} ${res.statusText}` },
      { status: 502 },
    )
  }

  const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  const kind = kindFromContentType(contentType)
  if (!kind || !ALLOWED_PREFIXES.some((p) => contentType.startsWith(p))) {
    return NextResponse.json(
      { error: `Unsupported media type "${contentType || "unknown"}" — must be image or video` },
      { status: 415 },
    )
  }

  // Reject oversized payloads early when the source advertises a length.
  const declaredLen = Number(res.headers.get("content-length") || "0")
  if (declaredLen && declaredLen > MAX_BYTES) {
    return NextResponse.json(
      { error: `Asset too large (${(declaredLen / 1024 / 1024).toFixed(0)}MB)` },
      { status: 413 },
    )
  }

  // Derive a filename + extension from the URL path / content type.
  const pathName = safeUrl.pathname.split("/").pop() || "asset"
  const extFromType = contentType.split("/")[1]?.replace("quicktime", "mov") || "bin"
  const baseName = pathName.includes(".")
    ? pathName.replace(/[^a-zA-Z0-9.-]/g, "_")
    : `${pathName.replace(/[^a-zA-Z0-9.-]/g, "_")}.${extFromType}`
  const filename = `content-posts/${crypto.randomUUID()}-${baseName}`

  let blobUrl: string
  try {
    // Stream straight from the source response into Blob — no full buffer.
    const blob = await put(filename, res.body, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    })
    blobUrl = blob.url
  } catch (err) {
    console.error("[ingest-asset] blob put failed:", err)
    return NextResponse.json({ error: "Failed to store the asset" }, { status: 500 })
  }

  const source: AssetSource = body.source === "higgsfield" ? "higgsfield" : "upload"
  const asset: Asset = {
    url: blobUrl,
    kind,
    source,
    ...(body.prompt ? { prompt: body.prompt } : {}),
    ...(body.higgsfieldJobId ? { higgsfieldJobId: body.higgsfieldJobId } : {}),
    ...(body.model ? { model: body.model } : {}),
  }

  return NextResponse.json({ success: true, asset })
}

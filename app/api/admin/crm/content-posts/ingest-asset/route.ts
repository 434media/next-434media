import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { put } from "@vercel/blob"
import crypto from "crypto"
import dns from "node:dns/promises"
import net from "node:net"
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

// True if an IP literal falls in a private / loopback / link-local / reserved
// range (v4 or v6). Called on every address the host RESOLVES to, so it also
// covers hostnames that point at internal IPs and numeric/octal/hex encodings
// (getaddrinfo normalizes "2130706433", "0x7f000001", etc. before we see them).
function ipInPrivateRange(ip: string): boolean {
  const fam = net.isIP(ip)
  if (fam === 4) {
    const o = ip.split(".").map(Number)
    return (
      o[0] === 0 ||
      o[0] === 127 || // loopback
      o[0] === 10 || // private
      (o[0] === 169 && o[1] === 254) || // link-local (incl. 169.254.169.254 metadata)
      (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || // private
      (o[0] === 192 && o[1] === 168) || // private
      (o[0] === 100 && o[1] >= 64 && o[1] <= 127) // CGNAT 100.64/10
    )
  }
  if (fam === 6) {
    const a = ip.toLowerCase()
    if (a === "::1" || a === "::") return true // loopback / unspecified
    if (a.startsWith("fe80") || a.startsWith("fc") || a.startsWith("fd")) return true // link-local + ULA
    const mapped = a.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/) // IPv4-mapped
    if (mapped) return ipInPrivateRange(mapped[1])
    return false
  }
  return false
}

// Block internal hosts to reduce SSRF surface. The asset URLs we expect are
// public CDN/generation outputs. We resolve the host and reject if ANY resolved
// address is internal — this catches DNS-rebinding hosts, IPv6, and numeric IP
// encodings that a literal-string allowlist would miss. Async because of DNS.
async function isSafeRemoteUrl(raw: string): Promise<URL | null> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase() // strip IPv6 brackets
  if (host === "localhost" || host.endsWith(".local")) return null
  let addrs: Array<{ address: string }>
  try {
    addrs = await dns.lookup(host, { all: true })
  } catch {
    return null // unresolvable → refuse
  }
  if (addrs.length === 0 || addrs.some((a) => ipInPrivateRange(a.address))) return null
  return u
}

// Follow redirects MANUALLY, re-validating every hop against isSafeRemoteUrl.
// With redirect:"follow", a public URL could 30x-redirect to an internal host
// (e.g. cloud metadata at 169.254.169.254) and slip past the allowlist above —
// the redirect target is never checked. This re-runs the guard on each Location
// and caps the chain length.
async function fetchAllowingSafeRedirects(start: URL, maxHops = 5): Promise<Response> {
  let current = start
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await fetch(current.toString(), { redirect: "manual" })
    if (res.status < 300 || res.status >= 400) return res
    const location = res.headers.get("location")
    if (!location) return res
    const next = await isSafeRemoteUrl(new URL(location, current).toString())
    if (!next) throw new Error("unsafe redirect target")
    current = next
  }
  throw new Error("too many redirects")
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

  const safeUrl = await isSafeRemoteUrl((body.url ?? "").trim())
  if (!safeUrl) {
    return NextResponse.json(
      { error: "A valid public http(s) asset URL is required" },
      { status: 400 },
    )
  }

  // Fetch the remote asset — redirects are followed manually and re-validated.
  let res: Response
  try {
    res = await fetchAllowingSafeRedirects(safeUrl)
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

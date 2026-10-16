import dns from "node:dns/promises"
import type { LookupAddress } from "node:dns"
import net from "node:net"
import { fetch as pinnedFetch, Agent } from "undici"

// SSRF-guarded fetch of a public asset URL. Moved unchanged from
// app/api/admin/crm/content-posts/ingest-asset/route.ts so the publisher's export
// attachment uses the same guard as admin ingestion.

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
export async function isSafeRemoteUrl(
  raw: string,
): Promise<{ url: URL; addresses: LookupAddress[] } | null> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase() // strip IPv6 brackets
  if (host === "localhost" || host.endsWith(".local")) return null
  let addrs: LookupAddress[]
  try {
    addrs = await dns.lookup(host, { all: true })
  } catch {
    return null // unresolvable → refuse
  }
  if (addrs.length === 0 || addrs.some((a) => ipInPrivateRange(a.address))) return null
  return { url: u, addresses: addrs }
}

// Pin the socket to the exact IP(s) we already validated as public, so fetch
// can't re-resolve the host to an internal address between our DNS check and the
// connect (DNS-rebinding / TOCTOU). SNI + TLS cert validation still use the
// hostname, so HTTPS works normally.
function pinnedAgent(addresses: LookupAddress[]): Agent {
  const lookup = (
    _hostname: string,
    options: { all?: boolean },
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | LookupAddress[],
      family?: number,
    ) => void,
  ): void => {
    if (options?.all) callback(null, addresses)
    else callback(null, addresses[0].address, addresses[0].family)
  }
  return new Agent({ connect: { lookup: lookup as never } })
}

// Follow redirects MANUALLY, re-validating every hop against isSafeRemoteUrl and
// re-pinning to the freshly-validated IP. With redirect:"follow", a public URL
// could 30x-redirect to an internal host (e.g. cloud metadata at
// 169.254.169.254) and slip past the guard — the redirect target is never
// checked. This re-runs the guard on each Location and caps the chain length.
export async function fetchAllowingSafeRedirects(
  startUrl: URL,
  startAddresses: LookupAddress[],
  maxHops = 5,
  headers?: Record<string, string>,
): Promise<Response> {
  let current = startUrl
  let addresses = startAddresses
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = (await pinnedFetch(current.toString(), {
      redirect: "manual",
      dispatcher: pinnedAgent(addresses),
      ...(headers ? { headers } : {}),
    })) as unknown as Response
    if (res.status < 300 || res.status >= 400) return res
    const location = res.headers.get("location")
    if (!location) return res
    const next = await isSafeRemoteUrl(new URL(location, current).toString())
    if (!next) throw new Error("unsafe redirect target")
    current = next.url
    addresses = next.addresses
  }
  throw new Error("too many redirects")
}

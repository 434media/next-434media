import { lookup } from "node:dns/promises"
import net from "node:net"

/**
 * Server-side sourcing for the MCU skill, no browser: read a source page as text (with its stated publication date and
 * share image and description), read the rights of a page's own photo (agency, DVIDS or company media), and find
 * openly licensed photos on Wikimedia Commons with their license, creator and credit. Every fetch is https-only, refuses private and internal
 * addresses, is size- and time-bounded, and identifies itself honestly.
 */
export const USER_AGENT = "434MEDIA-content-bot/1.0 (+https://www.434media.com)"
const MAX_PAGE_BYTES = 3 * 1024 * 1024
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

function privateAddress(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const o = ip.split(".").map(Number)
    return o[0] === 0 || o[0] === 10 || o[0] === 127 || (o[0] === 169 && o[1] === 254) || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168) || (o[0] === 100 && o[1] >= 64 && o[1] <= 127) || o[0] >= 224
  }
  const a = ip.toLowerCase()
  return a === "::" || a === "::1" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80") || a.startsWith("::ffff:")
}
/** https, a DNS name (no IP literal or single label), and every resolved address public. */
export async function assertPublicHttps(raw: string, resolve: (host: string) => Promise<string[]> = async h => (await lookup(h, { all: true })).map(a => a.address)): Promise<URL> {
  let url: URL
  try { url = new URL(raw) } catch { throw new Error("not_a_url") }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("https_only")
  const host = url.hostname
  if (net.isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".") || /(^|\.)(localhost|internal|local)$/i.test(host)) throw new Error("not_public")
  const addresses = await resolve(host)
  if (!addresses.length || addresses.some(privateAddress)) throw new Error("not_public")
  return url
}

export interface Fetcher { (url: URL, init: RequestInit): Promise<Response> }
/** Follows up to 4 redirects, re-checking each hop. */
async function guardedFetch(raw: string, fetcher: Fetcher, accept: string, check = assertPublicHttps): Promise<Response> {
  let url = await check(raw)
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetcher(url, { headers: { "user-agent": USER_AGENT, accept }, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000) })
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null
    if (!loc) return res
    url = await check(new URL(loc, url).toString())
  }
  throw new Error("too_many_redirects")
}
async function readBounded(res: Response, max: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array()
  const chunks: Uint8Array[] = []; let size = 0
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) { size += chunk.byteLength; if (size > max) throw new Error("too_large"); chunks.push(chunk) }
  return Buffer.concat(chunks)
}

export interface SourcePage { url: string; title: string; text: string; publishedAt?: string; image?: string; siteName?: string; description?: string }
// One pass over the entities, so "&amp;lt;" becomes "&lt;" and never "<" (no double unescaping).
const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", quot: "\"", "#39": "'", "#x27": "'", rsquo: "'", lsquo: "'", ldquo: "\"", rdquo: "\"", mdash: "—", ndash: "–", lt: "<", gt: ">" }
const decode = (s: string) => s.replace(/&(#\d{1,7}|#x27|[a-z]+);/gi, (m, e: string) => /^#\d+$/.test(e) ? (Number(e.slice(1)) <= 0x10ffff ? String.fromCodePoint(Number(e.slice(1))) : m) : ENTITIES[e.toLowerCase()] ?? m)
function meta(html: string, key: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, "i"), tag = re.exec(html)?.[0]
  const v = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1]
  return v ? decode(v).trim() : undefined
}
/** Readable text of an HTML page: scripts, styles, navigation and markup removed; capped at 40k characters. */
export function pageText(html: string): string {
  return decode(html.replace(/<head[\s>][\s\S]*?<\/head>/i, " ").replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, 40_000)
}
export function parsePage(url: string, html: string): SourcePage {
  const ld = [...html.matchAll(/"datePublished"\s*:\s*"([^"]+)"/g)].map(m => m[1])[0]
  const publishedAt = meta(html, "article:published_time") || ld || meta(html, "datePublished") || meta(html, "date") || meta(html, "DC.date.issued")
  const title = meta(html, "og:title") || decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "").trim()
  return { url, title, text: pageText(html), ...(publishedAt ? { publishedAt } : {}), ...(meta(html, "og:image") ? { image: meta(html, "og:image") } : {}), ...(meta(html, "og:site_name") ? { siteName: meta(html, "og:site_name") } : {}), ...(meta(html, "og:description") ? { description: meta(html, "og:description") } : {}) }
}
export async function fetchSourcePage(url: string, fetcher: Fetcher = fetch as Fetcher, check = assertPublicHttps): Promise<SourcePage> {
  const res = await guardedFetch(url, fetcher, "text/html,application/xhtml+xml", check)
  if (!res.ok) throw new Error(`http_${res.status}`)
  const type = res.headers.get("content-type") || ""
  if (!/html|xml|text\/plain/i.test(type)) throw new Error("not_html")
  return parsePage(res.url || url, new TextDecoder().decode(await readBounded(res, MAX_PAGE_BYTES)))
}
/** Image bytes (JPEG or PNG only, by signature) for vision checks and uploads. */
export async function fetchImage(url: string, fetcher: Fetcher = fetch as Fetcher, check = assertPublicHttps): Promise<{ bytes: Uint8Array; mime: "image/jpeg" | "image/png" }> {
  const res = await guardedFetch(url, fetcher, "image/jpeg,image/png", check)
  if (!res.ok) throw new Error(`http_${res.status}`)
  const bytes = await readBounded(res, MAX_IMAGE_BYTES)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { bytes, mime: "image/jpeg" }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { bytes, mime: "image/png" }
  throw new Error("not_jpeg_or_png")
}

// ── Wikimedia Commons ──
export interface MediaCandidate {
  url: string            // the file (or a ≤2000 px rendition) to place in the template
  thumbUrl: string       // ~640 px, for the relevance check
  pageUrl: string        // the item's own page: license, creator and history
  title: string
  description: string
  width: number
  height: number
  license: string        // e.g. "Public domain", "CC BY-SA 4.0"
  creator: string
  credit: string         // the line to print with the image
  date?: string
  usGovernment: boolean
  /** Where it was found: the story's own pages, a DVIDS image page, or Wikimedia Commons. */
  origin?: "source" | "dvids" | "commons"
  /** A rights point the reviewer must check before approving (company or courtesy media). */
  rightsNote?: string
}
/** Licenses usable for editorial social posts with attribution. Anything else (fair use, NC, ND, unknown) is skipped. */
export function usableLicense(short: string): boolean {
  const s = short.trim().toLowerCase()
  return s === "public domain" || s === "pd" || s.startsWith("cc0") || /^cc by(-sa)? \d/.test(s)
}
const strip = (s = "") => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()

export async function searchCommons(query: string, fetcher: Fetcher = fetch as Fetcher, limit = 12): Promise<MediaCandidate[]> {
  const u = new URL("https://commons.wikimedia.org/w/api.php")
  u.search = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: String(Math.min(limit * 2, 40)), prop: "imageinfo", iiprop: "url|size|extmetadata|mime", iiurlwidth: "1920", origin: "*" }).toString()
  const res = await fetcher(u, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`commons_http_${res.status}`)
  const data = await res.json() as { query?: { pages?: Record<string, { title?: string; index?: number; imageinfo?: { url?: string; thumburl?: string; width?: number; height?: number; mime?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }> } }
  const out: (MediaCandidate & { rank: number })[] = []
  for (const p of Object.values(data.query?.pages ?? {})) {
    const ii = p.imageinfo?.[0], m = ii?.extmetadata ?? {}
    if (!ii?.url || !ii.descriptionurl || !/^image\/(jpeg|png)$/.test(ii.mime || "")) continue
    const license = strip(m.LicenseShortName?.value)
    if (!usableLicense(license)) continue
    const width = ii.width ?? 0, height = ii.height ?? 0
    if (Math.min(width, height) < MIN_SHORT_SIDE) continue
    const creator = strip(m.Artist?.value) || "Unknown", credit = strip(m.Credit?.value)
    const usGovernment = /u\.?s\.? (army|navy|air force|marine|space force|coast guard|department of defense|dod)|dvids|\.mil\b|nasa/i.test(`${creator} ${credit} ${m.LicenseShortName?.value ?? ""} ${m.UsageTerms?.value ?? ""} ${strip(m.Copyright?.value)}`)
    // Commons serves thumbnails only at its standard widths (330, 500, 960, 1280, 1920, …); others return 400.
    const scaled = width > 1920 && ii.thumburl && /\/1920px/.test(ii.thumburl) ? ii.thumburl : null
    const thumb = scaled ? scaled.replace(/\/1920px/, "/500px") : ii.url
    out.push({ origin: "commons", rank: p.index ?? 99, url: scaled ?? ii.url, thumbUrl: thumb, pageUrl: ii.descriptionurl, title: (p.title || "").replace(/^File:/, ""), description: strip(m.ImageDescription?.value).slice(0, 400), width, height, license, creator: creator.slice(0, 200), credit: `${creator.slice(0, 120)}${license ? ` / ${license}` : ""} via Wikimedia Commons`, ...(m.DateTimeOriginal?.value ? { date: strip(m.DateTimeOriginal.value).slice(0, 40) } : {}), usGovernment })
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ rank, ...c }) => (void rank, c))
}

// ── Photos on the story's own pages and on DVIDS ──
/**
 * Smallest usable short side. The approved ULTRA card used a 1000 × 667 DVIDS rendition, cropped and upscaled, so the
 * old 1000 px floor rejected the very kind of photo MCU has published; whether the 4:5 crop holds up is judged per photo.
 */
export const MIN_SHORT_SIDE = 600
/** Pixel size from a JPEG or PNG header, or null when it can't be read. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b.length >= 24) return { width: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, height: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0 }
  if (b[0] !== 0xff || b[1] !== 0xd8) return null
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) { i++; continue }
    const marker = b[i + 1], len = b[i + 2] << 8 | b[i + 3]
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: b[i + 5] << 8 | b[i + 6], width: b[i + 7] << 8 | b[i + 8] }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
    i += 2 + len
  }
  return null
}
export const isDvidsImagePage = (u: string) => /^https:\/\/(www\.)?dvidshub\.net\/image\/\d+/i.test(u)
const GOV_HOST = /(^|\.)(mil|gov)$|(^|\.)dvidshub\.net$/i
/**
 * The share photo of a page as a candidate, with its rights read from the page. A U.S. military or government page's
 * own photo credited "(U.S. Army photo by …)" is a public-domain government work; "courtesy" photos and company pages
 * are company media, offered first by the editorial rules but flagged for the reviewer to confirm the terms.
 */
export function pageImageCandidate(page: SourcePage, origin: "source" | "dvids"): MediaCandidate | null {
  if (!page.image || !/^https:\/\//.test(page.image)) return null
  const host = new URL(page.url).hostname, about = `${page.description ?? ""} ${page.text.slice(0, 4000)}`
  const govCredit = /\(((?:U\.S\.|US) [A-Za-z .]+? (?:photo|illustration|graphic)(?: by [^)]{2,80})?)\)/.exec(about)?.[1]
  const courtesy = /\((?:[^)]*?)courtesy(?: of)? ([^)]{2,80})\)/i.exec(about)?.[1]
  const gov = GOV_HOST.test(host) && !courtesy
  const creator = gov ? govCredit ?? `${page.siteName || host}` : courtesy ?? page.siteName ?? host
  const date = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, (20\d{2})\b/.exec(page.description ?? "")?.[0]
  const dated = date ? new Date(`${date.replace(/\.|Sept/g, m => m === "Sept" ? "Sep" : "")} UTC`) : null
  return {
    origin, url: page.image, thumbUrl: page.image, pageUrl: page.url, title: page.title.slice(0, 200), description: (page.description ?? "").slice(0, 400),
    width: 0, height: 0, creator: creator.slice(0, 200),
    license: gov ? "Public domain (U.S. government work)" : courtesy ? "Courtesy photo" : "Official company media",
    credit: gov ? creator : `${creator} (courtesy)`, usGovernment: gov,
    ...(dated && Number.isFinite(dated.getTime()) ? { date: dated.toISOString().slice(0, 10) } : {}),
    ...(gov ? {} : { rightsNote: `Company media from ${host}: confirm its terms allow editorial use before approving` }),
  }
}

import { lookup } from "node:dns/promises"
import net from "node:net"

/**
 * Server-side sourcing for the MCU skill, no browser: read a source page as text (with its stated publication date and
 * share image and description), read the rights of a page's own photo (agency, DVIDS or company media), and find
 * openly licensed photos on Wikimedia Commons with their license, creator and credit. Every fetch is https-only, refuses private and internal
 * addresses, is size- and time-bounded, and identifies itself honestly.
 */
// The standard form for a named crawler ("Mozilla/5.0 (compatible; <bot>; +<url>)", as Googlebot and Bingbot use):
// still says plainly who is asking, and isn't rejected by servers that refuse anything not starting "Mozilla/".
export const USER_AGENT = "Mozilla/5.0 (compatible; 434MEDIA-content-bot/1.0; +https://www.434media.com)"
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
/**
 * Follows up to 4 redirects, re-checking each hop. A hop to plain http is asked for over https instead (servers
 * behind a TLS proxy often redirect to their own http:// address); the hop is then checked like any other, so
 * nothing is ever fetched without TLS. Gate round 1 (2026-10-17) dropped a Breaking Defense article as "https_only"
 * although its URL was https: the error named the first URL, not the hop that failed, which it now does.
 */
export async function guardedFetch(raw: string, fetcher: Fetcher, accept: string, check = assertPublicHttps): Promise<Response> {
  let url = await check(raw)
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetcher(url, { headers: { "user-agent": USER_AGENT, accept, "accept-language": "en-US,en;q=0.8" }, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000) })
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null
    if (!loc) return res
    const next = new URL(loc, url)
    if (next.protocol === "http:") { next.protocol = "https:"; if (next.port === "80") next.port = "" }
    try { url = await check(next.toString()) } catch (err) { throw new Error(`${err instanceof Error ? err.message : "blocked"} (redirect to ${next.toString().slice(0, 160)})`) }
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
/**
 * Text a script-rendered page carries outside its markup: JSON-LD articleBody and description strings, then the
 * meta description. Used when the page's own markup has too little readable text (Anduril's Thunder page: 0
 * characters of body text, 2026-10-17).
 */
function embeddedText(html: string): string {
  const ld = [...html.matchAll(/"(?:articleBody|description)"\s*:\s*"((?:[^"\\]|\\.){40,})"/g)].map(m => { try { return JSON.parse(`"${m[1]}"`) as string } catch { return "" } })
  return [...new Set([...ld, meta(html, "og:description") ?? "", meta(html, "description") ?? ""].map(t => decode(t).trim()).filter(Boolean))].join("\n").slice(0, 20_000)
}
export function parsePage(url: string, html: string): SourcePage {
  const ld = [...html.matchAll(/"datePublished"\s*:\s*"([^"]+)"/g)].map(m => m[1])[0]
  const publishedAt = meta(html, "article:published_time") || ld || meta(html, "datePublished") || meta(html, "date") || meta(html, "DC.date.issued")
  const title = meta(html, "og:title") || decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "").trim()
  const body = pageText(html), text = body.length >= 400 ? body : [body, embeddedText(html)].filter(Boolean).join("\n").slice(0, 40_000)
  return { url, title, text, ...(publishedAt ? { publishedAt } : {}), ...(meta(html, "og:image") ? { image: meta(html, "og:image") } : {}), ...(meta(html, "og:site_name") ? { siteName: meta(html, "og:site_name") } : {}), ...(meta(html, "og:description") ? { description: meta(html, "og:description") } : {}) }
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
  /** Where it was found: the story's own pages (or a government or maker page found by search), a DVIDS image page, or an open archive. */
  origin?: "source" | "dvids" | "commons" | "openverse" | "nasa"
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

const GOV_CREDIT = /u\.?s\.? (army|navy|air force|marine|space force|coast guard|department of (defense|war))|\bdod\b|dvids|\.mil\b|\bnasa\b|national guard/i
const OPENVERSE_LICENSE: Record<string, string> = { pdm: "Public domain", cc0: "CC0", by: "CC BY", "by-sa": "CC BY-SA" }

/**
 * Openverse (WordPress.org's open-media index: Flickr, museums, government collections and more), anonymous: no
 * key or account. Only public-domain, CC0, CC BY and CC BY-SA images are kept (its server-side license filter is not
 * relied on), each with its creator, license and the item's own page.
 */
export async function searchOpenverse(query: string, fetcher: Fetcher = fetch as Fetcher, limit = 12): Promise<MediaCandidate[]> {
  const u = new URL("https://api.openverse.org/v1/images/")
  u.search = new URLSearchParams({ q: query, license: "pdm,cc0,by,by-sa", page_size: String(Math.min(limit * 2, 40)), mature: "false" }).toString()
  const res = await fetcher(u, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`openverse_http_${res.status}`)
  const data = await res.json() as { results?: { title?: string; foreign_landing_url?: string; url?: string; creator?: string; license?: string; license_version?: string; source?: string; width?: number; height?: number; filetype?: string | null }[] }
  const out: MediaCandidate[] = []
  for (const r of data.results ?? []) {
    const short = OPENVERSE_LICENSE[String(r.license || "").toLowerCase()]
    const license = short ? `${short}${r.license_version && short.startsWith("CC BY") ? ` ${r.license_version}` : ""}`.trim() : ""
    if (!license || !usableLicense(license === "CC0" ? "cc0" : license) || !r.url || !r.foreign_landing_url || !/^https:\/\//.test(r.url) || !/^https:\/\//.test(r.foreign_landing_url)) continue
    if (r.filetype && !/^(jpe?g|png)$/i.test(r.filetype)) continue
    const width = r.width ?? 0, height = r.height ?? 0
    if (width && height && Math.min(width, height) < MIN_SHORT_SIDE) continue
    const creator = strip(r.creator) || "Unknown", from = r.source || "Openverse"
    out.push({ origin: "openverse", url: r.url, thumbUrl: r.url, pageUrl: r.foreign_landing_url, title: strip(r.title).slice(0, 200) || "Untitled", description: "", width, height, license, creator: creator.slice(0, 200), credit: `${creator.slice(0, 120)} / ${license} via ${from}`, usGovernment: GOV_CREDIT.test(`${creator} ${from}`) })
  }
  return out.slice(0, limit)
}

/**
 * NASA Image and Video Library, anonymous: NASA imagery is generally not copyrighted. Items whose description or
 * credit names a copyright or courtesy holder are skipped, since their rights can't be established here.
 */
export async function searchNasa(query: string, fetcher: Fetcher = fetch as Fetcher, limit = 8): Promise<MediaCandidate[]> {
  const u = new URL("https://images-api.nasa.gov/search")
  u.search = new URLSearchParams({ q: query, media_type: "image", page_size: String(limit * 2) }).toString()
  const res = await fetcher(u, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`nasa_http_${res.status}`)
  const data = await res.json() as { collection?: { items?: { data?: { nasa_id?: string; title?: string; description?: string; photographer?: string; secondary_creator?: string; center?: string; date_created?: string }[] }[] } }
  const out: MediaCandidate[] = []
  for (const it of data.collection?.items ?? []) {
    const m = it.data?.[0]
    if (!m?.nasa_id || !/^[A-Za-z0-9_.-]{3,120}$/.test(m.nasa_id)) continue
    const who = strip(m.photographer || m.secondary_creator || "") || `NASA${m.center ? ` ${m.center}` : ""}`
    if (/©|copyright|courtesy/i.test(`${m.description ?? ""} ${who}`)) continue
    const id = encodeURIComponent(m.nasa_id), creator = /nasa/i.test(who) ? who : `NASA / ${who}`
    out.push({ origin: "nasa", url: `https://images-assets.nasa.gov/image/${id}/${id}~large.jpg`, thumbUrl: `https://images-assets.nasa.gov/image/${id}/${id}~large.jpg`, pageUrl: `https://images.nasa.gov/details/${id}`, title: strip(m.title).slice(0, 200) || m.nasa_id, description: strip(m.description).slice(0, 400), width: 0, height: 0, license: "Public domain (NASA)", creator: creator.slice(0, 200), credit: creator.slice(0, 160), ...(m.date_created ? { date: m.date_created.slice(0, 10) } : {}), usGovernment: true })
    if (out.length >= limit) break
  }
  return out
}

const CONTEXT_WORDS = /\b(military|defen[cs]e|army|navy|naval|air ?force|marines?|space ?force|coast guard|soldiers?|sailors?|airmen|troops?|aircraft|jets?|fighters?|drones?|uas|unmanned|uncrewed|autonomous|missiles?|rockets?|launch(er|es)?|satellites?|spacecraft|vessels?|ships?|submarines?|vehicles?|tanks?|helicopters?|radar|weapons?|artillery|nasa|dod|dvids|exercise|test flight|prototype)\b/i
const NOT_A_PHOTO = /\b(logo|logotype|wordmark|icon|emblem|seal|insignia|badge|coat of arms|diagram|chart|map|infographic|screenshot)\b/i
/**
 * An open-archive hit is offered to the photo pick only when its own text ties it to the story: it names the maker,
 * or it is defense or space imagery (a context word, or a government creator), and it is not a logo or graphic. A
 * search for "Hivemind" also finds a comic writers' Dragon Con panel and a logo of that name (preview, 2026-10-17);
 * neither passes. The story's own pages and pages found by the photo search are not filtered here.
 */
export function archiveRelevant(c: Pick<MediaCandidate, "title" | "description" | "creator" | "usGovernment">, maker?: string): boolean {
  const text = `${c.title} ${c.description}`
  if (NOT_A_PHOTO.test(c.title)) return false
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const m = maker ? norm(maker) : ""
  return (m.length > 2 && norm(`${text} ${c.creator}`).includes(m)) || CONTEXT_WORDS.test(text) || c.usGovernment
}

// ── News outlets: secondary sources, and never a photo source ──
/**
 * News outlets' hosts. Their pages lead to a story's primary source (the editorial rules: "use secondary coverage only
 * to find it") and their photos are licensed to them. Gate round 2 (2026-10-17) placed Defense News photos labelled
 * "Official company media" and sourced two DT101 cards from Defense News articles. The seeds' outlet list adds to it.
 */
const OUTLETS = ["defensenews.com", "breakingdefense.com", "defenseone.com", "defensescoop.com", "c4isrnet.com", "militarytimes.com", "armytimes.com", "navytimes.com", "airforcetimes.com", "marinecorpstimes.com", "federaltimes.com", "airandspaceforces.com", "twz.com", "thedrive.com", "janes.com", "insidedefense.com", "nationaldefensemagazine.org", "flightglobal.com", "aviationweek.com", "spacenews.com", "military.com", "stripes.com", "navalnews.com", "defence-blog.com", "armyrecognition.com", "overtdefense.com", "sandboxx.us", "defensedaily.com", "executivegov.com", "govconwire.com", "washingtontechnology.com", "fedscoop.com", "nextgov.com", "reuters.com", "apnews.com", "bloomberg.com", "wsj.com", "nytimes.com", "washingtonpost.com", "politico.com", "axios.com", "cnn.com", "cnbc.com", "foxnews.com", "nbcnews.com", "cbsnews.com", "abcnews.go.com", "bbc.com", "bbc.co.uk", "theguardian.com", "newsweek.com", "forbes.com", "businessinsider.com", "yahoo.com", "msn.com", "techcrunch.com", "theverge.com", "wired.com", "popularmechanics.com", "interestingengineering.com", "newatlas.com", "thedefensepost.com", "defense-aerospace.com", "army-technology.com", "naval-technology.com", "airforce-technology.com", "globalmilitaryreview.com", "militaryaerospace.com", "satnews.com", "spacepolicyonline.com"]
export function isOutlet(url: string, extra: readonly string[] = []): boolean {
  let host: string
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, "") } catch { return false }
  return [...OUTLETS, ...extra.map(e => e.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))].some(o => o && (host === o || host.endsWith(`.${o}`)))
}
const NOT_A_NAME = new Set(["the", "inc", "corp", "company", "news", "newsroom", "media", "group", "official", "site", "home", "website", "www"])
/**
 * The organization a site names itself, without a trademark or slogan: og:site_name is sometimes a tagline
 * ("L3Harris® Fast. Forward.", gate round 2), which then printed as the image credit. The name is trusted only when
 * it agrees with the page's own host, by a distinctive word, the whole name run together, or its initials: site
 * metadata goes stale (rtx.com still names itself "United Technologies", RTX's parent before 2020, gate round 6). A
 * stale name gives way to the host's name as the page's title writes it ("RTX's Raytheon awarded …" → "RTX"), else
 * to the host itself. The photo's page is what is credited: its publisher, never a name it no longer uses.
 */
export function siteOrg(siteName: string | undefined, host: string, title = ""): string {
  const cut = (siteName ?? "").split(/[®™©|]| [-–—:] /)[0].trim()
  const bareHost = host.toLowerCase().replace(/^www\./, ""), labels = bareHost.split(".").slice(0, -1).filter(l => !NOT_A_NAME.has(l)).map(l => l.replace(/-/g, ""))
  const ws = cut.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const agrees = ws.filter(w => w.length >= 3 && !NOT_A_NAME.has(w)).some(w => labels.some(l => l.includes(w)))
    || labels.some(l => l.length >= 3 && (ws.join("").includes(l) || ws.join("") === l || (ws.length > 1 && l.startsWith(ws.map(w => w[0]).join("")))))
  if (cut && cut.length <= 40 && agrees) return cut
  const named = title.match(/[\p{L}\p{N}][\p{L}\p{N}&-]*/gu)?.find(t => labels.includes(t.toLowerCase().replace(/-/g, "")))
  return named ?? (cut && cut.length <= 40 && !labels.length ? cut : bareHost)
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
/**
 * Federal hosts, whose own photos are U.S. government works and so public domain (17 U.S.C. §105). Every .mil host and
 * DVIDS, plus an allowlist of federal .gov domains. A state, county or city .gov is not on it: those governments
 * usually hold copyright in their photos (security review, 2026-10-17, finding 1).
 */
const FEDERAL_GOV = ["defense.gov", "war.gov", "nasa.gov", "dhs.gov", "fema.gov", "cbp.gov", "ice.gov", "tsa.gov", "faa.gov", "dot.gov", "energy.gov", "state.gov", "va.gov", "noaa.gov", "weather.gov", "nist.gov", "usgs.gov", "nps.gov", "doi.gov", "usda.gov", "commerce.gov", "justice.gov", "fbi.gov", "treasury.gov", "whitehouse.gov", "congress.gov", "senate.gov", "house.gov", "gao.gov", "usa.gov", "nsf.gov", "nih.gov", "hhs.gov", "cdc.gov", "epa.gov", "sba.gov", "usaid.gov", "nro.gov", "dni.gov", "cia.gov"]
export function federalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "")
  return /(^|\.)(mil|dvidshub\.net|fed\.us)$/.test(h) || FEDERAL_GOV.some(d => h === d || h.endsWith(`.${d}`))
}
/** Hosts that serve a federal site's own photos from another domain (DVIDS's image CDNs). */
const GOV_MEDIA_HOSTS = ["d1ldvf68ux039x.cloudfront.net", "d34w7g4gy10iej.cloudfront.net"]
/** The registrable part of a host, as two labels: enough for .mil, .gov and .com, which are what this compares. */
const site = (host: string) => host.toLowerCase().split(".").slice(-2).join(".")
/**
 * The share photo of a page as a candidate, with its rights read from the page. It is a public-domain government work
 * only when all of these hold: the page is on a federal host; the photo is served from that same site or a known
 * government media host (a contractor's CDN is not); and no courtesy or copyright notice appears anywhere on the page.
 * Its credit is the "(U.S. Army photo by …)" line, taken from the page's description first, which describes the share
 * photo itself. Any other government page's photo is offered with a rights note naming why it isn't public domain;
 * "courtesy" photos and company pages are company media, offered first by the editorial rules but flagged for the
 * reviewer to confirm the terms.
 */
export function pageImageCandidate(page: SourcePage, origin: "source" | "dvids"): MediaCandidate | null {
  if (!page.image || !/^https:\/\//.test(page.image) || isOutlet(page.url)) return null
  const host = new URL(page.url).hostname, imageHost = new URL(page.image).hostname.toLowerCase(), whole = `${page.description ?? ""} ${page.text}`
  const credit = /\(((?:U\.S\.|US) [A-Za-z .]+? (?:photo|illustration|graphic)(?: by [^)]{2,80})?)\)/
  const govCredit = credit.exec(page.description ?? "")?.[1] ?? credit.exec(page.text)?.[1]
  const courtesy = /\((?:[^)]*?)courtesy(?: of)? ([^)]{2,80})\)/i.exec(whole)?.[1]
  // A notice, not the word: DVIDS pages link to their own "about/copyright" terms page on every public-domain image.
  const copyright = /©|\(c\)\s*(19|20)\d{2}|\bcopyright(ed)?\s+(\(c\)|(19|20)\d{2}|by\b)|all rights reserved/i.test(whole)
  const federal = federalHost(host), onSite = site(imageHost) === site(host) || GOV_MEDIA_HOSTS.includes(imageHost)
  const gov = federal && onSite && !courtesy && !copyright
  // A government page whose photo isn't a federal work: say which test it failed, so the reviewer knows what to check.
  const govNote = courtesy || gov || !/(^|\.)(mil|gov)$|(^|\.)dvidshub\.net$|(^|\.)fed\.us$/i.test(host) ? undefined
    : !federal ? `${host} is not a federal site, so its photos are not public domain: confirm its terms allow editorial use before approving`
    : !onSite ? `The photo on ${host} is served from ${imageHost}, not a government media host: confirm who owns it before approving`
    : `${host} carries a copyright notice: confirm the photo's terms allow editorial use before approving`
  const creator = gov ? govCredit ?? siteOrg(page.siteName, host, page.title) : courtesy ?? siteOrg(page.siteName, host, page.title)
  const date = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, (20\d{2})\b/.exec(page.description ?? "")?.[0]
  const dated = date ? new Date(`${date.replace(/\.|Sept/g, m => m === "Sept" ? "Sep" : "")} UTC`) : null
  return {
    origin, url: page.image, thumbUrl: page.image, pageUrl: page.url, title: page.title.slice(0, 200), description: (page.description ?? "").slice(0, 400),
    width: 0, height: 0, creator: creator.slice(0, 200),
    license: gov ? "Public domain (U.S. government work)" : courtesy ? "Courtesy photo" : govNote ? "Government media (confirm terms)" : "Official company media",
    credit: gov ? creator : `${creator} (courtesy)`, usGovernment: gov,
    ...(dated && Number.isFinite(dated.getTime()) ? { date: dated.toISOString().slice(0, 10) } : {}),
    ...(gov ? {} : { rightsNote: govNote ?? `Company media from ${host}: confirm its terms allow editorial use before approving` }),
  }
}

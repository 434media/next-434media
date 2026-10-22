import type { ContentPost, SocialPlatform } from "@/components/crm/types"
import type { MetaBatch, MetaDestination, MetaFormat } from "@/lib/owned-meta-publisher"
import type { PrepareChoices } from "@/lib/owned-meta-execution"
import { CREATE_PLATFORMS, FORMAT_LABEL, isHandPosted, type CreateFormat } from "./create-table"

/**
 * The approval drawer (plan v11.1 Step 3 item 2): a Create row's format variations, approved together. Each variation
 * is its own content post (one Canva design each). A variation going to Instagram and Facebook is approved through the
 * owned-Meta publisher: a manifest is prepared from the post's saved exports and the approval is bound to its hash. A
 * variation going only to hand-posted platforms (TikTok, YouTube Shorts, LinkedIn) is approved bound to its export
 * fingerprint. Approval comes from the signed-in session (super-admin or the content permission), never Slack.
 *
 * Client-safe: the drawer shows the same readiness the server enforces. Storage, Canva and the publisher are injected.
 */
export const APPROVED_STATUSES = ["approved", "scheduled", "posted"] as const
export const isApproved = (p: Pick<ContentPost, "status">) => (APPROVED_STATUSES as readonly string[]).includes(p.status)
export const formatOf = (p: Pick<ContentPost, "create_format">): CreateFormat => p.create_format === "reels" ? "reels" : "feed"
/** The social platforms a format's design can go to (TikTok and Shorts take 9:16; LinkedIn takes 4:5). */
export const platformsFor = (format: CreateFormat): SocialPlatform[] => [...new Set(CREATE_PLATFORMS.filter(p => p.format === format).map(p => p.platform))]

/** A variation with no platforms ticked stays in Review and is left out of the row's approval. */
export const goesOut = (p: Pick<ContentPost, "social_platforms">) => (p.social_platforms ?? []).length > 0
export const publisherPlatforms = (p: Pick<ContentPost, "social_platforms">) => (p.social_platforms ?? []).filter(x => !isHandPosted(x))
export const handPlatforms = (p: Pick<ContentPost, "social_platforms">) => (p.social_platforms ?? []).filter(isHandPosted)

/** Something already went out (or is going out): the variation's files, caption, date and platforms are fixed. */
export const frozen = (p: Pick<ContentPost, "status" | "owned_meta" | "hand_posts">) => p.status === "posted" || !!p.owned_meta?.started || !!p.hand_posts?.length

/**
 * Whether the variation's approval covers what it holds now. A publisher approval is reset by the publisher's guarded
 * update whenever files, caption, platforms or date change, so its status says it. A hand-post approval must name the
 * current export fingerprint: a status set any other way (the post drawer's status menu) doesn't count.
 */
export function approvalCovers(p: Pick<ContentPost, "status" | "owned_meta" | "approvals" | "export_fingerprint" | "hand_posts">): boolean {
  if (p.status === "posted" || p.hand_posts?.length) return true
  if (!isApproved(p)) return false
  if (p.owned_meta) return true
  const last = p.approvals?.[p.approvals.length - 1]
  return last?.decision === "approved" && !!last.export_fingerprint && last.export_fingerprint === p.export_fingerprint
}
/** Waiting for the row's approval: it goes out, its current files aren't approved, and nothing of it is out yet. */
export const awaitingApproval = (p: ContentPost) => goesOut(p) && !approvalCovers(p) && !frozen(p)

/** Why a variation can't be approved yet, in the person's words; null when it can. The server checks the same. */
export function readiness(p: ContentPost): string | null {
  if (p.pipeline_outcome) return "This card is a notice, not a post"
  if (!p.canva_design_id) return "Attach a Canva design first (paste its link)"
  if (!p.assets?.length || !p.export_fingerprint) return "The design isn't exported yet; use Refresh from Canva"
  if (publisherPlatforms(p).length === 1) return "The publisher posts to Instagram and Facebook together; tick both, or neither and post by hand"
  if (!p.social_copy?.trim()) return "Write the caption"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date_to_post ?? "")) return "Pick a post date"
  return null
}

/** What the reviewer was shown of a variation; an approval binds all of it, not only the files. */
export interface Shown { fingerprint: string; caption: string; date: string; platforms: string[] }
export const shownOf = (p: ContentPost): Shown => ({ fingerprint: p.export_fingerprint ?? "", caption: p.social_copy ?? "", date: p.date_to_post ?? "", platforms: [...(p.social_platforms ?? [])].sort() })
export const sameShown = (a: Shown, b: Shown) => a.fingerprint === b.fingerprint && a.caption === b.caption && a.date === b.date && [...a.platforms].sort().join() === [...b.platforms].sort().join()

/** The AI declarations a reviewer makes for the row: AI media at all, and (for a video) whether it is photorealistic. */
export interface AiChoice { aiGenerated: boolean; aiRealisticMedia?: boolean }

/** The publisher's choices for a variation's saved exports: format and placements follow the files and the design. */
export function prepareChoices(p: ContentPost, ai: AiChoice): PrepareChoices {
  const video = p.assets.some(a => a.kind === "video")
  const format: MetaFormat = video ? "video" : p.assets.length > 1 ? "carousel" : "still"
  const reels = formatOf(p) === "reels"
  return {
    brand: (p.intake?.metaBrand ?? "") as PrepareChoices["brand"], format,
    captions: { instagram: p.social_copy ?? "", facebook: p.social_copy ?? "" },
    placements: video ? { instagram: "reels", facebook: reels ? "reels" : "video" } : { instagram: "feed", facebook: "feed" },
    // The 4:5 video is the feed variation, so its Reel shows on the grid; the 9:16 Reel stays in Reels.
    instagramShareToFeed: video && !reels,
    aiGenerated: ai.aiGenerated,
    // Meta's disclosure rule asks an AI video whether it is photorealistic or has realistic audio.
    ...(video && ai.aiGenerated ? { aiRealisticMedia: ai.aiRealisticMedia === true } : {}),
    publicHostingApproved: true,
    templateRevision: p.profile_version_id ?? "unknown",
  }
}

export class RowApprovalError extends Error {
  constructor(readonly problems: string[], readonly status: 400 | 409 | 423 = 409) { super(problems.join("; ")) }
}

export interface ApproveRowDeps {
  listRow(rowId: string): Promise<ContentPost[]>
  prepare(postId: string, choices: PrepareChoices): Promise<MetaBatch>
  preflight(batch: MetaBatch): Record<MetaDestination, string | null>
  decide(postId: string, revision: number, hash: string): Promise<MetaBatch>
  /** Approves a hand-only variation in one transaction that checks it still holds exactly what was shown. */
  approveHand(postId: string, shown: Shown): Promise<void>
  /** SHA-256 of the ordered file hashes (owned-meta-intake exportFingerprint). */
  fingerprintOf(sha256s: string[]): string
}
export interface ApprovedVariation { postId: string; format: CreateFormat; via: "publisher" | "hand"; hash: string }

/** Every variation waiting for approval still holds exactly what was shown, and nothing else is waiting. */
function shownProblems(posts: ContentPost[], shown: Record<string, Shown>): string[] {
  const waiting = posts.filter(awaitingApproval)
  if (!waiting.length) return ["Nothing in this row is waiting for approval"]
  if (Object.keys(shown).sort().join() !== waiting.map(p => p.id).sort().join()) return ["The row changed since it was shown; reload before approving"]
  return waiting.filter(p => !sameShown(shownOf(p), shown[p.id])).map(p => `${FORMAT_LABEL[formatOf(p)]}: it changed since it was shown (design, caption, date or platforms); reload`)
}

/**
 * Approves every variation of the row that is waiting, together, bound to what the reviewer was shown (`shown`: each
 * variation's export fingerprint, caption, date and platforms). Everything is checked first; then every publisher
 * manifest is prepared and checked (same files, same caption, no format hold); the row is read again; only then is
 * anything approved. A failure before that point approves nothing (an unapproved manifest is harmless and is replaced
 * on the next try). A failure while approving names what was approved, so the person sees the row's real state.
 */
export async function approveRow(deps: ApproveRowDeps, rowId: string, shown: Record<string, Shown>, ai: AiChoice): Promise<ApprovedVariation[]> {
  const posts = await deps.listRow(rowId)
  let problems = shownProblems(posts, shown)
  if (problems.length) throw new RowApprovalError(problems)
  const waiting = posts.filter(awaitingApproval)
  for (const p of waiting) { const why = readiness(p); if (why) problems.push(`${FORMAT_LABEL[formatOf(p)]}: ${why}`) }
  if (problems.length) throw new RowApprovalError(problems)

  const prepared: { post: ContentPost; batch: MetaBatch }[] = []
  for (const p of waiting.filter(x => publisherPlatforms(x).length)) {
    const batch = await deps.prepare(p.id, prepareChoices(p, ai))
    const label = FORMAT_LABEL[formatOf(p)]
    if (deps.fingerprintOf(batch.manifest.assets.map(a => a.sha256)) !== shown[p.id].fingerprint) problems.push(`${label}: the files read for approval differ from the design shown; reload`)
    if (batch.manifest.captions.instagram !== shown[p.id].caption || batch.manifest.captions.facebook !== shown[p.id].caption) problems.push(`${label}: the caption changed since it was shown; reload`)
    for (const [d, hold] of Object.entries(deps.preflight(batch))) if (hold) problems.push(`${label}, ${d === "instagram" ? "Instagram" : "Facebook"}: ${hold}`)
    prepared.push({ post: p, batch })
  }
  if (problems.length) throw new RowApprovalError(problems)
  // Read again just before approving: an edit made meanwhile (another person, the post drawer) stops the row.
  problems = shownProblems(await deps.listRow(rowId), shown)
  if (problems.length) throw new RowApprovalError(problems)

  const out: ApprovedVariation[] = []
  try {
    for (const { post, batch } of prepared) {
      await deps.decide(post.id, batch.manifest.revision, batch.hash)
      out.push({ postId: post.id, format: formatOf(post), via: "publisher", hash: batch.hash })
    }
    for (const p of waiting.filter(x => !publisherPlatforms(x).length)) {
      await deps.approveHand(p.id, shown[p.id])
      out.push({ postId: p.id, format: formatOf(p), via: "hand", hash: shown[p.id].fingerprint })
    }
  } catch (err) {
    const done = out.map(o => FORMAT_LABEL[o.format]).join(", ")
    throw new RowApprovalError([`Approval stopped: ${err instanceof Error ? err.message : "a variation changed"}. ${done ? `Approved before it stopped: ${done}.` : "Nothing was approved."} Reload to see the row.`])
  }
  return out
}

/** A Canva design id from a pasted design link (canva.com/design/<id>/…) or a bare id; null when it is neither. */
export function canvaDesignIdFromLink(raw: string): string | null {
  const s = raw.trim()
  if (/^[A-Za-z0-9_-]{6,64}$/.test(s)) return s
  let url: URL
  try { url = new URL(s) } catch { return null }
  if (url.protocol !== "https:" || !/(^|\.)canva\.com$/.test(url.hostname)) return null
  const m = /^\/design\/([A-Za-z0-9_-]{6,64})(\/|$)/.exec(url.pathname)
  return m ? m[1] : null
}

/**
 * A design id from a pasted link, following a canva.link short link (Canva's Share → Copy link) on the server: each
 * hop must stay on canva.link or canva.com, at most five hops. Null when the link names no design.
 */
export async function resolveCanvaDesignLink(raw: string, fetcher: typeof fetch): Promise<string | null> {
  const direct = canvaDesignIdFromLink(raw)
  if (direct) return direct
  let url: URL
  try { url = new URL(raw.trim()) } catch { return null }
  if (url.protocol !== "https:" || url.hostname !== "canva.link") return null
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetcher(url, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000) })
    const location = res.headers.get("location")
    await res.body?.cancel().catch(() => {})
    if (!location) return null
    let next: URL
    try { next = new URL(location, url) } catch { return null }
    const id = canvaDesignIdFromLink(next.toString())
    if (id) return id
    if (next.protocol !== "https:" || !(next.hostname === "canva.link" || /(^|\.)canva\.com$/.test(next.hostname))) return null
    url = next
  }
  return null
}

/** Pages typed as "2" or "1, 3" (1–10 page numbers, in order); null when it isn't that. */
export function parsePages(raw: string): number[] | null {
  const parts = raw.split(/[\s,]+/).filter(Boolean)
  if (!parts.length || parts.length > 10 || parts.some(p => !/^\d{1,3}$/.test(p))) return null
  const pages = parts.map(Number)
  return pages.every(n => n >= 1 && n <= 200) && new Set(pages).size === pages.length ? pages : null
}

/** Today's date (YYYY-MM-DD) where the posts go out: 434 Media posts on San Antonio time. */
export const POSTING_TIME_ZONE = "America/Chicago"
export const todayIn = (timeZone = POSTING_TIME_ZONE, now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
/**
 * A variation dated after today. Publish now posts at once, whatever the date: scheduled publishing on a date is plan
 * Step 5, so until then publishing such a post early needs an explicit confirmation.
 */
export const futureDated = (p: Pick<ContentPost, "date_to_post">, today = todayIn()) => /^\d{4}-\d{2}-\d{2}$/.test(p.date_to_post ?? "") && p.date_to_post! > today

/** How a variation's design is exported: every 9:16 design and any design with a video as one MP4, else JPG pages. */
export const exportAs = (p: Pick<ContentPost, "create_format" | "assets">, format: CreateFormat = formatOf(p)): "mp4" | "jpg" =>
  format === "reels" || p.assets.some(a => a.kind === "video") ? "mp4" : "jpg"

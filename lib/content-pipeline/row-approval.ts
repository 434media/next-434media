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

/** The publisher's choices for a variation's saved exports: format and placements follow the files and the design. */
export function prepareChoices(p: ContentPost, aiGenerated: boolean): PrepareChoices {
  const video = p.assets.some(a => a.kind === "video")
  const format: MetaFormat = video ? "video" : p.assets.length > 1 ? "carousel" : "still"
  const reels = formatOf(p) === "reels"
  return {
    brand: (p.intake?.metaBrand ?? "") as PrepareChoices["brand"], format,
    captions: { instagram: p.social_copy ?? "", facebook: p.social_copy ?? "" },
    placements: video ? { instagram: "reels", facebook: reels ? "reels" : "video" } : { instagram: "feed", facebook: "feed" },
    // The 4:5 video is the feed variation, so its Reel shows on the grid; the 9:16 Reel stays in Reels.
    instagramShareToFeed: video && !reels,
    aiGenerated, publicHostingApproved: true,
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
  approveHand(postId: string, fingerprint: string): Promise<void>
  /** SHA-256 of the ordered file hashes (owned-meta-intake exportFingerprint). */
  fingerprintOf(sha256s: string[]): string
}
export interface ApprovedVariation { postId: string; format: CreateFormat; via: "publisher" | "hand"; hash: string }

/**
 * Approves every variation of the row that goes out, together, bound to what the reviewer was shown: `shown` maps each
 * such post to the export fingerprint the drawer displayed. Everything is checked first; then every publisher manifest
 * is prepared and checked (same files, no format hold); only then is anything approved. A failure before that point
 * approves nothing (an unapproved manifest is harmless and is replaced on the next try).
 */
export async function approveRow(deps: ApproveRowDeps, rowId: string, shown: Record<string, string>, aiGenerated: boolean): Promise<ApprovedVariation[]> {
  const posts = (await deps.listRow(rowId)).filter(p => goesOut(p) && !isApproved(p))
  if (!posts.length) throw new RowApprovalError(["Nothing in this row is waiting for approval"])
  const ids = Object.keys(shown).sort()
  if (ids.join() !== posts.map(p => p.id).sort().join()) throw new RowApprovalError(["The row changed since it was shown; reload before approving"])
  const problems: string[] = []
  for (const p of posts) {
    const why = readiness(p)
    if (why) problems.push(`${FORMAT_LABEL[formatOf(p)]}: ${why}`)
    else if (p.export_fingerprint !== shown[p.id]) problems.push(`${FORMAT_LABEL[formatOf(p)]}: the design changed since it was shown; reload`)
  }
  if (problems.length) throw new RowApprovalError(problems)

  const prepared: { post: ContentPost; batch: MetaBatch }[] = []
  for (const p of posts.filter(x => publisherPlatforms(x).length)) {
    const batch = await deps.prepare(p.id, prepareChoices(p, aiGenerated))
    const label = FORMAT_LABEL[formatOf(p)]
    if (deps.fingerprintOf(batch.manifest.assets.map(a => a.sha256)) !== shown[p.id]) problems.push(`${label}: the files read for approval differ from the design shown; reload`)
    for (const [d, hold] of Object.entries(deps.preflight(batch))) if (hold) problems.push(`${label}, ${d === "instagram" ? "Instagram" : "Facebook"}: ${hold}`)
    prepared.push({ post: p, batch })
  }
  if (problems.length) throw new RowApprovalError(problems)

  const out: ApprovedVariation[] = []
  for (const { post, batch } of prepared) {
    await deps.decide(post.id, batch.manifest.revision, batch.hash)
    out.push({ postId: post.id, format: formatOf(post), via: "publisher", hash: batch.hash })
  }
  for (const p of posts.filter(x => !publisherPlatforms(x).length)) {
    await deps.approveHand(p.id, shown[p.id])
    out.push({ postId: p.id, format: formatOf(p), via: "hand", hash: shown[p.id] })
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

/** How a variation's design is exported: every 9:16 design and any design with a video as one MP4, else JPG pages. */
export const exportAs = (p: Pick<ContentPost, "create_format" | "assets">, format: CreateFormat = formatOf(p)): "mp4" | "jpg" =>
  format === "reels" || p.assets.some(a => a.kind === "video") ? "mp4" : "jpg"

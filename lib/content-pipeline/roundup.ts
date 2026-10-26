import { BRAND } from "./brand"
import { icymiStory, icymiWindow, roundupSize, type PostRow } from "./worker"
import type { RoundupItem } from "./store"
import type { RoundupStory } from "./create-table"
import type { ContentPost } from "@/components/crm/types"

/**
 * ICYMI in the Create table (plan v11.2.1 Step 4 item 1). Which published posts a roundup may recap is the engine's
 * rule, unchanged from the pipeline's roundup (worker.ts icymiStory): last week's live News and Breaking posts (or the
 * super-admin's widened window, content_pipeline_config/icymi_window), each with its published card. The table lists
 * them; the person ticks min–max; the Run job checks the ticks against this list again before it fills the cover.
 * Runs inside withProfile(): the brand's names, exclusions and roundup size come from its published profile.
 */

/**
 * The brand's posts under any of the names they carry (older MCU records are not all tagged "milcity"), as findPosts
 * matches them (title, caption or tags), with when each went out for the ICYMI window. Newest first.
 */
export function brandPostRows(posts: ContentPost[]): PostRow[] {
  const ours = new RegExp(BRAND.posts.match, "i")
  const mine = posts.filter(p => !p.archived && [p.title, p.social_copy, p.tags, p.platform].some(v => typeof v === "string" && ours.test(v)))
  const when = (p: ContentPost) => p.posted_at || (p.status === "posted" || p.published_url ? p.date_to_post : undefined)
  // card: the post's first staged image, the card as posted, which ICYMI reuses as the story's slide.
  const card = (p: ContentPost) => (Array.isArray(p.assets) ? p.assets : []).find(a => a.kind === "image" && /^https:\/\//.test(a.url))
  return mine.map((p): PostRow => ({ id: p.id, title: p.title, status: p.status, ...(p.published_url ? { publishedUrl: p.published_url } : {}), ...(p.social_copy ? { caption: p.social_copy.slice(0, 2200) } : {}), ...(when(p) ? { publishedAt: when(p) } : {}), ...(Array.isArray(p.pipeline_media) && p.pipeline_media.length ? { media: p.pipeline_media.slice(0, 6) } : {}), ...(card(p) ? { card: { url: card(p)!.url, ...(card(p)!.sha256 ? { sha256: card(p)!.sha256 } : {}) } } : {}) }))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 75)
}

/** items: the same stories as the engine holds them (title and caption), for Human+; server-only, never sent to the browser. */
export interface RoundupChoices { window: string; min: number; max: number; stories: RoundupStory[]; items: RoundupItem[]; hold?: string }

/** The stories a roundup may recap now, newest first; `hold` says why there are too few for one. */
export function roundupChoices(posts: ContentPost[], nowMs: number, lookbackDays: number | null): RoundupChoices {
  const window = icymiWindow(nowMs, lookbackDays), size = roundupSize()
  const found = icymiStory(brandPostRows(posts), window, size)
  if (!Array.isArray(found)) return { window: window.label, ...size, stories: [], items: [], hold: found.hold }
  const byId = new Map(posts.map(p => [p.id, p]))
  const stories = (found[0]?.roundup ?? []).flatMap((item): RoundupStory[] => {
    if (!item.card) return []
    const post = byId.get(item.postId), photo = item.media && /^https:\/\//.test(item.media.url) && /^https:\/\//.test(item.media.pageUrl) ? { url: item.media.url, pageUrl: item.media.pageUrl } : undefined
    return [{ postId: item.postId, title: item.title, card: item.card.url, ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}), ...(item.publishedUrl ? { publishedUrl: item.publishedUrl } : {}), ...(post?.create_text?.headline ? { headline: post.create_text.headline } : {}), ...(photo ? { photo } : {}) }]
  })
  return { window: window.label, ...size, stories, items: (found[0]?.roundup ?? []).filter(i => i.card) }
}

/** Production: the content posts (through the CRM's 30-second list cache, as the pipeline's roundup read them) and the window setting. */
export async function liveRoundupChoices(): Promise<RoundupChoices> {
  const [{ getContentPosts }, { getIcymiWindow }] = await Promise.all([import("@/lib/firestore-crm"), import("@/lib/firestore-content-pipeline")])
  const [posts, setting] = await Promise.all([getContentPosts(), getIcymiWindow().catch(() => ({ lookbackDays: null }))])
  return roundupChoices(posts, Date.now(), setting.lookbackDays ?? null)
}

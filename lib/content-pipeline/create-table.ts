import type { BrandProfile, ProfileSeries } from "./profile"
import type { FieldSpec, RequestKind, SeriesKey } from "./series"

/**
 * The Create table (plan v11 Step 2): one row is one post. A person picks the Brand and its Template, gives a reference
 * link, media and target platforms, and fills (or asks Human+ to fill) the Headline, Sub-headline and Caption; Run job
 * then fills every Canva template the row's platforms need. Client-safe: the profile is passed in, never imported, and
 * nothing here reads the profile in scope (brand.ts), so the table and the routes share it.
 *
 * Every platform takes the 4:5 feed design or the 9:16 Reels design (profile-store templateMap; see CREATE_PLATFORMS), so a
 * row makes one design per format, and each design is its own content post: the publisher binds one Canva design to a
 * post, and publishes a Reel only as video. A row's posts share its row id (create_row_id) for Step 3's drawer.
 */
export type CreateFormat = "feed" | "reels"
/** Where the Create table keeps its rows in the browser until they run (the drawer reads it for older rows' card text). */
export const CREATE_ROWS_STORE_KEY = "434-create-table-rows-v1"
/** Where a platform's post goes: through the owned-Meta publisher, or posted by hand until its vendor approves API publishing (plan v11.1 Step 8). */
export type Posting = "publisher" | "hand"
export interface CreatePlatform { id: string; label: string; platform: "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin"; format: CreateFormat; posting: Posting }
/**
 * Platform → format routing (plan v11.1 Step 3 item 1). TikTok and YouTube Shorts take the 9:16 Reels design and
 * LinkedIn the 4:5 feed design, so they need no templates of their own; they are posted by hand for now.
 */
export const CREATE_PLATFORMS: readonly CreatePlatform[] = [
  { id: "instagram_feed", label: "Instagram feed", platform: "instagram", format: "feed", posting: "publisher" },
  { id: "instagram_reels", label: "Instagram Reels", platform: "instagram", format: "reels", posting: "publisher" },
  { id: "facebook_feed", label: "Facebook feed", platform: "facebook", format: "feed", posting: "publisher" },
  { id: "facebook_reels", label: "Facebook Reels", platform: "facebook", format: "reels", posting: "publisher" },
  { id: "tiktok", label: "TikTok", platform: "tiktok", format: "reels", posting: "hand" },
  { id: "youtube_shorts", label: "YouTube Shorts", platform: "youtube", format: "reels", posting: "hand" },
  { id: "linkedin", label: "LinkedIn", platform: "linkedin", format: "feed", posting: "hand" },
]
export const FORMAT_LABEL: Record<CreateFormat, string> = { feed: "Feed 4:5", reels: "Reels 9:16" }
/** The aspect alone, for a template-gap note ("No 9:16 News template for MilCityUSA yet"). */
export const FORMAT_ASPECT: Record<CreateFormat, string> = { feed: "4:5", reels: "9:16" }
/** The social platforms the publisher posts to; every other platform is posted by hand. */
export const PUBLISHER_PLATFORMS = ["instagram", "facebook"] as const
export const isHandPosted = (platform: string) => !(PUBLISHER_PLATFORMS as readonly string[]).includes(platform)

/** The formats a row's ticked platforms need, feed first, each with the social platforms it goes to. */
export function formatsOf(platformIds: readonly string[]): { format: CreateFormat; platforms: CreatePlatform["platform"][] }[] {
  const picked = CREATE_PLATFORMS.filter(p => platformIds.includes(p.id))
  return (["feed", "reels"] as const).map(format => ({ format, platforms: picked.filter(p => p.format === format).map(p => p.platform) })).filter(f => f.platforms.length)
}

export type CreateSocial = CreatePlatform["platform"]
/** The social platforms in the order the table lists them, each once. */
export const CREATE_SOCIALS: readonly CreateSocial[] = [...new Set(CREATE_PLATFORMS.map(p => p.platform))]
export const SOCIAL_LABEL: Record<CreateSocial, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube Shorts", linkedin: "LinkedIn" }
/** What the row's media is: a video, or a photo (a template with no media field makes a still card, like a photo). */
export type MediaShape = "photo" | "video"
export const mediaShapeOf = (media: Pick<RowMedia, "kind"> | null | undefined): MediaShape => media?.kind === "video" ? "video" : "photo"

/**
 * One format per platform per row (Step 3 part 5): the sizes a platform takes for the row's media, the default first.
 * Instagram and Facebook take a photo at 4:5, and a video as a 9:16 Reel or, as the alternative, at 4:5; TikTok and
 * YouTube Shorts take 9:16 only; LinkedIn takes 4:5.
 */
export function formatChoices(platform: CreateSocial, shape: MediaShape): CreateFormat[] {
  if (platform === "instagram" || platform === "facebook") return shape === "video" ? ["reels", "feed"] : ["feed"]
  return CREATE_PLATFORMS.filter(p => p.platform === platform).map(p => p.format)
}
/**
 * A choice's name in the table. On Instagram a video is a Reel at either size (the 4:5 one is shared to the feed); on
 * Facebook the 9:16 is a Reel and the 4:5 goes out as a regular Page video (row-approval prepareChoices).
 */
export function choiceLabel(platform: CreateSocial, format: CreateFormat, shape: MediaShape): string {
  if (platform === "instagram" && shape === "video") return format === "reels" ? "9:16 Reel" : "4:5 Reel"
  if (platform === "facebook" && shape === "video") return format === "reels" ? "9:16 Reel" : "4:5 video"
  return FORMAT_ASPECT[format]
}
export const platformIdOf = (platform: CreateSocial, format: CreateFormat) => CREATE_PLATFORMS.find(p => p.platform === platform && p.format === format)?.id
/** The size a platform is ticked at, or undefined when it isn't ticked (the first, if a stored row has two). */
export const pickedFormat = (platformIds: readonly string[], platform: CreateSocial): CreateFormat | undefined =>
  CREATE_PLATFORMS.find(p => p.platform === platform && platformIds.includes(p.id))?.format

/**
 * Every ticked platform once, at a size its media allows: the size ticked when it is allowed and has a template, else the
 * first allowed size with one; a platform with none is dropped. `has` says whether the template has a design at a size.
 * `fresh`: the media just changed between photo and video, so each platform takes its default size again.
 */
export function normalizePlatforms(platformIds: readonly string[], shape: MediaShape, has: (f: CreateFormat) => boolean = () => true, fresh = false): string[] {
  const out: string[] = []
  for (const platform of CREATE_SOCIALS) {
    const ticked = CREATE_PLATFORMS.filter(p => p.platform === platform && platformIds.includes(p.id)).map(p => p.format)
    if (!ticked.length) continue
    const allowed = formatChoices(platform, shape).filter(has)
    const format = (fresh ? undefined : ticked.find(f => allowed.includes(f))) ?? allowed[0]
    const id = format && platformIdOf(platform, format)
    if (id) out.push(id)
  }
  return out
}

/** Why the ticked platforms break "one size per platform" for this media, in the person's words; empty when they don't. */
export function platformProblems(platformIds: readonly string[], shape: MediaShape): string[] {
  const p: string[] = []
  for (const platform of CREATE_SOCIALS) {
    const ticked = CREATE_PLATFORMS.filter(x => x.platform === platform && platformIds.includes(x.id)).map(x => x.format)
    if (ticked.length > 1) p.push(`${SOCIAL_LABEL[platform]} is ticked at two sizes; a platform gets one size per row`)
    const allowed = formatChoices(platform, shape)
    for (const f of ticked) if (!allowed.includes(f)) p.push(`${SOCIAL_LABEL[platform]} takes a ${shape} at ${allowed.map(a => FORMAT_ASPECT[a]).join(" or ")} only`)
  }
  return p
}

/** The table's ids for a variation's social platforms (the drawer edits them in the table's terms). */
export function platformIdsOf(format: CreateFormat, socialPlatforms: readonly string[]): string[] {
  return CREATE_PLATFORMS.filter(p => p.format === format && socialPlatforms.includes(p.platform)).map(p => p.id)
}

/** Why a platform can't be ticked for a template, or null when it can: a missing template is a gap, never a fallback. */
export function templateGap(t: Pick<CreateTemplate, "label" | "templates"> | undefined, brandLabel: string, format: CreateFormat): string | null {
  if (!t || t.templates[format]) return null
  return `No ${FORMAT_ASPECT[format]} ${t.label} template for ${brandLabel} yet`
}

/** A card field as the table shows it. role: which column holds it; "extra" fields show under the row's More fields. */
export interface CellField { name: string; label: string; role: "headline" | "subHeadline" | "extra" | "story"; perLine?: number; maxLines?: number; maxChars?: number; exactLines?: number; uppercase?: boolean; allowed?: readonly string[] }
export interface CreateTemplate {
  kind: RequestKind
  label: string
  detail: string
  series: SeriesKey
  fields: CellField[]
  /** The brand template per format (the profile's template map); a format with none cannot be ticked. */
  templates: Partial<Record<CreateFormat, string>>
  /** The template's image field per format (a video goes into it too), or none. */
  media: Partial<Record<CreateFormat, string>>
  /**
   * A roundup (MCU's ICYMI, Step 4 item 1): the cover is filled from min–max chosen published posts, one story row each,
   * under a fixed headline; each story's published card follows the cover as it is. Feed only: it is a carousel.
   */
  roundup?: { min: number; max: number; headline: string }
}

/** Written fields only: the server fills dates, counters and labels, and fixed values are the same on every card. */
const written = (f: FieldSpec) => !f.serverFilled && !f.fixed && !f.date
/** The first written field is the Headline column, the second the Sub-headline; the rest are extra cells. */
export function cellRoles(series: Pick<ProfileSeries, "fields">): { headline?: string; subHeadline?: string; extra: string[] } {
  const names = series.fields.filter(written).map(f => f.name)
  return { headline: names[0], subHeadline: names[1], extra: names.slice(2) }
}

/** A roundup cover's story rows (story_01 … story_05): one per story chosen, in order. */
export const STORY_SLOT = /^story_0([1-9])$/
export const storySlotUsed = (name: string, stories: number) => { const m = STORY_SLOT.exec(name); return !m || Number(m[1]) <= stories }

/**
 * The templates a brand's Create row offers: its request kinds (one card each) with a template for at least one format,
 * and a roundup (a kind with minStories, MCU's ICYMI: Step 4 item 1), whose cover is a 4:5 carousel's first card.
 */
export function createTemplates(profile: BrandProfile): CreateTemplate[] {
  return profile.requestKinds.filter(k => k.series.length === 1).flatMap(k => {
    const series = profile.series[k.series[0]]
    if (!series) return []
    if (k.minStories) return roundupTemplate(k, series)
    const templates: CreateTemplate["templates"] = {}, media: CreateTemplate["media"] = {}
    for (const f of ["feed", "reels"] as const) {
      if (series.templates[f]) templates[f] = series.templates[f]
      const m = series.media?.[f]
      if (series.templates[f] && m) media[f] = m
    }
    if (!templates.feed && !templates.reels) return []
    const roles = cellRoles(series)
    const fields: CellField[] = series.fields.filter(written).map(f => ({
      name: f.name, label: f.label, role: f.name === roles.headline ? "headline" : f.name === roles.subHeadline ? "subHeadline" : "extra",
      ...(f.perLine ? { perLine: f.perLine } : {}), ...(f.maxLines ? { maxLines: f.maxLines } : {}), ...(f.maxChars ? { maxChars: f.maxChars } : {}),
      ...(f.exactLines ? { exactLines: f.exactLines } : {}), ...(f.uppercase ? { uppercase: true } : {}), ...(f.allowed ? { allowed: f.allowed } : {}),
    }))
    return [{ kind: k.kind, label: k.label, detail: k.detail, series: k.series[0], fields, templates, media }]
  })
}

function roundupTemplate(k: BrandProfile["requestKinds"][number], series: ProfileSeries): CreateTemplate[] {
  const headline = series.fields.find(f => f.fixed)?.fixed
  if (!series.templates.feed || !headline) return []
  const fields: CellField[] = series.fields.filter(f => STORY_SLOT.test(f.name) && written(f)).map(f => ({
    name: f.name, label: f.label, role: "story", ...(f.perLine ? { perLine: f.perLine } : {}), ...(f.maxLines ? { maxLines: f.maxLines } : {}), ...(f.maxChars ? { maxChars: f.maxChars } : {}),
  }))
  const max = Math.min(k.maxStories ?? fields.length, fields.length), min = Math.min(k.minStories ?? 1, max)
  if (!max) return []
  return [{ kind: k.kind, label: k.label, detail: k.detail, series: k.series[0], fields, templates: { feed: series.templates.feed }, media: series.media?.feed ? { feed: series.media.feed } : {}, roundup: { min, max, headline } }]
}

/** A published post a roundup can recap (Step 4 item 1): last week's live News or Breaking post with its card. */
export interface RoundupStory { postId: string; title: string; publishedAt?: string; publishedUrl?: string; card: string; /** Its headline as it was set (a Create row's), for the story row. */ headline?: string; /** The photo it used, with the page it came from, for the cover. */ photo?: { url: string; pageUrl: string } }

export interface RowMedia { url: string; kind: "image" | "video"; name: string; bytes?: number; width?: number; height?: number; durationSec?: number; optimized?: string; /** The link it was pasted from (a dropped file has none): a DVIDS photo keeps its credit. */ source?: string }
export interface CreateRow {
  /** Stable per row: the Run job's idempotency key (each design and post is keyed by it). */
  id: string
  brand: string
  kind: string
  referenceLink: string
  notes: string
  media: RowMedia | null
  platforms: string[]
  headline: string
  subHeadline: string
  caption: string
  /** The post date (YYYY-MM-DD); the card's printed date is the story's, when Human+ read one. */
  date: string
  /** Extra card fields by name, and the card's printed date (date) when Human+ set it. */
  fields: Record<string, string>
  /** The profile version Human+ wrote under, carried to the posts with the one the Run job fills under. */
  copyVersionId?: string
  /** A roundup's chosen published posts, by id, in the order the cover lists them. */
  roundup?: string[]
}

/** The card text a template gets: the row's fields under the names the template has. */
export function designText(t: Pick<CreateTemplate, "fields" | "roundup">, row: Pick<CreateRow, "headline" | "subHeadline" | "fields" | "date" | "roundup">, dataset: Record<string, string>): { text: Record<string, string>; unfilled: string[] } {
  const text: Record<string, string> = {}, unfilled: string[] = []
  const put = (names: string[], value: string) => { const n = names.find(x => dataset[x] === "text"); if (n && value.trim()) { text[n] = value.trim(); return true } return false }
  if (t.roundup) {
    // The cover: its fixed headline, one row per chosen story and their numbers ("01\n02\n03"); the rows past the last
    // story are left unfilled, as the pipeline's roundup left them.
    const n = row.roundup?.length ?? 0
    if (!put(["headline"], t.roundup.headline)) unfilled.push("Cover headline")
    put(["story_numbers"], Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, "0")).join("\n"))
    for (const f of t.fields.filter(f => storySlotUsed(f.name, n))) if (!put([f.name], row.fields[f.name] ?? "")) unfilled.push(f.label)
    put(["date"], row.fields.date?.trim() || (row.date ? ddmmmyy(row.date) : ""))
    return { text, unfilled }
  }
  for (const f of t.fields) {
    const raw = f.role === "headline" ? row.headline : f.role === "subHeadline" ? row.subHeadline : row.fields[f.name] ?? ""
    // A template that names the column differently (a generic master: headline, deck) still gets it.
    if (!put(f.role === "headline" ? [f.name, "headline"] : f.role === "subHeadline" ? [f.name, "deck"] : [f.name], f.uppercase ? raw.toUpperCase() : raw)) unfilled.push(f.label)
  }
  put(["date"], row.fields.date?.trim() || (row.date ? ddmmmyy(row.date) : ""))
  return { text, unfilled }
}

/** The readable part of a variation's file names: brand, post date and headline (milcity-2026-10-21-himars-at-fort-sill). */
export function exportFileBase(brand: string, date: string, headline: string): string {
  const slug = (v: string, max: number) => v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "")
  return [slug(brand, 20), /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "", slug(headline, 50)].filter(Boolean).join("-")
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
/** DDMMMYY (19OCT26) from YYYY-MM-DD, as the cards print it. */
export function ddmmmyy(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  return m ? `${m[3]}${MONTHS[Number(m[2]) - 1] ?? ""}${m[1].slice(2)}` : ""
}

/** What keeps a row from running, in the person's words (the server checks again, with the profile's limits). */
export function rowProblems(row: CreateRow, t: CreateTemplate | undefined): string[] {
  const p: string[] = []
  if (!row.brand) p.push("Choose a Brand")
  if (!t) { p.push("Choose a Template"); return p }
  if (t.roundup) return [...p, ...roundupProblems(row, t, t.roundup)]
  const formats = formatsOf(row.platforms)
  if (!formats.length) p.push("Tick at least one platform")
  p.push(...platformProblems(row.platforms, mediaShapeOf(row.media)))
  for (const f of formats) if (!t.templates[f.format]) p.push(`${t.label} has no ${FORMAT_ASPECT[f.format]} template yet`)
  if (formats.some(f => t.media[f.format]) && !row.media) p.push("Add media (a photo or a video)")
  if (row.media && row.media.optimized !== "done") p.push("Wait for the media to finish optimizing")
  if (!row.headline.trim()) p.push("Write the Headline")
  if (t.fields.some(f => f.role === "subHeadline") && !row.subHeadline.trim()) p.push("Write the Sub-headline")
  for (const f of t.fields.filter(f => f.role === "extra" && f.name !== "source")) if (!(row.fields[f.name] ?? "").trim()) p.push(`Write ${f.label}`)
  if (!row.caption.trim()) p.push("Write the Caption")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) p.push("Pick a Date")
  return p
}

/** What keeps a roundup row from running: min–max stories, a row for each, the cover's media, a caption and a date. */
function roundupProblems(row: CreateRow, t: CreateTemplate, r: NonNullable<CreateTemplate["roundup"]>): string[] {
  const p: string[] = [], n = row.roundup?.length ?? 0
  if (n < r.min || n > r.max) p.push(`Tick ${r.min}–${r.max} published stories`)
  else if (new Set(row.roundup).size !== n) p.push("Tick each story once")
  const formats = formatsOf(row.platforms)
  if (!formats.length) p.push("Tick at least one platform")
  if (formats.some(f => f.format !== "feed")) p.push(`${t.label} is a 4:5 carousel; it has no 9:16 size`)
  if (t.media.feed && !row.media) p.push("Add the cover's photo")
  if (row.media?.kind === "video") p.push(`${t.label} is a carousel of photos; its cover takes a photo, not a video`)
  if (row.media && row.media.optimized !== "done") p.push("Wait for the media to finish optimizing")
  for (const f of t.fields.filter(f => storySlotUsed(f.name, n) && n)) if (!(row.fields[f.name] ?? "").trim()) p.push(`Write ${f.label}`)
  if (!row.caption.trim()) p.push("Write the Caption")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) p.push("Pick a Date")
  return p
}

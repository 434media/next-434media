import type { BrandProfile, ProfileSeries } from "./profile"
import type { FieldSpec, RequestKind, SeriesKey } from "./series"

/**
 * The Create table (plan v11 Step 2): one row is one post. A person picks the Brand and its Template, gives a reference
 * link, media and target platforms, and fills (or asks Human+ to fill) the Headline, Sub-headline and Caption; Run job
 * then fills every Canva template the row's platforms need. Client-safe: the profile is passed in, never imported, and
 * nothing here reads the profile in scope (brand.ts), so the table and the routes share it.
 *
 * Instagram and Facebook take the same 4:5 feed design and the same 9:16 Reels design (profile-store templateMap), so a
 * row makes one design per format, and each design is its own content post: the publisher binds one Canva design to a
 * post, and publishes a Reel only as video. A row's posts share its row id (create_row_id) for Step 3's drawer.
 */
export type CreateFormat = "feed" | "reels"
export interface CreatePlatform { id: string; label: string; platform: "instagram" | "facebook"; format: CreateFormat }
export const CREATE_PLATFORMS: readonly CreatePlatform[] = [
  { id: "instagram_feed", label: "Instagram feed", platform: "instagram", format: "feed" },
  { id: "instagram_reels", label: "Instagram Reels", platform: "instagram", format: "reels" },
  { id: "facebook_feed", label: "Facebook feed", platform: "facebook", format: "feed" },
  { id: "facebook_reels", label: "Facebook Reels", platform: "facebook", format: "reels" },
]
export const FORMAT_LABEL: Record<CreateFormat, string> = { feed: "Feed 4:5", reels: "Reels 9:16" }

/** The formats a row's ticked platforms need, feed first, each with the social platforms it goes to. */
export function formatsOf(platformIds: readonly string[]): { format: CreateFormat; platforms: ("instagram" | "facebook")[] }[] {
  const picked = CREATE_PLATFORMS.filter(p => platformIds.includes(p.id))
  return (["feed", "reels"] as const).map(format => ({ format, platforms: picked.filter(p => p.format === format).map(p => p.platform) })).filter(f => f.platforms.length)
}

/** A card field as the table shows it. role: which column holds it; "extra" fields show under the row's More fields. */
export interface CellField { name: string; label: string; role: "headline" | "subHeadline" | "extra"; perLine?: number; maxLines?: number; maxChars?: number; exactLines?: number; uppercase?: boolean; allowed?: readonly string[] }
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
}

/** Written fields only: the server fills dates, counters and labels, and fixed values are the same on every card. */
const written = (f: FieldSpec) => !f.serverFilled && !f.fixed && !f.date
/** The first written field is the Headline column, the second the Sub-headline; the rest are extra cells. */
export function cellRoles(series: Pick<ProfileSeries, "fields">): { headline?: string; subHeadline?: string; extra: string[] } {
  const names = series.fields.filter(written).map(f => f.name)
  return { headline: names[0], subHeadline: names[1], extra: names.slice(2) }
}

/**
 * The templates a brand's Create row offers: its request kinds (one card each) with a template for at least one format.
 * A roundup (a kind with minStories, MCU's ICYMI) is built from published posts and is offered in Step 4, not here.
 */
export function createTemplates(profile: BrandProfile): CreateTemplate[] {
  return profile.requestKinds.filter(k => !k.minStories && k.series.length === 1).flatMap(k => {
    const series = profile.series[k.series[0]]
    if (!series) return []
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

export interface RowMedia { url: string; kind: "image" | "video"; name: string; bytes?: number; width?: number; height?: number; durationSec?: number; optimized?: string }
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
}

/** The card text a template gets: the row's fields under the names the template has. */
export function designText(t: Pick<CreateTemplate, "fields">, row: Pick<CreateRow, "headline" | "subHeadline" | "fields" | "date">, dataset: Record<string, string>): { text: Record<string, string>; unfilled: string[] } {
  const text: Record<string, string> = {}, unfilled: string[] = []
  const put = (names: string[], value: string) => { const n = names.find(x => dataset[x] === "text"); if (n && value.trim()) { text[n] = value.trim(); return true } return false }
  for (const f of t.fields) {
    const raw = f.role === "headline" ? row.headline : f.role === "subHeadline" ? row.subHeadline : row.fields[f.name] ?? ""
    // A template that names the column differently (a generic master: headline, deck) still gets it.
    if (!put(f.role === "headline" ? [f.name, "headline"] : f.role === "subHeadline" ? [f.name, "deck"] : [f.name], f.uppercase ? raw.toUpperCase() : raw)) unfilled.push(f.label)
  }
  put(["date"], row.fields.date?.trim() || (row.date ? ddmmmyy(row.date) : ""))
  return { text, unfilled }
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
  const formats = formatsOf(row.platforms)
  if (!formats.length) p.push("Tick at least one platform")
  for (const f of formats) if (!t.templates[f.format]) p.push(`${t.label} has no ${FORMAT_LABEL[f.format]} template yet`)
  if (formats.some(f => t.media[f.format]) && !row.media) p.push("Add media (a photo or a video)")
  if (row.media && row.media.optimized !== "done") p.push("Wait for the media to finish optimizing")
  if (!row.headline.trim()) p.push("Write the Headline")
  if (t.fields.some(f => f.role === "subHeadline") && !row.subHeadline.trim()) p.push("Write the Sub-headline")
  for (const f of t.fields.filter(f => f.role === "extra" && f.name !== "source")) if (!(row.fields[f.name] ?? "").trim()) p.push(`Write ${f.label}`)
  if (!row.caption.trim()) p.push("Write the Caption")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) p.push("Pick a Date")
  return p
}

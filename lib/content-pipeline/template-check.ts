import type { BrandProfile, ProfileSeries } from "./profile"
import { cellRoles } from "./create-table"

/**
 * The template check (pre-run, founder 2026-10-29): every brand template a brand's published profile binds is read
 * from Canva (GET /brand-templates/{id}/dataset, the same read the Run job makes) and compared with what the profile
 * says it holds, so a broken template is caught here, with a plain message, before a staff run fails in Canva.
 *
 * Reported per template and format: the profile's media field missing from the dataset or not an image field, and a
 * card field the profile writes missing or not a text field. Server-filled fields (dates, counters, labels) are
 * optional: the fill skips them when the template has none, as designText does.
 *
 * What it cannot see (DATASET_LIMIT): Canva's published dataset can still list a field the editable template no longer
 * has. On 2026-10-29 the MilCityUSA DT101 feed template's photo frame became the page background while the dataset still
 * listed `media: image`; this read passed and the fill failed with autofill_error. Only a real fill catches that: the
 * test fill (canva-create.ts probeTemplateMedia), run by hand per template.
 *
 * Client-safe and pure: the dataset reader is passed in.
 */
export type TemplateFormat = "feed" | "reels"
export interface TemplateCheckRow {
  series: string
  label: string
  format: TemplateFormat
  templateId: string
  /** The profile's photo field for this format, or null when the template takes none. */
  mediaField: string | null
  problems: string[]
}

export const DATASET_LIMIT = "This reads the fields Canva publishes for each template. Canva can still list a photo frame the template no longer has (on 2026-10-29 a frame became the page background and the list didn't change); a test fill is the only check that catches that."

const FORMAT_ASPECT: Record<TemplateFormat, string> = { feed: "4:5", reels: "9:16" }

/** The series a roundup kind fills (its cover): its written fields are story rows, never aliased to headline/deck. */
const roundupSeries = (profile: BrandProfile) => new Set(profile.requestKinds.filter(k => k.minStories).flatMap(k => k.series))

/** One template's problems against its dataset (name → type), in the words the Brands page shows. */
export function templateProblems(series: Pick<ProfileSeries, "fields" | "media">, format: TemplateFormat, dataset: Record<string, string>, opts: { aliases: boolean }): string[] {
  const out: string[] = []
  if (!Object.keys(dataset).length) return ["Canva lists no autofill fields for this template, so it can't be filled. Check it is still published as a brand template with its data fields connected."]
  const mediaField = series.media?.[format] ?? null
  if (mediaField) {
    if (!(mediaField in dataset)) out.push(`The photo frame "${mediaField}" is missing: Canva lists no field by that name`)
    else if (dataset[mediaField] !== "image") out.push(`"${mediaField}" is a ${dataset[mediaField]} field in Canva, not a photo frame`)
  }
  // The fill's own rule (designText): the first written field may land in "headline" and the second in "deck".
  const roles = opts.aliases ? cellRoles(series) : { headline: undefined, subHeadline: undefined }
  for (const f of series.fields) {
    if (f.serverFilled || f.date) continue
    const names = f.name === roles.headline ? [f.name, "headline"] : f.name === roles.subHeadline ? [f.name, "deck"] : [f.name]
    if (names.some(n => dataset[n] === "text")) continue
    const typed = names.find(n => n in dataset)
    out.push(typed ? `"${typed}" (${f.label}) is a ${dataset[typed]} field in Canva, not a text field` : `No text field "${f.name}" (${f.label})`)
  }
  return out
}

/**
 * Every template the profile binds, each format, read once per template id. A template Canva can't be read for is a
 * problem on its row (the reason is ours, never Canva's text), so one bad read doesn't hide the others.
 */
export async function checkTemplates(profile: BrandProfile, read: (templateId: string) => Promise<Record<string, string>>): Promise<TemplateCheckRow[]> {
  const roundups = roundupSeries(profile)
  const reads = new Map<string, Promise<{ dataset: Record<string, string> } | { error: string }>>()
  const once = (id: string) => {
    if (!reads.has(id)) reads.set(id, read(id).then(dataset => ({ dataset }), (err: unknown) => ({ error: readError(err) })))
    return reads.get(id)!
  }
  const rows: TemplateCheckRow[] = []
  for (const [key, series] of Object.entries(profile.series)) {
    if (!series) continue
    for (const format of ["feed", "reels"] as const) {
      const templateId = series.templates[format]
      if (!templateId) continue
      const got = await once(templateId)
      const problems = "error" in got ? [got.error] : templateProblems(series, format, got.dataset, { aliases: !roundups.has(key as never) })
      rows.push({ series: key, label: `${series.label} ${FORMAT_ASPECT[format]}`, format, templateId, mediaField: series.media?.[format] ?? null, problems })
    }
  }
  return rows
}

/** A CanvaError's message is ours and safe to show; anything else is named generically. */
function readError(err: unknown): string {
  const msg = err instanceof Error && err.name === "CanvaError" ? err.message : "the read failed"
  return `Could not read the template from Canva: ${msg}`
}

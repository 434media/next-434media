import milcity from "@/lib/brand-profiles/milcity.json"
import type { Series } from "./series"

/**
 * Brand profiles: everything that makes a post one property's post. The engine (lib/content-pipeline/) holds only
 * mechanics; each property's editorial rules, Canva template catalog, research and photo briefs, identifiers and seed
 * shape live in its profile, a reviewed document in 434-context (`06 Standards/Brand Profiles/<Brand>.md`). Its
 * generator (`04 Build/brand_profile_extract.py`) validates it and emits lib/brand-profiles/<id>.json, which is
 * generated output: never edit it by hand (scripts/check_drift.py re-hashes it against lib/brand-profiles/manifest.json).
 *
 * The emitted file is validated again here, by the same rules, and a brand whose profile fails is refused: loadProfile
 * throws, and the Generate panel does not offer it (properties.ts). Sensitive material (the seeds themselves) is never
 * in a profile; it stays in Firestore.
 */
export const PROFILE_SCHEMA = "434-brand-profile/1"

/**
 * The engine's vocabulary. A series key is a card format the engine can assemble (a single card, a roundup cover and
 * its story cards, …); it is also stored on every draft (frames[].series), so it is never renamed. A profile binds the
 * formats it uses to its own templates, labels and limits. A request kind is what Generate can ask for.
 */
export const SERIES_KEYS = ["news", "breaking", "dt101", "icymi_cover", "icymi_story", "followon_graphic", "followon_text", "tentpole_talent", "tentpole_ceremonial"] as const
export type SeriesKey = typeof SERIES_KEYS[number]
export type RequestKind = "news" | "breaking" | "dt101" | "icymi"
export const REQUEST_KINDS: readonly RequestKind[] = ["news", "breaking", "dt101", "icymi"]

export interface CaptionFormat { firstLines: string[]; labels: string[]; format: string; missingLabel: string }
export interface ProfileSeries extends Series {
  /** May use a representative photo (the people, unit or equipment the story is about) when no exact one exists. */
  representative?: boolean
  /** A caption shape the series requires (MCU's DT101 mission brief). */
  caption?: CaptionFormat
}
export interface ProfileRequestKind { kind: RequestKind; label: string; detail: string; series: SeriesKey[]; code: string; recencyDays?: number; undatedOk?: boolean }
/** fields: one-line headlines; hookFields: multi-line hooks (one punctuation convention across lines); deckField: the deck. */
export interface HeadlineChecks { enabled: boolean; fields: string[]; hookFields: string[]; maxCommas: number; deckField: string }
export interface OriginalityChecks { enabled: boolean; headlineMaxRun: number; captionMaxRun: number; exempt: SeriesKey[] }
export interface BrandProfile {
  schema: typeof PROFILE_SCHEMA
  generatedBy: string
  profile: string
  profileVersion: string
  profileDate: string
  profileSha256: string
  /** The Generate panel's property id ("milcity"). */
  id: string
  name: string
  shortName: string
  /** With each request kind's code, the stored draft ids ("MCU-NEWS-20261018-01"). */
  draftPrefix: string
  rulesVersion: string
  never: { id: string; what: string }[]
  /** The editorial rules the writer and research are prompted with (the cached system prefix). */
  editorial: string
  headlineRules?: string
  checks?: { headline?: HeadlineChecks; originality?: OriginalityChecks }
  series: Partial<Record<SeriesKey, ProfileSeries>>
  requestKinds: ProfileRequestKind[]
  research: { scope: string; outletExamples: string; writeNote: string; kinds: Partial<Record<RequestKind, { want: string; guidance: string }>> }
  photos: { card: string; searchSubject: string }
  posts: { match: string; tag: string; metaBrand: string; homeUrl: string; roundupExclude: string; roundupExcludeCaption: string }
  seeds: { orgKinds: string[]; outletKind: string; lookFirst: { label: string; kinds: string[]; sites: boolean }[]; backlog?: { kind: RequestKind; label: string } }
}

const EMITTED: Record<string, unknown> = { milcity }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v)
const str = (v: unknown, max: number, empty = false) => typeof v === "string" && (empty || v.trim() !== "") && v.length <= max
const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi
const pattern = (v: unknown) => { if (!str(v, 300)) return false; try { new RegExp(v as string); return true } catch { return false } }
function keys(o: unknown, where: string, required: string[], optional: string[], problems: string[]): o is Obj {
  if (!isObj(o)) { problems.push(`${where} must be an object`); return false }
  for (const k of required) if (!(k in o)) problems.push(`${where}.${k} is required`)
  for (const k of Object.keys(o)) if (!required.includes(k) && !optional.includes(k)) problems.push(`${where}.${k} is not a profile key`)
  return true
}

/** Problems with an emitted profile (empty = loadable). Mirrors brand_profile_extract.py's validate(). */
export function validateProfile(v: unknown): string[] {
  const p: string[] = []
  if (!keys(v, "profile", ["schema", "generatedBy", "profile", "profileVersion", "profileDate", "profileSha256", "id", "name", "shortName", "rulesVersion", "draftPrefix", "never", "editorial", "series", "requestKinds", "research", "photos", "posts", "seeds"], ["headlineRules", "checks"], p)) return p
  if (v.schema !== PROFILE_SCHEMA) p.push(`schema must be ${PROFILE_SCHEMA}`)
  if (!(typeof v.id === "string" && /^[a-z][a-z0-9-]{1,30}$/.test(v.id))) p.push("id: lowercase letters, digits and hyphens")
  for (const [k, n] of [["name", 60], ["shortName", 20], ["rulesVersion", 80], ["editorial", 40000]] as const) if (!str(v[k], n)) p.push(`${k}: 1–${n} characters`)
  if (!(typeof v.draftPrefix === "string" && /^[A-Z][A-Z0-9]{1,9}$/.test(v.draftPrefix))) p.push("draftPrefix: 2–10 uppercase letters or digits")
  if ("headlineRules" in v && !str(v.headlineRules, 20000)) p.push("headlineRules: 1–20,000 characters")
  if (!Array.isArray(v.never) || !v.never.every(n => isObj(n) && Object.keys(n).sort().join() === "id,what" && str(n.id, 80) && str(n.what, 400))) p.push("never: a list of {id, what}")

  if (v.checks !== undefined && keys(v.checks, "checks", [], ["headline", "originality"], p)) {
    const h = v.checks.headline, o = v.checks.originality
    if (h !== undefined && keys(h, "checks.headline", ["enabled", "fields", "hookFields", "maxCommas", "deckField"], [], p)) {
      if (typeof h.enabled !== "boolean") p.push("checks.headline.enabled: true or false")
      for (const k of ["fields", "hookFields"]) if (!(Array.isArray(h[k]) && (h[k] as unknown[]).every(f => str(f, 40)))) p.push(`checks.headline.${k}: field names`)
      if (!int(h.maxCommas, 0, 5)) p.push("checks.headline.maxCommas: 0–5")
      if (!str(h.deckField, 40)) p.push("checks.headline.deckField: a field name")
    }
    if (o !== undefined && keys(o, "checks.originality", ["enabled", "headlineMaxRun", "captionMaxRun", "exempt"], [], p)) {
      if (typeof o.enabled !== "boolean") p.push("checks.originality.enabled: true or false")
      if (!int(o.headlineMaxRun, 2, 20)) p.push("checks.originality.headlineMaxRun: 2–20 words")
      if (!int(o.captionMaxRun, 4, 60)) p.push("checks.originality.captionMaxRun: 4–60 words")
      if (!(Array.isArray(o.exempt) && o.exempt.every(k => (SERIES_KEYS as readonly unknown[]).includes(k)))) p.push("checks.originality.exempt: series keys")
    }
  }

  const series: Obj = isObj(v.series) && Object.keys(v.series).length ? v.series : (p.push("series: an object of series"), {})
  for (const [key, s] of Object.entries(series)) {
    const w = `series.${key}`
    if (!(SERIES_KEYS as readonly string[]).includes(key)) { p.push(`${w}: not a format the engine knows (${SERIES_KEYS.join(", ")})`); continue }
    if (!keys(s, w, ["key", "label", "templates", "fields", "media", "requestable"], ["representative", "caption"], p)) continue
    if (s.key !== key) p.push(`${w}.key must be ${key}`)
    if (!str(s.label, 60)) p.push(`${w}.label: 1–60 characters`)
    const placements = (o: unknown, ok: (x: unknown) => boolean) => isObj(o) && Object.keys(o).sort().join() === "feed,reels" && Object.values(o).every(ok)
    if (!placements(s.templates, x => typeof x === "string" && (x === "" || /^[A-Za-z0-9_-]{8,20}$/.test(x)))) p.push(`${w}.templates: {feed, reels} (Canva template ids, or "" for none)`)
    if (!placements(s.media, x => x === null || (typeof x === "string" && /^[a-z0-9_]{1,40}$/.test(x)))) p.push(`${w}.media: {feed, reels} (a field name or null)`)
    for (const k of ["requestable", "representative"]) if (k in s && typeof s[k] !== "boolean") p.push(`${w}.${k}: true or false`)
    const fields = Array.isArray(s.fields) ? s.fields : (p.push(`${w}.fields: a list`), [])
    const names = new Set<string>()
    fields.forEach((f: unknown, i: number) => {
      const fw = `${w}.fields[${i}]`
      if (!keys(f, fw, ["name", "label"], ["perLine", "maxLines", "maxChars", "allowed", "date", "uppercase", "exactLines", "serverFilled"], p)) return
      if (!(typeof f.name === "string" && /^[a-z0-9_]{1,40}$/.test(f.name))) p.push(`${fw}.name: lowercase field name`)
      else if (names.has(f.name)) p.push(`${fw}.name: ${f.name} repeats`)
      else names.add(f.name)
      if (!str(f.label, 60)) p.push(`${fw}.label: 1–60 characters`)
      for (const [k, lo, hi] of [["perLine", 1, 200], ["maxLines", 1, 10], ["maxChars", 1, 500], ["exactLines", 1, 10]] as const) if (k in f && !int(f[k], lo, hi)) p.push(`${fw}.${k}: ${lo}–${hi}`)
      for (const k of ["date", "uppercase", "serverFilled"]) if (k in f && typeof f[k] !== "boolean") p.push(`${fw}.${k}: true or false`)
      if ("allowed" in f && !(Array.isArray(f.allowed) && f.allowed.length && f.allowed.every(a => str(a, 60)))) p.push(`${fw}.allowed: a non-empty list`)
      if ("exactLines" in f && !("perLine" in f)) p.push(`${fw}: exactLines needs perLine`)
    })
    if (s.caption !== undefined && keys(s.caption, `${w}.caption`, ["firstLines", "labels", "format", "missingLabel"], [], p)) {
      const c = s.caption
      if (!(Array.isArray(c.firstLines) && c.firstLines.every(pattern))) p.push(`${w}.caption.firstLines: patterns`)
      if (!(Array.isArray(c.labels) && c.labels.every(l => str(l, 40)))) p.push(`${w}.caption.labels: line labels`)
      if (!str(c.format, 400)) p.push(`${w}.caption.format: 1–400 characters`)
      if (!(str(c.missingLabel, 200) && (c.missingLabel as string).includes("{label}"))) p.push(`${w}.caption.missingLabel: a message containing {label}`)
    }
  }

  const kinds = Array.isArray(v.requestKinds) && v.requestKinds.length ? v.requestKinds : (p.push("requestKinds: a non-empty list"), [])
  kinds.forEach((k: unknown, i: number) => {
    const w = `requestKinds[${i}]`
    if (!keys(k, w, ["kind", "label", "detail", "series", "code"], ["recencyDays", "undatedOk"], p)) return
    if (!(REQUEST_KINDS as readonly unknown[]).includes(k.kind)) p.push(`${w}.kind: one of ${REQUEST_KINDS.join(", ")}`)
    if (!str(k.label, 60) || !str(k.detail, 120)) p.push(`${w}: label 1–60 and detail 1–120 characters`)
    if (!(typeof k.code === "string" && /^[A-Z0-9]{2,8}$/.test(k.code))) p.push(`${w}.code: 2–8 uppercase letters or digits (draft ids)`)
    if ("recencyDays" in k && !int(k.recencyDays, 1, 3650)) p.push(`${w}.recencyDays: 1–3650`)
    if ("undatedOk" in k && typeof k.undatedOk !== "boolean") p.push(`${w}.undatedOk: true or false`)
    if (!(Array.isArray(k.series) && k.series.length && k.series.every(x => typeof x === "string" && x in series))) p.push(`${w}.series: series defined in this profile`)
    else if (!k.series.every(x => (series[x as string] as { templates?: { feed?: string } })?.templates?.feed)) p.push(`${w}: every series it fills needs a feed template`)
  })
  if (new Set(kinds.map((k: unknown) => isObj(k) ? k.kind : undefined)).size !== kinds.length) p.push("requestKinds: a kind repeats")

  if (keys(v.research, "research", ["scope", "outletExamples", "kinds", "writeNote"], [], p)) {
    const r = v.research
    for (const k of ["scope", "outletExamples"]) if (!str(r[k], 1000)) p.push(`research.${k}: 1–1,000 characters`)
    if (!str(r.writeNote, 600, true)) p.push("research.writeNote: up to 600 characters")
    const rk = r.kinds
    if (!(isObj(rk) && Object.entries(rk).every(([k, x]) => (REQUEST_KINDS as readonly string[]).includes(k) && isObj(x) && Object.keys(x).sort().join() === "guidance,want" && str(x.want, 1000) && str(x.guidance, 2000, true)))) p.push("research.kinds: {kind: {want, guidance}}")
    for (const k of kinds) if (isObj(k) && k.kind !== "icymi" && !(isObj(rk) && (k.kind as string) in rk)) p.push(`research.kinds.${String(k.kind)} is required for a researched kind`)
  }
  if (keys(v.photos, "photos", ["card", "searchSubject"], [], p)) for (const k of ["card", "searchSubject"]) if (!str(v.photos[k], 600)) p.push(`photos.${k}: 1–600 characters`)
  if (keys(v.posts, "posts", ["match", "tag", "metaBrand", "homeUrl", "roundupExclude", "roundupExcludeCaption"], [], p)) {
    const po = v.posts
    for (const k of ["match", "roundupExclude", "roundupExcludeCaption"]) if (!pattern(po[k])) p.push(`posts.${k}: a pattern`)
    for (const k of ["tag", "metaBrand"]) if (!(typeof po[k] === "string" && /^[a-z0-9-]{2,30}$/.test(po[k] as string))) p.push(`posts.${k}: lowercase id`)
    if (!(typeof po.homeUrl === "string" && po.homeUrl.startsWith("https://"))) p.push("posts.homeUrl: an https URL")
  }
  if (keys(v.seeds, "seeds", ["orgKinds", "outletKind", "lookFirst"], ["backlog"], p)) {
    const sd = v.seeds
    const orgKinds = Array.isArray(sd.orgKinds) && sd.orgKinds.length && sd.orgKinds.every(k => typeof k === "string" && /^[a-z][a-z-]{1,30}$/.test(k)) ? sd.orgKinds as string[] : (p.push("seeds.orgKinds: lowercase kinds"), [])
    if (!orgKinds.includes(sd.outletKind as string)) p.push("seeds.outletKind: one of seeds.orgKinds")
    if (!(Array.isArray(sd.lookFirst) && sd.lookFirst.every(g => isObj(g) && Object.keys(g).sort().join() === "kinds,label,sites" && str(g.label, 200) && typeof g.sites === "boolean" && Array.isArray(g.kinds) && g.kinds.length > 0 && g.kinds.every(x => orgKinds.includes(x as string))))) p.push("seeds.lookFirst: a list of {label, kinds, sites}")
    if (sd.backlog !== undefined && !(isObj(sd.backlog) && Object.keys(sd.backlog).sort().join() === "kind,label" && (REQUEST_KINDS as readonly unknown[]).includes(sd.backlog.kind) && str(sd.backlog.label, 200))) p.push("seeds.backlog: {kind, label}")
  }
  return p
}

/** Why a property can't be generated from its profile (empty = it can). */
export function profileProblems(id: string, emitted: Record<string, unknown> = EMITTED): string[] {
  return id in emitted ? validateProfile(emitted[id]) : [`no brand profile for ${id}`]
}
/** The validated profile, or an error: the engine never runs a brand whose profile fails validation. */
export function loadProfile(id: string, emitted: Record<string, unknown> = EMITTED): BrandProfile {
  const problems = profileProblems(id, emitted)
  if (problems.length) throw new Error(`The ${id} brand profile failed validation, so the content pipeline will not run it: ${problems.slice(0, 8).join("; ")}`)
  return emitted[id] as BrandProfile
}

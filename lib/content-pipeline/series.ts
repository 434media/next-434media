import { BRAND } from "./brand"
import type { ProfileSeries, SeriesKey } from "./profile"

/**
 * Card formats and their on-card fields: the mechanics of filling a Canva brand template. Which templates a property
 * uses, their fields and limits, are the property's brand profile (./profile.ts), loaded through ./brand.ts; SERIES
 * is the running brand's catalog. Every template's live dataset is checked again before each design is created
 * (fields not on a template's dataset stop the run rather than vanishing).
 *
 * Fixed design (chips, logos, banner, scrim, locks) is never touched: autofill only fills these named slots, and
 * always into a NEW design — masters are never targeted.
 */
export { REQUEST_KINDS, SERIES_KEYS, type RequestKind, type SeriesKey } from "./profile"
export type Placement = "feed" | "reels"

export interface FieldSpec {
  name: string
  label: string
  /** Characters per line at the largest ladder size, and the line limit (the API cannot step down the ladder). */
  perLine?: number
  maxLines?: number
  maxChars?: number
  /** A fixed list: pick from it, never invent. */
  allowed?: readonly string[]
  /** DDMMMYY, e.g. 14SEP26. */
  date?: boolean
  uppercase?: boolean
  /** Exactly this many lines, separated by a line break (the DT101 two-line benefit hook). */
  exactLines?: number
  /** Filled by the server, not written by the model (dates, counters, the DT101 image label). */
  serverFilled?: boolean
}
export interface Series {
  key: SeriesKey
  label: string
  templates: Record<Placement, string>
  fields: FieldSpec[]
  /** The template's photo slot; null = no media field on that placement's template. */
  media: Record<Placement, string | null>
  /** Created by a Generate request directly (others are frames inside a carousel, or tentpole posts that need approved talent photos). */
  requestable: boolean
}

/** The running brand's series, from its profile; a series the profile doesn't bind is absent. */
export const SERIES = BRAND.series as Record<SeriesKey, ProfileSeries>

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
/** 2026-09-14 → 14SEP26. */
export function ddmmmyy(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!m) throw new Error("date must be YYYY-MM-DD")
  return `${m[3]}${MONTHS[Number(m[2]) - 1]}${m[1].slice(2)}`
}

/** Greedy word wrap: how many lines `text` takes at `perLine` characters. */
export function lineCount(text: string, perLine: number): number {
  let lines = 1, current = 0
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const need = current ? current + 1 + word.length : word.length
    if (need <= perLine) current = need
    else { if (current) lines++; current = word.length }
    while (current > perLine) { lines++; current -= perLine } // an overlong word breaks across lines
  }
  return lines
}

/** Problems with one series' on-card values (empty = fits the spec at its largest size). */
export function checkFields(series: Series, values: Record<string, string>): string[] {
  const problems: string[] = []
  for (const f of series.fields) {
    const v = values[f.name]
    if (typeof v !== "string" || !v.trim()) { if (!f.serverFilled) problems.push(`${f.label} is empty`); continue }
    if (/[[\]{}]|lorem|placeholder|TBD/i.test(v)) problems.push(`${f.label} contains placeholder text`)
    if (f.allowed && !f.allowed.includes(v)) problems.push(`${f.label} must be one of: ${f.allowed.join(", ")}`)
    if (f.date && !/^\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}$/.test(v)) problems.push(`${f.label} must be DDMMMYY, e.g. 14SEP26`)
    if (f.maxChars && v.length > f.maxChars) problems.push(`${f.label} is ${v.length} characters; at most ${f.maxChars}`)
    if (f.exactLines) {
      const lines = v.split("\n").map(l => l.trim()).filter(Boolean)
      if (lines.length !== f.exactLines) problems.push(`${f.label} must be exactly ${f.exactLines} lines separated by a line break`)
      if (f.perLine && lines.some(l => l.length > f.perLine!)) problems.push(`${f.label}: each line at most ${f.perLine} characters`)
    } else if (f.perLine && f.maxLines && lineCount(v, f.perLine) > f.maxLines) problems.push(`${f.label} runs past ${f.maxLines} line${f.maxLines > 1 ? "s" : ""} (about ${f.perLine * f.maxLines} characters); shorten it`)
  }
  for (const k of Object.keys(values)) if (!series.fields.some(f => f.name === k)) problems.push(`${k} is not a field on ${series.label}`)
  return problems
}

/**
 * Clipped words a writer reaches for to squeeze copy into a line: "FAST DEPLOYMENT / LOW COST PROD" (the -05 DT101
 * hook, 2026-10-17). Card copy uses whole words. Names and acronyms that are the subject's own (HIMARS, C2, UAS) are
 * not on the list; the source field, dates and the subject line are not checked; and a word the source itself prints
 * is allowed.
 */
const CLIPPED = new Set(["PROD", "PRODS", "PRODN", "MFG", "MFR", "MFRS", "MGMT", "MGT", "GOVT", "GOV'T", "DEPT", "DEPTS", "ASSY", "EQPT", "EQUIP", "MAINT", "SYS", "SVC", "SVCS", "TRANSP", "CAPAB", "DEV", "DEVS", "INTL", "INT'L", "NATL", "NAT'L", "APPROX", "ADV", "PERF", "RESP", "AVAIL", "ENGR", "VEH", "VEHS", "ACFT", "MSN", "MSNS", "TRNG", "TNG", "QTY", "AMT", "YR", "YRS", "ENVT", "DPLY", "OPNL", "OPER", "TECHS", "LOGI", "RECOG", "ID'D"])
const NOT_CHECKED = new Set(["source", "date", "counter", "image_context", "subject_identifier", "kicker"])
export function clippedWords(fields: Record<string, string>, source = ""): string[] {
  const inSource = new Set((source.match(/[A-Za-z][A-Za-z']*/g) ?? []).map(w => w.toUpperCase()))
  const words = Object.entries(fields).filter(([k]) => !NOT_CHECKED.has(k)).flatMap(([, v]) => v.toUpperCase().match(/[A-Z][A-Z']*/g) ?? [])
  return [...new Set(words.map(w => w.replace(/'$/, "")).filter(w => CLIPPED.has(w) && !inSource.has(w)))]
}

/** Uppercase fields are typed uppercase so the card and the review text match. */
export function normalizeFields(series: Series, values: Record<string, string>): Record<string, string> {
  const clean = (f: FieldSpec, v: string) => f.exactLines ? v.split("\n").map(l => l.trim().replace(/\s+/g, " ")).filter(Boolean).join("\n") : v.trim().replace(/\s+/g, " ")
  return Object.fromEntries(series.fields.filter(f => typeof values[f.name] === "string").map(f => [f.name, f.uppercase ? clean(f, values[f.name]).toUpperCase() : clean(f, values[f.name])]))
}

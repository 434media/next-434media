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
  /** The same value on every card, set by the server and never written by the model (the ICYMI cover's headline). */
  fixed?: string
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

/**
 * A field's length as the card sets it: one per character drawn (letters, digits, spaces and punctuation alike), so an
 * accented letter or a curly apostrophe counts once. Fields are measured after normalizeFields, in the case printed.
 */
export const measure = (text: string) => [...text].length
/** Greedy word wrap: how many lines `text` takes at `perLine` characters. */
export function lineCount(text: string, perLine: number): number {
  let lines = 1, current = 0
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const len = measure(word)
    const need = current ? current + 1 + len : len
    if (need <= perLine) current = need
    else { if (current) lines++; current = len }
    while (current > perLine) { lines++; current -= perLine } // an overlong word breaks across lines
  }
  return lines
}

/**
 * Where a value runs past its field's limits, measured as the card sets it: each problem names the limit, the measured
 * length and the line that runs over, so a rewrite knows exactly what to shorten. The same for every field of every
 * template; only length is judged here (checkFields adds the rest).
 */
export function overLimits(f: FieldSpec, v: string): string[] {
  const out: string[] = []
  if (f.maxChars && measure(v) > f.maxChars) out.push(`${f.label} is ${measure(v)} characters; at most ${f.maxChars}`)
  if (f.exactLines) {
    const lines = v.split("\n").map(l => l.trim()).filter(Boolean)
    const over = f.perLine ? lines.map((l, i) => ({ l, i })).filter(x => measure(x.l) > f.perLine!) : []
    if (over.length) out.push(`${f.label}: each line at most ${f.perLine} characters, counting letters, spaces and punctuation; ${over.map(x => `line ${x.i + 1} "${x.l}" is ${measure(x.l)}, ${measure(x.l) - f.perLine!} over`).join("; ")}`)
  } else if (f.perLine && f.maxLines) {
    const n = lineCount(v, f.perLine)
    if (n > f.maxLines) out.push(`${f.label} runs past ${f.maxLines} line${f.maxLines > 1 ? "s" : ""} (about ${f.perLine * f.maxLines} characters); shorten it: "${v}" is ${measure(v)} characters and wraps to ${n} lines of at most ${f.perLine}`)
  }
  return out
}
/**
 * The words of a fixed-line field set across exactly `lines` lines of at most `perLine` characters, when they fit that
 * way: the break is layout, not grammar (founder, 2026-10-18), so moving a word to the other line changes nothing a
 * reader sees but where the line breaks. The writer's own break is kept when it fits; otherwise the fitting break
 * nearest to it. Null when no break fits: the words themselves must be shortened. Words are never cut or changed.
 */
export function fitLines(text: string, perLine: number, lines: number): string | null {
  const given = text.split("\n").map(l => l.trim().split(/\s+/).filter(Boolean)).filter(l => l.length)
  const words = given.flat()
  if (words.length < lines) return null
  const width = (ws: string[]) => measure(ws.join(" "))
  if (given.length === lines && given.every(l => width(l) <= perLine)) return given.map(l => l.join(" ")).join("\n")
  // The writer's breaks, as word positions, to stay close to.
  const want: number[] = []
  for (let i = 0, at = 0; i < given.length - 1; i++) { at += given[i].length; want.push(at) }
  let best: { cuts: number[]; cost: number } | null = null
  const place = (start: number, cuts: number[]) => {
    if (cuts.length === lines - 1) {
      if (width(words.slice(start)) > perLine || start >= words.length) return
      const cost = cuts.reduce((c, x, i) => c + Math.abs(x - (want[i] ?? x)), 0)
      if (!best || cost < best.cost) best = { cuts: [...cuts], cost }
      return
    }
    for (let end = start + 1; end < words.length; end++) {
      if (width(words.slice(start, end)) > perLine) break
      place(end, [...cuts, end])
    }
  }
  place(0, [])
  if (!best) return null
  const cuts = [0, ...(best as { cuts: number[] }).cuts, words.length]
  return cuts.slice(1).map((end, i) => words.slice(cuts[i], end).join(" ")).join("\n")
}

/** Problems with one series' on-card values (empty = fits the spec at its largest size). */
export function checkFields(series: Series, values: Record<string, string>): string[] {
  const problems: string[] = []
  for (const f of series.fields) {
    const v = values[f.name]
    if (typeof v !== "string" || !v.trim()) { if (!f.serverFilled) problems.push(`${f.label} is empty`); continue }
    if (/[[\]{}]|lorem|placeholder|TBD/i.test(v)) problems.push(`${f.label} contains placeholder text`)
    if (f.allowed && !f.allowed.includes(v)) problems.push(`${f.label} must be one of: ${f.allowed.join(", ")}`)
    if (f.fixed && v !== (f.uppercase ? f.fixed.toUpperCase() : f.fixed)) problems.push(`${f.label} is fixed: "${f.fixed}"`)
    if (f.date && !/^\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}$/.test(v)) problems.push(`${f.label} must be DDMMMYY, e.g. 14SEP26`)
    if (f.exactLines && v.split("\n").map(l => l.trim()).filter(Boolean).length !== f.exactLines) problems.push(`${f.label} must be exactly ${f.exactLines} lines separated by a line break`)
    problems.push(...overLimits(f, v))
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

/**
 * Uppercase fields are typed uppercase so the card and the review text match. A fixed-line field whose words fit its
 * lines with a different break is re-broken to fit (fitLines); its words are kept as written.
 */
export function normalizeFields(series: Series, values: Record<string, string>): Record<string, string> {
  const clean = (f: FieldSpec, v: string) => f.exactLines ? v.split("\n").map(l => l.trim().replace(/\s+/g, " ")).filter(Boolean).join("\n") : v.trim().replace(/\s+/g, " ")
  const fit = (f: FieldSpec, v: string) => f.exactLines && f.perLine && overLimits(f, v).length + Number(v.split("\n").length !== f.exactLines) ? fitLines(v, f.perLine, f.exactLines) ?? v : v
  return Object.fromEntries(series.fields.filter(f => typeof values[f.name] === "string").map(f => [f.name, fit(f, f.uppercase ? clean(f, values[f.name]).toUpperCase() : clean(f, values[f.name]))]))
}

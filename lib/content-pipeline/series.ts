/**
 * MilCityUSA series → Canva brand templates and on-card fields. This file is where the Admin content pipeline loads its
 * template mapping; the editorial rules it applies are in ./editorial.ts. Template IDs are the founder's published
 * MilCityUSA Brand Templates (2026-10-16, feed / Reels); the folder "MilCityUSA — Templates" (FAHXVKCc2Os) does not
 * list them all, so the catalog IDs are used directly. Field lists and limits come from the template specs and the
 * VA SOP; every template's live dataset is checked again before each design is created (fields not on a template's
 * dataset stop the run rather than vanishing).
 *
 * Fixed design (chips, logos, banner, scrim, locks) is never touched: autofill only fills these named slots, and
 * always into a NEW design — masters are never targeted.
 */
export type SeriesKey = "news" | "breaking" | "dt101" | "icymi_cover" | "icymi_story" | "followon_graphic" | "followon_text" | "tentpole_talent" | "tentpole_ceremonial"
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

export const DOMAINS = ["Air", "Land", "Sea", "Space", "Cyber", "Multi-domain"] as const
export const STATUSES = ["Concept", "In Development", "Testing", "Fielded"] as const
export const KICKERS = ["WHAT HAPPENED", "WHY IT MATTERS", "WHAT'S NEXT"] as const

// perLine values measured on real exports of each template on 2026-10-16 (e.g. News fits "ARMY BACKS 9 C2" on one line
// at 84 px but not "SOFTWARE VENDORS").
const headline = (perLine: number): FieldSpec => ({ name: "headline", label: "Headline", perLine, maxLines: 3, uppercase: true })
const deck: FieldSpec = { name: "deck", label: "Deck", perLine: 50, maxLines: 2 }
const date: FieldSpec = { name: "date", label: "Date", date: true }
const source: FieldSpec = { name: "source", label: "Source outlet", maxChars: 28, uppercase: true }

export const SERIES: Record<SeriesKey, Series> = {
  news: { key: "news", label: "News", templates: { feed: "EAHXWo1LiF8", reels: "EAHXZN4kp3Y" }, fields: [headline(15), deck, date, source], media: { feed: "media", reels: "media" }, requestable: true },
  breaking: { key: "breaking", label: "Breaking News", templates: { feed: "EAHXZAbAA8s", reels: "EAHXZAPPFLQ" }, fields: [headline(17), deck, date, source], media: { feed: "media", reels: "media" }, requestable: true },
  // Deck: maximum two lines at 34 px (founder rule). Spec strip values are fixed lists for DOMAIN and STATUS.
  // The approved benefit-led DT101 (founder, 2026-10-16): the ULTRA / HIMARS design published as Brand Template
  // EAHYOAJhC_8 from DT101 candidate DAHXqOPwZ-I. Maker, domain and status live in the caption's mission brief now.
  // No benefit-led Reels template exists yet; the old MAKER/DOMAIN/STATUS masters (EAHXZIadVzM / EAHXZAunvYI) are retired for DT101.
  dt101: { key: "dt101", label: "Defense Tech 101", templates: { feed: "EAHYOAJhC_8", reels: "" },
    fields: [
      { name: "benefit_headline", label: "Benefit hook", perLine: 16, exactLines: 2, uppercase: true },
      { name: "subject_identifier", label: "Subject", maxChars: 40, uppercase: true },
      { name: "image_context", label: "Image label", serverFilled: true, uppercase: true },
    ],
    media: { feed: "media", reels: null }, requestable: true },
  icymi_cover: { key: "icymi_cover", label: "ICYMI cover", templates: { feed: "EAHXZPgjqSY", reels: "EAHXZJnI-Nc" },
    fields: [{ ...headline(17), name: "headline", label: "Roundup theme" }, date, ...[1, 2, 3, 4, 5].map(n => ({ name: `story_0${n}`, label: `Story ${n}`, perLine: 38, maxLines: 1 }))],
    media: { feed: "media", reels: "media" }, requestable: true },
  icymi_story: { key: "icymi_story", label: "ICYMI story", templates: { feed: "EAHXZJnAT0o", reels: "EAHXZMFmSh0" },
    // Two headline lines only: a third runs into the deck on this card (export check, 2026-10-16).
    fields: [{ name: "counter", label: "Counter" }, { ...headline(15), maxLines: 2 }, deck], media: { feed: "media", reels: "media" }, requestable: false },
  followon_graphic: { key: "followon_graphic", label: "Follow-on graphic", templates: { feed: "EAHXZOYmzQ8", reels: "EAHXZHGriWI" }, fields: [], media: { feed: "media", reels: "media" }, requestable: false },
  followon_text: { key: "followon_text", label: "Follow-on text", templates: { feed: "EAHXZEmHgsE", reels: "EAHXZHixcNk" },
    fields: [{ name: "kicker", label: "Kicker", allowed: KICKERS }, { name: "headline", label: "Headline", perLine: 24, maxLines: 3, uppercase: true }, { name: "body", label: "Body", perLine: 50, maxLines: 3 }, source, { name: "counter", label: "Counter" }],
    media: { feed: "media", reels: "media" }, requestable: false },
  tentpole_talent: { key: "tentpole_talent", label: "Tentpole talent (Salute to Troops)", templates: { feed: "EAHXZNY2y7A", reels: "EAHXZeK2aFE" },
    fields: [{ name: "talent_name", label: "Talent name", perLine: 12, maxLines: 2, uppercase: true }, { name: "proof_line", label: "Proof line", perLine: 40, maxLines: 1 }, date, { name: "venue", label: "Venue", maxChars: 30, uppercase: true }],
    media: { feed: "media", reels: "media" }, requestable: false },
  tentpole_ceremonial: { key: "tentpole_ceremonial", label: "Tentpole ceremonial (Salute to Troops)", templates: { feed: "EAHXZShXbag", reels: "EAHXZQVQ34s" },
    fields: [{ name: "talent_name", label: "Talent name", perLine: 12, maxLines: 2, uppercase: true }, { name: "proof_line", label: "Proof line", perLine: 40, maxLines: 1 }, date, { name: "venue", label: "Venue", maxChars: 30, uppercase: true }],
    media: { feed: "media", reels: "media" }, requestable: false },
}

/** What a Generate request can ask for: one post per story, or the fixed-five ICYMI roundup (one cover + five cards). */
export type RequestKind = "news" | "breaking" | "dt101" | "icymi"
export const REQUEST_KINDS: readonly RequestKind[] = ["news", "breaking", "dt101", "icymi"]

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

/** Uppercase fields are typed uppercase so the card and the review text match. */
export function normalizeFields(series: Series, values: Record<string, string>): Record<string, string> {
  const clean = (f: FieldSpec, v: string) => f.exactLines ? v.split("\n").map(l => l.trim().replace(/\s+/g, " ")).filter(Boolean).join("\n") : v.trim().replace(/\s+/g, " ")
  return Object.fromEntries(series.fields.filter(f => typeof values[f.name] === "string").map(f => [f.name, f.uppercase ? clean(f, values[f.name]).toUpperCase() : clean(f, values[f.name])]))
}

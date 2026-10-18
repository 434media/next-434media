import type { HeadlineChecks, OriginalityChecks } from "./profile"
import type { FrameCopy, Story } from "./store"

/**
 * The headline, deck and originality checks a brand profile turns on (`checks`). Only what code can judge reliably
 * is checked here: punctuation, one convention per field, a deck that is one sentence and doesn't repeat the headline,
 * and how many words in a row the copy shares with its source. Whether a headline has a real verb is left to the
 * writer's rules and the reviewer: on short uppercase text a word-list guess is wrong too often to force a rewrite on.
 * A problem returned here sends the copy back for a rewrite, and holds the draft if it persists, like any other rule.
 */

/** Words for comparing copy with its source: lowercase, punctuation dropped, hyphenated names and U.S. kept whole. */
export function words(text: string): string[] {
  return (text.toLowerCase().replace(/[’']s\b/g, "").match(/[\p{L}\p{N}]+(?:[.\-][\p{L}\p{N}]+)*/gu) ?? [])
}
/** The longest run of consecutive words two texts share, and the run itself. */
export function longestSharedRun(a: string[], b: string[]): { length: number; run: string[] } {
  let best = 0, end = 0
  let prev = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) if (a[i - 1] === b[j - 1]) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) { best = cur[j]; end = i } }
    prev = cur
  }
  return { length: best, run: a.slice(end - best, end) }
}

/** Text with the dots of initialisms (U.S., D.C.) and decimals (3.5) removed, so any period left is a full stop. */
const bare = (v: string) => v.replace(/\b(?:[A-Za-z]\.){2,}/g, m => m.replace(/\./g, "")).replace(/(\d)\.(\d)/g, "$1$2")
const FORBIDDEN = /[/:;!?]/

export function headlineProblems(frames: FrameCopy[], c: HeadlineChecks): string[] {
  if (!c.enabled) return []
  const out: string[] = [], at = (i: number) => frames.length > 1 ? `frame ${i + 1}: ` : ""
  frames.forEach((f, i) => {
    for (const name of c.fields) {
      const v = f.fields[name]?.trim()
      if (!v) continue
      if (bare(v).includes(".")) out.push(`${at(i)}the headline takes no period: write it as one statement with no full stops ("${v}")`)
      if (FORBIDDEN.test(v)) out.push(`${at(i)}the headline takes no slash, colon, semicolon, exclamation or question mark: one complete statement ("${v}")`)
      if ((v.match(/,/g) ?? []).length > c.maxCommas) out.push(`${at(i)}the headline has more than ${c.maxCommas} comma${c.maxCommas === 1 ? "" : "s"}: one statement, not a list ("${v}")`)
    }
    // A hook's lines are one container for one hook (founder, 2026-10-18): the break is layout, not grammar, so the hook
    // is read as one text and punctuated by its sentences, never line by line. A sentence that ends with a period
    // inside it means the last one ends with one too ("TAXI SAFE. / LANDING SECURE" fails; "FIRE. / RELOCATE." and
    // "IT FINDS DRONES / AND STRIKES THEM" pass).
    for (const name of c.hookFields) {
      const lines = (f.fields[name] ?? "").split("\n").map(l => l.trim()).filter(Boolean)
      if (!lines.length) continue
      const hook = bare(lines.join(" "))
      if (hook.slice(0, -1).includes(".") && !hook.endsWith(".")) out.push(`${at(i)}the hook ends one sentence with a period and leaves the last without one: punctuate it as one written statement, by its sentences, not line by line ("${lines.join(" / ")}")`)
      if (lines.some(l => FORBIDDEN.test(l))) out.push(`${at(i)}the hook takes no slash, colon, semicolon, exclamation or question mark ("${lines.join(" / ")}")`)
    }
    const deck = f.fields[c.deckField]?.trim()
    if (deck) {
      if (/[.!?]["”’)]?\s+["“‘(]?[A-Z]/.test(bare(deck))) out.push(`${at(i)}the deck must be one sentence, not two: "${deck}"`)
      else if (!/\.["”’)]?$/.test(deck)) out.push(`${at(i)}the deck is one complete sentence ending with a period, not a list of fragments: "${deck}"`)
      if (/\bSource:/i.test(deck)) out.push(`${at(i)}the deck carries no "Source:"; the caption's source line does`)
      const head = c.fields.map(n => f.fields[n] ?? "").join(" ")
      const shared = longestSharedRun(words(deck), words(head))
      if (shared.length >= 3) out.push(`${at(i)}the deck repeats the headline ("${shared.run.join(" ")}"): add what the headline leaves out — the consequence, the scale, what happens next`)
    }
  })
  return out
}

/** Caption lines that aren't the writer's prose: the source line, image credits and the government notice. */
const NOT_PROSE = /^(Source|Image|Archive image|Photo): |^The appearance of U\.S\. Department/
/** The caption's own words: quotations (attributed quotes) and credit lines removed. */
export function captionProse(caption: string): string {
  return caption.split("\n").filter(l => !NOT_PROSE.test(l.trim())).join("\n").replace(/["“][^"”]*["”]/g, " ")
}

/**
 * Each field that copies more of its source than the profile allows: which frame and field ("caption" for the caption),
 * the copied run, and the problem as validate words it. The fresh-wording pass (worker.ts freshStep) shows the writer
 * the run and asks for fresh wording of just these fields.
 */
export interface Copied { frame: number; field: string; run: string[]; message: string }
export function originalityFindings(frames: FrameCopy[], caption: string, story: Pick<Story, "sourceTitle" | "sourceText">, c: OriginalityChecks, headlineFields: string[]): Copied[] {
  if (!c.enabled || frames.some(f => c.exempt.includes(f.series))) return []
  const out: Copied[] = [], source = words(story.sourceTitle)
  frames.forEach((f, i) => {
    for (const name of headlineFields) {
      const v = f.fields[name]
      if (!v) continue
      const shared = longestSharedRun(words(v), source)
      if (shared.length > c.headlineMaxRun) out.push({ frame: i, field: name, run: shared.run, message: `${frames.length > 1 ? `frame ${i + 1}: ` : ""}the headline copies ${shared.length} words in a row from the source's headline ("${shared.run.join(" ")}"): write it fresh, in your own words, from the facts` })
    }
  })
  const shared = longestSharedRun(words(captionProse(caption)), words(story.sourceText))
  if (shared.length > c.captionMaxRun) out.push({ frame: -1, field: "caption", run: shared.run, message: `the caption copies ${shared.length} words in a row from the source ("${shared.run.slice(0, 16).join(" ")}${shared.length > 16 ? " …" : ""}"): write it fresh, and quote only in quotation marks, attributed` })
  return out
}
export function originalityProblems(frames: FrameCopy[], caption: string, story: Pick<Story, "sourceTitle" | "sourceText">, c: OriginalityChecks, headlineFields: string[]): string[] {
  return originalityFindings(frames, caption, story, c, headlineFields).map(x => x.message)
}

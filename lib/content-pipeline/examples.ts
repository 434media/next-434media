import type { ProfileExample, ProfileExamples } from "./profile-store"

/**
 * The brand's approved examples, as the writer sees them (434 build sequence V1 item 0, founder 2026-11-17). A
 * published profile version carries `examples.approved` and `.rejected` (lib/content-pipeline/profile-store.ts); the
 * writer is shown a few approved ones of the series it is writing, so it matches the brand's voice, shape and length.
 *
 * Which examples: those tagged with the series being written, newest first, then untagged ones (an example published
 * before tags existed may be of any series). An example tagged with another series is never shown. At most
 * MAX_EXAMPLES, each cut to a bounded length, so the prompt stays bounded however many are stored (up to 50).
 * Rejected examples are not shown: a bad example in the prompt tends to be copied, not avoided.
 */
export const MAX_EXAMPLES = 5
const MAX_TEXT = 1_500
const MAX_NOTE = 300

export function examplesFor(examples: ProfileExamples | null | undefined, series: string): ProfileExample[] {
  const approved = (examples?.approved ?? []).filter(e => e && typeof e.text === "string" && e.text.trim())
  const newest = (a: ProfileExample, b: ProfileExample) => (b.at ?? "").localeCompare(a.at ?? "")
  const tagged = approved.filter(e => e.series === series).sort(newest)
  const untagged = approved.filter(e => !e.series).sort(newest)
  return [...tagged, ...untagged].slice(0, MAX_EXAMPLES)
}

/** The prompt block for the writer: empty when the brand has no approved examples for this series. */
export function examplesBrief(examples: ProfileExamples | null | undefined, series: string): string {
  const chosen = examplesFor(examples, series)
  if (!chosen.length) return ""
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s)
  return `\nAPPROVED EXAMPLES: posts the brand approved for this series. Match their voice, shape and length; never copy their facts, figures or wording, and the rules above still win where an example differs.\n${chosen
    .map((e, i) => `Example ${i + 1}:\n${cut(e.text.trim(), MAX_TEXT)}${e.note?.trim() ? `\n(Why it was approved: ${cut(e.note.trim(), MAX_NOTE)})` : ""}`)
    .join("\n\n")}`
}

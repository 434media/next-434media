import { createHash } from "node:crypto"
import { brandBookProblems, type BrandBook } from "./brand-book"

/**
 * Server-side checks on a profile's brand book (plan v11.2.1 Step 4 item 3). The book is generated, never typed: the
 * generator (scripts/brand-profiles/profile.ts book) stamps `digest`, a hash of the standard and sections it made, and
 * a book whose content no longer hashes to it was changed by hand and is not shown. A bad book never blocks the
 * profile: the profile publishes and runs, and the brand page says "No brand book yet" with the reason.
 */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`
  return JSON.stringify(v)
}
/** The hash the generator stamps: the standard's provenance and the sections, as made. */
export const bookDigest = (b: Pick<BrandBook, "standard" | "sections">) => createHash("sha256").update(canonical({ standard: b.standard, sections: b.sections })).digest("hex").slice(0, 16)

/** Whether a profile's `visual` block is a generated book that can be shown, or why not. */
export function brandBookStatus(visual: unknown): { ok: true; book: BrandBook } | { ok: false; reason: string } {
  if (visual === undefined || visual === null) return { ok: false, reason: "no visual standard has been generated into the profile" }
  const problems = brandBookProblems(visual)
  if (problems.length) return { ok: false, reason: `the generated book is malformed (${problems[0]})` }
  const b = visual as BrandBook
  if (b.digest !== bookDigest(b)) return { ok: false, reason: "the book no longer matches what the generator made; generate it again from the visual standard" }
  return { ok: true, book: b }
}

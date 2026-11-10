import { createHash } from "node:crypto"
import { parseVisualStandard, type BrandBook } from "./content-pipeline/brand-book"
import { bookDigest } from "./content-pipeline/brand-book-check"
import { vendorFiles } from "./brand-assets"
import { standardPrefix } from "./brand-asset-store"

/**
 * Publishing a brand's book from its visual standard, in two halves that never share a credential (Display and Design
 * Standard §3.0: the site's own identity never publishes media).
 *
 * 1. Files. A 434-context workflow, on a merge that touches a brand's marks or its standard, checks every file the
 *    standard's Marks table names against that folder's SOURCES.md, then publishes the files, their previews and a copy
 *    of the standard to the private bucket through the create-only publisher (scripts/brand-profiles/assets.ts --adc).
 * 2. Book. A super-admin's "Publish brand book" in the Admin (app/api/admin/brand-profiles/[id]/book) reads the newest
 *    standard copy from the bucket, checks every file it names is there and unchanged, regenerates the brand book as
 *    `profile.ts book` does, and publishes it as the profile's next version. It writes Firestore only.
 */

export const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex")

/** Each copy of a brand's standard has a new name for every distinct text, so none is ever replaced. */
export const standardPath = (brandId: string, md: string) => `${standardPrefix(brandId)}${sha256(md).slice(0, 16)}.md`

/**
 * The sha256 SOURCES.md records for each file: every table with a `sha256` column, keyed by the first `name` in a
 * row's first cell. A recorded value may be a prefix (16 hex or more, often shown with a trailing ellipsis).
 */
export function sourcesShas(md: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  let col = -1
  for (const line of md.split("\n")) {
    if (!line.trim().startsWith("|")) { col = -1; continue }
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim())
    if (cells.every(c => /^:?-+:?$/.test(c))) continue
    const h = cells.findIndex(c => /^sha256$/i.test(c))
    if (h >= 0) { col = h; continue }
    if (col < 0) continue
    const name = /`([A-Za-z0-9][A-Za-z0-9._-]*)`/.exec(cells[0] ?? "")?.[1]
    const hex = /([0-9a-f]{16,64})/.exec(cells[col] ?? "")?.[1]
    if (name && hex) out.set(name, [...(out.get(name) ?? []), hex])
  }
  return out
}

/** Whether SOURCES.md records this file with this content. No row, or no recorded value that matches, is false. */
export const recordedIn = (sources: Map<string, string[]>, file: string, sha: string) =>
  (sources.get(file) ?? []).some(h => sha.startsWith(h))

/** The book `profile.ts book` makes from a standard: parsed, then stamped with its digest. */
export function bookFromStandard(md: string, sourcePath: string): BrandBook & { digest: string } {
  const parsed = parseVisualStandard(md, { path: sourcePath, sha256: sha256(md).slice(0, 16) })
  return { ...parsed, digest: bookDigest(parsed) }
}

/** The files a standard's Marks table names, which must all be in the bucket before its book is published. */
export const namedFiles = (book: Pick<BrandBook, "sections">) => vendorFiles(book).logos.map(l => l.file)

export interface FileCheck { file: string; state: "ok" | "missing" | "changed" | "unrecorded" }
export interface BookPlan {
  brandId: string
  standard: { object: string; generation: string; path: string; title: string; version: string; sha256: string } | null
  digest: string | null
  publishedVersion: string | null
  nextVersion: string
  files: FileCheck[]
  /** Nothing to do: the published book is already this one. */
  current: boolean
  problems: string[]
  /** Ties a Publish to the dry run it follows: a change to any input in between is refused. */
  token: string
}

/**
 * The dry run. `files` are what the bucket holds for each named file: its bytes and the sha256 its publisher recorded
 * (null when absent). A file that is absent, whose bytes differ from its record, or that has no record, is a problem,
 * and so is a draft with unpublished edits (publishing the book would publish them too).
 */
export function planBook(input: {
  brandId: string
  standard: { object: string; generation: string; md: string; sourcePath: string } | null
  files: Record<string, { data: Uint8Array; recorded: string | null } | null>
  doc: { last_version: number; published: { version_id: string; profile: unknown } | null; draftDiffers: boolean } | null
}): BookPlan {
  const problems: string[] = []
  const { brandId, standard, doc } = input
  if (!doc) problems.push("This brand has no profile yet.")
  else if (!doc.published) problems.push("This brand has no published profile to add the brand book to.")
  if (doc?.draftDiffers) problems.push("The draft has unpublished edits. Publish or discard them first: publishing the book would publish them too.")
  if (!standard) problems.push("No copy of the visual standard is in storage yet. It arrives when 434-context's brand-assets workflow runs.")
  const book = standard ? bookFromStandard(standard.md, standard.sourcePath) : null
  const files: FileCheck[] = (book ? namedFiles(book) : []).map(file => {
    const got = input.files[file]
    if (!got) return { file, state: "missing" as const }
    if (!got.recorded) return { file, state: "unrecorded" as const }
    return { file, state: sha256(got.data) === got.recorded ? "ok" as const : "changed" as const }
  })
  if (book && !files.length) problems.push("The standard's Marks table names no files.")
  for (const f of files) if (f.state !== "ok") problems.push(`${f.file}: ${{ missing: "not in storage", changed: "its bytes differ from the sha256 recorded when it was published", unrecorded: "no sha256 was recorded when it was published" }[f.state]}.`)
  const published = (doc?.published?.profile as { visual?: { digest?: string } } | undefined)?.visual?.digest ?? null
  const current = !!book && published === book.digest
  const nextVersion = `${brandId}@v${(doc?.last_version ?? 0) + 1}`
  const token = sha256(JSON.stringify([brandId, standard?.object, standard?.generation, book?.digest, doc?.published?.version_id ?? null, doc?.last_version ?? 0, files]))
  return {
    brandId,
    standard: standard && book ? { object: standard.object, generation: standard.generation, path: book.standard.path, title: book.standard.title, version: book.standard.version, sha256: book.standard.sha256 } : null,
    digest: book?.digest ?? null,
    publishedVersion: doc?.published?.version_id ?? null,
    nextVersion,
    files,
    current,
    problems,
    token,
  }
}

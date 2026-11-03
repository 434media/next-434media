/**
 * Offline. Publish brand book (lib/brand-book-publish.ts): the SOURCES.md check the workflow runs before it writes,
 * the dry run's refusals, the plan token, and that an SVG mark gets a tile and a preview like a PNG. An invented brand.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { planBook, recordedIn, sha256, sourcesShas, standardPath } from "../brand-book-publish"
import { prepare } from "../brand-asset-prep"

const STANDARD = [
  "# Fixture Brand — Visual Standard", "", "**Version 1.1.0 — November 1, 2026**", "",
  "## 2. Colour", "", "| Name | Hex | Used for |", "|---|---|---|", "| Fixture Red | `ED2020` | Chips |", "",
  "## 4. Marks", "", "| File | Mark | Use |", "|---|---|---|",
  "| `fx-logo-white-v1.png` | Logo, white | Dark backgrounds |",
  "| `fx-logo-white-v1.svg` | Logo, white, vector | As the PNG |", "",
].join("\n")

const PNG = new Uint8Array([1, 2, 3]), SVG = new Uint8Array([4, 5, 6])
const SOURCES = [
  "| File here | Original in Drive | sha256 | Offered |", "|---|---|---|---|",
  // The original's own checksum in the second column must not be taken for the file's.
  `| \`fx-logo-white-v1.png\` (300 × 300) | \`orig.png\` (sha256 \`${"a".repeat(16)}…\`) | \`${sha256(PNG).slice(0, 16)}…\` | Yes |`, "",
  "| File | Bytes | sha256 |", "|---|---|---|",
  `| \`fx-logo-white-v1.svg\` | 3 | \`${sha256(SVG)}\` |`,
].join("\n")

const doc = (over: Partial<{ last_version: number; digest: string | null; draftDiffers: boolean }> = {}) => ({
  last_version: over.last_version ?? 11,
  published: { version_id: `fx@v${over.last_version ?? 11}`, profile: { visual: { digest: over.digest ?? "old" } } },
  draftDiffers: over.draftDiffers ?? false,
})
const stored = { object: standardPath("fx", STANDARD), generation: "1", md: STANDARD, sourcePath: "06 Standards/Fixture.md" }
const files = (over: Record<string, { data: Uint8Array; recorded: string | null } | null> = {}) => ({
  "fx-logo-white-v1.png": { data: PNG, recorded: sha256(PNG) },
  "fx-logo-white-v1.svg": { data: SVG, recorded: sha256(SVG) },
  ...over,
})

test("SOURCES.md: the sha256 column only, by the first name in a row, prefixes accepted", () => {
  const s = sourcesShas(SOURCES)
  assert.deepEqual([...s.keys()].sort(), ["fx-logo-white-v1.png", "fx-logo-white-v1.svg"])
  assert.equal(recordedIn(s, "fx-logo-white-v1.png", sha256(PNG)), true)
  assert.equal(recordedIn(s, "fx-logo-white-v1.svg", sha256(SVG)), true)
  assert.equal(recordedIn(s, "fx-logo-white-v1.png", sha256(SVG)), false, "different bytes")
  assert.equal(recordedIn(s, "fx-logo-white-v1.png", "a".repeat(64)), false, "the original's checksum is not the file's")
  assert.equal(recordedIn(s, "fx-other-v1.png", sha256(PNG)), false, "no row")
})

test("dry run: every named file in storage, unchanged, gives the next version and no problems", () => {
  const p = planBook({ brandId: "fx", standard: stored, files: files(), doc: doc() })
  assert.deepEqual(p.problems, [])
  assert.equal(p.nextVersion, "fx@v12")
  assert.equal(p.current, false)
  assert.deepEqual(p.files.map(f => f.state), ["ok", "ok"])
  assert.match(p.standard!.version, /1\.1\.0/)
  assert.equal(p.standard!.path, "06 Standards/Fixture.md")
})

test("dry run refuses a missing, changed or unrecorded file, a draft with edits, and no standard", () => {
  assert.match(planBook({ brandId: "fx", standard: stored, files: files({ "fx-logo-white-v1.svg": null }), doc: doc() }).problems.join(), /svg: not in storage/)
  assert.match(planBook({ brandId: "fx", standard: stored, files: files({ "fx-logo-white-v1.svg": { data: PNG, recorded: sha256(SVG) } }), doc: doc() }).problems.join(), /bytes differ/)
  assert.match(planBook({ brandId: "fx", standard: stored, files: files({ "fx-logo-white-v1.png": { data: PNG, recorded: null } }), doc: doc() }).problems.join(), /no sha256 was recorded/)
  assert.match(planBook({ brandId: "fx", standard: stored, files: files(), doc: doc({ draftDiffers: true }) }).problems.join(), /unpublished edits/)
  assert.match(planBook({ brandId: "fx", standard: null, files: {}, doc: doc() }).problems.join(), /No copy of the visual standard/)
  assert.match(planBook({ brandId: "fx", standard: stored, files: files(), doc: null }).problems.join(), /no profile/)
})

test("a book already published is current; the token changes with any input", () => {
  const first = planBook({ brandId: "fx", standard: stored, files: files(), doc: doc() })
  assert.equal(planBook({ brandId: "fx", standard: stored, files: files(), doc: doc({ digest: first.digest! }) }).current, true)
  assert.equal(planBook({ brandId: "fx", standard: stored, files: files(), doc: doc() }).token, first.token, "same inputs, same token")
  assert.notEqual(planBook({ brandId: "fx", standard: { ...stored, generation: "2" }, files: files(), doc: doc() }).token, first.token)
  assert.notEqual(planBook({ brandId: "fx", standard: stored, files: files(), doc: doc({ last_version: 12 }) }).token, first.token)
  assert.notEqual(planBook({ brandId: "fx", standard: stored, files: files({ "fx-logo-white-v1.svg": null }), doc: doc() }).token, first.token)
})

test("an SVG mark gets a tile and a preview: a white one reads on a dark tile", async () => {
  const svg = (fill: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><path d="M10 10H90V50H10Z" fill="${fill}"/></svg>`)
  const white = await prepare("fx-flag-white-v1.svg", svg("#FFFFFF")), navy = await prepare("fx-flag-navy-v1.svg", svg("#2A304C"))
  assert.equal(white.tile, "dark")
  assert.equal(navy.tile, "light")
  assert.ok(white.preview && white.preview.subarray(8, 12).toString("ascii") === "WEBP")
  assert.deepEqual(await prepare("fx-source-v1.ai", Buffer.from("%PDF-1.6")), { tile: "light", preview: null })
})

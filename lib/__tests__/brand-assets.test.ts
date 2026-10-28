/**
 * Offline. The vendor's downloads (plan v11.3 Step 4 item 6): which files a shared book offers, that a download takes
 * only those, and that the zip holds exactly the ticked files, byte-identical. An invented brand; no storage, no network.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { inflateRawSync } from "node:zlib"
import os from "node:os"
import path from "node:path"
import { crc32, fontNote, pickedFiles, vendorFiles, zipName, zipStore } from "../brand-assets"
import { localStore } from "../brand-asset-store"
import { designerBook, parseVisualStandard } from "../content-pipeline/brand-book"

const STANDARD = [
  "# Fixture Brand — Visual Standard", "", "**Version 1.0.0 — October 1, 2026**", "",
  "## 1. Scope", "", "About the document.", "",
  "## 3. Typography", "",
  "| Role | Face | Weight | Licence | Where |", "|---|---|---|---|---|",
  "| Heading | Fixture Sans | Black 900 | ✓ Free (OFL) | Headline slot |",
  "| Body | Fixture Sans | Medium 500 | ✓ Free (OFL) | Deck slot |",
  "| Data\\* | Fixture Mono | Medium 500 | ✓ Free (OFL) | Meta line |",
  "| Display | Paid Serif | Bold 700 | Licensed per seat | Covers |", "",
  "\\* Data means dates.", "",
  "## 4. Marks", "", "Three files, in the Canva brand kit under Logos.", "",
  "| File | Mark | Use |", "|---|---|---|",
  "| `fx-logo-white-v1.png` | Logo, white | Dark backgrounds |",
  "| `fx-logo-navy-v1.png` | Logo, navy | Light backgrounds |",
  "| `fx-banner-v1.png` | Banner | First frames |", "",
  "## 5. Rules common to every surface: frame geometry", "", "| Canvas | 1080 × 1350 |", "|---|---|", "| Banner | `fx-banner-v1.png`, 520 px |",
].join("\n")
const book = designerBook(parseVisualStandard(STANDARD, { path: "fixture.md", sha256: "0".repeat(16) }))

test("the book's Marks table decides the logos, and open-licence faces are the fonts", () => {
  const f = vendorFiles(book)
  assert.deepEqual(f.logos.map(l => [l.file, l.mark, l.use, l.format]), [
    ["fx-logo-white-v1.png", "Logo, white", "Dark backgrounds", "PNG"],
    ["fx-logo-navy-v1.png", "Logo, navy", "Light backgrounds", "PNG"],
    ["fx-banner-v1.png", "Banner", "First frames", "PNG"],
  ])
  // One entry per face, its weights gathered; the licensed face is named in the book and offered as nothing.
  assert.deepEqual(f.fonts.map(x => [x.id, x.weights, x.sourceUrl]), [
    ["font:Fixture Sans", ["Black 900", "Medium 500"], "https://fonts.google.com/specimen/Fixture+Sans"],
    ["font:Fixture Mono", ["Medium 500"], "https://fonts.google.com/specimen/Fixture+Mono"],
  ])
})

test("the frame-geometry section is not in the designer's book, so a file it names is not offered twice", () => {
  assert.equal(vendorFiles(book).logos.filter(l => l.file === "fx-banner-v1.png").length, 1)
})

test("a download keeps only ids the book offers and files that are in storage", () => {
  const f = vendorFiles(book)
  const p = pickedFiles(f, ["fx-logo-white-v1.png", "fx-logo-navy-v1.png", "../../etc/passwd", "brand-assets/other/x-v1.png", "font:Paid Serif", "font:Fixture Mono"], file => file !== "fx-logo-navy-v1.png")
  assert.deepEqual(p.logos.map(l => l.file), ["fx-logo-white-v1.png"])
  assert.deepEqual(p.fonts.map(x => x.face), ["Fixture Mono"])
})

test("a font's note gives its source and licence, not a file", () => {
  const note = fontNote(vendorFiles(book).fonts[0], "Fixture Brand")
  assert.match(note, /https:\/\/fonts\.google\.com\/specimen\/Fixture\+Sans/)
  assert.match(note, /SIL Open Font License 1\.1/)
  assert.match(note, /Black 900; Medium 500/)
})

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926)
})

/** The zip's entries, read back from the central directory. */
function unzip(zip: Buffer): { name: string; data: Buffer }[] {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = zip.readUInt16LE(end + 10), out: { name: string; data: Buffer }[] = []
  let p = zip.readUInt32LE(end + 16)
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10), size = zip.readUInt32LE(p + 20), nameLen = zip.readUInt16LE(p + 28), extra = zip.readUInt16LE(p + 30), comment = zip.readUInt16LE(p + 32), at = zip.readUInt32LE(p + 42)
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString("utf8")
    const start = at + 30 + zip.readUInt16LE(at + 26) + zip.readUInt16LE(at + 28), raw = zip.subarray(start, start + size)
    const data = method === 0 ? Buffer.from(raw) : inflateRawSync(raw)
    assert.equal(crc32(data), zip.readUInt32LE(p + 16), `${name}: crc`)
    out.push({ name, data })
    p += 46 + nameLen + extra + comment
  }
  return out
}

test("ticking two files returns a zip holding exactly those two, byte-identical to the stored copies", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "brand-assets-"))
  await mkdir(path.join(root, "brand-assets/fixture"), { recursive: true })
  const bytes = { "fx-logo-white-v1.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 250]), "fx-banner-v1.png": Buffer.alloc(70_000, 7), "fx-logo-navy-v1.png": Buffer.from("navy") }
  for (const [n, b] of Object.entries(bytes)) await writeFile(path.join(root, "brand-assets/fixture", n), b)
  await writeFile(path.join(root, "brand-assets/fixture/fx-logo-white-v1.png.json"), JSON.stringify({ tile: "dark" }))
  const store = localStore(root)
  assert.deepEqual(await store.info("fixture", "fx-logo-white-v1.png"), { bytes: 8, dark: true })
  assert.equal(await store.info("fixture", "missing-v1.png"), null)
  assert.equal(await store.read("fixture", "../fixture/fx-banner-v1.png"), null)

  const p = pickedFiles(vendorFiles(book), ["fx-logo-white-v1.png", "fx-banner-v1.png"], () => true)
  const entries = await Promise.all(p.logos.map(async l => ({ name: `logos/${l.file}`, data: (await store.read("fixture", l.file))! })))
  const back = unzip(zipStore(entries))
  assert.deepEqual(back.map(e => e.name), ["logos/fx-logo-white-v1.png", "logos/fx-banner-v1.png"])
  assert.ok(back[0].data.equals(bytes["fx-logo-white-v1.png"]))
  assert.ok(back[1].data.equals(bytes["fx-banner-v1.png"]))
})

test("the zip's name carries the brand and version only", () => {
  assert.equal(zipName("MilCityUSA", "milcity@v11"), "MilCityUSA-brand-files-milcity-v11.zip")
})

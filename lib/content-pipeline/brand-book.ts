/**
 * A brand's brand book (plan v11.2.1 Step 4 item 3): generated from the brand's visual standard, never copied by hand.
 * For MilCityUSA that is `06 Standards/Brand Profiles/MilCityUSA_Visual_Standard.md` in 434-context.
 *
 * The standard is parsed into the profile's optional `visual` block (scripts/brand-profiles/profile.ts book writes it
 * to the brand's draft, stamped with a digest), and published with the profile. The hand editor never shows or takes
 * it, and a block that no longer matches its digest is not shown (brand-book-check.ts). So the book lives in the database, not in this public repository,
 * and each profile version carries the book it was built from: the brand page names that version, and a share that
 * pins a version (Step 4 item 4) shows exactly what was sent. Client-safe and pure.
 *
 * The parse keeps the standard's own words and structure: each `##` section (with its `###`/`####` subsections) as
 * headings, paragraphs, lists and tables. Sections about the document rather than the design (its scope, provenance
 * and open questions) are left out by default; a table with a Hex column is drawn as swatches.
 */
export interface BookBlock {
  kind: "heading" | "paragraph" | "list" | "table" | "code"
  /** heading: 3 (###) or 4 (####). */
  level?: 3 | 4
  /** heading and paragraph text; code: the fenced block's lines as written. */
  text?: string
  items?: string[]
  /** list: each item's nesting depth (0 at the margin), and whether the list is numbered. */
  depths?: number[]
  ordered?: boolean
  head?: string[]
  /** Each row's cells. A row is an object, not a bare array: Firestore stores no array directly inside an array. */
  rows?: { cells: string[] }[]
}
export interface BookSection { title: string; blocks: BookBlock[] }
export interface BrandBook {
  /** The standard it was generated from: its path in 434-context, its title and version line, and a sha256 prefix. */
  standard: { path: string; title: string; version: string; sha256: string }
  sections: BookSection[]
  /** Stamped by the generator over standard and sections (brand-book-check.ts bookDigest); a hand edit breaks it. */
  digest?: string
}

/** `##` sections left out by default: about the document, not the design. */
export const DEFAULT_EXCLUDE = /^(\d+(\.\d+)*\.?\s*)?(scope|provenance|open)\b/i

/** A table row's cells; an escaped pipe (\\|) stays in its cell as a pipe. */
const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, "|"))
const isRule = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)

export function parseVisualStandard(md: string, source: { path: string; sha256: string }, exclude: RegExp = DEFAULT_EXCLUDE): BrandBook {
  const lines = md.replace(/\r\n/g, "\n").split("\n")
  const title = (lines.find(l => /^# /.test(l)) ?? "# Brand book").replace(/^# /, "").trim()
  const version = (lines.find(l => /^\*\*Version /.test(l)) ?? "").replace(/\*\*/g, "").trim()
  const sections: BookSection[] = []
  let cur: BookSection | null = null, skip = false, para: string[] = []
  let list: { items: string[]; depths: number[]; ordered: boolean } | null = null
  const flush = () => {
    if (cur && !skip) {
      if (para.length) cur.blocks.push({ kind: "paragraph", text: para.join(" ") })
      if (list?.items.length) cur.blocks.push({ kind: "list", items: list.items, ...(list.depths.some(d => d > 0) ? { depths: list.depths } : {}), ...(list.ordered ? { ordered: true } : {}) })
    }
    para = []; list = null
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // A fenced code block is kept as written, and nothing inside it is read as a heading, list or table.
    const fence = /^\s*(```|~~~)/.exec(line)
    if (fence) {
      flush()
      const body: string[] = []
      for (i++; i < lines.length && !lines[i].trimStart().startsWith(fence[1]); i++) body.push(lines[i])
      if (cur && !skip) cur.blocks.push({ kind: "code", text: body.join("\n") })
      continue
    }
    const h = /^(#{2,4})\s+(.*)$/.exec(line)
    if (h) {
      flush()
      if (h[1] === "##") { skip = exclude.test(h[2].trim()); cur = { title: h[2].trim(), blocks: [] }; if (!skip) sections.push(cur) }
      else if (cur && !skip) cur.blocks.push({ kind: "heading", level: h[1].length as 3 | 4, text: h[2].trim() })
      continue
    }
    if (!cur || skip) continue
    if (/^\s*\|/.test(line) && isRule(lines[i + 1] ?? "")) {
      flush()
      const head = cells(line), rows: { cells: string[] }[] = []
      i += 2
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push({ cells: cells(lines[i++]) })
      i--
      cur.blocks.push({ kind: "table", head, rows })
      continue
    }
    // A list item, bulleted or numbered; its indent (two spaces a level) is its depth.
    const item = /^(\s*)(?:[-*+]|(\d+)[.)])\s+(.*)$/.exec(line)
    if (item) {
      if (para.length) { cur.blocks.push({ kind: "paragraph", text: para.join(" ") }); para = [] }
      const depth = Math.min(4, Math.floor(item[1].replace(/\t/g, "  ").length / 2))
      if (!list) list = { items: [], depths: [], ordered: !!item[2] && depth === 0 }
      list.items.push(item[3].trim()); list.depths.push(depth)
      continue
    }
    // A wrapped line under a list item continues it.
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += ` ${line.trim()}`; continue }
    if (!line.trim() || /^-{3,}\s*$/.test(line)) { flush(); continue }
    if (list) { flush() }
    para.push(line.trim())
  }
  flush()
  return { standard: { path: source.path, title, version, sha256: source.sha256 }, sections: sections.filter(s => s.blocks.length) }
}

/** The Hex column of a table, when it has one: the book draws those rows as swatches. */
export function hexColumn(b: Pick<BookBlock, "head">): number {
  return (b.head ?? []).findIndex(h => /^hex$/i.test(h.trim()))
}
/** A cell's colour, for a swatch: `ED2020`, `#ed2020` or `` `ED2020` `` → "#ED2020"; else null. */
export function hexOf(cell: string): string | null {
  const m = /^`?#?([0-9a-f]{6})`?$/i.exec(cell.trim())
  return m ? `#${m[1].toUpperCase()}` : null
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const str = (v: unknown, max: number) => typeof v === "string" && v.length <= max
/** Problems with a profile's `visual` block (empty = it can be published). */
export function brandBookProblems(v: unknown): string[] {
  if (!isObj(v) || !isObj(v.standard) || !Array.isArray(v.sections)) return ["visual: {standard, sections, digest} from scripts/brand-profiles/profile.ts book"]
  const p: string[] = [], s = v.standard
  if (!(str(s.path, 300) && (s.path as string).trim() && str(s.title, 200) && str(s.version, 200) && typeof s.sha256 === "string" && /^[0-9a-f]{16,64}$/.test(s.sha256))) p.push("visual.standard: {path, title, version, sha256}")
  if (!v.sections.length || v.sections.length > 40) p.push("visual.sections: 1–40")
  v.sections.forEach((sec, i) => {
    const w = `visual.sections[${i}]`
    if (!isObj(sec) || !str(sec.title, 200) || !Array.isArray(sec.blocks) || sec.blocks.length > 300) { p.push(`${w}: {title, blocks (at most 300)}`); return }
    sec.blocks.forEach((b, j) => {
      const ok = isObj(b) && (
        (b.kind === "heading" && (b.level === 3 || b.level === 4) && str(b.text, 300)) ||
        (b.kind === "paragraph" && str(b.text, 6000)) ||
        (b.kind === "list" && Array.isArray(b.items) && b.items.length <= 60 && b.items.every(x => str(x, 2000)) && (b.depths === undefined || (Array.isArray(b.depths) && b.depths.length === b.items.length && b.depths.every(d => Number.isInteger(d) && d >= 0 && d <= 4))) && (b.ordered === undefined || b.ordered === true)) ||
        (b.kind === "code" && str(b.text, 6000)) ||
        (b.kind === "table" && Array.isArray(b.head) && b.head.length <= 12 && b.head.every(x => str(x, 200)) && Array.isArray(b.rows) && b.rows.length <= 80 && b.rows.every(r => isObj(r) && Array.isArray(r.cells) && Object.keys(r).length === 1 && r.cells.length <= 12 && r.cells.every(x => str(x, 2000)))))
      if (!ok) p.push(`${w}.blocks[${j}]: a heading, paragraph, list, table or code block`)
    })
  })
  return p.slice(0, 20)
}

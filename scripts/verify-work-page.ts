/**
 * Verify the Work page still renders every published record.
 *
 * CI-safe by construction: reads only files in this repository, needs no
 * secrets, no network, and no access to the context store. `docs/context` is a
 * symlink to the shared drive and is not present in a clone, so any check that
 * needs the master cannot run here — see scripts/check_drift.py, which is a
 * local tool for exactly that reason.
 *
 *   npx tsx scripts/verify-work-page.ts
 *
 * This is the check a hash cannot perform. lib/work-records.ts being intact
 * says nothing about whether the page shows what is in it. A record disappears
 * silently when its commercial model does not match one of the page's three
 * section ids, because sections are built by filtering records on that value —
 * a record with an unmatched model is dropped with no error and no empty state.
 * A stray `.filter()` on the derivation would do the same.
 *
 * The page receives its records as a prop from the server component, which
 * reads them from `portfolio_records`. CI cannot reach Firestore, so what is
 * checked here is the shape of the path the records travel: the page groups by
 * the section list and nothing else, the server component actually passes the
 * records, and the fallback is the full generated extract rather than a subset.
 * Whether the store's content matches the extract is settled by
 * scripts/sor/compare-work-records.ts, which needs no credentials either.
 *
 * The page being checked is the redesign. WorkClient was deleted when the
 * redesign became the only Work page; this check moved with the page rather
 * than being dropped, because the failure it catches belongs to the data
 * shape, not to any one implementation.
 *
 * Exits non-zero on any record that would not render.
 */
import { readFileSync } from "node:fs"

import { WORK_RECORDS } from "../lib/work-records"

const PAGE = "app/work/redesign/WorkRedesign.tsx"
// The order the page groups by is generated from the record seed, so read the
// models from there rather than from a literal in the component. The component
// used to carry its own copy; it now derives SECTIONS from this file, and the
// check below holds it to that.
const SECTIONS_FILE = "lib/work-sections.ts"
const SERVER = "app/work/page.tsx"
const DATA = "lib/sor/work-page-data.ts"

function fail(lines: string[]): never {
  console.error(lines.join("\n"))
  process.exit(1)
}

function main(): void {
  const src = readFileSync(PAGE, "utf8")

  // The section models the page groups by, read from the generated order.
  const sections = [
    ...readFileSync(SECTIONS_FILE, "utf8").matchAll(/model: "([^"]+)"/g),
  ].map((m) => m[1])
  if (sections.length === 0) {
    fail([`Could not read models from ${SECTIONS_FILE}.`])
  }

  // Every record the published manifest names must be one the page renders, and
  // the page must prefer the manifest over the path convention. A manifest entry
  // for a record the page never shows is media published to nobody; a component
  // that reads the convention first would serve the old asset from a versioned
  // bucket and look entirely correct.
  const media = readFileSync("lib/work-media.ts", "utf8")
  const mediaKeys = [...media.matchAll(/^  "([a-z0-9-]+)": \{$/gm)].map((m) => m[1])
  if (mediaKeys.length === 0) {
    fail(["lib/work-media.ts names no records."])
  }
  for (const k of mediaKeys) {
    if (!src.includes(`"${k}"`)) {
      fail([`lib/work-media.ts names ${k}, which app/work/redesign/WorkRedesign.tsx does not.`])
    }
  }
  for (const group of ["loop", "detail", "tile"]) {
    const re = new RegExp(
      `const published = RECORD_MEDIA\\[k\\]\\?\\.${group}\\s*\\n\\s*if \\(published\\) return published`)
    if (!re.test(src)) {
      fail([
        `${PAGE} no longer prefers the published manifest for the ${group}.`,
        "Each of the loop, the detail video and the tile must read RECORD_MEDIA",
        "first and fall back to the path convention after.",
      ])
    }
  }

  // The component must build its sections from that file rather than listing
  // them again. A second copy is how the page and the seed drift apart.
  if (!/const SECTIONS = WORK_SECTIONS\.map\(/.test(src)) {
    fail([
      `${PAGE} no longer derives SECTIONS from ${SECTIONS_FILE}.`,
      "The order is canonical in the record seed. A literal here is a second",
      "copy of it, and nothing would tell you the two had diverged.",
    ])
  }

  // The page must group by mapping SECTIONS and selecting each section's
  // records by model. That is the whole derivation: a record whose model
  // matches a section lands in it, and nothing else decides what renders.
  if (!/SECTIONS\.map\(/.test(src)) {
    fail([
      `${PAGE} no longer derives its groups by mapping SECTIONS.`,
      "Every record whose model matches a section must reach it; a hand-written",
      "list would drop records silently.",
    ])
  }
  // Isolate the grouping itself, so what follows is checked against the
  // derivation and not against the whole file. A truncation anywhere else is
  // not this check's business; a truncation here is invisible on the page.
  const gStart = src.indexOf("const grouped = useMemo(")
  if (gStart === -1) {
    fail([`${PAGE} no longer derives its groups in a \`grouped\` useMemo.`])
  }
  const grouped = src.slice(gStart, src.indexOf("[records],", gStart))

  if (!/items:\s*records\.filter\(\(r\) => r\.model === s\.model\),/.test(grouped)) {
    fail([
      `${PAGE} does not select each section's items by exactly`,
      "  items: records.filter((r) => r.model === s.model),",
      "Publication is decided upstream (Section 4.5 `Work page`), and placement",
      "is decided by the model alone. Any other predicate, or anything chained",
      "onto this one, can hide a published record with no error.",
      grouped,
    ])
  }

  // Anything that shortens the list is the failure this check exists for: it
  // leaves a page that renders, looks complete, and is missing records.
  for (const method of [".slice(", ".splice(", ".shift(", ".pop("]) {
    if (grouped.includes(method)) {
      fail([
        `${PAGE} calls ${method} while grouping records.`,
        "A shortened section renders without error and looks like a full page.",
        grouped,
      ])
    }
  }

  // The server component must actually pass records. Without this, the prop is
  // ignored and nothing anywhere reports it.
  const server = readFileSync(SERVER, "utf8")
  if (!/<WorkRedesign\s+records=\{/.test(server)) {
    fail([
      `${SERVER} does not pass records to <WorkRedesign>.`,
      "The page would render nothing on every request.",
    ])
  }
  if (!/getWorkPageRecords\(/.test(server)) {
    fail([`${SERVER} does not call getWorkPageRecords().`])
  }

  // The fallback must be the whole extract. A narrower default would render a
  // subset whenever the record store is unreachable, and look like a full page.
  // It lives in the data module now, not in a default prop value.
  const data = readFileSync(DATA, "utf8")
  if (!/records:\s*WORK_RECORDS\b/.test(data)) {
    fail([
      `${DATA} does not fall back to WORK_RECORDS.`,
      "The generated extract is the fallback when portfolio_records cannot be",
      "read. Falling back to anything else serves a partial page on failure.",
    ])
  }

  // Every record must land in exactly one section.
  const orphans = WORK_RECORDS.filter((r) => !sections.includes(r.model))
  if (orphans.length > 0) {
    fail([
      `${orphans.length} record(s) would not render on ${PAGE}:`,
      ...orphans.map((r) => `  ${r.title}\n      model ${JSON.stringify(r.model)} matches no section`),
      "",
      `Sections are: ${sections.map((s) => JSON.stringify(s)).join(", ")}`,
      "A record whose commercial model matches no section is dropped silently.",
    ])
  }

  const counts = sections.map((s) => ({
    section: s,
    n: WORK_RECORDS.filter((r) => r.model === s).length,
  }))
  const total = counts.reduce((sum, c) => sum + c.n, 0)
  if (total !== WORK_RECORDS.length) {
    fail([
      `Section totals (${total}) do not add up to ${WORK_RECORDS.length} records.`,
      "A record is counted twice or not at all.",
    ])
  }

  console.log(`${WORK_RECORDS.length} published record(s), all rendered:`)
  for (const c of counts) console.log(`  ${c.section}: ${c.n}`)
}

main()

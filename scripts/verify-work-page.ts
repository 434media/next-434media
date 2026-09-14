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
 * Exits non-zero on any record that would not render.
 */
import { readFileSync } from "node:fs"

import { WORK_RECORDS } from "../lib/work-records"

const PAGE = "app/work/WorkClient.tsx"

function fail(lines: string[]): never {
  console.error(lines.join("\n"))
  process.exit(1)
}

function main(): void {
  const src = readFileSync(PAGE, "utf8")

  // The three section ids the page groups by, read from CATEGORIES.
  const meta = src.slice(
    src.indexOf("const CATEGORIES: CategoryMeta[] = ["),
    src.indexOf("\n]\n", src.indexOf("const CATEGORIES: CategoryMeta[] = [")),
  )
  const sections = [...meta.matchAll(/id: "([^"]+)"/g)].map((m) => m[1])
  if (sections.length === 0) {
    fail([`Could not read CATEGORIES ids from ${PAGE}.`])
  }

  // The page must derive its items from every record, unfiltered.
  if (!/WORK_RECORDS\.map\(/.test(src)) {
    fail([
      `${PAGE} no longer derives its items from WORK_RECORDS.map().`,
      "Every published record must reach the page; a filter or a hand-written",
      "list will drop records silently.",
    ])
  }
  const derivation = src.slice(
    src.indexOf("const workItems"),
    src.indexOf("\n\n", src.indexOf("const workItems")),
  )
  if (/\.filter\(/.test(derivation)) {
    fail([
      `${PAGE} filters records while deriving workItems.`,
      "Publication is decided by the generator (Section 4.5 `Work page`), not",
      "by the page. A filter here hides a published record with no error.",
      derivation,
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

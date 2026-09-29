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
 * The page now receives its records as a prop from the server component, which
 * reads them from `portfolio_records`. CI cannot reach Firestore, so what is
 * checked here is the shape of the path the records travel: the page maps over
 * everything it is given, the server component actually passes them, and the
 * fallback is the full generated extract rather than a subset. Whether the
 * store's content matches the extract is settled by
 * scripts/sor/compare-work-records.ts, which needs no credentials either.
 *
 * Exits non-zero on any record that would not render.
 */
import { readFileSync } from "node:fs"

import { WORK_RECORDS } from "../lib/work-records"

const PAGE = "app/work/WorkClient.tsx"
const SERVER = "app/work/page.tsx"

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

  // The page must derive its items from every record it is given, unfiltered.
  const start = src.indexOf("function buildItems(")
  if (start === -1) {
    fail([
      `${PAGE} no longer derives its items in buildItems().`,
      "Every record the page receives must reach it; a filter or a hand-written",
      "list will drop records silently.",
    ])
  }
  const derivation = src.slice(start, src.indexOf("\n}", start))
  if (!/records\.map\(/.test(derivation)) {
    fail([`${PAGE} buildItems() does not map over its records argument.`, derivation])
  }
  if (/\.filter\(/.test(derivation)) {
    fail([
      `${PAGE} filters records while deriving workItems.`,
      "Publication is decided upstream (Section 4.5 `Work page`), not by the",
      "page. A filter here hides a published record with no error.",
      derivation,
    ])
  }

  // The fallback must be the whole extract. A narrower default would render a
  // subset whenever the record store is unreachable, and look like a full page.
  if (!/records\s*=\s*WORK_RECORDS\b/.test(src)) {
    fail([
      `${PAGE} does not default its records prop to WORK_RECORDS.`,
      "The generated extract is the fallback when portfolio_records cannot be",
      "read. Defaulting to anything else serves a partial page on failure.",
    ])
  }

  // The server component must actually pass records. Without this, the prop is
  // ignored, the default is used forever, and nothing anywhere reports it.
  const server = readFileSync(SERVER, "utf8")
  if (!/<WorkClient\s+records=\{/.test(server)) {
    fail([
      `${SERVER} does not pass records to <WorkClient>.`,
      "The page would silently render the fallback on every request.",
    ])
  }
  if (!/getWorkPageRecords\(/.test(server)) {
    fail([`${SERVER} does not call getWorkPageRecords().`])
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

/**
 * Verify the Work page against the committed portfolio record. CI-safe: reads
 * only files in this repository, needs no secrets, no network, no context store.
 *
 * Catches the failure mode that reading misses. During #24 the reconciliation
 * found an abridged description with three sentences dropped, ASCII apostrophes
 * where the record has U+2019, and two record fields concatenated into one card
 * field — none visible at a glance. It also catches the likelier future case:
 * the record changes and the page is not updated. Section 4 moved five times
 * during that PR's life and twice changed a rendered field.
 *
 *   npx tsx scripts/verify-portfolio-records.ts
 *
 * Exits non-zero on any deviation. Refresh the record with
 * scripts/extract-portfolio-records.ts when the context store changes.
 */
import { readFileSync } from "node:fs"

const RECORDS = "docs/standards/portfolio-records.json"
const PAGE = "app/work/WorkClient.tsx"

// card field -> record field
const COMPARE: Record<string, string> = {
  client: "client",
  role: "role",
  credit: "founderCredit",
  collaboratorCredit: "creativeCredit",
  description: "description",
}

interface Payload {
  sourceVersion: string
  records: Record<string, Record<string, string>>
}

function cards(src: string): Record<string, string>[] {
  const start = src.indexOf("const workItems")
  const end = src.indexOf("\n]", start)
  if (start < 0 || end < 0) throw new Error(`Could not locate workItems in ${PAGE}`)
  return src
    .slice(start, end)
    .split(/\n {2}\{\n/)
    .slice(1)
    .map((block) => {
      const out: Record<string, string> = {}
      for (const key of ["title", ...Object.keys(COMPARE)]) {
        const m = block.match(new RegExp(`^\\s*${key}:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m"))
        if (m) out[key] = m[1].replace(/\\"/g, '"')
      }
      return out
    })
}

function main() {
  const payload = JSON.parse(readFileSync(RECORDS, "utf8")) as Payload
  const page = cards(readFileSync(PAGE, "utf8"))
  const problems: string[] = []

  for (const card of page) {
    const record = payload.records[card.title]
    if (!record) {
      problems.push(
        `"${card.title}" is on the Work page but has no published record.\n` +
          `    Either it is not in Section 4, or it is marked "Work page: Not published".`,
      )
      continue
    }
    for (const [cardField, recordField] of Object.entries(COMPARE)) {
      const got = card[cardField]
      if (got === undefined) continue
      const want = record[recordField]
      if (got !== want) {
        problems.push(
          `"${card.title}" — ${cardField} does not match the record\n` +
            `      page:   ${JSON.stringify(got)}\n` +
            `      record: ${JSON.stringify(want ?? null)}`,
        )
      }
    }
  }

  const compared = page.length
  console.log(`Work page vs portfolio record (source ${payload.sourceVersion})`)
  console.log(`  ${compared} cards on the page · ${Object.keys(payload.records).length} published records`)

  if (problems.length) {
    console.error(`\n${problems.length} deviation(s):\n`)
    problems.forEach((p) => console.error(`  · ${p}\n`))
    console.error(
      "The Work page must reproduce the record exactly (Display and Design Standard 2.6).\n" +
        "If the record changed, re-run scripts/extract-portfolio-records.ts with the\n" +
        "context store mounted and commit the updated JSON alongside the page change.",
    )
    process.exit(1)
  }
  console.log("  no deviations")
}

main()

/**
 * Extract the PUBLIC half of the Section 4 portfolio record into the repo, so
 * CI has something to verify the Work page against.
 *
 * The context document cannot live in this repository — it carries the
 * qualification ladder, engagement bands, and per-record internal context, and
 * this repo is public. But the fields the Work page renders are public by
 * definition: they are on the website. Extracting only those gives CI a
 * comparison target without publishing anything that is not already published.
 *
 * Emitted per record: client, role, founderCredit, creativeCredit, years,
 * status, description.
 * NEVER emitted: Internal context, Proof assets, Categories, or any record
 * carrying `Work page: Not published`.
 *
 * Run locally, where the context store is reachable. Commit the result.
 *
 *   MASTER_CONTEXT_PATH="/path/to/434_MEDIA_Master_Contextual_Document_v2_0_Locked.md" \
 *     npx tsx scripts/extract-portfolio-records.ts
 */
import { readFileSync, writeFileSync } from "node:fs"

const OUT = "docs/standards/portfolio-records.json"

// Only these leave the store. Adding a field here is a disclosure decision —
// everything else in a record (Internal context, Proof assets, Categories,
// Credit rule, Scope, and the rest) stays in the context store.
//
// Several record fields feed one card field, and Section 4 spells some of them
// more than one way, so each output field lists its sources in precedence
// order. "Presenting partner" is the attribution on Rise of a Champion, which
// has no Client; omitting it made the verifier report a page deviation that
// was really a hole in this map.
const PUBLIC_FIELDS: Record<string, string[]> = {
  client: ["Client", "Presenting partner"],
  role: ["434 MEDIA role"],
  founderCredit: ["Founder credit"],
  creativeCredit: ["Creative credit"],
  years: ["Years", "Year", "Year established"],
  status: ["Status"],
  description: ["Public description"],
}

function main() {
  const path = process.env.MASTER_CONTEXT_PATH
  if (!path) {
    console.error(
      "MASTER_CONTEXT_PATH is not set. This script reads the context store and is\n" +
        "meant to run locally, not in CI — CI verifies against the committed JSON.",
    )
    process.exit(1)
  }

  const src = readFileSync(path, "utf8")
  const version = src.match(/^\*\*Version ([0-9.]+)/m)?.[1] ?? "unknown"

  // Records are #### headings, except Rise of a Champion which is a #####
  // nested under TXMX Boxing. Splitting on #### alone merges the two and
  // silently attributes Rise's fields to TXMX.
  const parts = src.split(/\n#{4,5} /)
  const records: Record<string, Record<string, string>> = {}
  let held = 0

  for (const block of parts.slice(1)) {
    const title = block.split("\n")[0].trim()
    const fields: Record<string, string> = {}
    let notPublished = false

    // First occurrence of a key wins: a nested record's fields follow its own
    // heading, so stopping at the first keeps blocks from bleeding together.
    const raw: Record<string, string> = {}
    for (const m of block.matchAll(/^- \*\*([^*]+):\*\*\s*(.+)$/gm)) {
      const key = m[1].trim()
      const value = m[2].trim()
      if (key === "Work page" && /Not published/i.test(value)) notPublished = true
      if (!(key in raw)) raw[key] = value
    }
    for (const [out, sources] of Object.entries(PUBLIC_FIELDS)) {
      const hit = sources.find((s) => s in raw)
      if (hit) fields[out] = raw[hit]
    }

    if (!fields.description) continue // not a portfolio record
    if (notPublished) {
      held++
      continue
    }
    records[title] = fields
  }

  const payload = {
    $comment:
      "Generated from the 434 context store by scripts/extract-portfolio-records.ts. " +
      "Public fields of published Section 4 records only — the same values rendered " +
      "on the Work page. Do not hand-edit; re-run the script.",
    sourceVersion: version,
    generatedAt: new Date().toISOString().slice(0, 10),
    records,
  }

  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n")
  console.log(`Wrote ${OUT}`)
  console.log(`  source version : ${version}`)
  console.log(`  published      : ${Object.keys(records).length}`)
  console.log(`  held back      : ${held} (Work page: Not published)`)
}

main()

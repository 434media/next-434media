/**
 * Prove the Work page's committed artifact is current with the seed.
 *
 * The records are canonical in `portfolio_records` seed; `lib/work-records.ts`
 * is generated from it by emit_work_records.py and is the page's fallback when
 * Firestore cannot be read. This compares the committed artifact against the
 * seed mapped through `lib/sor/work-records.ts` — the same mapper the Firestore
 * path uses — field by field, in order. Any difference is printed and the
 * script exits non-zero.
 *
 * So it catches two things at once: an artifact nobody regenerated after a seed
 * change, and a mapper that disagrees with the generator about any field. Until
 * the records moved it compared two independent extractions of the master; that
 * second source is gone, and this is what the check is for now.
 *
 * This runs against the seed rather than against Firestore so it needs no
 * credentials and can run in CI. The seed is what was loaded, and the loader
 * writes rows verbatim apart from `updated_at`/`updated_by`, neither of which
 * the mapper reads.
 *
 * Usage: tsx scripts/sor/compare-work-records.ts [--seed <dir>]
 */
import { readFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { WORK_RECORDS, type WorkRecord } from "../../lib/work-records"
import { toWorkRecords } from "../../lib/sor/work-records"

function seedDir(): string {
  const i = process.argv.indexOf("--seed")
  if (i !== -1 && process.argv[i + 1]) return resolve(process.argv[i + 1])
  const guess = resolve("../434-context/05 System of Record/seed")
  if (existsSync(guess)) return guess
  throw new Error("Seed not found; pass --seed <dir>.")
}

const rows = JSON.parse(readFileSync(join(seedDir(), "portfolio_records.json"), "utf8"))
const order = WORK_RECORDS.map((r) => r.recordKey ?? "")
const mapped = toWorkRecords(rows, order)

const problems: string[] = []

if (mapped.length !== WORK_RECORDS.length) {
  problems.push(`count: generated ${WORK_RECORDS.length}, mapped ${mapped.length}`)
}

const FIELDS = Object.keys(WORK_RECORDS[0]) as (keyof WorkRecord)[]
for (let i = 0; i < Math.max(mapped.length, WORK_RECORDS.length); i++) {
  const a = WORK_RECORDS[i]
  const b = mapped[i]
  if (!a) { problems.push(`[${i}] only in mapped: ${b?.title}`); continue }
  if (!b) { problems.push(`[${i}] only in generated: ${a.title}`); continue }
  for (const f of FIELDS) {
    if (a[f] !== b[f]) {
      problems.push(`[${i}] ${a.title} · ${f}:\n      generated ${JSON.stringify(a[f])}\n      mapped    ${JSON.stringify(b[f])}`)
    }
  }
}

if (problems.length) {
  console.error(`DIFFERENT — ${problems.length} difference(s):`)
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`)
  process.exit(1)
}

console.log(`IDENTICAL — ${mapped.length} records, ${FIELDS.length} fields each, no differences.`)
console.log(`  fields compared: ${FIELDS.join(", ")}`)

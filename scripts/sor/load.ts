/**
 * Load the system-of-record seed into Firestore.
 *
 * Idempotent: every row upserts on its own `key`, so a re-run converges rather
 * than duplicating. The document id *is* the key, which is why the two records
 * that arrived without one (see seed/_exceptions.json) need a founder decision
 * before a production load — a key is permanent once it is written.
 *
 * All-or-nothing: every row is validated against its schema before anything is
 * written. A single failure refuses the whole load. A partially-applied
 * migration is worse than none, because nothing downstream can tell which half
 * it is reading.
 *
 * The schemas are canonical in the private context repo and are not in this
 * repository; pass --seed and --schemas, or run from a checkout that has both.
 *
 * Usage:
 *   tsx scripts/sor/load.ts --dry-run
 *   tsx scripts/sor/load.ts --seed <dir> --schemas <dir> [--dry-run]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, resolve, basename } from "node:path"
import Ajv2020 from "ajv/dist/2020"
import addFormats from "ajv-formats"

/** Seed file -> collection and schema. Order is the load order. */
const TABLES = [
  { seed: "portfolio_records.json", collection: "portfolio_records", schema: "portfolio_record" },
  { seed: "cohorts.json", collection: "cohorts", schema: "cohort" },
  { seed: "qualification_thresholds.json", collection: "qualification_thresholds", schema: "qualification_threshold" },
  { seed: "partner_services.json", collection: "partner_services", schema: "partner_service" },
  { seed: "rate_card.json", collection: "rate_card_lines", schema: "rate_card_line", optional: true },
] as const

const DRY = process.argv.includes("--dry-run")

function arg(name: string, fallbacks: string[]): string {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1 && process.argv[i + 1]) return resolve(process.argv[i + 1])
  for (const f of fallbacks) if (existsSync(resolve(f))) return resolve(f)
  throw new Error(`--${name} not given and no default found`)
}

const SEED = arg("seed", ["../434-context/05 System of Record/seed"])
const SCHEMAS = arg("schemas", ["../434-context/05 System of Record/schemas"])

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"))

/** Stable document id for an enumeration value. */
function enumKey(value: unknown): string {
  if (value && typeof value === "object" && "key" in (value as Record<string, unknown>)) {
    return String((value as { key: unknown }).key)
  }
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

type Row = Record<string, unknown> & { key: string }
type Planned = { collection: string; rows: Row[] }

async function main() {
  const manifest = read(join(SEED, "_manifest.json"))
  const updatedBy = `migration-${manifest.master_version}`

  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  for (const f of readdirSync(SCHEMAS).filter((f) => f.endsWith(".schema.json"))) {
    ajv.addSchema(read(join(SCHEMAS, f)), basename(f, ".schema.json"))
  }

  const planned: Planned[] = []
  const failures: string[] = []
  const now = new Date().toISOString()

  for (const table of TABLES) {
    const path = join(SEED, table.seed)
    if (!existsSync(path)) {
      if (!("optional" in table && table.optional)) failures.push(`${table.seed}: missing`)
      else console.log(`  ${table.collection}: seed not present, skipped`)
      continue
    }
    const validate = ajv.getSchema(table.schema)
    if (!validate) { failures.push(`${table.schema}: schema not loaded`); continue }

    const rows: Row[] = read(path).map((row: Record<string, unknown>) => ({
      ...row,
      // `source` is carried from the row; a row without one is a row whose
      // provenance nobody can state, so it fails rather than defaulting.
      updated_at: now,
      updated_by: updatedBy,
    }))

    const seen = new Set<string>()
    for (const row of rows) {
      if (!row.key) { failures.push(`${table.collection}: a row has no key`); continue }
      if (seen.has(row.key)) failures.push(`${table.collection}/${row.key}: duplicate key`)
      seen.add(row.key)
      if (!row.source) failures.push(`${table.collection}/${row.key}: no source`)
      if (!validate(row)) {
        for (const e of validate.errors ?? []) {
          failures.push(`${table.collection}/${row.key}: ${e.instancePath || "/"} ${e.message}`)
        }
      }
    }
    planned.push({ collection: table.collection, rows })
  }

  // Enumerations: one collection each, document id from the value.
  const enums: Record<string, unknown[]> = read(join(SEED, "enums.json"))
  for (const [name, values] of Object.entries(enums)) {
    const rows: Row[] = values.map((value, i) => ({
      key: enumKey(value),
      ...(value && typeof value === "object" ? (value as object) : { label: value }),
      ordinal: i,
      source: `master ${manifest.master_version}`,
      updated_at: now,
      updated_by: updatedBy,
    }))
    const keys = rows.map((r) => r.key)
    if (new Set(keys).size !== keys.length) failures.push(`${name}: duplicate enum keys`)
    planned.push({ collection: name, rows })
  }

  if (failures.length) {
    console.error(`REFUSED — ${failures.length} problem(s), nothing written:`)
    for (const f of failures.slice(0, 40)) console.error(`  ${f}`)
    process.exit(1)
  }

  const total = planned.reduce((n, p) => n + p.rows.length, 0)
  console.log(`\nmaster ${manifest.master_version} · updated_by=${updatedBy}`)
  for (const p of planned) console.log(`  ${p.collection.padEnd(26)} ${String(p.rows.length).padStart(3)} rows`)
  console.log(`  ${"TOTAL".padEnd(26)} ${String(total).padStart(3)} rows across ${planned.length} collections`)

  if (DRY) {
    console.log(`\nDRY RUN — validated only, nothing written.`)
    return
  }

  const { getDb } = await import("../../lib/firebase-admin")
  const db = getDb()
  for (const p of planned) {
    // 500 is Firestore's documented per-batch write limit.
    for (let i = 0; i < p.rows.length; i += 400) {
      const batch = db.batch()
      for (const row of p.rows.slice(i, i + 400)) {
        batch.set(db.collection(p.collection).doc(row.key), row, { merge: true })
      }
      await batch.commit()
    }
    console.log(`  wrote ${p.collection}: ${p.rows.length}`)
  }
  console.log(`\nLoaded ${total} rows.`)
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e))
  process.exit(1)
})

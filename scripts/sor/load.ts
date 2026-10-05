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
import { createHash } from "node:crypto"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, resolve, basename } from "node:path"
import Ajv2020 from "ajv/dist/2020"
import addFormats from "ajv-formats"

/** Seed file -> collection and schema. Order is the load order. */
const TABLES = [
  { seed: "portfolio_records.json", collection: "portfolio_records", schema: "portfolio_record" },
  // Seed file and collection differ deliberately: the CRM already has
  // `crm_cohorts` for Digital Canvas program cohorts, which are a different
  // thing entirely. These are ICP buyer segments A-E.
  { seed: "cohorts.json", collection: "icp_cohorts", schema: "cohort" },
  { seed: "qualification_thresholds.json", collection: "qualification_thresholds", schema: "qualification_threshold" },
  { seed: "partner_services.json", collection: "partner_services", schema: "partner_service" },
  { seed: "rate_card.json", collection: "rate_card_lines", schema: "rate_card_line", optional: true },
  { seed: "launch_dependencies.json", collection: "launch_dependencies", schema: "launch_dependency" },
  // Internal by policy, not by accident: master 4.11 forbids using a talent
  // history to imply management or representation, and a public read is the
  // shortest route to exactly that. See INTERNAL_COLLECTIONS in lib/sor/visibility.ts.
  { seed: "talent_relationships.json", collection: "talent_relationships", schema: "talent_relationship" },
  { seed: "work_page_sections.json", collection: "work_page_sections", schema: "work_page_section" },
] as const

const DRY = process.argv.includes("--dry-run")
/** Reads Firestore and writes nothing: reports what a load would add, change or leave alone. */
const PLAN = process.argv.includes("--plan")

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

/**
 * The policy and voice files, read as documents rather than rows.
 *
 * They are what `get_policy` serves. A job with a network reads them here; a
 * job without one reads the copy in its bundle. Both come from the same cut, so
 * the connector is the live path rather than a second version.
 *
 * Firestore's document limit is 1 MiB and the policy is ~69 KB, so a whole
 * document fits in a field with room to spare.
 */
function policyRows(policyPath: string, voiceDir: string, now: string, updatedBy: string): Row[] {
  const read = (p: string) => readFileSync(p, "utf8")
  const short = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16)
  const versionOf = (t: string) =>
    t.match(/\*\*Version (\S+) \u2014/)?.[1] ?? t.match(/^Version:\s*(.+?)\s*$/m)?.[1]?.trim() ?? "unversioned"

  const rows: Row[] = []
  const policy = read(policyPath)
  rows.push({
    key: "policy", kind: "policy", title: "434 MEDIA \u2014 Policy",
    version: versionOf(policy), body: policy, bytes: Buffer.byteLength(policy),
    sha256: short(policy), source: "434-context: 00 Governing/434_MEDIA_Policy.md",
    updated_at: now, updated_by: updatedBy,
  })
  for (const f of readdirSync(voiceDir).filter((f) => f.endsWith(".md")).sort()) {
    const body = read(join(voiceDir, f))
    rows.push({
      key: `voice-${basename(f, ".md").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`,
      kind: "voice", title: basename(f, ".md"), version: versionOf(body), body,
      bytes: Buffer.byteLength(body), sha256: short(body),
      source: `434-context: 01 Voice System/${f}`, updated_at: now, updated_by: updatedBy,
    })
  }
  return rows
}

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

  // Policy and voice documents, if their sources are reachable.
  const policyPath = process.argv.includes("--policy")
    ? resolve(process.argv[process.argv.indexOf("--policy") + 1])
    : resolve("../434-context/00 Governing/434_MEDIA_Policy.md")
  const voiceDir = process.argv.includes("--voice")
    ? resolve(process.argv[process.argv.indexOf("--voice") + 1])
    : resolve("../434-context/01 Voice System")
  if (existsSync(policyPath) && existsSync(voiceDir)) {
    const rows = policyRows(policyPath, voiceDir, now, updatedBy)
    // Validated like every other collection. These rows are built in code rather
    // than read from seed, which is exactly why they need the check — nothing
    // upstream has already refused a malformed one.
    const validatePolicy = ajv.getSchema("policy_document")
    if (!validatePolicy) failures.push("policy_document: schema not loaded")
    else for (const row of rows) {
      if (!validatePolicy(row)) {
        for (const e of validatePolicy.errors ?? []) {
          failures.push(`policy_documents/${row.key}: ${e.instancePath || "/"} ${e.message}`)
        }
      }
    }
    planned.push({ collection: "policy_documents", rows })
  } else {
    failures.push(`policy_documents: ${policyPath} or ${voiceDir} not found; pass --policy and --voice`)
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

  // --plan reads Firestore and writes nothing. Everything above has already
  // validated, so a plan that prints is a load that would have succeeded.
  //
  // Rows in Firestore that the seed does not have are REPORTED, never removed.
  // The loader has no delete path and this does not add one: a row the seed has
  // dropped may be a record the master retired, or may be a seed that is behind,
  // and only a person can tell those apart.
  if (PLAN) {
    const { getDb } = await import("../../lib/firebase-admin")
    const db = getDb()
    console.log(`\nPLAN — reading Firestore, writing nothing.`)
    let add = 0, chg = 0, same = 0, extra = 0
    for (const p of planned) {
      const snap = await db.collection(p.collection).get()
      const live = new Map(snap.docs.map((d) => [d.id, d.data() as Record<string, unknown>]))
      const seedKeys = new Set(p.rows.map((r) => r.key))
      const a: string[] = [], c: string[] = [], u: string[] = []
      for (const row of p.rows) {
        const cur = live.get(row.key)
        if (!cur) { a.push(row.key); continue }
        // updated_at/updated_by are written by the loader, not carried by the
        // seed, so comparing them would mark every row changed on every run.
        const strip = (o: Record<string, unknown>) => {
          const { updated_at, updated_by, ...rest } = o
          return JSON.stringify(rest, Object.keys(rest).sort())
        }
        if (strip(cur) === strip(row as unknown as Record<string, unknown>)) u.push(row.key)
        else c.push(row.key)
      }
      const only = [...live.keys()].filter((k) => !seedKeys.has(k)).sort()
      add += a.length; chg += c.length; same += u.length; extra += only.length
      console.log(`\n  ${p.collection}`)
      console.log(`    add       ${String(a.length).padStart(3)}${a.length ? "  " + a.join(" ") : ""}`)
      console.log(`    change    ${String(c.length).padStart(3)}${c.length ? "  " + c.join(" ") : ""}`)
      console.log(`    unchanged ${String(u.length).padStart(3)}`)
      if (only.length) console.log(`    IN FIRESTORE, NOT IN SEED  ${only.length}  ${only.join(" ")}   (reported, never removed)`)
    }
    console.log(`\n  TOTAL  add ${add} · change ${chg} · unchanged ${same} · firestore-only ${extra}`)
    console.log(`  Nothing was written.`)
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

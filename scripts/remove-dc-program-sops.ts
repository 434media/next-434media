/**
 * Retire the "Digital Canvas Program" space from the SOPs knowledge base.
 *
 * The SOPs page used to carry two spaces: 434 Media (evergreen company
 * knowledge) and Digital Canvas Program — five verb categories that were the
 * intern cohort's playbook home. The cohort ended, the space was removed from
 * app/admin/sops/page.tsx, and this deletes the docs that lived in it. Without
 * this, those docs would be stranded: no category in the rail matches them, so
 * `normalizeCategory` would silently dump them into Operations.
 *
 * Scope is the program categories ONLY — the verb keys and the squad-named keys
 * they replaced. Docs in the six 434 Media categories are never touched, even
 * the intern-authored ones under Sales & CRM (those live in the company space
 * and stay).
 *
 * SAFETY: dry-run by default, and every deleted doc is snapshotted to
 * backups/ first, so a mistaken run is recoverable from that file.
 *
 *   npx tsx scripts/remove-dc-program-sops.ts            # preview
 *   npx tsx scripts/remove-dc-program-sops.ts --apply    # snapshot + delete
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

// `node --env-file` mis-parses the double-quote-wrapped JSON blob in .env.local
// (it stops at the first inner quote), so load the env by hand.
function loadEnv(path = ".env.local") {
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch {
    console.error(`Could not read ${path} — run this from the repo root.`)
    process.exit(1)
  }
  for (const line of raw.split("\n")) {
    const eq = line.indexOf("=")
    if (eq < 0 || line.trimStart().startsWith("#")) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

const COLLECTION = "pm_sops"

// The verb categories, plus the squad-named keys they replaced (older docs may
// still carry those).
const PROGRAM_CATEGORIES = new Set([
  "find",
  "frame",
  "ship",
  "tell",
  "prove",
  "GTM",
  "Underwriter Onboarding",
  "Builders",
  "Storytellers",
  "Analytics",
])

const APPLY = process.argv.includes("--apply")
const BACKUP_PATH = resolve("backups/dc-program-sops-snapshot.json")

async function main() {
  const { getDb } = await import("../lib/firebase-admin")
  const db = getDb()
  const snap = await db.collection(COLLECTION).get()

  const doomed = snap.docs.filter((d) => PROGRAM_CATEGORIES.has(String((d.data() as { category?: string }).category)))
  const kept = snap.size - doomed.length

  console.log(`\n${APPLY ? "APPLYING — deleting Digital Canvas program SOPs" : "DRY-RUN — no writes (pass --apply)"}\n`)

  if (!doomed.length) {
    console.log(`No SOPs in a Digital Canvas program category. ${kept} doc(s) untouched — nothing to do.`)
    return
  }

  const w = (s: string, n: number) => s.padEnd(n)
  console.log(w("CATEGORY", 12) + w("STATUS", 10) + w("OWNER", 20) + "TITLE")
  console.log("-".repeat(96))
  const rows = doomed
    .map((d) => d.data() as { category?: string; status?: string; owner?: string; title?: string })
    .sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.title).localeCompare(String(b.title)))
  for (const r of rows) {
    console.log(w(String(r.category ?? "-"), 12) + w(String(r.status ?? "-"), 10) + w(String(r.owner ?? "-"), 20) + String(r.title ?? "").trim())
  }
  console.log(`\n${doomed.length} SOP(s) to delete · ${kept} 434 Media doc(s) untouched\n`)

  if (!APPLY) {
    console.log(`Preview only. Re-run with --apply to snapshot these to\n${BACKUP_PATH} and delete them.`)
    return
  }

  const backup = doomed.map((doc) => ({ id: doc.id, data: doc.data() }))
  mkdirSync(dirname(BACKUP_PATH), { recursive: true })
  writeFileSync(BACKUP_PATH, JSON.stringify({ collection: COLLECTION, removedAt: new Date().toISOString(), records: backup }, null, 2))
  console.log(`Snapshot written: ${BACKUP_PATH} (${backup.length} doc(s))`)

  const batch = db.batch()
  for (const doc of doomed) batch.delete(doc.ref)
  await batch.commit()

  console.log(`Deleted ${doomed.length} ${COLLECTION} doc(s). ${kept} remain.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

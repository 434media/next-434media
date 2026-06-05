/**
 * Rename the brand "DEVSA TV" → "DEVSA" on existing CRM records.
 *
 * The brand is stored as a plain string on each record, so renaming it in code
 * (the Brand union / BRANDS / BRAND_GOALS) without migrating the data would
 * leave old "DEVSA TV" rows unmatched by the new "DEVSA" goal card. This rewrites
 * every stored occurrence across the brand-bearing collections:
 *   - crm_clients      (clients AND opportunities — opps are is_opportunity rows)
 *   - crm_tasks        (opportunity tasks carry a brand)
 *   - crm_content_posts (social/content posts carry a brand)
 *
 * Safety: DRY-RUN by default — prints the plan, writes nothing. Pass --apply.
 *
 *   npx tsx --env-file=.env.local scripts/rename-brand-devsa.ts
 *   npx tsx --env-file=.env.local scripts/rename-brand-devsa.ts --apply
 */
import { getDb } from "../lib/firebase-admin"

const APPLY = process.argv.includes("--apply")
const FROM = "DEVSA TV"
const TO = "DEVSA"
const COLLECTIONS = ["crm_clients", "crm_tasks", "crm_content_posts"]

async function main() {
  const db = getDb()
  console.log(`\n${APPLY ? "🔴 APPLY" : "🟢 DRY-RUN"} — rename brand "${FROM}" → "${TO}"\n`)

  let grandTotal = 0
  for (const col of COLLECTIONS) {
    const snap = await db.collection(col).where("brand", "==", FROM).get()
    console.log(`  ${col.padEnd(20)} ${snap.size} row(s) with brand "${FROM}"`)
    grandTotal += snap.size

    if (APPLY && snap.size > 0) {
      let i = 0
      for (; i < snap.docs.length; i += 400) {
        const batch = db.batch()
        for (const d of snap.docs.slice(i, i + 400)) {
          batch.update(d.ref, { brand: TO })
        }
        await batch.commit()
      }
    }
  }

  console.log(`\n── Summary ──`)
  console.log(`Total rows ${APPLY ? "updated" : "to update"}: ${grandTotal}`)
  if (!APPLY) {
    console.log(`\n🟢 Dry-run — nothing written. Re-run with --apply to execute.`)
  } else {
    console.log(`\n✅ Renamed ${grandTotal} row(s) from "${FROM}" to "${TO}".`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

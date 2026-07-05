/**
 * Backfill opportunity `disposition` from the legacy vocabulary to the funnel
 * stage names — the data half of the CRM↔funnel alignment (Phase 1):
 *   open    → discovery
 *   pitched → proposal
 * `closed_won` / `closed_lost` are already funnel-aligned and left untouched.
 *
 * Runs over BOTH client-opportunities (`crm_clients`, is_opportunity) and the
 * few task-opportunities (`crm_tasks`, is_opportunity) so nothing shows a blank
 * stage in the interim before Phase 2 migrates task-opps into clients.
 *
 * Idempotent (only rewrites the two legacy values). DRY-RUN by default; pass
 * --apply to write.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-opportunity-stages.ts
 *   npx tsx --env-file=.env.local scripts/backfill-opportunity-stages.ts --apply
 */
import { getDb } from "../lib/firebase-admin"

const RENAME: Record<string, string> = { open: "discovery", pitched: "proposal" }

async function backfillCollection(collection: string, apply: boolean) {
  const db = getDb()
  const snap = await db.collection(collection).where("is_opportunity", "==", true).get()
  const plan: Record<string, number> = {}
  let changed = 0
  for (const doc of snap.docs) {
    const cur = doc.data().disposition as string | undefined
    if (!cur || !(cur in RENAME)) continue
    const next = RENAME[cur]
    plan[`${cur}→${next}`] = (plan[`${cur}→${next}`] ?? 0) + 1
    if (apply) {
      await doc.ref.update({ disposition: next })
      changed++
    }
  }
  const wouldChange = Object.values(plan).reduce((a, b) => a + b, 0)
  console.log(`\n[${collection}] opportunities scanned: ${snap.size}`)
  console.log(`  plan: ${JSON.stringify(plan)}`)
  console.log(apply ? `  applied: ${changed}` : `  dry-run — ${wouldChange} would change`)
}

async function main() {
  const apply = process.argv.includes("--apply")
  console.log(apply ? "APPLY mode — writing changes." : "DRY-RUN — no writes (pass --apply to write).")
  await backfillCollection("crm_clients", apply)
  await backfillCollection("crm_tasks", apply)
  console.log("\nDone.")
  process.exit(0)
}

main().catch((e) => {
  console.error("FATAL:", e)
  process.exit(1)
})

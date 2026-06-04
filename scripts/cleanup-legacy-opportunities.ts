/**
 * Retire the orphaned `crm_opportunities` collection.
 *
 * Opportunities live in `crm_clients` (is_opportunity=true) — that's where the
 * UI writes and the kanban reads, and (after the read-repoint) where the
 * dashboard/pipeline/command-palette read too. `crm_opportunities` is stale,
 * write-dead seed data (all "lead" stage, no overlap with the real opps) that
 * nothing reads anymore. This removes it so opportunities have one home.
 *
 * Safety:
 *   - DRY-RUN BY DEFAULT — lists what's there, deletes nothing. Pass --apply.
 *   - Sanity-guards: refuses to run if any crm_opportunities id ALSO exists in
 *     crm_clients (would indicate it's NOT just orphaned seed data) — pass
 *     --force to override after reviewing.
 *
 *   npx tsx --env-file=.env.local scripts/cleanup-legacy-opportunities.ts
 *   npx tsx --env-file=.env.local scripts/cleanup-legacy-opportunities.ts --apply
 */
import { getDb } from "../lib/firebase-admin"

const APPLY = process.argv.includes("--apply")
const FORCE = process.argv.includes("--force")
const LEGACY = "crm_opportunities"

async function main() {
  const db = getDb()
  const [legacy, clients] = await Promise.all([
    db.collection(LEGACY).get(),
    db.collection("crm_clients").get(),
  ])
  const clientIds = new Set(clients.docs.map((d) => d.id))
  const liveOpps = clients.docs.filter((d) => d.data().is_opportunity === true).length
  const overlap = legacy.docs.filter((d) => clientIds.has(d.id))

  console.log(`\n${APPLY ? "🔴 APPLY" : "🟢 DRY-RUN"} — retire ${LEGACY}\n`)
  console.log(`Real opportunities (crm_clients.is_opportunity): ${liveOpps} — kept, untouched`)
  console.log(`${LEGACY} docs to remove: ${legacy.size}`)
  console.log(`  of which share an id with crm_clients (should be 0): ${overlap.length}`)

  const byStage: Record<string, number> = {}
  for (const d of legacy.docs) {
    const s = String(d.data().stage ?? "(none)")
    byStage[s] = (byStage[s] ?? 0) + 1
  }
  console.log(`  by stage: ${JSON.stringify(byStage)}`)
  console.log(
    `  sample: ${legacy.docs.slice(0, 5).map((d) => d.data().name || d.data().client_name || d.id).join(", ")}`,
  )

  if (overlap.length > 0 && !FORCE) {
    console.log(
      `\n⚠ ${overlap.length} ${LEGACY} docs share an id with crm_clients — NOT just orphaned seed data.`,
    )
    console.log(`  Review before deleting; re-run with --force to override.`)
    return
  }

  if (!APPLY) {
    console.log(`\n🟢 Dry-run — nothing deleted. Re-run with --apply to remove ${legacy.size} docs.`)
    return
  }

  let deleted = 0
  for (let i = 0; i < legacy.docs.length; i += 400) {
    const batch = db.batch()
    for (const d of legacy.docs.slice(i, i + 400)) {
      batch.delete(d.ref)
      deleted++
    }
    await batch.commit()
  }
  console.log(`\n✅ Deleted ${deleted} docs from ${LEGACY}. Opportunities now live only in crm_clients.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Clean up legacy task collections after the task migration.
 *
 * The migration copied per-owner task collections + the master list into the
 * unified `crm_tasks` collection (preserving doc ids for the master-list rows),
 * but never deleted the originals. Those stale duplicates caused delete/edit to
 * hit the invisible copy (fixed in the tasks API route). This removes the dead
 * collections so `crm_tasks` is the single source of truth.
 *
 * Safety:
 *   - DRY-RUN BY DEFAULT — audits coverage, deletes nothing. Pass --apply.
 *   - Only deletes legacy docs whose id is ALSO present in `crm_tasks`
 *     (proven duplicates). Any "orphan" not found in crm_tasks is REPORTED and
 *     LEFT IN PLACE for manual review — pass --include-orphans to remove those
 *     too (only after you've confirmed they're safe to lose).
 *
 *   npx tsx --env-file=.env.local scripts/cleanup-legacy-tasks.ts
 *   npx tsx --env-file=.env.local scripts/cleanup-legacy-tasks.ts --apply
 *   npx tsx --env-file=.env.local scripts/cleanup-legacy-tasks.ts --apply --include-orphans
 */
import { getDb } from "../lib/firebase-admin"

const APPLY = process.argv.includes("--apply")
const INCLUDE_ORPHANS = process.argv.includes("--include-orphans")

const UNIFIED = "crm_tasks"
const LEGACY_COLLECTIONS = [
  "crm_master_list",
  "crm_tasks_jake",
  "crm_tasks_pm",
  "crm_tasks_marc",
  "crm_tasks_stacy",
  "crm_tasks_jesse",
  "crm_tasks_barb",
  "crm_tasks_teams",
  "crm_tasks_completed",
]

async function deleteRefs(db: FirebaseFirestore.Firestore, refs: FirebaseFirestore.DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch()
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref)
    await batch.commit()
  }
}

async function main() {
  const db = getDb()
  const unifiedSnap = await db.collection(UNIFIED).get()
  const unifiedIds = new Set(unifiedSnap.docs.map((d) => d.id))
  console.log(`\n${APPLY ? "🔴 APPLY" : "🟢 DRY-RUN"} — unified ${UNIFIED}: ${unifiedSnap.size} docs (source of truth)\n`)

  let totalCovered = 0
  let totalOrphan = 0

  for (const col of LEGACY_COLLECTIONS) {
    const snap = await db.collection(col).get()
    if (snap.empty) {
      console.log(`  ${col}: empty`)
      continue
    }
    const covered = snap.docs.filter((d) => unifiedIds.has(d.id))
    const orphans = snap.docs.filter((d) => !unifiedIds.has(d.id))
    totalCovered += covered.length
    totalOrphan += orphans.length
    console.log(
      `  ${col}: ${snap.size} docs | in crm_tasks (safe to drop): ${covered.length} | orphan (not in crm_tasks): ${orphans.length}`,
    )

    if (APPLY) {
      const toDelete = INCLUDE_ORPHANS ? snap.docs : covered
      await deleteRefs(db, toDelete.map((d) => d.ref))
      console.log(`     → deleted ${toDelete.length}${INCLUDE_ORPHANS ? " (incl. orphans)" : ""}`)
    }
  }

  console.log(
    `\nTotals — duplicates (in crm_tasks): ${totalCovered} | orphans (NOT in crm_tasks): ${totalOrphan}`,
  )
  if (!APPLY) {
    console.log(`\n🟢 Dry-run — nothing deleted.`)
    console.log(`   Re-run with --apply to drop the ${totalCovered} proven duplicates.`)
    if (totalOrphan > 0) {
      console.log(`   ${totalOrphan} orphan docs are NOT in crm_tasks — review them before using --include-orphans.`)
    }
  } else {
    console.log(`\n✅ Done.${totalOrphan > 0 && !INCLUDE_ORPHANS ? ` ${totalOrphan} orphans left in place for review.` : ""}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Reference backfill: gives existing tasks and opportunities their TSK-/OPP- reference (lib/record-refs.ts).
 *
 * Which records get one is `survivesTriage` in lib/record-refs-backfill.ts, the founder's rule decided 2026-11-19.
 * The plan is read by lib/record-refs-backfill-server.ts, the same reader as the founder-only dry-run route
 * GET /api/admin/refs/backfill-plan. The write runs only on the founder's separate go, after he has seen that plan.
 *
 * Never production by default: the emulator (FIRESTORE_EMULATOR_HOST) or --production. Dry-run unless --apply.
 * Idempotent: a record that has a reference keeps it, so a second run numbers nothing.
 *
 *   npx tsx --env-file=.env.local scripts/refs/backfill.ts --production                 # report only
 *   npx tsx --env-file=.env.local scripts/refs/backfill.ts --production --type OPP --apply
 */
import { scriptDb } from "../brand-profiles/load"
import { assignRefIfMissing, firestoreRefStore, type RefType } from "../../lib/record-refs"
import { TRIAGE_RULE_STATUS } from "../../lib/record-refs-backfill"
import { readBackfillPlan } from "../../lib/record-refs-backfill-server"
import { LEGACY_TASK_COLLECTIONS } from "../../lib/firestore-crm"

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const types: RefType[] = args.includes("--type") ? [args[args.indexOf("--type") + 1] as RefType] : ["TSK", "OPP"]
  if (types.some((t) => t !== "TSK" && t !== "OPP")) throw new Error("--type is TSK or OPP")
  if (apply && TRIAGE_RULE_STATUS !== "approved") throw new Error("The triage rule is not approved (lib/record-refs-backfill.ts). Nothing is written.")

  const { db, target } = await scriptDb(args.includes("--production"))
  const read = await readBackfillPlan(db, LEGACY_TASK_COLLECTIONS)
  console.log(`${apply ? "APPLY" : "DRY-RUN"} on ${target}; rule ${read.rule}; task store ${read.taskCollections.join(", ")}`)
  console.log(`scanned ${read.scanned.tasks} tasks, ${read.scanned.opportunities} opportunities`)
  for (const t of types) console.log(`  ${t}: ${JSON.stringify(read.summary[t as "TSK" | "OPP"])}`)
  if (!apply) return

  const store = firestoreRefStore(db)
  let done = 0
  for (const c of read.plan.assign.filter((a) => types.includes(a.type))) {
    const out = await assignRefIfMissing(store, c.collection, c.id, c.type)
    if (out?.assigned) done++
    if (out) console.log(`  ${out.ref}  ${c.collection}/${c.id}${out.assigned ? "" : " (already had it)"}`)
  }
  console.log(`  numbered ${done}`)
}

main().then(() => process.exit(0), (e) => {
  console.error("FATAL:", e instanceof Error ? e.message : e)
  process.exit(1)
})

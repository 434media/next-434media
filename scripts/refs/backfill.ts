/**
 * Reference backfill: gives existing tasks and opportunities their TSK-/OPP- reference (lib/record-refs.ts).
 *
 * Which records get one is `survivesTriage` in lib/record-refs-backfill.ts, a rule PROPOSED AND AWAITING THE FOUNDER.
 * Until he approves it (TRIAGE_RULE_STATUS = "approved"), this script only reports; --apply refuses.
 *
 * Never production by default: the emulator (FIRESTORE_EMULATOR_HOST) or --production. Dry-run unless --apply.
 * Idempotent: a record that has a reference keeps it, so a second run numbers nothing.
 *
 *   npx tsx --env-file=.env.local scripts/refs/backfill.ts --production                 # report only
 *   npx tsx --env-file=.env.local scripts/refs/backfill.ts --production --type OPP --apply
 */
import { scriptDb } from "../brand-profiles/load"
import { assignRefIfMissing, firestoreRefStore, type RefType } from "../../lib/record-refs"
import { TRIAGE_RULE_STATUS, planBackfill, type BackfillCandidate } from "../../lib/record-refs-backfill"

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const typeArg = args[args.indexOf("--type") + 1]
  const types: RefType[] = args.includes("--type") ? [typeArg as RefType] : ["TSK", "OPP"]
  if (types.some((t) => t !== "TSK" && t !== "OPP")) throw new Error("--type is TSK or OPP")
  if (apply && TRIAGE_RULE_STATUS !== "approved") {
    throw new Error("The triage rule is proposed, awaiting the founder (lib/record-refs-backfill.ts). Nothing is written until it is approved.")
  }

  const { db, target } = await scriptDb(args.includes("--production"))
  console.log(`${apply ? "APPLY" : "DRY-RUN"} on ${target}; rule ${TRIAGE_RULE_STATUS}`)

  const candidates: BackfillCandidate[] = []
  if (types.includes("TSK")) {
    const migrated = (await db.collection("crm_meta").doc("task_migration").get()).data()?.completed === true
    if (!migrated) console.log("  tasks: the unified-tasks migration has not run, so no task survives the proposed rule")
    for (const doc of (await db.collection("crm_tasks").get()).docs) {
      candidates.push({ collection: "crm_tasks", id: doc.id, type: "TSK", data: doc.data() })
    }
  }
  if (types.includes("OPP")) {
    for (const doc of (await db.collection("crm_clients").where("is_opportunity", "==", true).get()).docs) {
      candidates.push({ collection: "crm_clients", id: doc.id, type: "OPP", data: doc.data() })
    }
  }

  const { assign, skipped } = planBackfill(candidates)
  const why: Record<string, number> = {}
  for (const s of skipped) why[`${s.candidate.type} ${s.reason}`] = (why[`${s.candidate.type} ${s.reason}`] ?? 0) + 1
  console.log(`  scanned ${candidates.length}; to number ${assign.length} (${types.map((t) => `${t} ${assign.filter((a) => a.type === t).length}`).join(", ")})`)
  console.log(`  left out: ${JSON.stringify(why)}`)
  if (!apply) return

  const store = firestoreRefStore(db)
  let done = 0
  for (const c of assign) {
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

/**
 * The reference backfill's plan, read from a database: the candidates in the stores the CRM reads, the decided rule
 * (lib/record-refs-backfill.ts), and the counters as they stand. READ ONLY: nothing here writes. Shared by the
 * founder-only GET /api/admin/refs/backfill-plan (production's own credentials) and scripts/refs/backfill.ts.
 */
import { REF_COUNTER_COLLECTION, refCounterDocId, type RefType } from "./record-refs"
import { planBackfill, summarizePlan, TRIAGE_RULE_STATUS, type BackfillCandidate } from "./record-refs-backfill"

export const UNIFIED_TASKS_COLLECTION = "crm_tasks"
export const CLIENTS_COLLECTION_NAME = "crm_clients"

export interface BackfillPlanRead {
  rule: typeof TRIAGE_RULE_STATUS
  /** Whether the unified-tasks migration has run; it decides which task store is read. */
  taskMigrationCompleted: boolean
  taskCollections: string[]
  scanned: { tasks: number; opportunities: number }
  summary: ReturnType<typeof summarizePlan>
  /** The plan itself, for the script's write. Not returned by the route. */
  plan: ReturnType<typeof planBackfill>
}

export async function readBackfillPlan(db: FirebaseFirestore.Firestore, legacyTaskCollections: readonly string[]): Promise<BackfillPlanRead> {
  const taskMigrationCompleted = (await db.collection("crm_meta").doc("task_migration").get()).data()?.completed === true
  const taskCollections = taskMigrationCompleted ? [UNIFIED_TASKS_COLLECTION] : [...legacyTaskCollections]

  const candidates: BackfillCandidate[] = []
  let tasks = 0
  for (const name of taskCollections) {
    for (const doc of (await db.collection(name).get()).docs) {
      tasks++
      candidates.push({ collection: name, id: doc.id, type: "TSK", data: doc.data() })
    }
  }
  // Opportunities as the pipeline reads them (next-434media#347): `is_opportunity` truthy, so a stored "true" or 1
  // is not missed by an equality query.
  let opportunities = 0
  for (const doc of (await db.collection(CLIENTS_COLLECTION_NAME).get()).docs) {
    const data = doc.data()
    if (!data.is_opportunity) continue
    opportunities++
    candidates.push({ collection: CLIENTS_COLLECTION_NAME, id: doc.id, type: "OPP", data })
  }

  const counters: Partial<Record<RefType, unknown>> = {}
  for (const t of ["TSK", "OPP"] as const) {
    const snap = await db.collection(REF_COUNTER_COLLECTION).doc(refCounterDocId(t)).get()
    counters[t] = snap.exists ? snap.data() : null
  }
  const plan = planBackfill(candidates)
  return { rule: TRIAGE_RULE_STATUS, taskMigrationCompleted, taskCollections, scanned: { tasks, opportunities }, summary: summarizePlan(plan, counters), plan }
}

import { FieldValue } from "firebase-admin/firestore"
import { getDb } from "../firebase-admin"
import { dayOf, type CallTokens } from "./cost"
import { propertyKey, type DaySpend } from "./budget"

/**
 * Where model-call costs are kept (434 build sequence V1 item 2, Foundation A: "Cost per task recorded from day one").
 *
 *  - `ai_call_costs/<auto>`: one record per call. Task, kind, property and skill (ids, never names or addresses), the
 *    model, token counts, the Gateway's billed figure, the list estimate and when its price was read. No prompt and no
 *    answer: the ledger stores ids and figures, never message bodies (build plan v3, the ledger ruling).
 *  - `ai_cost_daily/<YYYY-MM-DD>`: the day's running totals, global and by property, which the budget check reads.
 *    One small document a day, incremented in place.
 *
 * Cost by task is a query on `ai_call_costs` by `task`; the console (V1 item 4) shows it by task, property and day.
 */
export const AI_CALL_COSTS_COLLECTION = "ai_call_costs"
export const AI_COST_DAILY_COLLECTION = "ai_cost_daily"

export interface CallCostRecord {
  at: string
  task: string
  kind: string
  property?: string
  skill?: string
  model: string
  /** The provider the Gateway routed to, when it said. */
  provider?: string
  tokens: CallTokens
  billedUsd?: number
  listUsd?: number
  priceCheckedAt?: string
  /** The figure the budget counts: billed when the Gateway reported it, else the list estimate, else 0. */
  usd: number
  error?: string
}


/** Stores one call. Never throws: a ledger write that fails must not fail the work it records. */
export async function recordCallCost(rec: CallCostRecord): Promise<void> {
  try {
    const db = getDb()
    const day = db.collection(AI_COST_DAILY_COLLECTION).doc(dayOf(new Date(rec.at)))
    const batch = db.batch()
    batch.create(db.collection(AI_CALL_COSTS_COLLECTION).doc(), JSON.parse(JSON.stringify(rec)))
    batch.set(
      day,
      {
        totalUsd: FieldValue.increment(rec.usd),
        calls: FieldValue.increment(1),
        ...(rec.property ? { byProperty: { [propertyKey(rec.property)]: FieldValue.increment(rec.usd) } } : {}),
        updatedAt: rec.at,
      },
      { merge: true },
    )
    await batch.commit()
  } catch (e) {
    console.error(`[engine:cost] Failed to record a call's cost (task ${rec.task}, ${rec.model}):`, e)
  }
}

/**
 * Today's spend as the ledger has it. When the ledger cannot be read, the error is thrown: the guard then refuses the
 * call, because a budget that cannot be checked is not a budget (fails closed).
 */
export async function readDaySpend(at = new Date()): Promise<DaySpend> {
  const snap = await getDb().collection(AI_COST_DAILY_COLLECTION).doc(dayOf(at)).get()
  const d = (snap.exists ? snap.data() : {}) as { totalUsd?: unknown; byProperty?: Record<string, unknown> }
  const byProperty: Record<string, number> = {}
  for (const [k, v] of Object.entries(d.byProperty ?? {})) if (typeof v === "number") byProperty[k] = v
  return { totalUsd: typeof d.totalUsd === "number" ? d.totalUsd : 0, byProperty }
}

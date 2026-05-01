import { getDb } from "./firebase-admin"

/**
 * Analytics goals — track key business metrics against monthly targets.
 *
 * Three flavors of metric source today:
 *   - "ga4:<metric>" — native GA4 metric (sessions, users, pageViews, engagementRate)
 *   - "ga4_event:<eventName>" — count of a specific GA4 event in the period
 *   - "crm:<key>" — Firestore-side count (leads_created, leads_converted, …)
 *
 * Goals are scoped to a single GA4 property OR portfolio-wide (propertyId === null).
 * The KPI panel on each property's analytics page shows the union of
 * "this property's goals" + "portfolio-wide goals."
 */

const COLLECTION = "analytics_goals"

export type GoalSource =
  | "ga4:sessions"
  | "ga4:totalUsers"
  | "ga4:screenPageViews"
  | "ga4:engagementRate"
  | "ga4:engagedSessions"
  | "ga4_event"
  | "crm:leads_created"
  | "crm:leads_converted"

export type GoalPeriod = "monthly" | "weekly"

export interface Goal {
  id: string
  /** Display label, e.g. "Newsletter signups". */
  name: string
  /** Metric source identifier. For ga4_event, also see eventName. */
  source: GoalSource
  /** Required when source === "ga4_event". */
  eventName?: string
  /** Numeric target for the period. */
  target: number
  /** Time window the target applies to. */
  period: GoalPeriod
  /** GA4 property id this goal is scoped to. null = portfolio-wide. */
  propertyId: string | null
  /** True for metrics where lower-is-better (e.g. bounce rate goal). Default false. */
  invertGoodness?: boolean
  /** Email of the user who created the goal. */
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type GoalCreateInput = Omit<Goal, "id" | "createdAt" | "updatedAt">

export type GoalUpdateInput = Partial<Omit<Goal, "id" | "createdAt" | "updatedAt" | "createdBy">>

function normalize(id: string, raw: FirebaseFirestore.DocumentData): Goal {
  return {
    id,
    name: raw.name ?? "",
    source: raw.source ?? "ga4:sessions",
    eventName: raw.eventName ?? undefined,
    target: typeof raw.target === "number" ? raw.target : Number(raw.target) || 0,
    period: raw.period === "weekly" ? "weekly" : "monthly",
    // Firestore doesn't preserve `null` cleanly across the JS SDK roundtrip
    // for some docs — treat undefined and explicit null both as "portfolio-wide."
    propertyId: raw.propertyId ?? null,
    invertGoodness: !!raw.invertGoodness,
    createdBy: raw.createdBy ?? "",
    createdAt: raw.createdAt ?? "",
    updatedAt: raw.updatedAt ?? "",
  }
}

export async function getGoals(): Promise<Goal[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTION).orderBy("createdAt", "desc").get()
  return snap.docs.map((d) => normalize(d.id, d.data()))
}

/** Goals that apply to a given property: that property's own goals + portfolio-wide goals. */
export async function getGoalsForProperty(propertyId: string): Promise<Goal[]> {
  const all = await getGoals()
  return all.filter((g) => g.propertyId === propertyId || g.propertyId === null)
}

export async function getGoalById(id: string): Promise<Goal | null> {
  const db = getDb()
  const doc = await db.collection(COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return normalize(doc.id, doc.data() ?? {})
}

export async function createGoal(input: GoalCreateInput): Promise<Goal> {
  const db = getDb()
  const now = new Date().toISOString()
  const doc = {
    name: input.name,
    source: input.source,
    eventName: input.eventName ?? null,
    target: input.target,
    period: input.period,
    propertyId: input.propertyId, // null = portfolio-wide
    invertGoodness: !!input.invertGoodness,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  }
  const ref = await db.collection(COLLECTION).add(doc)
  return normalize(ref.id, doc)
}

export async function updateGoal(id: string, patch: GoalUpdateInput): Promise<Goal> {
  const db = getDb()
  const ref = db.collection(COLLECTION).doc(id)
  const existing = await ref.get()
  if (!existing.exists) throw new Error(`Goal ${id} not found`)

  const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  // Firestore rejects `undefined` — coerce to null for nullable fields.
  if (patch.eventName === undefined && "eventName" in patch) update.eventName = null
  if (patch.propertyId === undefined && "propertyId" in patch) update.propertyId = null

  await ref.update(update)
  const after = await ref.get()
  return normalize(id, after.data() ?? {})
}

export async function deleteGoal(id: string): Promise<void> {
  const db = getDb()
  await db.collection(COLLECTION).doc(id).delete()
}

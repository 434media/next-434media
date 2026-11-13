import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type { Activity, ActivityType, CoreSource, MergeRecord, TriageDecision, TriageRecord } from "../types/core-model"
import { ACTIVITY_TYPES, CORE_SOURCES, TRIAGE_DECISIONS } from "../types/core-model"
import type { ActivityInput } from "./core-model/activity"
import { safeDocId, stripUndefined, toIsoString } from "./core-model/firestore-util"

// Activities (the core model): every touch, written once and never edited. This module exports no update and
// no delete, on purpose. The CRM keeps the full text: `body` is stored whole. Whether an activity is triaged is
// not a field on it: triage is its own record in `crm_activity_triage`, keyed on the activity id, which also
// covers activities read from old collections. Merges are logged in `crm_merges`.

const COLLECTION = CRM_COLLECTIONS.ACTIVITIES
const TRIAGE = CRM_COLLECTIONS.ACTIVITY_TRIAGE
const MERGES = CRM_COLLECTIONS.MERGES

const CACHE_TTL = 30 * 1000
let listCache: { data: Activity[]; ts: number } | null = null
let triageCache: { data: Map<string, TriageRecord>; ts: number } | null = null

export function invalidateActivities(): void {
  listCache = null
  triageCache = null
}

function normalize(id: string, raw: FirebaseFirestore.DocumentData): Activity {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined)
  return {
    id,
    type: (ACTIVITY_TYPES.includes(raw.type) ? raw.type : "note") as ActivityType,
    source: (CORE_SOURCES.includes(raw.source) ? raw.source : "manual") as CoreSource,
    channel: str(raw.channel),
    occurred_at: toIsoString(raw.occurred_at),
    contact: raw.contact && typeof raw.contact === "object" ? (raw.contact as Activity["contact"]) : {},
    person_id: str(raw.person_id),
    organization_id: str(raw.organization_id),
    opportunity_id: str(raw.opportunity_id),
    job_id: str(raw.job_id),
    summary: typeof raw.summary === "string" ? raw.summary : "",
    body: str(raw.body),
    email: raw.email && typeof raw.email === "object" ? (raw.email as Activity["email"]) : undefined,
    legacy_ref: raw.legacy_ref && typeof raw.legacy_ref === "object" ? (raw.legacy_ref as Activity["legacy_ref"]) : undefined,
    created_by: str(raw.created_by),
    triaged: false,
    created_at: toIsoString(raw.created_at),
  }
}

export async function listActivities(): Promise<Activity[]> {
  if (listCache && Date.now() - listCache.ts < CACHE_TTL) return listCache.data
  const snap = await getDb().collection(COLLECTION).get()
  const data = snap.docs.map((d) => normalize(d.id, d.data()))
  listCache = { data, ts: Date.now() }
  return data
}

export async function getActivity(id: string): Promise<Activity | null> {
  const doc = await getDb().collection(COLLECTION).doc(safeDocId(id)).get()
  return doc.exists ? normalize(doc.id, doc.data() as FirebaseFirestore.DocumentData) : null
}

/** Write-once. Validation (lib/core-model/activity.ts) runs in the service before this is called. */
export async function createActivity(input: ActivityInput): Promise<Activity> {
  const now = new Date().toISOString()
  const ref = getDb().collection(COLLECTION).doc()
  await ref.create(stripUndefined({ ...input, created_at: now }))
  invalidateActivities()
  return { ...input, id: ref.id, triaged: false, created_at: now }
}

// ── Triage ──

export async function listTriage(): Promise<Map<string, TriageRecord>> {
  if (triageCache && Date.now() - triageCache.ts < CACHE_TTL) return triageCache.data
  const snap = await getDb().collection(TRIAGE).get()
  const data = new Map<string, TriageRecord>()
  for (const d of snap.docs) {
    const raw = d.data()
    const activityId = typeof raw.activity_id === "string" ? raw.activity_id : d.id
    if (!TRIAGE_DECISIONS.includes(raw.decision)) continue
    data.set(activityId, {
      id: activityId,
      decision: raw.decision as TriageDecision,
      by: typeof raw.by === "string" ? raw.by : "",
      at: toIsoString(raw.at),
      person_id: typeof raw.person_id === "string" ? raw.person_id : undefined,
      lead_id: typeof raw.lead_id === "string" ? raw.lead_id : undefined,
    })
  }
  triageCache = { data, ts: Date.now() }
  return data
}

export async function getTriage(activityId: string): Promise<TriageRecord | null> {
  const doc = await getDb().collection(TRIAGE).doc(safeDocId(activityId)).get()
  if (!doc.exists) return null
  const raw = doc.data() as FirebaseFirestore.DocumentData
  return { id: activityId, decision: raw.decision, by: raw.by, at: toIsoString(raw.at), person_id: raw.person_id, lead_id: raw.lead_id }
}

/** One record per activity. `create` refuses a second, so two people triaging at once cannot both win. */
export async function recordTriage(record: TriageRecord): Promise<void> {
  const { id, ...rest } = record
  await getDb().collection(TRIAGE).doc(safeDocId(id)).create(stripUndefined({ ...rest, activity_id: id }))
  invalidateActivities()
}

// ── Merge log ──

export async function recordMerge(record: Omit<MergeRecord, "id">): Promise<void> {
  await getDb().collection(MERGES).add(stripUndefined(record))
}

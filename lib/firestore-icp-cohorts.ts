import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type { OutboundCohort } from "./sor/types.generated"

// The outbound ICP cohorts (master §5.6–5.10), as the system of record loads
// them into Firestore. Read-only: the 434-context sor-sync workflow is the only
// writer, so there is no write path here and nothing to invalidate on write.
// Internal data — never return these rows from a public route.

const COLLECTION = CRM_COLLECTIONS.ICP_COHORTS

// 30s in-memory cache, the same window as the other Firestore modules.
const CACHE_TTL = 30 * 1000
let listCache: { data: OutboundCohort[]; ts: number } | null = null

const LETTERS = ["A", "B", "C", "D", "E"] as const

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

function normalize(id: string, raw: FirebaseFirestore.DocumentData): OutboundCohort {
  const letter = LETTERS.includes(raw.letter) ? (raw.letter as OutboundCohort["letter"]) : "A"
  const floor = raw.revenue_floor
  return {
    key: (raw.key as string) || id,
    letter,
    name: (raw.name || "") as string,
    objective: (raw.objective || "") as string,
    target_profile: strings(raw.target_profile),
    target_profile_notes: typeof raw.target_profile_notes === "string" ? raw.target_profile_notes : null,
    qualification_signals: strings(raw.qualification_signals),
    qualification_signal_notes:
      typeof raw.qualification_signal_notes === "string" ? raw.qualification_signal_notes : null,
    proof: Array.isArray(raw.proof) ? raw.proof : [],
    narrative: typeof raw.narrative === "string" ? raw.narrative : null,
    first_pitch: (raw.first_pitch || "") as string,
    first_pitch_kind: raw.first_pitch_kind || undefined,
    secondary_routes: strings(raw.secondary_routes),
    revenue_floor:
      floor && typeof floor.amount_minor === "number" && typeof floor.currency === "string"
        ? { amount_minor: floor.amount_minor, currency: floor.currency }
        : null,
    signer: raw.signer === "founder" ? "founder" : "434",
    source: raw.source || undefined,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  }
}

/** Every outbound cohort, ordered A–E. Cached for 30s. */
export async function listIcpCohorts(): Promise<OutboundCohort[]> {
  if (listCache && Date.now() - listCache.ts < CACHE_TTL) return listCache.data
  const snap = await getDb().collection(COLLECTION).get()
  const data = snap.docs
    .map((d) => normalize(d.id, d.data()))
    .sort((a, b) => a.letter.localeCompare(b.letter))
  listCache = { data, ts: Date.now() }
  return data
}

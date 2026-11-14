import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type { Affiliation, AffiliationRole } from "../types/core-model"
import { AFFILIATION_ROLES } from "../types/core-model"
import type { NewAffiliation } from "./core-model/service"
import { stripUndefined, toIsoString } from "./core-model/firestore-util"

// Affiliations (the core model): Person ⟷ Organization with a role. The role lives on the link.

const COLLECTION = CRM_COLLECTIONS.AFFILIATIONS

const CACHE_TTL = 30 * 1000
let listCache: { data: Affiliation[]; ts: number } | null = null

export function invalidateAffiliations(): void {
  listCache = null
}

function normalize(id: string, raw: FirebaseFirestore.DocumentData): Affiliation {
  return {
    id,
    person_id: typeof raw.person_id === "string" ? raw.person_id : "",
    organization_id: typeof raw.organization_id === "string" ? raw.organization_id : "",
    role: (AFFILIATION_ROLES.includes(raw.role) ? raw.role : "prospect") as AffiliationRole,
    title: typeof raw.title === "string" && raw.title ? raw.title : undefined,
    active: raw.active !== false,
    created_at: toIsoString(raw.created_at),
    updated_at: toIsoString(raw.updated_at),
  }
}

export async function listAffiliations(): Promise<Affiliation[]> {
  if (listCache && Date.now() - listCache.ts < CACHE_TTL) return listCache.data
  const snap = await getDb().collection(COLLECTION).get()
  const data = snap.docs.map((d) => normalize(d.id, d.data()))
  listCache = { data, ts: Date.now() }
  return data
}

export async function findAffiliation(personId: string, organizationId: string, role: AffiliationRole): Promise<Affiliation | null> {
  const snap = await getDb().collection(COLLECTION).where("person_id", "==", personId).get()
  const hit = snap.docs.map((d) => normalize(d.id, d.data())).find((a) => a.organization_id === organizationId && a.role === role)
  return hit ?? null
}

export async function createAffiliation(input: NewAffiliation): Promise<Affiliation> {
  const now = new Date().toISOString()
  const ref = getDb().collection(COLLECTION).doc()
  await ref.set(stripUndefined({ ...input, created_at: now, updated_at: now }))
  invalidateAffiliations()
  return { ...input, id: ref.id, created_at: now, updated_at: now }
}

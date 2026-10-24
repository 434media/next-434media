import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import { isAlreadyExists } from "./firestore-event-role-overlays"

/**
 * Travel projects: one document per `/travel/<project>` slug, holding the dates,
 * the Airtable base and each traveller's name and route.
 *
 * A traveller's name and route are a named person's movements, so they live here
 * and not in the public repository (they used to be lib/travel/projects.ts).
 * Who reads what:
 * - the itinerary page and its API: the whole record, behind getTravelAccess
 *   (an admin session, or a provisioned travel_access viewer for that page);
 * - the sign-in page and sign-in route: only whether the page exists;
 * - the public link card: client, purpose and year, never the traveller or dates.
 */

const COLLECTION = CRM_COLLECTIONS.TRAVEL_PROJECTS
const CACHE_TTL = 30 * 1000
const SLUG = /^[a-z0-9-]{1,64}$/

export interface TravelRouteStop {
  code: string
  city: string
  dates: string
  home?: boolean
}

export interface TravelTraveler {
  slug: string
  name: string
  displayName: string
  routeStops: TravelRouteStop[]
}

export interface TravelProject {
  slug: string
  client: string
  purpose: string
  year: number
  startDate: string
  endDate: string
  airtableBaseId: string
  travelers: Record<string, TravelTraveler>
  created_at: string
  updated_at: string
}

const cache = new Map<string, { data: TravelProject; ts: number }>()

export function invalidateTravelProjectsCache(): void {
  cache.clear()
}

function toIsoString(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return ""
}

const str = (v: unknown) => (typeof v === "string" ? v : "")

function normalizeStop(raw: unknown): TravelRouteStop | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (!str(r.code)) return null
  const stop: TravelRouteStop = { code: str(r.code), city: str(r.city), dates: str(r.dates) }
  if (r.home === true) stop.home = true
  return stop
}

function normalizeTraveler(slug: string, raw: unknown): TravelTraveler | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const name = str(r.name)
  return {
    slug,
    name,
    displayName: str(r.displayName) || name,
    routeStops: Array.isArray(r.routeStops) ? r.routeStops.map(normalizeStop).filter((s): s is TravelRouteStop => !!s) : [],
  }
}

export function normalizeTravelProject(id: string, raw: FirebaseFirestore.DocumentData): TravelProject {
  const travelers: Record<string, TravelTraveler> = {}
  const rawTravelers = raw.travelers && typeof raw.travelers === "object" ? (raw.travelers as Record<string, unknown>) : {}
  for (const [slug, t] of Object.entries(rawTravelers)) {
    if (!SLUG.test(slug)) continue
    const traveler = normalizeTraveler(slug, t)
    if (traveler) travelers[slug] = traveler
  }
  return {
    slug: id,
    client: str(raw.client),
    purpose: str(raw.purpose),
    year: Number(raw.year) || 0,
    startDate: str(raw.startDate),
    endDate: str(raw.endDate),
    airtableBaseId: str(raw.airtableBaseId),
    travelers,
    created_at: toIsoString(raw.created_at),
    updated_at: toIsoString(raw.updated_at),
  }
}

/**
 * One project, or null. The slug arrives from a URL, so anything that is not a
 * plain slug is null without a read; misses are not cached, so a project added
 * to the database is live on its next request.
 */
export async function getTravelProjectRecord(
  projectSlug: string,
  db: FirebaseFirestore.Firestore = getDb(),
): Promise<TravelProject | null> {
  if (!SLUG.test(projectSlug)) return null
  const hit = cache.get(projectSlug)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data
  const snap = await db.collection(COLLECTION).doc(projectSlug).get()
  if (!snap.exists) return null
  const data = normalizeTravelProject(snap.id, snap.data() || {})
  cache.set(projectSlug, { data, ts: Date.now() })
  return data
}

/** A project and one of its travellers, or null when either is unknown. */
export async function getTravelProject(
  projectSlug: string,
  travelerSlug: string,
  db: FirebaseFirestore.Firestore = getDb(),
) {
  const project = await getTravelProjectRecord(projectSlug, db)
  if (!project) return null
  const traveler = Object.prototype.hasOwnProperty.call(project.travelers, travelerSlug)
    ? project.travelers[travelerSlug]
    : null
  if (!traveler) return null
  return { project, traveler }
}

export type TravelProjectInput = Omit<TravelProject, "created_at" | "updated_at">

/**
 * Create the project document if it does not exist; never overwrite one. Used by
 * the one-time import (scripts/personal-data/import.ts), so a second run is a no-op.
 */
export async function createTravelProjectIfAbsent(
  input: TravelProjectInput,
  db: FirebaseFirestore.Firestore = getDb(),
): Promise<{ created: boolean }> {
  if (!SLUG.test(input.slug)) throw new Error(`not a travel project slug: ${input.slug}`)
  const now = new Date().toISOString()
  const { travelers, ...rest } = normalizeTravelProject(input.slug, input)
  try {
    await db.collection(COLLECTION).doc(input.slug).create({
      ...rest,
      // Firestore rejects undefined: a stop that is not home carries no `home` field at all.
      travelers: JSON.parse(JSON.stringify(travelers)),
      created_at: now,
      updated_at: now,
    })
    return { created: true }
  } catch (error) {
    if (isAlreadyExists(error)) return { created: false }
    throw error
  } finally {
    invalidateTravelProjectsCache()
  }
}

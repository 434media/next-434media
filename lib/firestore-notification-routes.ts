import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import { isAlreadyExists } from "./firestore-event-role-overlays"

/**
 * Notification routes: who an internal notification email goes to.
 *
 * One document per route (`notification_routes/lead-with-ops-call-request`),
 * holding `{to: [emails], cc: [emails]}`. A route can name a partner's own
 * mailbox, so the addresses live here and not in the public repository (the
 * Lead with Ops recipient used to be a fallback in
 * lib/lead-with-ops-call-request.ts). Read only by server code.
 */

const COLLECTION = CRM_COLLECTIONS.NOTIFICATION_ROUTES
const CACHE_TTL = 30 * 1000

export interface NotificationRoute {
  /** The route id, also the document id. */
  id: string
  to: string[]
  cc: string[]
  created_at: string
  updated_at: string
}

const cache = new Map<string, { data: NotificationRoute | null; ts: number }>()

export function invalidateNotificationRoutesCache(): void {
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

function normalizeEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out = new Set<string>()
  for (const v of value) {
    if (typeof v !== "string") continue
    const e = v.trim().toLowerCase()
    if (e) out.add(e)
  }
  return [...out]
}

export function normalizeNotificationRoute(id: string, raw: FirebaseFirestore.DocumentData): NotificationRoute {
  return {
    id,
    to: normalizeEmails(raw.to),
    cc: normalizeEmails(raw.cc),
    created_at: toIsoString(raw.created_at),
    updated_at: toIsoString(raw.updated_at),
  }
}

/** The route, or null when none is stored. A read error throws. */
export async function getNotificationRoute(
  id: string,
  db: FirebaseFirestore.Firestore = getDb(),
): Promise<NotificationRoute | null> {
  const hit = cache.get(id)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data
  const snap = await db.collection(COLLECTION).doc(id).get()
  const data = snap.exists ? normalizeNotificationRoute(snap.id, snap.data() || {}) : null
  cache.set(id, { data, ts: Date.now() })
  return data
}

/**
 * Create the route document if it does not exist; never overwrite one. Used by
 * the one-time import (scripts/personal-data/import-pending.ts), so a second
 * run is a no-op.
 */
export async function createNotificationRouteIfAbsent(
  id: string,
  route: { to: string[]; cc: string[] },
  db: FirebaseFirestore.Firestore = getDb(),
): Promise<{ created: boolean }> {
  const now = new Date().toISOString()
  const clean = normalizeNotificationRoute(id, route)
  try {
    await db.collection(COLLECTION).doc(id).create({ to: clean.to, cc: clean.cc, created_at: now, updated_at: now })
    return { created: true }
  } catch (error) {
    if (isAlreadyExists(error)) return { created: false }
    throw error
  } finally {
    invalidateNotificationRoutesCache()
  }
}

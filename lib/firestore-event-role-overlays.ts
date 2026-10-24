import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"

/**
 * Role overlays: which registrants of an event spoke, pitched or judged.
 *
 * One document per event slug (`event_role_overlays/sa-tech-day-2026`), mapping a
 * role tag to the emails that carry it. The registrations themselves stay in the
 * child site's named database, untouched; the overlay is joined onto them at read
 * time (lib/firestore-event-registrations.ts).
 *
 * These are people's email addresses, so they live here and not in the public
 * repository (they used to be lib/event-roles/sa-tech-day-2026.ts). Read only by
 * server code behind the admin session or the cron secret.
 */

const COLLECTION = CRM_COLLECTIONS.EVENT_ROLE_OVERLAYS
const CACHE_TTL = 30 * 1000

export interface EventRoleOverlay {
  /** The event slug, also the document id. */
  eventSlug: string
  /** Role tag (`role:…`) → lowercased, trimmed, de-duplicated emails. */
  roles: Record<string, string[]>
  created_at: string
  updated_at: string
}

const cache = new Map<string, { data: EventRoleOverlay | null; ts: number }>()

export function invalidateEventRoleOverlaysCache(): void {
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

/** Only `role:` tags survive: the overlay adds roles, never sites, events or clients. */
export function normalizeEventRoleOverlay(id: string, raw: FirebaseFirestore.DocumentData): EventRoleOverlay {
  const roles: Record<string, string[]> = {}
  const rawRoles = raw.roles && typeof raw.roles === "object" ? (raw.roles as Record<string, unknown>) : {}
  for (const [tag, emails] of Object.entries(rawRoles)) {
    if (!tag.startsWith("role:")) continue
    const list = normalizeEmails(emails)
    if (list.length) roles[tag] = list
  }
  return {
    eventSlug: typeof raw.event_slug === "string" && raw.event_slug ? raw.event_slug : id,
    roles,
    created_at: toIsoString(raw.created_at),
    updated_at: toIsoString(raw.updated_at),
  }
}

/**
 * The overlay for one event, or null when none is stored. A read error throws: a
 * caller that carried on without it would tag speakers and judges as plain
 * attendees, and nothing on the page would look wrong.
 */
export async function getEventRoleOverlay(
  eventSlug: string,
  db: FirebaseFirestore.Firestore = getDb(),
): Promise<EventRoleOverlay | null> {
  const hit = cache.get(eventSlug)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data
  const snap = await db.collection(COLLECTION).doc(eventSlug).get()
  const data = snap.exists ? normalizeEventRoleOverlay(snap.id, snap.data() || {}) : null
  cache.set(eventSlug, { data, ts: Date.now() })
  return data
}

/** The role tags an email carries in an overlay; empty for no overlay, no email or no match. */
export function roleTagsFor(overlay: EventRoleOverlay | null, email: string | undefined | null): string[] {
  if (!overlay || !email) return []
  const e = email.trim().toLowerCase()
  if (!e) return []
  return Object.entries(overlay.roles)
    .filter(([, emails]) => emails.includes(e))
    .map(([tag]) => tag)
}

/**
 * Create the overlay document if it does not exist; never overwrite one. Returns
 * whether it was created. Used by the one-time import
 * (scripts/personal-data/import.ts), so a second run is a no-op.
 */
export async function createEventRoleOverlayIfAbsent(
  eventSlug: string,
  roles: Record<string, string[]>,
  db: FirebaseFirestore.Firestore = getDb(),
): Promise<{ created: boolean }> {
  const now = new Date().toISOString()
  const clean = normalizeEventRoleOverlay(eventSlug, { roles }).roles
  try {
    await db.collection(COLLECTION).doc(eventSlug).create({ event_slug: eventSlug, roles: clean, created_at: now, updated_at: now })
    return { created: true }
  } catch (error) {
    if (isAlreadyExists(error)) return { created: false }
    throw error
  } finally {
    invalidateEventRoleOverlaysCache()
  }
}

export function isAlreadyExists(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS"
}

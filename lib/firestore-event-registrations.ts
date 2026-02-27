import { getDb, getNamedDb, getDigitalCanvasDb, COLLECTIONS, NAMED_DATABASES } from "./firebase-admin"

// Event Registration interface
export interface EventRegistration {
  id?: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  company: string | null
  subscribeToFeed: boolean
  event: string
  eventName: string
  eventDate: string
  registeredAt: string
  source: string
  tags: string[]
  pageUrl: string
  checkedIn?: boolean
  checkedInAt?: string
  _dbSource?: string // Track which database this came from
}

const COLLECTION = COLLECTIONS.EVENT_REGISTRATIONS

/**
 * Convert a Firestore Timestamp or date value to ISO string
 */
function toISOString(value: unknown): string {
  if (!value) return ""
  // Firestore Timestamp object (has _seconds or seconds property)
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>
    const seconds = (v._seconds ?? v.seconds) as number | undefined
    if (typeof seconds === "number") {
      return new Date(seconds * 1000).toISOString()
    }
    // Firestore Timestamp with toDate() method
    if (typeof (v as { toDate?: () => Date }).toDate === "function") {
      return (v as { toDate: () => Date }).toDate().toISOString()
    }
  }
  // Already a string
  if (typeof value === "string") return value
  // Number (milliseconds)
  if (typeof value === "number") return new Date(value).toISOString()
  return ""
}

/**
 * Map a Firestore doc to an EventRegistration (default DB format)
 * Handles both string dates and Firestore Timestamp objects
 */
function mapDefaultDoc(doc: FirebaseFirestore.DocumentSnapshot): EventRegistration {
  const data = doc.data()!
  return {
    id: doc.id,
    email: data.email || "",
    firstName: data.firstName || data.first_name || "",
    lastName: data.lastName || data.last_name || "",
    fullName: data.fullName || data.full_name || data.name || "",
    company: data.company || null,
    subscribeToFeed: data.subscribeToFeed || data.subscribe_to_feed || false,
    event: data.event || "",
    eventName: data.eventName || data.event_name || "",
    eventDate: toISOString(data.eventDate || data.event_date || ""),
    registeredAt: toISOString(data.registeredAt || data.registered_at || data.createdAt || data.created_at || ""),
    source: data.source || "",
    tags: data.tags || [],
    pageUrl: data.pageUrl || data.page_url || "",
    checkedIn: data.checkedIn || false,
    checkedInAt: toISOString(data.checkedInAt || ""),
    _dbSource: "default",
  }
}

/**
 * Map a techday registration doc to the EventRegistration interface
 */
function mapTechdayDoc(doc: FirebaseFirestore.DocumentSnapshot): EventRegistration {
  const data = doc.data()!
  const registeredAt = data.createdAt?._seconds
    ? new Date(data.createdAt._seconds * 1000).toISOString()
    : data.createdAt || ""
  return {
    id: `techday:${doc.id}`,
    email: data.email || "",
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    fullName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
    company: data.company || null,
    subscribeToFeed: false,
    event: "SATechDay2026",
    eventName: "SA Tech Day 2026",
    eventDate: "2026-04-10",
    registeredAt,
    source: "SATechDay",
    tags: ["sa-tech-day", ...(data.events || [])],
    pageUrl: "https://www.sanantoniotechday.com",
    checkedIn: data.checkedIn || false,
    checkedInAt: data.checkedInAt ? toISOString(data.checkedInAt) : "",
    _dbSource: "techday",
  }
}

/**
 * Fetch registrations from the techday named database
 */
async function getTechdayRegistrations(filters?: { event?: string }): Promise<EventRegistration[]> {
  try {
    // If filtering by a non-techday event, skip
    if (filters?.event && filters.event !== "SATechDay2026") return []

    const tdDb = getNamedDb(NAMED_DATABASES.TECHDAY)
    const snapshot = await tdDb.collection("registrations").get()
    return snapshot.docs.map(mapTechdayDoc)
  } catch (error) {
    console.error("Error fetching techday registrations:", error)
    return []
  }
}

/**
 * Fetch registrations from the Digital Canvas Firestore project (media-analytics-proxy).
 * Digital Canvas writes to the "event-registrations" collection (hyphenated)
 * in a completely separate GCP project.
 */
async function getDigitalCanvasRegistrations(filters?: { event?: string }): Promise<EventRegistration[]> {
  try {
    // If filtering by a non-MHTH event, skip
    if (filters?.event && filters.event !== "MoreHumanThanHuman2026") return []

    const dcDb = getDigitalCanvasDb()
    const snapshot = await dcDb.collection("event-registrations").get()
    return snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: `dc:${doc.id}`,
        email: data.email || "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        fullName: data.fullName || "",
        company: data.company || null,
        subscribeToFeed: data.subscribeToFeed || false,
        event: data.event || "MoreHumanThanHuman2026",
        eventName: data.eventName || "More Human Than Human",
        eventDate: toISOString(data.eventDate || "2026-02-28"),
        registeredAt: toISOString(data.registeredAt || data.createdAt || ""),
        source: data.source || "web-digitalcanvas",
        tags: data.tags || [],
        pageUrl: data.pageUrl || "",
        checkedIn: data.checkedIn || false,
        checkedInAt: data.checkedInAt ? toISOString(data.checkedInAt) : "",
        _dbSource: "digitalcanvas",
      }
    })
  } catch (error) {
    console.error("Error fetching Digital Canvas registrations:", error)
    return []
  }
}

/**
 * Deduplicate registrations across databases by email+event
 * Default DB registrations take priority (they may have been enriched)
 */
function deduplicateRegistrations(registrations: EventRegistration[]): EventRegistration[] {
  const seen = new Map<string, EventRegistration>()
  for (const reg of registrations) {
    const key = `${reg.email.toLowerCase()}|${reg.event}`
    const existing = seen.get(key)
    // Prefer default DB records over named DB records
    if (!existing || (reg._dbSource === "default" && existing._dbSource !== "default")) {
      seen.set(key, reg)
    }
  }
  return Array.from(seen.values())
}

/**
 * Get event registrations with optional filtering
 * Merges results from:
 *  1. Default DB (groovy-ego) — event_registrations collection (migrated data)
 *  2. Techday named DB (groovy-ego/techday) — registrations collection
 *  3. Digital Canvas project (media-analytics-proxy) — event-registrations collection
 */
export async function getEventRegistrations(filters?: {
  event?: string
  source?: string
}): Promise<EventRegistration[]> {
  try {
    // Fetch from default DB
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTION)

    if (filters?.event) {
      query = query.where("event", "==", filters.event)
    }
    if (filters?.source) {
      query = query.where("source", "==", filters.source)
    }

    const [defaultSnapshot, techdayRegs, dcRegs] = await Promise.all([
      query.get(),
      getTechdayRegistrations(filters),
      getDigitalCanvasRegistrations(filters),
    ])

    const defaultRegs = defaultSnapshot.docs.map(mapDefaultDoc)

    // If filtering by source and it's not SATechDay or digitalcanvas, only return default
    if (filters?.source && filters.source !== "SATechDay" && filters.source !== "web-digitalcanvas") {
      return defaultRegs
    }

    // Merge and deduplicate across all three sources
    const allRegs = deduplicateRegistrations([...defaultRegs, ...techdayRegs, ...dcRegs])
    return allRegs
  } catch (error) {
    console.error("Error fetching event registrations:", error)
    throw new Error("Failed to fetch event registrations")
  }
}

/**
 * Get unique event names from registrations
 */
export async function getEventNames(): Promise<string[]> {
  try {
    const db = getDb()
    const snapshot = await db.collection(COLLECTION).get()
    const events = new Set<string>()
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.eventName) events.add(data.eventName)
    })
    return Array.from(events).sort()
  } catch (error) {
    console.error("Error fetching event names:", error)
    return []
  }
}

/**
 * Get counts by event (merges default + techday + digitalcanvas databases)
 */
export async function getEventRegistrationCounts(): Promise<Record<string, number>> {
  try {
    const allRegs = await getEventRegistrations()
    const counts: Record<string, number> = {}
    allRegs.forEach((reg) => {
      const name = reg.eventName || "Unknown"
      counts[name] = (counts[name] || 0) + 1
    })
    return counts
  } catch (error) {
    console.error("Error fetching event registration counts:", error)
    return {}
  }
}

/**
 * Update fields on an event registration (e.g. check-in status)
 * Supports default, techday, and digitalcanvas databases
 */
export async function updateEventRegistration(
  id: string,
  fields: Partial<Pick<EventRegistration, "checkedIn" | "checkedInAt">>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (id.startsWith("techday:")) {
      const realId = id.replace("techday:", "")
      const tdDb = getNamedDb(NAMED_DATABASES.TECHDAY)
      await tdDb.collection("registrations").doc(realId).update(fields)
      return { success: true }
    }
    if (id.startsWith("dc:")) {
      const realId = id.replace("dc:", "")
      const dcDb = getDigitalCanvasDb()
      await dcDb.collection("event-registrations").doc(realId).update(fields)
      return { success: true }
    }
    const db = getDb()
    await db.collection(COLLECTION).doc(id).update(fields)
    return { success: true }
  } catch (error) {
    console.error("Error updating event registration:", error)
    return { success: false, error: "Failed to update event registration" }
  }
}

/**
 * Add a new event registration (e.g. walk-up at event day)
 * Writes to the default database event_registrations collection
 */
export async function addEventRegistration(
  registration: Omit<EventRegistration, "id">
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = getDb()
    const docRef = await db.collection(COLLECTION).add({
      ...registration,
      registeredAt: registration.registeredAt || new Date().toISOString(),
    })
    return { success: true, id: docRef.id }
  } catch (error) {
    console.error("Error adding event registration:", error)
    return { success: false, error: "Failed to add event registration" }
  }
}

/**
 * Delete an event registration
 * Supports deletion from default, techday, and digitalcanvas databases
 */
export async function deleteEventRegistration(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if this is a techday-prefixed ID
    if (id.startsWith("techday:")) {
      const realId = id.replace("techday:", "")
      const tdDb = getNamedDb(NAMED_DATABASES.TECHDAY)
      await tdDb.collection("registrations").doc(realId).delete()
      return { success: true }
    }

    // Check if this is a digitalcanvas-prefixed ID
    if (id.startsWith("dc:")) {
      const realId = id.replace("dc:", "")
      const dcDb = getDigitalCanvasDb()
      await dcDb.collection("event-registrations").doc(realId).delete()
      return { success: true }
    }

    const db = getDb()
    await db.collection(COLLECTION).doc(id).delete()
    return { success: true }
  } catch (error) {
    console.error("Error deleting event registration:", error)
    return { success: false, error: "Failed to delete event registration" }
  }
}

/**
 * Convert event registrations to CSV
 */
export function eventRegistrationsToCSV(registrations: EventRegistration[]): string {
  const headers = ["First Name", "Last Name", "Email", "Company", "Event", "Event Date", "Registered At", "Subscribe to Feed", "Source"]
  const rows = registrations.map((r) => [
    r.firstName,
    r.lastName,
    r.email,
    r.company || "",
    r.eventName,
    r.eventDate,
    r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : "",
    r.subscribeToFeed ? "Yes" : "No",
    r.source,
  ])

  const escape = (val: string) => {
    const s = String(val).replace(/"/g, '""')
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s
  }

  return [headers.join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n")
}

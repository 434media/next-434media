import { getDb, getNamedDb, COLLECTIONS, NAMED_DATABASES } from "./firebase-admin"

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
  _dbSource?: string // Track which database this came from
}

const COLLECTION = COLLECTIONS.EVENT_REGISTRATIONS

/**
 * Map a Firestore doc to an EventRegistration (default DB format)
 */
function mapDefaultDoc(doc: FirebaseFirestore.DocumentSnapshot): EventRegistration {
  const data = doc.data()!
  return {
    id: doc.id,
    email: data.email || "",
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    fullName: data.fullName || "",
    company: data.company || null,
    subscribeToFeed: data.subscribeToFeed || false,
    event: data.event || "",
    eventName: data.eventName || "",
    eventDate: data.eventDate || "",
    registeredAt: data.registeredAt || "",
    source: data.source || "",
    tags: data.tags || [],
    pageUrl: data.pageUrl || "",
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
 * Merges results from default DB and techday named database
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

    const [defaultSnapshot, techdayRegs] = await Promise.all([
      query.get(),
      getTechdayRegistrations(filters),
    ])

    const defaultRegs = defaultSnapshot.docs.map(mapDefaultDoc)

    // If filtering by source and it's not SATechDay, only return default
    if (filters?.source && filters.source !== "SATechDay") {
      return defaultRegs
    }

    // Merge and deduplicate
    const allRegs = deduplicateRegistrations([...defaultRegs, ...techdayRegs])
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
 * Get counts by event (merges default + techday databases)
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
 * Delete an event registration
 * Supports deletion from both default and techday databases
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

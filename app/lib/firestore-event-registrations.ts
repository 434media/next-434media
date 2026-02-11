import { getDb, COLLECTIONS } from "./firebase-admin"

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
}

const COLLECTION = COLLECTIONS.EVENT_REGISTRATIONS

/**
 * Get event registrations with optional filtering
 */
export async function getEventRegistrations(filters?: {
  event?: string
  source?: string
}): Promise<EventRegistration[]> {
  try {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTION)

    if (filters?.event) {
      query = query.where("event", "==", filters.event)
    }
    if (filters?.source) {
      query = query.where("source", "==", filters.source)
    }

    const snapshot = await query.get()
    return snapshot.docs.map((doc) => {
      const data = doc.data()
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
      }
    })
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
 * Get counts by event
 */
export async function getEventRegistrationCounts(): Promise<Record<string, number>> {
  try {
    const db = getDb()
    const snapshot = await db.collection(COLLECTION).get()
    const counts: Record<string, number> = {}
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      const name = data.eventName || "Unknown"
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
 */
export async function deleteEventRegistration(id: string): Promise<{ success: boolean; error?: string }> {
  try {
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

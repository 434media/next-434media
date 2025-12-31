import { getDb, COLLECTIONS, admin } from "./firebase-admin"
import type { Event } from "../types/event-types"

// ============================================
// SIMPLE IN-MEMORY CACHE (reduces Firestore reads)
// ============================================
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 30 * 1000 // 30 seconds cache

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// Invalidate cache for events
export function invalidateEventsCache(): void {
  for (const key of cache.keys()) {
    if (key.includes("events")) {
      cache.delete(key)
    }
  }
}

// Convert Firestore document to Event interface
function mapFirestoreToEvent(doc: admin.firestore.DocumentSnapshot): Event {
  const data = doc.data()
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`)
  }

  const Timestamp = admin.firestore.Timestamp

  return {
    id: doc.id,
    title: data.title || "",
    description: data.description || undefined,
    date: data.date || "",
    time: data.time || undefined,
    location: data.location || undefined,
    organizer: data.organizer || undefined,
    image: data.image || undefined,
    url: data.url || undefined,
    tags: data.tags || undefined,
    isPast: data.isPast || false,
    category: data.category || "other",
    source: data.source || "manual",
    attendees: data.attendees || undefined,
    price: data.price || undefined,
    created_at: data.created_at instanceof Timestamp 
      ? data.created_at.toDate().toISOString() 
      : data.created_at,
    updated_at: data.updated_at instanceof Timestamp 
      ? data.updated_at.toDate().toISOString() 
      : data.updated_at,
  }
}

// Get all events from Firestore (with caching)
export async function getEventsFromFirestore(): Promise<Event[]> {
  const cacheKey = "events:all"
  const cached = getCached<Event[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for events")
    return cached
  }

  try {
    const db = getDb()
    const snapshot = await db
      .collection(COLLECTIONS.EVENTS)
      .orderBy("date", "asc")
      .get()

    const events = snapshot.docs.map(mapFirestoreToEvent)
    console.log(`[Firestore] Fetched ${events.length} events`)
    
    // Cache the results
    setCache(cacheKey, events)
    
    return events
  } catch (error) {
    console.error("Error fetching events from Firestore:", error)
    throw new Error("Failed to fetch events from Firestore")
  }
}

// Get upcoming events (not past) - with caching
export async function getUpcomingEventsFromFirestore(): Promise<Event[]> {
  const cacheKey = "events:upcoming"
  const cached = getCached<Event[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for upcoming events")
    return cached
  }

  try {
    const db = getDb()
    const snapshot = await db
      .collection(COLLECTIONS.EVENTS)
      .where("isPast", "==", false)
      .orderBy("date", "asc")
      .get()

    const events = snapshot.docs.map(mapFirestoreToEvent)
    console.log(`[Firestore] Fetched ${events.length} upcoming events`)
    
    // Cache the results
    setCache(cacheKey, events)
    
    return events
  } catch (error) {
    console.error("Error fetching upcoming events from Firestore:", error)
    throw new Error("Failed to fetch upcoming events from Firestore")
  }
}

// Get a specific event by ID from Firestore
export async function getEventByIdFromFirestore(id: string): Promise<Event | null> {
  try {
    const db = getDb()
    const doc = await db.collection(COLLECTIONS.EVENTS).doc(id).get()

    if (!doc.exists) {
      return null
    }

    return mapFirestoreToEvent(doc)
  } catch (error) {
    console.error("Error fetching event by ID from Firestore:", error)
    return null
  }
}

// Create a new event in Firestore
export async function createEventInFirestore(
  eventData: Omit<Event, "id" | "created_at" | "updated_at">
): Promise<Event> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const now = FieldValue.serverTimestamp()

    const docRef = await db.collection(COLLECTIONS.EVENTS).add({
      ...eventData,
      created_at: now,
      updated_at: now,
    })

    // Invalidate events cache
    invalidateEventsCache()

    // Fetch the created document
    const doc = await docRef.get()
    return mapFirestoreToEvent(doc)
  } catch (error) {
    console.error("Error creating event in Firestore:", error)
    throw new Error("Failed to create event in Firestore")
  }
}

// Update an event in Firestore
export async function updateEventInFirestore(
  id: string,
  updates: Partial<Event>
): Promise<Event> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const docRef = db.collection(COLLECTIONS.EVENTS).doc(id)

    // Remove undefined values
    const cleanUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== "id" && key !== "created_at") {
        cleanUpdates[key] = value
      }
    }

    cleanUpdates.updated_at = FieldValue.serverTimestamp()

    await docRef.update(cleanUpdates)

    // Invalidate events cache
    invalidateEventsCache()

    // Fetch updated document
    const doc = await docRef.get()
    return mapFirestoreToEvent(doc)
  } catch (error) {
    console.error("Error updating event in Firestore:", error)
    throw new Error("Failed to update event in Firestore")
  }
}

// Delete an event from Firestore
export async function deleteEventFromFirestore(id: string): Promise<void> {
  try {
    const db = getDb()
    await db.collection(COLLECTIONS.EVENTS).doc(id).delete()
    
    // Invalidate events cache
    invalidateEventsCache()
  } catch (error) {
    console.error("Error deleting event from Firestore:", error)
    throw new Error("Failed to delete event from Firestore")
  }
}

// Mark past events automatically
export async function markPastEventsInFirestore(): Promise<number> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD format

    // Get events that should be marked as past
    const snapshot = await db
      .collection(COLLECTIONS.EVENTS)
      .where("date", "<", today)
      .where("isPast", "==", false)
      .get()

    if (snapshot.empty) {
      return 0
    }

    // Batch update
    const batch = db.batch()
    snapshot.docs.forEach((doc: admin.firestore.DocumentSnapshot) => {
      batch.update(doc.ref, {
        isPast: true,
        updated_at: FieldValue.serverTimestamp(),
      })
    })

    await batch.commit()
    return snapshot.size
  } catch (error) {
    console.error("Error marking past events:", error)
    throw new Error("Failed to mark past events")
  }
}

// Test Firestore Events connection
export async function testFirestoreEventsConnection(): Promise<boolean> {
  try {
    const db = getDb()
    await db.collection(COLLECTIONS.EVENTS).limit(1).get()
    return true
  } catch (error) {
    console.error("Firestore Events connection test failed:", error)
    return false
  }
}

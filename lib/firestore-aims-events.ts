import { getDb, COLLECTIONS, admin } from "./firebase-admin"
import type { Event } from "../types/event-types"

// ============================================
// AIM SATX EVENTS - Firestore Functions
// ============================================

// Simple in-memory cache for AIMS events
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const aimsCache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 30 * 1000 // 30 seconds

function getCached<T>(key: string): T | null {
  const entry = aimsCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    aimsCache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  aimsCache.set(key, { data, timestamp: Date.now() })
}

// Invalidate cache for AIM SATX events
export function invalidateAimsEventsCache(): void {
  for (const key of aimsCache.keys()) {
    if (key.includes("aims")) {
      aimsCache.delete(key)
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

// Get all AIMS events from Firestore
export async function getAimsEventsFromFirestore(): Promise<Event[]> {
  const cacheKey = "aims:events:all"
  const cached = getCached<Event[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for AIMS events")
    return cached
  }

  try {
    const db = getDb()
    const snapshot = await db
      .collection(COLLECTIONS.EVENTS_AIMS)
      .orderBy("date", "asc")
      .get()

    const events = snapshot.docs.map(mapFirestoreToEvent)
    console.log(`[Firestore] Fetched ${events.length} AIMS events`)
    
    setCache(cacheKey, events)
    return events
  } catch (error) {
    console.error("Error fetching AIMS events from Firestore:", error)
    throw new Error("Failed to fetch AIMS events from Firestore")
  }
}

// Get a single AIMS event by ID
export async function getAimsEventByIdFromFirestore(id: string): Promise<Event | null> {
  try {
    const db = getDb()
    const doc = await db.collection(COLLECTIONS.EVENTS_AIMS).doc(id).get()

    if (!doc.exists) {
      return null
    }

    return mapFirestoreToEvent(doc)
  } catch (error) {
    console.error("Error fetching AIMS event by ID from Firestore:", error)
    return null
  }
}

// Create a new AIMS event in Firestore
export async function createAimsEventInFirestore(
  eventData: Omit<Event, "id" | "created_at" | "updated_at">
): Promise<Event> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const now = FieldValue.serverTimestamp()

    const docRef = await db.collection(COLLECTIONS.EVENTS_AIMS).add({
      ...eventData,
      created_at: now,
      updated_at: now,
    })

    invalidateAimsEventsCache()

    const doc = await docRef.get()
    return mapFirestoreToEvent(doc)
  } catch (error) {
    console.error("Error creating AIMS event in Firestore:", error)
    throw new Error("Failed to create AIMS event in Firestore")
  }
}

// Update an AIMS event in Firestore
export async function updateAimsEventInFirestore(
  id: string,
  updates: Partial<Event>
): Promise<Event> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const docRef = db.collection(COLLECTIONS.EVENTS_AIMS).doc(id)

    const cleanUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== "id" && key !== "created_at") {
        cleanUpdates[key] = value
      }
    }

    cleanUpdates.updated_at = FieldValue.serverTimestamp()

    await docRef.update(cleanUpdates)
    invalidateAimsEventsCache()

    const doc = await docRef.get()
    return mapFirestoreToEvent(doc)
  } catch (error) {
    console.error("Error updating AIMS event in Firestore:", error)
    throw new Error("Failed to update AIMS event in Firestore")
  }
}

// Delete an AIMS event from Firestore
export async function deleteAimsEventFromFirestore(id: string): Promise<void> {
  try {
    const db = getDb()
    await db.collection(COLLECTIONS.EVENTS_AIMS).doc(id).delete()
    invalidateAimsEventsCache()
  } catch (error) {
    console.error("Error deleting AIMS event from Firestore:", error)
    throw new Error("Failed to delete AIMS event from Firestore")
  }
}

// Mark past AIMS events automatically
export async function markPastAimsEventsInFirestore(): Promise<number> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const today = new Date().toISOString().split("T")[0]

    const snapshot = await db
      .collection(COLLECTIONS.EVENTS_AIMS)
      .where("isPast", "==", false)
      .get()

    if (snapshot.empty) {
      return 0
    }

    const pastEvents = snapshot.docs.filter((doc: admin.firestore.DocumentSnapshot) => {
      const data = doc.data()
      return data?.date && data.date < today
    })

    if (pastEvents.length === 0) {
      return 0
    }

    const batch = db.batch()
    pastEvents.forEach((doc: admin.firestore.DocumentSnapshot) => {
      batch.update(doc.ref, {
        isPast: true,
        updated_at: FieldValue.serverTimestamp(),
      })
    })

    await batch.commit()
    return pastEvents.length
  } catch (error) {
    console.error("Error marking past AIMS events (non-blocking):", error)
    return 0
  }
}

// Test AIMS Events Firestore connection
export async function testAimsEventsConnection(): Promise<boolean> {
  try {
    const db = getDb()
    await db.collection(COLLECTIONS.EVENTS_AIMS).limit(1).get()
    return true
  } catch (error) {
    console.error("AIMS Events Firestore connection test failed:", error)
    return false
  }
}


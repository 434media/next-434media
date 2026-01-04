import { getDb, COLLECTIONS, admin } from "./firebase-admin"
import type { Event } from "../types/event-types"

// ============================================
// AIMS EVENTS - Firestore Functions
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

// Invalidate cache for AIMS events
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

// Import events from Airtable to Firestore
export async function importAimsEventsFromAirtable(): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = []
  let imported = 0

  try {
    const baseId = process.env.AIMS_EVENTS_BASE_ID
    const apiKey = process.env.AIRTABLE_API_KEY

    if (!baseId || !apiKey) {
      throw new Error("AIMS Airtable credentials not configured")
    }

    // Fetch from Airtable
    const response = await fetch(
      `https://api.airtable.com/v0/${baseId}/Events?view=Grid%20view`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`)
    }

    const data = await response.json()
    const records = data.records || []

    const db = getDb()
    const FieldValue = admin.firestore.FieldValue

    for (const record of records) {
      try {
        const fields = record.fields || {}
        
        // Map Airtable fields to our event structure
        const eventData = {
          title: fields.Name || fields.Title || "",
          description: fields.Description || fields.Notes || "",
          date: fields.Date ? new Date(fields.Date).toISOString().split("T")[0] : "",
          time: fields.Time || fields["Start Time"] || undefined,
          location: fields.Location || fields.Venue || "",
          organizer: fields.Organizer || fields.Host || "AIMS ATX",
          category: mapAirtableCategory(fields.Category || fields.Type),
          price: fields.Price || fields.Cost || undefined,
          url: fields.URL || fields.Link || fields["Event URL"] || undefined,
          image: fields.Image?.[0]?.url || fields["Image URL"] || undefined,
          source: "manual" as const,
          isPast: fields.Date ? new Date(fields.Date) < new Date() : false,
          tags: fields.Tags || undefined,
        }

        if (!eventData.title || !eventData.date) {
          errors.push(`Skipped record ${record.id}: Missing title or date`)
          continue
        }

        // Check if event already exists (by title and date)
        const existing = await db
          .collection(COLLECTIONS.EVENTS_AIMS)
          .where("title", "==", eventData.title)
          .where("date", "==", eventData.date)
          .limit(1)
          .get()

        if (!existing.empty) {
          // Update existing
          const docRef = existing.docs[0].ref
          await docRef.update({
            ...eventData,
            updated_at: FieldValue.serverTimestamp(),
          })
        } else {
          // Create new
          await db.collection(COLLECTIONS.EVENTS_AIMS).add({
            ...eventData,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          })
        }

        imported++
      } catch (recordError) {
        errors.push(`Error processing record ${record.id}: ${recordError}`)
      }
    }

    invalidateAimsEventsCache()
    return { imported, errors }
  } catch (error) {
    console.error("Error importing AIMS events from Airtable:", error)
    throw error
  }
}

// Helper to map Airtable categories
function mapAirtableCategory(category: string | undefined): "conference" | "workshop" | "meetup" | "networking" | "other" {
  if (!category) return "other"
  
  const lowerCat = category.toLowerCase()
  if (lowerCat.includes("conference")) return "conference"
  if (lowerCat.includes("workshop") || lowerCat.includes("training")) return "workshop"
  if (lowerCat.includes("meetup") || lowerCat.includes("meeting")) return "meetup"
  if (lowerCat.includes("network") || lowerCat.includes("social")) return "networking"
  return "other"
}

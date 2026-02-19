import { getDb, admin } from "./firebase-admin"
import type { PMEvent, Vendor, Speaker, SOP } from "../types/project-management-types"

// Collection names for project management
export const PM_COLLECTIONS = {
  PM_EVENTS: "pm_events",
  PM_VENDORS: "pm_vendors",
  PM_SPEAKERS: "pm_speakers",
  PM_SOPS: "pm_sops",
} as const

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

// Invalidate cache for PM data
export function invalidatePMCache(): void {
  for (const key of cache.keys()) {
    if (key.startsWith("pm:")) {
      cache.delete(key)
    }
  }
}

// ============================================
// PM Events Functions
// ============================================

function mapFirestoreToPMEvent(doc: admin.firestore.DocumentSnapshot): PMEvent {
  const data = doc.data()
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`)
  }

  const Timestamp = admin.firestore.Timestamp

  return {
    id: doc.id,
    airtable_id: data.airtable_id,
    name: data.name || "",
    date: data.date || "",
    start_date: data.start_date,
    end_date: data.end_date,
    start_time: data.start_time,
    end_time: data.end_time,
    location: data.location,
    venue_name: data.venue_name,
    venue_location: data.venue_location,
    venue_address: data.venue_address,
    venue_map_link: data.venue_map_link,
    description: data.description,
    agenda_overview: data.agenda_overview,
    status: data.status || "planning",
    budget: data.budget,
    actual_cost: data.actual_cost,
    actual_expenses: data.actual_expenses,
    estimated_expenses: data.estimated_expenses,
    on_budget: data.on_budget,
    days_to_go: data.days_to_go,
    month: data.month,
    photo_banner: data.photo_banner,
    img_ai: data.img_ai,
    website_url: data.website_url,
    notes: data.notes,
    links: data.links || [],
    client_contacts: data.client_contacts || [],
    vendor_ids: data.vendor_ids,
    speaker_ids: data.speaker_ids,
    created_at: data.created_at instanceof Timestamp
      ? data.created_at.toDate().toISOString()
      : data.created_at,
    updated_at: data.updated_at instanceof Timestamp
      ? data.updated_at.toDate().toISOString()
      : data.updated_at,
  }
}

export async function getPMEventsFromFirestore(): Promise<PMEvent[]> {
  const cacheKey = "pm:events:all"
  const cached = getCached<PMEvent[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for PM events")
    return cached
  }

  try {
    const db = getDb()
    const snapshot = await db
      .collection(PM_COLLECTIONS.PM_EVENTS)
      .orderBy("date", "desc")
      .get()

    const events = snapshot.docs.map(mapFirestoreToPMEvent)
    console.log(`[Firestore] Fetched ${events.length} PM events`)
    
    setCache(cacheKey, events)
    return events
  } catch (error) {
    console.error("Error fetching PM events from Firestore:", error)
    throw new Error("Failed to fetch PM events from Firestore")
  }
}

export async function getPMEventByIdFromFirestore(id: string): Promise<PMEvent | null> {
  try {
    const db = getDb()
    const doc = await db.collection(PM_COLLECTIONS.PM_EVENTS).doc(id).get()

    if (!doc.exists) {
      return null
    }

    return mapFirestoreToPMEvent(doc)
  } catch (error) {
    console.error("Error fetching PM event by ID from Firestore:", error)
    return null
  }
}

export async function createPMEventInFirestore(
  eventData: Omit<PMEvent, "id" | "created_at" | "updated_at">
): Promise<PMEvent> {
  try {
    const db = getDb()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const docRef = await db.collection(PM_COLLECTIONS.PM_EVENTS).add({
      ...eventData,
      created_at: now,
      updated_at: now,
    })

    invalidatePMCache()

    const doc = await docRef.get()
    return mapFirestoreToPMEvent(doc)
  } catch (error) {
    console.error("Error creating PM event in Firestore:", error)
    throw new Error("Failed to create PM event in Firestore")
  }
}

export async function updatePMEventInFirestore(
  id: string,
  updates: Partial<PMEvent>
): Promise<PMEvent> {
  try {
    const db = getDb()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const { id: _, created_at: __, ...updateData } = updates

    // Use set with merge to create-or-update (prevents NOT_FOUND errors
    // when data was loaded from Airtable but not yet synced to Firestore)
    await db.collection(PM_COLLECTIONS.PM_EVENTS).doc(id).set({
      ...updateData,
      updated_at: now,
      created_at: __ || now,
    }, { merge: true })

    invalidatePMCache()

    const doc = await db.collection(PM_COLLECTIONS.PM_EVENTS).doc(id).get()
    return mapFirestoreToPMEvent(doc)
  } catch (error) {
    console.error("Error updating PM event in Firestore:", error)
    throw new Error("Failed to update PM event in Firestore")
  }
}

export async function deletePMEventFromFirestore(id: string): Promise<void> {
  try {
    const db = getDb()
    await db.collection(PM_COLLECTIONS.PM_EVENTS).doc(id).delete()
    invalidatePMCache()
  } catch (error) {
    console.error("Error deleting PM event from Firestore:", error)
    throw new Error("Failed to delete PM event from Firestore")
  }
}

// ============================================
// Vendors Functions
// ============================================

function mapFirestoreToVendor(doc: admin.firestore.DocumentSnapshot): Vendor {
  const data = doc.data()
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`)
  }

  const Timestamp = admin.firestore.Timestamp

  return {
    id: doc.id,
    airtable_id: data.airtable_id,
    name: data.name || "",
    company: data.company,
    email: data.email,
    phone: data.phone,
    category: data.category || "Other",
    specialty: data.specialty,
    website: data.website,
    link_url: data.link_url,
    address: data.address,
    city: data.city,
    state: data.state,
    zip: data.zip,
    photo: data.photo,
    social_media: data.social_media,
    research: data.research,
    rate: data.rate,
    rate_type: data.rate_type,
    contract_status: data.contract_status,
    notes: data.notes,
    rating: data.rating,
    event_ids: data.event_ids,
    attachments: data.attachments,
    created_at: data.created_at instanceof Timestamp
      ? data.created_at.toDate().toISOString()
      : data.created_at,
    updated_at: data.updated_at instanceof Timestamp
      ? data.updated_at.toDate().toISOString()
      : data.updated_at,
  }
}

export async function getVendorsFromFirestore(): Promise<Vendor[]> {
  const cacheKey = "pm:vendors:all"
  const cached = getCached<Vendor[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for vendors")
    return cached
  }

  try {
    const db = getDb()
    const snapshot = await db
      .collection(PM_COLLECTIONS.PM_VENDORS)
      .orderBy("name", "asc")
      .get()

    const vendors = snapshot.docs.map(mapFirestoreToVendor)
    console.log(`[Firestore] Fetched ${vendors.length} vendors`)
    
    setCache(cacheKey, vendors)
    return vendors
  } catch (error) {
    console.error("Error fetching vendors from Firestore:", error)
    throw new Error("Failed to fetch vendors from Firestore")
  }
}

export async function getVendorByIdFromFirestore(id: string): Promise<Vendor | null> {
  try {
    const db = getDb()
    const doc = await db.collection(PM_COLLECTIONS.PM_VENDORS).doc(id).get()

    if (!doc.exists) {
      return null
    }

    return mapFirestoreToVendor(doc)
  } catch (error) {
    console.error("Error fetching vendor by ID from Firestore:", error)
    return null
  }
}

export async function createVendorInFirestore(
  vendorData: Omit<Vendor, "id" | "created_at" | "updated_at">
): Promise<Vendor> {
  try {
    const db = getDb()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const docRef = await db.collection(PM_COLLECTIONS.PM_VENDORS).add({
      ...vendorData,
      created_at: now,
      updated_at: now,
    })

    invalidatePMCache()

    const doc = await docRef.get()
    return mapFirestoreToVendor(doc)
  } catch (error) {
    console.error("Error creating vendor in Firestore:", error)
    throw new Error("Failed to create vendor in Firestore")
  }
}

export async function updateVendorInFirestore(
  id: string,
  updates: Partial<Vendor>
): Promise<Vendor> {
  try {
    const db = getDb()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const { id: _, created_at: __, ...updateData } = updates

    await db.collection(PM_COLLECTIONS.PM_VENDORS).doc(id).set({
      ...updateData,
      updated_at: now,
    }, { merge: true })

    invalidatePMCache()

    const doc = await db.collection(PM_COLLECTIONS.PM_VENDORS).doc(id).get()
    return mapFirestoreToVendor(doc)
  } catch (error) {
    console.error("Error updating vendor in Firestore:", error)
    throw new Error("Failed to update vendor in Firestore")
  }
}

export async function deleteVendorFromFirestore(id: string): Promise<void> {
  try {
    const db = getDb()
    await db.collection(PM_COLLECTIONS.PM_VENDORS).doc(id).delete()
    invalidatePMCache()
  } catch (error) {
    console.error("Error deleting vendor from Firestore:", error)
    throw new Error("Failed to delete vendor from Firestore")
  }
}

// ============================================
// Speakers Functions
// ============================================

function mapFirestoreToSpeaker(doc: admin.firestore.DocumentSnapshot): Speaker {
  const data = doc.data()
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`)
  }

  const Timestamp = admin.firestore.Timestamp

  return {
    id: doc.id,
    airtable_id: data.airtable_id,
    name: data.name || "",
    title: data.title,
    company: data.company,
    bio: data.bio,
    email: data.email,
    phone: data.phone,
    website: data.website,
    linkedin: data.linkedin,
    twitter: data.twitter,
    instagram: data.instagram,
    headshot: data.headshot,
    topics: data.topics,
    speaking_fee: data.speaking_fee,
    travel_requirements: data.travel_requirements,
    availability: data.availability,
    notes: data.notes,
    event_ids: data.event_ids,
    created_at: data.created_at instanceof Timestamp
      ? data.created_at.toDate().toISOString()
      : data.created_at,
    updated_at: data.updated_at instanceof Timestamp
      ? data.updated_at.toDate().toISOString()
      : data.updated_at,
  }
}

export async function getSpeakersFromFirestore(): Promise<Speaker[]> {
  const cacheKey = "pm:speakers:all"
  const cached = getCached<Speaker[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for speakers")
    return cached
  }

  try {
    const db = getDb()
    const snapshot = await db
      .collection(PM_COLLECTIONS.PM_SPEAKERS)
      .orderBy("name", "asc")
      .get()

    const speakers = snapshot.docs.map(mapFirestoreToSpeaker)
    console.log(`[Firestore] Fetched ${speakers.length} speakers`)
    
    setCache(cacheKey, speakers)
    return speakers
  } catch (error) {
    console.error("Error fetching speakers from Firestore:", error)
    throw new Error("Failed to fetch speakers from Firestore")
  }
}

export async function getSpeakerByIdFromFirestore(id: string): Promise<Speaker | null> {
  try {
    const db = getDb()
    const doc = await db.collection(PM_COLLECTIONS.PM_SPEAKERS).doc(id).get()

    if (!doc.exists) {
      return null
    }

    return mapFirestoreToSpeaker(doc)
  } catch (error) {
    console.error("Error fetching speaker by ID from Firestore:", error)
    return null
  }
}

export async function createSpeakerInFirestore(
  speakerData: Omit<Speaker, "id" | "created_at" | "updated_at">
): Promise<Speaker> {
  try {
    const db = getDb()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const docRef = await db.collection(PM_COLLECTIONS.PM_SPEAKERS).add({
      ...speakerData,
      created_at: now,
      updated_at: now,
    })

    invalidatePMCache()

    const doc = await docRef.get()
    return mapFirestoreToSpeaker(doc)
  } catch (error) {
    console.error("Error creating speaker in Firestore:", error)
    throw new Error("Failed to create speaker in Firestore")
  }
}

export async function updateSpeakerInFirestore(
  id: string,
  updates: Partial<Speaker>
): Promise<Speaker> {
  try {
    const db = getDb()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const { id: _, created_at: __, ...updateData } = updates

    await db.collection(PM_COLLECTIONS.PM_SPEAKERS).doc(id).set({
      ...updateData,
      updated_at: now,
    }, { merge: true })

    invalidatePMCache()

    const doc = await db.collection(PM_COLLECTIONS.PM_SPEAKERS).doc(id).get()
    return mapFirestoreToSpeaker(doc)
  } catch (error) {
    console.error("Error updating speaker in Firestore:", error)
    throw new Error("Failed to update speaker in Firestore")
  }
}

export async function deleteSpeakerFromFirestore(id: string): Promise<void> {
  try {
    const db = getDb()
    await db.collection(PM_COLLECTIONS.PM_SPEAKERS).doc(id).delete()
    invalidatePMCache()
  } catch (error) {
    console.error("Error deleting speaker from Firestore:", error)
    throw new Error("Failed to delete speaker from Firestore")
  }
}

// ============================================
// SOPs Functions
// ============================================

function mapFirestoreToSOP(doc: admin.firestore.DocumentSnapshot): SOP {
  const data = doc.data()
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`)
  }

  const Timestamp = admin.firestore.Timestamp

  return {
    id: doc.id,
    airtable_id: data.airtable_id,
    title: data.title || "",
    category: data.category || "Other",
    department: data.department,
    description: data.description,
    content: data.content || "",
    version: data.version || "1.0",
    status: data.status || "draft",
    owner: data.owner,
    reviewers: data.reviewers,
    last_reviewed: data.last_reviewed,
    next_review: data.next_review,
    related_sops: data.related_sops,
    attachments: data.attachments,
    tags: data.tags,
    created_at: data.created_at instanceof Timestamp
      ? data.created_at.toDate().toISOString()
      : data.created_at,
    updated_at: data.updated_at instanceof Timestamp
      ? data.updated_at.toDate().toISOString()
      : data.updated_at,
  }
}

export async function getSOPsFromFirestore(): Promise<SOP[]> {
  const cacheKey = "pm:sops:all"
  const cached = getCached<SOP[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for SOPs")
    return cached
  }

  try {
    const db = getDb()
    const snapshot = await db
      .collection(PM_COLLECTIONS.PM_SOPS)
      .orderBy("title", "asc")
      .get()

    const sops = snapshot.docs.map(mapFirestoreToSOP)
    console.log(`[Firestore] Fetched ${sops.length} SOPs`)
    
    setCache(cacheKey, sops)
    return sops
  } catch (error) {
    console.error("Error fetching SOPs from Firestore:", error)
    throw new Error("Failed to fetch SOPs from Firestore")
  }
}

export async function getSOPByIdFromFirestore(id: string): Promise<SOP | null> {
  try {
    const db = getDb()
    const doc = await db.collection(PM_COLLECTIONS.PM_SOPS).doc(id).get()

    if (!doc.exists) {
      return null
    }

    return mapFirestoreToSOP(doc)
  } catch (error) {
    console.error("Error fetching SOP by ID from Firestore:", error)
    return null
  }
}

export async function createSOPInFirestore(
  sopData: Omit<SOP, "id" | "created_at" | "updated_at">
): Promise<SOP> {
  try {
    const db = getDb()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const docRef = await db.collection(PM_COLLECTIONS.PM_SOPS).add({
      ...sopData,
      created_at: now,
      updated_at: now,
    })

    invalidatePMCache()

    const doc = await docRef.get()
    return mapFirestoreToSOP(doc)
  } catch (error) {
    console.error("Error creating SOP in Firestore:", error)
    throw new Error("Failed to create SOP in Firestore")
  }
}

export async function updateSOPInFirestore(
  id: string,
  updates: Partial<SOP>
): Promise<SOP> {
  try {
    const db = getDb()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const { id: _, created_at: __, ...updateData } = updates

    await db.collection(PM_COLLECTIONS.PM_SOPS).doc(id).set({
      ...updateData,
      updated_at: now,
    }, { merge: true })

    invalidatePMCache()

    const doc = await db.collection(PM_COLLECTIONS.PM_SOPS).doc(id).get()
    return mapFirestoreToSOP(doc)
  } catch (error) {
    console.error("Error updating SOP in Firestore:", error)
    throw new Error("Failed to update SOP in Firestore")
  }
}

export async function deleteSOPFromFirestore(id: string): Promise<void> {
  try {
    const db = getDb()
    await db.collection(PM_COLLECTIONS.PM_SOPS).doc(id).delete()
    invalidatePMCache()
  } catch (error) {
    console.error("Error deleting SOP from Firestore:", error)
    throw new Error("Failed to delete SOP from Firestore")
  }
}

// ============================================
// Batch Migration Functions
// ============================================

export async function savePMEventsToFirestore(events: PMEvent[]): Promise<number> {
  try {
    const db = getDb()
    const batch = db.batch()
    const now = admin.firestore.FieldValue.serverTimestamp()

    for (const event of events) {
      const docRef = event.airtable_id
        ? db.collection(PM_COLLECTIONS.PM_EVENTS).doc(event.airtable_id)
        : db.collection(PM_COLLECTIONS.PM_EVENTS).doc()

      batch.set(docRef, {
        ...event,
        id: docRef.id,
        updated_at: now,
        created_at: event.created_at || now,
      }, { merge: true })
    }

    await batch.commit()
    invalidatePMCache()
    return events.length
  } catch (error) {
    console.error("Error saving PM events to Firestore:", error)
    throw new Error("Failed to save PM events to Firestore")
  }
}

export async function saveVendorsToFirestore(vendors: Vendor[]): Promise<number> {
  try {
    const db = getDb()
    const batch = db.batch()
    const now = admin.firestore.FieldValue.serverTimestamp()

    for (const vendor of vendors) {
      const docRef = vendor.airtable_id
        ? db.collection(PM_COLLECTIONS.PM_VENDORS).doc(vendor.airtable_id)
        : db.collection(PM_COLLECTIONS.PM_VENDORS).doc()

      batch.set(docRef, {
        ...vendor,
        id: docRef.id,
        updated_at: now,
        created_at: vendor.created_at || now,
      }, { merge: true })
    }

    await batch.commit()
    invalidatePMCache()
    return vendors.length
  } catch (error) {
    console.error("Error saving vendors to Firestore:", error)
    throw new Error("Failed to save vendors to Firestore")
  }
}

export async function saveSpeakersToFirestore(speakers: Speaker[]): Promise<number> {
  try {
    const db = getDb()
    const batch = db.batch()
    const now = admin.firestore.FieldValue.serverTimestamp()

    for (const speaker of speakers) {
      const docRef = speaker.airtable_id
        ? db.collection(PM_COLLECTIONS.PM_SPEAKERS).doc(speaker.airtable_id)
        : db.collection(PM_COLLECTIONS.PM_SPEAKERS).doc()

      batch.set(docRef, {
        ...speaker,
        id: docRef.id,
        updated_at: now,
        created_at: speaker.created_at || now,
      }, { merge: true })
    }

    await batch.commit()
    invalidatePMCache()
    return speakers.length
  } catch (error) {
    console.error("Error saving speakers to Firestore:", error)
    throw new Error("Failed to save speakers to Firestore")
  }
}

export async function saveSOPsToFirestore(sops: SOP[]): Promise<number> {
  try {
    const db = getDb()
    const batch = db.batch()
    const now = admin.firestore.FieldValue.serverTimestamp()

    for (const sop of sops) {
      const docRef = sop.airtable_id
        ? db.collection(PM_COLLECTIONS.PM_SOPS).doc(sop.airtable_id)
        : db.collection(PM_COLLECTIONS.PM_SOPS).doc()

      batch.set(docRef, {
        ...sop,
        id: docRef.id,
        updated_at: now,
        created_at: sop.created_at || now,
      }, { merge: true })
    }

    await batch.commit()
    invalidatePMCache()
    return sops.length
  } catch (error) {
    console.error("Error saving SOPs to Firestore:", error)
    throw new Error("Failed to save SOPs to Firestore")
  }
}

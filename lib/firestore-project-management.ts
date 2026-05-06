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
// Airtable wrapper unwrap — some PM fields were synced from Airtable while
// computed/formula fields hadn't resolved, so they land in Firestore as
// `{ errorType, state, isStale, value }` wrappers instead of raw primitives.
// Unwrap defensively at the read boundary so the rest of the app sees clean
// primitives by contract.
// ============================================

function unwrapValue<T>(v: unknown, expected: "string" | "number" | "boolean"): T | undefined {
  if (v == null) return undefined
  if (typeof v === expected) return v as T
  if (typeof v === "object" && v !== null && "value" in (v as Record<string, unknown>)) {
    const inner = (v as { value: unknown }).value
    if (typeof inner === expected) return inner as T
  }
  return undefined
}

const str = (v: unknown): string | undefined => unwrapValue<string>(v, "string")
const num = (v: unknown): number | undefined => unwrapValue<number>(v, "number")

function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: string[] = []
  for (const item of v) {
    const s = str(item)
    if (s) out.push(s)
  }
  return out.length > 0 ? out : undefined
}

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
    airtable_id: str(data.airtable_id),
    name: str(data.name) || "",
    date: str(data.date) || "",
    start_date: str(data.start_date),
    end_date: str(data.end_date),
    start_time: str(data.start_time),
    end_time: str(data.end_time),
    location: str(data.location),
    venue_name: str(data.venue_name),
    venue_location: str(data.venue_location),
    venue_address: str(data.venue_address),
    venue_map_link: str(data.venue_map_link),
    description: str(data.description),
    agenda_overview: str(data.agenda_overview),
    status: (str(data.status) || "planning") as PMEvent["status"],
    budget: num(data.budget),
    actual_cost: num(data.actual_cost),
    actual_expenses: num(data.actual_expenses),
    estimated_expenses: num(data.estimated_expenses),
    on_budget: str(data.on_budget),
    days_to_go: str(data.days_to_go),
    month: str(data.month),
    photo_banner: str(data.photo_banner),
    img_ai: str(data.img_ai),
    website_url: str(data.website_url),
    notes: str(data.notes),
    // links + client_contacts are structured arrays — passed through as-is;
    // their inner string fields are unwrapped at the consumer if needed
    links: data.links || [],
    client_contacts: data.client_contacts || [],
    vendor_ids: strArray(data.vendor_ids),
    speaker_ids: strArray(data.speaker_ids),
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
    airtable_id: str(data.airtable_id),
    name: str(data.name) || "",
    company: str(data.company),
    email: str(data.email),
    phone: str(data.phone),
    category: str(data.category) || "Other",
    specialty: str(data.specialty),
    website: str(data.website),
    link_url: str(data.link_url),
    address: str(data.address),
    city: str(data.city),
    state: str(data.state),
    zip: str(data.zip),
    photo: str(data.photo),
    social_media: str(data.social_media),
    research: str(data.research),
    rate: num(data.rate),
    rate_type: str(data.rate_type) as Vendor["rate_type"],
    contract_status: str(data.contract_status) as Vendor["contract_status"],
    notes: str(data.notes),
    rating: num(data.rating),
    event_ids: strArray(data.event_ids),
    // attachments is a structured array — passed through as-is
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
    airtable_id: str(data.airtable_id),
    name: str(data.name) || "",
    title: str(data.title),
    company: str(data.company),
    bio: str(data.bio),
    introduction: str(data.introduction),
    email: str(data.email),
    phone: str(data.phone),
    website: str(data.website),
    linkedin: str(data.linkedin),
    linkedin_url: str(data.linkedin_url),
    linkedin_summary: str(data.linkedin_summary),
    twitter: str(data.twitter),
    instagram: str(data.instagram),
    headshot: str(data.headshot),
    photo: str(data.photo),
    topics: strArray(data.topics),
    session_topics: strArray(data.session_topics),
    session_topic_ids: strArray(data.session_topic_ids),
    speaking_fee: num(data.speaking_fee),
    travel_requirements: str(data.travel_requirements),
    availability: str(data.availability),
    notes: str(data.notes),
    event_ids: strArray(data.event_ids),
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
    airtable_id: str(data.airtable_id),
    title: str(data.title) || "",
    category: str(data.category) || "Other",
    department: str(data.department),
    description: str(data.description),
    content: str(data.content) || "",
    version: str(data.version) || "1.0",
    status: (str(data.status) || "draft") as SOP["status"],
    owner: str(data.owner),
    reviewers: strArray(data.reviewers),
    last_reviewed: str(data.last_reviewed),
    next_review: str(data.next_review),
    related_sops: strArray(data.related_sops),
    // attachments is a structured array — passed through as-is
    attachments: data.attachments,
    tags: strArray(data.tags),
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


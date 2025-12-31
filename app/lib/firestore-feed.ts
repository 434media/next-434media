import { getDb, COLLECTIONS, TABLE_TO_COLLECTION, admin } from "./firebase-admin"

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

// Invalidate cache for feed items
export function invalidateFeedCache(tableName?: string): void {
  for (const key of cache.keys()) {
    if (tableName) {
      if (key.includes(tableName) || key.includes("feed")) {
        cache.delete(key)
      }
    } else if (key.includes("feed")) {
      cache.delete(key)
    }
  }
}

// Get the correct Firestore collection for a table name
function getCollectionForTable(tableName?: string): string {
  if (!tableName) return COLLECTIONS.FEED
  return TABLE_TO_COLLECTION[tableName] || TABLE_TO_COLLECTION[tableName.toUpperCase()] || COLLECTIONS.FEED
}

// Types for The Feed items (matching existing interface)
export interface FeedItem {
  id?: string
  published_date: string
  title: string
  type: "video" | "article" | "podcast" | "newsletter"
  summary: string
  authors: string[]
  topics: string[]
  slug: string
  og_image?: string
  status: "draft" | "published" | "archived"
  
  // Newsletter-specific fields
  hero_image_desktop?: string
  hero_image_mobile?: string
  founders_note_text?: string
  founders_note_image?: string
  last_month_gif?: string
  the_drop_gif?: string
  featured_post_title?: string
  featured_post_image?: string
  featured_post_content?: string
  upcoming_event_title?: string
  upcoming_event_description?: string
  upcoming_event_image_desktop?: string
  upcoming_event_image_mobile?: string
  upcoming_event_cta_text?: string
  upcoming_event_cta_link?: string
  
  // Spotlight fields (inline - 1, 2, 3)
  spotlight_1_title?: string
  spotlight_1_description?: string
  spotlight_1_image?: string
  spotlight_1_cta_text?: string
  spotlight_1_cta_link?: string
  
  spotlight_2_title?: string
  spotlight_2_description?: string
  spotlight_2_image?: string
  spotlight_2_cta_text?: string
  spotlight_2_cta_link?: string
  
  spotlight_3_title?: string
  spotlight_3_description?: string
  spotlight_3_image?: string
  spotlight_3_cta_text?: string
  spotlight_3_cta_link?: string

  // Firestore metadata
  created_at?: string
  updated_at?: string
}

// Convert Firestore document to FeedItem interface
function mapFirestoreToFeedItem(doc: admin.firestore.DocumentSnapshot): FeedItem {
  const data = doc.data()
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`)
  }

  const Timestamp = admin.firestore.Timestamp

  return {
    id: doc.id,
    published_date: data.published_date || new Date().toISOString(),
    title: data.title || "",
    type: data.type || "newsletter",
    summary: data.summary || "",
    authors: data.authors || [],
    topics: data.topics || [],
    slug: data.slug || "",
    og_image: data.og_image || undefined,
    status: data.status || "draft",
    
    // Newsletter-specific fields
    hero_image_desktop: data.hero_image_desktop || undefined,
    hero_image_mobile: data.hero_image_mobile || undefined,
    founders_note_text: data.founders_note_text || undefined,
    founders_note_image: data.founders_note_image || undefined,
    last_month_gif: data.last_month_gif || undefined,
    the_drop_gif: data.the_drop_gif || undefined,
    featured_post_title: data.featured_post_title || undefined,
    featured_post_image: data.featured_post_image || undefined,
    featured_post_content: data.featured_post_content || undefined,
    upcoming_event_title: data.upcoming_event_title || undefined,
    upcoming_event_description: data.upcoming_event_description || undefined,
    upcoming_event_image_desktop: data.upcoming_event_image_desktop || undefined,
    upcoming_event_image_mobile: data.upcoming_event_image_mobile || undefined,
    upcoming_event_cta_text: data.upcoming_event_cta_text || undefined,
    upcoming_event_cta_link: data.upcoming_event_cta_link || undefined,
    
    // Spotlight fields
    spotlight_1_title: data.spotlight_1_title || undefined,
    spotlight_1_description: data.spotlight_1_description || undefined,
    spotlight_1_image: data.spotlight_1_image || undefined,
    spotlight_1_cta_text: data.spotlight_1_cta_text || undefined,
    spotlight_1_cta_link: data.spotlight_1_cta_link || undefined,
    
    spotlight_2_title: data.spotlight_2_title || undefined,
    spotlight_2_description: data.spotlight_2_description || undefined,
    spotlight_2_image: data.spotlight_2_image || undefined,
    spotlight_2_cta_text: data.spotlight_2_cta_text || undefined,
    spotlight_2_cta_link: data.spotlight_2_cta_link || undefined,
    
    spotlight_3_title: data.spotlight_3_title || undefined,
    spotlight_3_description: data.spotlight_3_description || undefined,
    spotlight_3_image: data.spotlight_3_image || undefined,
    spotlight_3_cta_text: data.spotlight_3_cta_text || undefined,
    spotlight_3_cta_link: data.spotlight_3_cta_link || undefined,

    created_at: data.created_at instanceof Timestamp 
      ? data.created_at.toDate().toISOString() 
      : data.created_at,
    updated_at: data.updated_at instanceof Timestamp 
      ? data.updated_at.toDate().toISOString() 
      : data.updated_at,
  }
}

// Get all feed items from Firestore (with caching)
export async function getFeedItems(filters?: { 
  status?: string
  type?: string
  tableName?: string 
}): Promise<FeedItem[]> {
  // Generate cache key from filters
  const cacheKey = `feed:${JSON.stringify(filters || {})}`
  const cached = getCached<FeedItem[]>(cacheKey)
  if (cached) {
    console.log(`[Firestore] Cache hit for feed items`)
    return cached
  }

  try {
    const db = getDb()
    const collectionName = getCollectionForTable(filters?.tableName)
    
    let query: admin.firestore.Query = db.collection(collectionName)

    // Apply filters
    if (filters?.status) {
      query = query.where("status", "==", filters.status)
    }

    if (filters?.type) {
      query = query.where("type", "==", filters.type)
    }

    // Order by published_date descending
    query = query.orderBy("published_date", "desc")

    const snapshot = await query.get()
    const items = snapshot.docs.map(mapFirestoreToFeedItem)
    
    console.log(`[Firestore] Fetched ${items.length} feed items from ${collectionName}`)
    
    // Cache the results
    setCache(cacheKey, items)
    
    return items
  } catch (error) {
    console.error("[Firestore] Error fetching feed items:", error)
    return []
  }
}

// Get a specific feed item by slug
export async function getFeedItemBySlug(slug: string, tableName?: string): Promise<FeedItem | null> {
  try {
    const db = getDb()
    const collectionName = getCollectionForTable(tableName)
    
    const snapshot = await db
      .collection(collectionName)
      .where("slug", "==", slug)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return null
    }

    return mapFirestoreToFeedItem(snapshot.docs[0])
  } catch (error) {
    console.error("[Firestore] Error fetching feed item by slug:", error)
    return null
  }
}

// Get a specific feed item by ID
export async function getFeedItemById(id: string, tableName?: string): Promise<FeedItem | null> {
  try {
    const db = getDb()
    const collectionName = getCollectionForTable(tableName)
    
    const doc = await db.collection(collectionName).doc(id).get()

    if (!doc.exists) {
      return null
    }

    return mapFirestoreToFeedItem(doc)
  } catch (error) {
    console.error("[Firestore] Error fetching feed item by ID:", error)
    return null
  }
}

// Create a new feed item in Firestore
export async function createFeedItem(item: Partial<FeedItem>, tableName?: string): Promise<FeedItem> {
  try {
    const db = getDb()
    const collectionName = getCollectionForTable(tableName)
    const FieldValue = admin.firestore.FieldValue
    const now = FieldValue.serverTimestamp()

    // Clean the item data (remove undefined values)
    const cleanItem: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(item)) {
      if (value !== undefined && key !== "id") {
        cleanItem[key] = value
      }
    }

    cleanItem.created_at = now
    cleanItem.updated_at = now
    cleanItem._source_table = tableName || "THEFEED"

    const docRef = await db.collection(collectionName).add(cleanItem)
    
    // Invalidate feed cache
    invalidateFeedCache(tableName)
    
    const doc = await docRef.get()

    console.log(`[Firestore] Created feed item in ${collectionName}: ${docRef.id}`)

    return mapFirestoreToFeedItem(doc)
  } catch (error) {
    console.error("[Firestore] Error creating feed item:", error)
    throw new Error(`Failed to create feed item in Firestore: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Update a feed item in Firestore
export async function updateFeedItem(id: string, updates: Partial<FeedItem>, tableName?: string): Promise<FeedItem> {
  try {
    const db = getDb()
    const collectionName = getCollectionForTable(tableName)
    const FieldValue = admin.firestore.FieldValue
    const docRef = db.collection(collectionName).doc(id)

    // Clean the updates (remove undefined values)
    const cleanUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== "id" && key !== "created_at") {
        cleanUpdates[key] = value
      }
    }

    cleanUpdates.updated_at = FieldValue.serverTimestamp()

    await docRef.update(cleanUpdates)

    // Invalidate feed cache
    invalidateFeedCache(tableName)

    const doc = await docRef.get()
    
    console.log(`[Firestore] Updated feed item in ${collectionName}: ${id}`)
    
    return mapFirestoreToFeedItem(doc)
  } catch (error) {
    console.error("[Firestore] Error updating feed item:", error)
    throw new Error("Failed to update feed item in Firestore")
  }
}

// Delete a feed item from Firestore
export async function deleteFeedItem(id: string, tableName?: string): Promise<void> {
  try {
    const db = getDb()
    const collectionName = getCollectionForTable(tableName)
    
    await db.collection(collectionName).doc(id).delete()
    
    // Invalidate feed cache
    invalidateFeedCache(tableName)
    
    console.log(`[Firestore] Deleted feed item from ${collectionName}: ${id}`)
  } catch (error) {
    console.error("[Firestore] Error deleting feed item:", error)
    throw new Error("Failed to delete feed item from Firestore")
  }
}

// Test Firestore Feed connection
export async function testFeedFirestoreConnection(): Promise<boolean> {
  try {
    const db = getDb()
    await db.collection(COLLECTIONS.FEED).limit(1).get()
    console.log("✅ Firestore Feed connection successful")
    return true
  } catch (error) {
    console.error("❌ Firestore Feed connection test failed:", error)
    return false
  }
}

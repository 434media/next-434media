import admin from "firebase-admin"
import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type { Asset, StoredAsset } from "../components/crm/types"

// Reusable media library (crm_assets). Generated assets are persisted here so
// they can be browsed/downloaded/reused in the Studio, independent of any
// content post. Newest-first, cursor-paginated. Short read cache like the other
// CRM libs; invalidated on write.

const COLLECTION = CRM_COLLECTIONS.ASSETS
const PAGE_SIZE = 24
const CACHE_TTL = 30 * 1000

interface CacheEntry<T> {
  data: T
  timestamp: number
}
const cache = new Map<string, CacheEntry<unknown>>()

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
function clearCache(): void {
  cache.clear()
}

function toIso(value: unknown): string {
  const Timestamp = admin.firestore.Timestamp
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === "string") return value
  return new Date().toISOString()
}

function docToStoredAsset(doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot): StoredAsset {
  const data = doc.data()!
  return {
    ...data,
    id: doc.id,
    created_at: toIso(data.created_at),
  } as StoredAsset
}

// Persist a generated/uploaded asset into the library.
export async function createAsset(input: {
  asset: Asset
  created_by: string
  title?: string
}): Promise<StoredAsset> {
  const db = getDb()
  const FieldValue = admin.firestore.FieldValue
  const ref = await db.collection(COLLECTION).add({
    ...input.asset,
    title: input.title ?? undefined,
    created_by: input.created_by,
    created_at: FieldValue.serverTimestamp(),
  })
  clearCache()
  const doc = await ref.get()
  return docToStoredAsset(doc)
}

// List library assets, newest-first, cursor-paginated (cursor = created_at ISO
// of the last item from the previous page). Kind filtering is done client-side
// over loaded pages — deliberately NOT in the query, so we avoid a Firestore
// composite index (where kind + orderBy created_at). Fine at admin-library
// volume; revisit if the library grows large.
export async function listAssets(opts: {
  cursor?: string
} = {}): Promise<{ assets: StoredAsset[]; nextCursor: string | null }> {
  const cacheKey = `assets:${opts.cursor ?? "0"}`
  const cached = getCached<{ assets: StoredAsset[]; nextCursor: string | null }>(cacheKey)
  if (cached) return cached

  const db = getDb()
  let q: FirebaseFirestore.Query = db.collection(COLLECTION).orderBy("created_at", "desc")
  if (opts.cursor) q = q.startAfter(admin.firestore.Timestamp.fromDate(new Date(opts.cursor)))
  q = q.limit(PAGE_SIZE + 1) // fetch one extra to know if there's a next page

  const snap = await q.get()
  const docs = snap.docs.slice(0, PAGE_SIZE)
  const assets = docs.map(docToStoredAsset)
  const hasMore = snap.docs.length > PAGE_SIZE
  const nextCursor = hasMore ? assets[assets.length - 1]?.created_at ?? null : null

  const result = { assets, nextCursor }
  setCache(cacheKey, result)
  return result
}

export async function getAsset(id: string): Promise<StoredAsset | null> {
  const db = getDb()
  const doc = await db.collection(COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return docToStoredAsset(doc)
}

// Delete the LIBRARY RECORD only — never the underlying Blob, which may still be
// referenced by a content post (deleting bytes would break that post).
export async function deleteAsset(id: string): Promise<void> {
  const db = getDb()
  await db.collection(COLLECTION).doc(id).delete()
  clearCache()
}

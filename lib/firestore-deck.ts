import crypto from "crypto"
import admin from "firebase-admin"
import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type {
  SalesDeck,
  DeckStatus,
  CreateDeckInput,
  UpdateDeckInput,
} from "../types/deck-types"

// Sales decks (crm_decks). Mirrors the other CRM firestore libs: short read
// cache invalidated on write. A deck carries an unguessable `share_id` for the
// public /deck/[share_id] route (unlisted; not the internal name). Images are
// Asset URLs, so a deck doc stays small.

const COLLECTION = CRM_COLLECTIONS.DECKS
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
export function invalidateDeckCache(): void {
  clearCache()
}

function toIso(value: unknown): string {
  const Timestamp = admin.firestore.Timestamp
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === "string") return value
  return new Date().toISOString()
}

// URL-safe, unguessable id for the public share link (16 bytes → 22 chars).
function newShareId(): string {
  return crypto.randomBytes(16).toString("base64url")
}

function docToDeck(
  doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot,
): SalesDeck {
  const data = doc.data()!
  return {
    id: doc.id,
    share_id: data.share_id ?? "",
    name: data.name ?? "Untitled deck",
    brand: data.brand ?? undefined,
    status: (data.status as DeckStatus) ?? "draft",
    slides: Array.isArray(data.slides) ? data.slides : [],
    created_by: data.created_by ?? "",
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
    published_at: data.published_at ? toIso(data.published_at) : undefined,
  }
}

export async function createDeck(input: CreateDeckInput): Promise<SalesDeck> {
  const db = getDb()
  const FieldValue = admin.firestore.FieldValue
  const ref = await db.collection(COLLECTION).add({
    share_id: newShareId(),
    name: input.name,
    brand: input.brand ?? null,
    status: "draft",
    slides: input.slides,
    created_by: input.created_by,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  })
  clearCache()
  return docToDeck(await ref.get())
}

export async function listDecks(): Promise<SalesDeck[]> {
  const cacheKey = "decks:all"
  const cached = getCached<SalesDeck[]>(cacheKey)
  if (cached) return cached

  const db = getDb()
  const snap = await db.collection(COLLECTION).orderBy("updated_at", "desc").limit(250).get()
  const decks = snap.docs.map(docToDeck)
  setCache(cacheKey, decks)
  return decks
}

export async function getDeckById(id: string): Promise<SalesDeck | null> {
  const db = getDb()
  const doc = await db.collection(COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return docToDeck(doc)
}

// Public share lookup — resolve a deck by its unguessable share_id.
export async function getDeckByShareId(shareId: string): Promise<SalesDeck | null> {
  const db = getDb()
  const snap = await db.collection(COLLECTION).where("share_id", "==", shareId).limit(1).get()
  if (snap.empty) return null
  return docToDeck(snap.docs[0])
}

export async function updateDeck(
  id: string,
  updates: UpdateDeckInput,
): Promise<SalesDeck | null> {
  const db = getDb()
  const FieldValue = admin.firestore.FieldValue
  const ref = db.collection(COLLECTION).doc(id)
  const existing = await ref.get()
  if (!existing.exists) return null

  const patch: Record<string, unknown> = { updated_at: FieldValue.serverTimestamp() }
  if (updates.name !== undefined) patch.name = updates.name
  if (updates.brand !== undefined) patch.brand = updates.brand
  if (updates.slides !== undefined) patch.slides = updates.slides
  if (updates.status !== undefined) {
    patch.status = updates.status
    // Stamp published_at on the first publish; clear it on unpublish (blog pattern).
    if (updates.status === "published") {
      if (!existing.data()?.published_at) patch.published_at = FieldValue.serverTimestamp()
    } else {
      patch.published_at = FieldValue.delete()
    }
  }

  await ref.update(patch)
  clearCache()
  return docToDeck(await ref.get())
}

export async function deleteDeck(id: string): Promise<void> {
  const db = getDb()
  await db.collection(COLLECTION).doc(id).delete()
  clearCache()
}

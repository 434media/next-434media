import { createHash } from "node:crypto"
import { FieldValue } from "firebase-admin/firestore"
import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"

/**
 * Firestore for brand-book shares with vendors (plan v11.2.1 Step 4 item 4): `brand_shares/<id>`, one per share, and
 * `brand_shares/<id>/views/<auto>`, one per opening of the link (deduplicated per minute, at most MAX_STORED_VIEWS kept);
 * `brand_shares/<id>/downloads/<auto>`, one per zip downloaded through the link, with the files it held (Step 4 item 6);
 * and `brand_share_guards`, the daily counter and the repeat key, taken in one transaction with the share. The record is the send's audit record too: who sent
 * which brand and version to whom, when, how (button or command) and the Resend message id.
 *
 * The link's token is never stored: `token_hash` is its sha256 (lib/brand-share.ts), and the landing page finds the
 * share by hashing the token it was given.
 *
 * NO CACHE, deliberately (as brand profiles): a Revoke has to refuse the very next opening of the link, on every
 * instance, so neither the token lookup nor the brand page's list is served from the skill's 30-second cache.
 */
const COLLECTION = CRM_COLLECTIONS.BRAND_SHARES
const GUARDS = CRM_COLLECTIONS.BRAND_SHARE_GUARDS
const VIEWS = "views"
const DOWNLOADS = "downloads"
/** A share's views stored at most: the count keeps going, the time records stop (a link pasted somewhere busy). */
export const MAX_STORED_VIEWS = 200

export type ShareVia = "button" | "command"
export interface BrandShare {
  id: string
  brand_id: string
  brand_label: string
  /** The pinned published version ("milcity@v10") and its number: the vendor sees what was sent. */
  version_id: string
  version_n: number
  recipient_name: string
  recipient_email: string
  /** ISO 3166-1 alpha-2, as the sender stated it (checked against EXCLUDED_COUNTRIES before the send). */
  recipient_country: string
  sender_email: string
  sender_name: string
  via: ShareVia
  token_hash: string
  created_at: string
  expires_at: string
  /** pending until Resend accepts it; failed (and never openable) when it doesn't. */
  status: "pending" | "sent" | "failed"
  resend_message_id: string | null
  error: string | null
  revoked: boolean
  revoked_by: string | null
  revoked_at: string | null
  view_count: number
  last_viewed_at: string | null
  /** Zips downloaded through the link (Step 4 item 6), recorded like views. */
  download_count: number
  last_downloaded_at: string | null
}
export type NewBrandShare = Omit<BrandShare, "id" | "status" | "resend_message_id" | "error" | "revoked" | "revoked_by" | "revoked_at" | "view_count" | "last_viewed_at" | "download_count" | "last_downloaded_at">
export interface ShareView { at: string }
/** One download: when, and the ids of the files in the zip (file names, and `font:<face>`). */
export interface ShareDownload { at: string; files: string[] }
/** The send guards (lib/brand-share-send.ts): the requester's day, the repeat key, the cap and the repeat window. */
export interface ShareGuard { day: string; key: string; cap: number; windowMs: number }
export type Reserved = { ok: true; share: BrandShare } | { ok: false; reason: "cap"; used: number } | { ok: false; reason: "repeat"; shareId: string }

export interface BrandShareStore {
  /** In one transaction: refuses when the requester's counter for the day is at the cap or the repeat key was taken
   * within the window; otherwise records the share, counts it and takes the key. */
  reserve(share: NewBrandShare, guard: ShareGuard): Promise<Reserved>
  markSent(id: string, messageId: string): Promise<void>
  /** Marks the share failed and gives back its count and repeat key. */
  markFailed(id: string, error: string, guard: ShareGuard): Promise<void>
  /** How many shares the requester has counted on `day`. */
  usedOn(senderEmail: string, day: string): Promise<number>
  byTokenHash(hash: string): Promise<BrandShare | null>
  get(id: string): Promise<BrandShare | null>
  /** A brand's shares, newest first. */
  forBrand(brandId: string, limit?: number): Promise<BrandShare[]>
  revoke(id: string, actor: string, at: string): Promise<BrandShare | null>
  /** Records an opening, unless one was recorded in the last minute; the time is kept for the first MAX_STORED_VIEWS. */
  recordView(id: string, at: string): Promise<void>
  views(id: string): Promise<ShareView[]>
  /** Records a download and what it held; the time and files are kept for the first MAX_STORED_VIEWS. */
  recordDownload(id: string, at: string, files: string[]): Promise<void>
  downloads(id: string): Promise<ShareDownload[]>
}

const str = (v: unknown) => typeof v === "string" ? v : ""
const strOrNull = (v: unknown) => typeof v === "string" && v ? v : null
/** An ISO string from whatever the field holds (string, Timestamp or Date); "" when absent. */
function toIsoString(v: unknown): string {
  if (typeof v === "string") return v
  if (v instanceof Date) return v.toISOString()
  if (v && typeof (v as { toDate?: unknown }).toDate === "function") return (v as { toDate: () => Date }).toDate().toISOString()
  return ""
}

/** The requester's counter for a day; the address is hashed so it is not a document id. */
const capId = (senderEmail: string, day: string) => `cap-${createHash("sha256").update(senderEmail.toLowerCase(), "utf8").digest("hex").slice(0, 32)}-${day}`

function normalize(id: string, raw: FirebaseFirestore.DocumentData): BrandShare {
  return {
    id,
    brand_id: str(raw.brand_id), brand_label: str(raw.brand_label) || str(raw.brand_id),
    version_id: str(raw.version_id), version_n: Number(raw.version_n) || 0,
    recipient_name: str(raw.recipient_name), recipient_email: str(raw.recipient_email).toLowerCase(), recipient_country: str(raw.recipient_country),
    sender_email: str(raw.sender_email).toLowerCase(), sender_name: str(raw.sender_name),
    via: raw.via === "command" ? "command" : "button",
    token_hash: str(raw.token_hash),
    created_at: toIsoString(raw.created_at), expires_at: toIsoString(raw.expires_at),
    status: raw.status === "sent" || raw.status === "failed" ? raw.status : "pending",
    resend_message_id: strOrNull(raw.resend_message_id), error: strOrNull(raw.error),
    // Anything but an explicit false is treated as revoked: a malformed record never opens.
    revoked: raw.revoked !== false, revoked_by: strOrNull(raw.revoked_by), revoked_at: strOrNull(toIsoString(raw.revoked_at)),
    view_count: Number(raw.view_count) || 0, last_viewed_at: strOrNull(toIsoString(raw.last_viewed_at)),
    download_count: Number(raw.download_count) || 0, last_downloaded_at: strOrNull(toIsoString(raw.last_downloaded_at)),
  }
}

export function firestoreBrandShares(db: FirebaseFirestore.Firestore = getDb()): BrandShareStore {
  const col = db.collection(COLLECTION), gdb = db.collection(GUARDS)
  const one = async (id: string) => { const s = await col.doc(id).get(); return s.exists ? normalize(s.id, s.data()!) : null }
  return {
    async reserve(share, guard) {
      const capRef = gdb.doc(capId(share.sender_email, guard.day)), keyRef = gdb.doc(`key-${guard.key}`), ref = col.doc()
      return db.runTransaction(async (tx): Promise<Reserved> => {
        const [cap, key] = await Promise.all([tx.get(capRef), tx.get(keyRef)])
        const used = Number(cap.data()?.count) || 0
        const taken = key.exists ? key.data()! : null
        if (taken && Date.parse(share.created_at) - Date.parse(String(taken.at)) < guard.windowMs) return { ok: false, reason: "repeat", shareId: String(taken.share_id) }
        if (used >= guard.cap) return { ok: false, reason: "cap", used }
        const doc = { ...share, status: "pending", resend_message_id: null, error: null, revoked: false, revoked_by: null, revoked_at: null, view_count: 0, last_viewed_at: null, download_count: 0, last_downloaded_at: null }
        tx.create(ref, doc)
        tx.set(capRef, { day: guard.day, count: used + 1 }, { merge: true })
        tx.set(keyRef, { share_id: ref.id, at: share.created_at })
        return { ok: true, share: normalize(ref.id, doc) }
      })
    },
    markSent: async (id, messageId) => { await col.doc(id).update({ status: "sent", resend_message_id: messageId }) },
    async markFailed(id, error, guard) {
      await db.runTransaction(async tx => {
        const snap = await tx.get(col.doc(id))
        if (!snap.exists || snap.data()!.status === "failed") return
        const capRef = gdb.doc(capId(String(snap.data()!.sender_email), guard.day)), keyRef = gdb.doc(`key-${guard.key}`)
        const key = await tx.get(keyRef)
        tx.update(col.doc(id), { status: "failed", error: error.slice(0, 500) })
        tx.set(capRef, { count: FieldValue.increment(-1) }, { merge: true })
        if (key.exists && key.data()!.share_id === id) tx.delete(keyRef)
      })
    },
    usedOn: async (senderEmail, day) => Number((await gdb.doc(capId(senderEmail, day)).get()).data()?.count) || 0,
    async byTokenHash(hash) {
      const snap = await col.where("token_hash", "==", hash).limit(1).get()
      return snap.empty ? null : normalize(snap.docs[0].id, snap.docs[0].data())
    },
    get: one,
    // Single-field equality queries, sorted here: no composite index to deploy.
    forBrand: async (brandId, limit = 50) => (await col.where("brand_id", "==", brandId).get()).docs
      .map(d => normalize(d.id, d.data())).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit),
    async revoke(id, actor, at) {
      const ref = col.doc(id)
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        if (snap.exists && snap.data()!.revoked === false) tx.update(ref, { revoked: true, revoked_by: actor, revoked_at: at })
      })
      return one(id)
    },
    async recordView(id, at) {
      const ref = col.doc(id)
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        if (!snap.exists) return
        const last = toIsoString(snap.data()!.last_viewed_at), count = Number(snap.data()!.view_count) || 0
        // The same link opened again within a minute is one view (a reload, a double tap).
        if (last && Date.parse(at) - Date.parse(last) < 60_000) return
        if (count < MAX_STORED_VIEWS) tx.create(ref.collection(VIEWS).doc(), { at })
        tx.update(ref, { view_count: FieldValue.increment(1), last_viewed_at: at })
      })
    },
    views: async id => (await col.doc(id).collection(VIEWS).orderBy("at", "asc").get()).docs.map(d => ({ at: toIsoString(d.data().at) })),
    async recordDownload(id, at, files) {
      const ref = col.doc(id)
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        if (!snap.exists) return
        if ((Number(snap.data()!.download_count) || 0) < MAX_STORED_VIEWS) tx.create(ref.collection(DOWNLOADS).doc(), { at, files: files.slice(0, 50) })
        tx.update(ref, { download_count: FieldValue.increment(1), last_downloaded_at: at })
      })
    },
    downloads: async id => (await col.doc(id).collection(DOWNLOADS).orderBy("at", "asc").get()).docs
      .map(d => ({ at: toIsoString(d.data().at), files: Array.isArray(d.data().files) ? d.data().files.map(String) : [] })),
  }
}

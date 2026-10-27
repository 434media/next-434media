import { FieldValue } from "firebase-admin/firestore"
import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"

/**
 * Firestore for brand-book shares with vendors (plan v11.2.1 Step 4 item 4): `brand_shares/<id>`, one per share, and
 * `brand_shares/<id>/views/<auto>`, one per opening of the link. The record is the send's audit record too: who sent
 * which brand and version to whom, when, how (button or command) and the Resend message id.
 *
 * The link's token is never stored: `token_hash` is its sha256 (lib/brand-share.ts), and the landing page finds the
 * share by hashing the token it was given.
 *
 * NO CACHE, deliberately (as brand profiles): a Revoke has to refuse the very next opening of the link, on every
 * instance, so neither the token lookup nor the brand page's list is served from the skill's 30-second cache.
 */
const COLLECTION = CRM_COLLECTIONS.BRAND_SHARES
const VIEWS = "views"

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
}
export type NewBrandShare = Omit<BrandShare, "id" | "status" | "resend_message_id" | "error" | "revoked" | "revoked_by" | "revoked_at" | "view_count" | "last_viewed_at">
export interface ShareView { at: string }

export interface BrandShareStore {
  create(share: NewBrandShare): Promise<BrandShare>
  markSent(id: string, messageId: string): Promise<void>
  markFailed(id: string, error: string): Promise<void>
  byTokenHash(hash: string): Promise<BrandShare | null>
  get(id: string): Promise<BrandShare | null>
  /** A brand's shares, newest first. */
  forBrand(brandId: string, limit?: number): Promise<BrandShare[]>
  /** A sender's shares created at or after `since` (the daily cap), any status but failed. */
  sentBySince(senderEmail: string, since: string): Promise<BrandShare[]>
  revoke(id: string, actor: string, at: string): Promise<BrandShare | null>
  recordView(id: string, at: string): Promise<void>
  views(id: string): Promise<ShareView[]>
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
  }
}

export function firestoreBrandShares(db: FirebaseFirestore.Firestore = getDb()): BrandShareStore {
  const col = db.collection(COLLECTION)
  const one = async (id: string) => { const s = await col.doc(id).get(); return s.exists ? normalize(s.id, s.data()!) : null }
  return {
    async create(share) {
      const ref = col.doc()
      const doc = { ...share, status: "pending", resend_message_id: null, error: null, revoked: false, revoked_by: null, revoked_at: null, view_count: 0, last_viewed_at: null }
      await ref.create(doc)
      return normalize(ref.id, doc)
    },
    markSent: async (id, messageId) => { await col.doc(id).update({ status: "sent", resend_message_id: messageId }) },
    markFailed: async (id, error) => { await col.doc(id).update({ status: "failed", error: error.slice(0, 500) }) },
    async byTokenHash(hash) {
      const snap = await col.where("token_hash", "==", hash).limit(1).get()
      return snap.empty ? null : normalize(snap.docs[0].id, snap.docs[0].data())
    },
    get: one,
    // Single-field equality queries, sorted here: no composite index to deploy.
    forBrand: async (brandId, limit = 50) => (await col.where("brand_id", "==", brandId).get()).docs
      .map(d => normalize(d.id, d.data())).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit),
    sentBySince: async (senderEmail, since) => (await col.where("sender_email", "==", senderEmail.toLowerCase()).get()).docs
      .map(d => normalize(d.id, d.data())).filter(s => s.status !== "failed" && s.created_at >= since),
    async revoke(id, actor, at) {
      const ref = col.doc(id)
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        if (snap.exists && snap.data()!.revoked === false) tx.update(ref, { revoked: true, revoked_by: actor, revoked_at: at })
      })
      return one(id)
    },
    async recordView(id, at) {
      const ref = col.doc(id), batch = db.batch()
      batch.create(ref.collection(VIEWS).doc(), { at })
      batch.update(ref, { view_count: FieldValue.increment(1), last_viewed_at: at })
      await batch.commit()
    },
    views: async id => (await col.doc(id).collection(VIEWS).orderBy("at", "asc").get()).docs.map(d => ({ at: toIsoString(d.data().at) })),
  }
}

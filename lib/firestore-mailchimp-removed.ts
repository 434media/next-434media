import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type { UnpushableReason } from "./mailchimp-push-plan"

/**
 * Contacts Mailchimp permanently deleted (founder, 2026-11-18). Mailchimp refuses to re-import such an address
 * ("was permanently deleted and cannot be re-imported. The contact must re-subscribe"), and some of these people
 * asked to be removed. So the hourly push records the refusal here and skips the address from then on, the daily
 * full pass included. Nothing is deleted: the signup and registration records stay as they are.
 *
 * One document per address, id = the lowercased email (as `email_suppression`), because the contact's records are
 * spread across four databases and another project's, some of them written by other sites; this is the one place
 * the mark can live. The mark clears when the person gives consent again: a consented newsletter form deletes it
 * (lib/newsletter-subscribe.ts), and any consent record dated after `removed_at` lifts it at read time
 * (stillRemoved in lib/mailchimp-push-plan.ts).
 *
 * Addresses Mailchimp judges fake or invalid ("looks fake or invalid", founder, 2026-11-20) are marked the same way,
 * with reason "invalid_address". Those stay skipped whatever the consent, until the contact's address changes.
 *
 * Never cached: the cron must see the previous run's marks and a form's clear at once.
 */
const COLLECTION = CRM_COLLECTIONS.MAILCHIMP_REMOVED

export interface MailchimpRemovedRecord {
  email: string
  /** Why Mailchimp refused. A record with none predates "invalid_address" and is "permanently_deleted". */
  reason: UnpushableReason
  /** ISO time the refusal was last recorded. */
  removed_at: string
}

/** Document id for an address. Firestore ids cannot hold "/", which an address may. */
function docId(email: string): string {
  return email.replace(/\//g, "%2F")
}

function toIso(v: unknown): string {
  if (typeof v === "string") return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") return (v as { toDate: () => Date }).toDate().toISOString()
  return ""
}

export interface MailchimpRemovedMark {
  removedAt: string
  reason: UnpushableReason
}

/** Every marked address (lowercased) → when its refusal was recorded, and why. */
export async function getMailchimpRemoved(): Promise<Map<string, MailchimpRemovedMark>> {
  const snap = await getDb().collection(COLLECTION).get()
  const out = new Map<string, MailchimpRemovedMark>()
  for (const d of snap.docs) {
    const data = d.data()
    const email = String(data.email ?? d.id).toLowerCase().trim()
    const reason: UnpushableReason = data.reason === "invalid_address" ? "invalid_address" : "permanently_deleted"
    if (email) out.set(email, { removedAt: toIso(data.removed_at), reason })
  }
  return out
}

/** Records each refusal. Idempotent: a later refusal moves `removed_at` (and sets the latest reason). */
export async function markMailchimpRemoved(
  marks: Array<{ email: string; reason: UnpushableReason }>,
  at: string,
): Promise<void> {
  const unique = new Map<string, UnpushableReason>()
  for (const m of marks) {
    const email = m.email.toLowerCase().trim()
    if (email) unique.set(email, m.reason)
  }
  const entries = [...unique]
  const db = getDb()
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch()
    for (const [email, reason] of entries.slice(i, i + 400)) {
      const rec: MailchimpRemovedRecord = { email, reason, removed_at: at }
      batch.set(db.collection(COLLECTION).doc(docId(email)), rec)
    }
    await batch.commit()
  }
}

/** Clears the mark after the person subscribes again through a consented form. No-op when there is none. */
export async function clearMailchimpRemoved(email: string): Promise<void> {
  const e = email.toLowerCase().trim()
  if (!e) return
  await getDb().collection(COLLECTION).doc(docId(e)).delete()
}

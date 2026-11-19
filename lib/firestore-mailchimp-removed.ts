import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"

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
 * Never cached: the cron must see the previous run's marks and a form's clear at once.
 */
const COLLECTION = CRM_COLLECTIONS.MAILCHIMP_REMOVED

export interface MailchimpRemovedRecord {
  email: string
  /** Why Mailchimp refused. Only "permanently_deleted" today. */
  reason: "permanently_deleted"
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

/** Every marked address (lowercased) → when its refusal was recorded. */
export async function getMailchimpRemoved(): Promise<Map<string, string>> {
  const snap = await getDb().collection(COLLECTION).get()
  const out = new Map<string, string>()
  for (const d of snap.docs) {
    const data = d.data()
    const email = String(data.email ?? d.id).toLowerCase().trim()
    if (email) out.set(email, toIso(data.removed_at))
  }
  return out
}

/** Records Mailchimp's permanent-deletion refusal for each address. Idempotent: a later refusal moves `removed_at`. */
export async function markMailchimpRemoved(emails: string[], at: string): Promise<void> {
  const unique = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))]
  const db = getDb()
  for (let i = 0; i < unique.length; i += 400) {
    const batch = db.batch()
    for (const email of unique.slice(i, i + 400)) {
      const rec: MailchimpRemovedRecord = { email, reason: "permanently_deleted", removed_at: at }
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

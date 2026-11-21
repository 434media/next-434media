import { getDb } from "./firebase-admin"

// Email suppression list for broadcasts. A suppressed email is never sent to,
// regardless of opt-in status — the record of someone who unsubscribed from a
// Resend broadcast (the unsubscribe route writes here, and also writes the
// opt-out back to Mailchimp so consent stays single-sourced).
//
// Doc id = lowercased email, so writes are naturally idempotent.

const COLLECTION = "email_suppression"

export interface SuppressionRecord {
  email: string
  reason: string
  ts: string
}

/** All suppressed emails (lowercased), as a Set for fast exclusion. */
export async function getSuppressedEmails(): Promise<Set<string>> {
  const snap = await getDb().collection(COLLECTION).get()
  return new Set(snap.docs.map((d) => String(d.data().email ?? "").toLowerCase()))
}

export async function addSuppression(email: string, reason: string): Promise<void> {
  const e = email.toLowerCase().trim()
  if (!e) return
  await getDb()
    .collection(COLLECTION)
    .doc(e)
    .set({ email: e, reason, ts: new Date().toISOString() }, { merge: true })
}

/**
 * Suppresses each address not already suppressed, in batches. An existing record is left as it is, so its first
 * reason and time stand (an unsubscribe-link record is never relabelled). Returns how many were added.
 */
export async function addSuppressions(emails: string[], reason: string, at = new Date().toISOString()): Promise<number> {
  const unique = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))]
  if (!unique.length) return 0
  const db = getDb()
  const existing = new Set<string>()
  for (let i = 0; i < unique.length; i += 300) {
    const refs = unique.slice(i, i + 300).map((e) => db.collection(COLLECTION).doc(e))
    for (const d of await db.getAll(...refs)) if (d.exists) existing.add(d.id)
  }
  const fresh = unique.filter((e) => !existing.has(e))
  for (let i = 0; i < fresh.length; i += 400) {
    const batch = db.batch()
    for (const e of fresh.slice(i, i + 400)) batch.set(db.collection(COLLECTION).doc(e), { email: e, reason, ts: at })
    await batch.commit()
  }
  return fresh.length
}

export async function isSuppressed(email: string): Promise<boolean> {
  const doc = await getDb().collection(COLLECTION).doc(email.toLowerCase().trim()).get()
  return doc.exists
}

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

export async function isSuppressed(email: string): Promise<boolean> {
  const doc = await getDb().collection(COLLECTION).doc(email.toLowerCase().trim()).get()
  return doc.exists
}

import { getDb } from "./firebase-admin"

// Per-campaign sent ledger — prevents double-emailing the same person across
// multiple broadcasts of the same campaign (e.g. a second audience that overlaps
// a first send). Each recipient is recorded under a campaign key; the next send
// of that campaign excludes anyone already in the ledger.

const COLLECTION = "broadcast_sends"
const docId = (campaign: string, email: string) => `${campaign}__${email.toLowerCase().trim()}`

/** Set of emails already sent for this campaign. */
export async function getSentEmails(campaign: string): Promise<Set<string>> {
  const snap = await getDb().collection(COLLECTION).where("campaign", "==", campaign).get()
  return new Set(snap.docs.map((d) => String(d.data().email ?? "").toLowerCase()))
}

/** Record that these emails were sent for this campaign (idempotent by doc id). */
export async function recordSent(
  campaign: string,
  emails: string[],
  broadcastId: string,
): Promise<void> {
  const db = getDb()
  const ts = new Date().toISOString()
  for (let i = 0; i < emails.length; i += 400) {
    const batch = db.batch()
    for (const raw of emails.slice(i, i + 400)) {
      const email = raw.toLowerCase().trim()
      if (!email) continue
      batch.set(
        db.collection(COLLECTION).doc(docId(campaign, email)),
        { campaign, email, broadcastId, ts },
        { merge: true },
      )
    }
    await batch.commit()
  }
}

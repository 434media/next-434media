import { getDb } from "./firebase-admin"

/**
 * Per-submission state on top of email_signups / contact_forms /
 * event_registrations — without modifying those collections.
 *
 * State lives in a sidecar collection `submission_states`, doc id =
 * `${sourceCollection}:${sourceId}`. No record → "new" (the default for
 * any submission we haven't touched yet). This means the source-of-truth
 * collections stay byte-identical to today.
 *
 * Used by /admin/leads to flag what's been triaged / replied / archived
 * and to support bulk actions across multiple submissions.
 */

const COLLECTION = "submission_states"

export type SubmissionSourceCollection =
  | "email_signups"
  | "contact_forms"
  | "event_registrations"

export type SubmissionState = "new" | "triaged" | "replied" | "archived" | "spam"

export const VALID_STATES: SubmissionState[] = ["new", "triaged", "replied", "archived", "spam"]

export interface SubmissionStateRecord {
  /** Composite doc id: `${source}:${sourceId}` */
  id: string
  source: SubmissionSourceCollection
  sourceId: string
  state: SubmissionState
  updatedBy: string
  updatedAt: string
}

function compositeId(source: SubmissionSourceCollection, sourceId: string): string {
  return `${source}:${sourceId}`
}

/**
 * Batch-fetch states for many submissions in one read. Returns a Map keyed
 * by sourceId (since the caller already knows the source collection).
 *
 * Uses Firestore's getAll for the batch — single round trip regardless of
 * how many ids are passed.
 */
export async function getStatesForSubmissions(
  source: SubmissionSourceCollection,
  sourceIds: string[],
): Promise<Map<string, SubmissionState>> {
  const result = new Map<string, SubmissionState>()
  if (sourceIds.length === 0) return result

  const db = getDb()
  const refs = sourceIds.map((id) => db.collection(COLLECTION).doc(compositeId(source, id)))

  // Firestore caps getAll at 100 reads per call — chunk for safety.
  const chunkSize = 100
  for (let i = 0; i < refs.length; i += chunkSize) {
    const chunk = refs.slice(i, i + chunkSize)
    const snapshots = await db.getAll(...chunk)
    for (let j = 0; j < snapshots.length; j++) {
      const snap = snapshots[j]
      if (snap.exists) {
        const data = snap.data()
        if (data?.state && VALID_STATES.includes(data.state as SubmissionState)) {
          result.set(sourceIds[i + j], data.state as SubmissionState)
        }
      }
    }
  }

  return result
}

/**
 * Set state for one submission. Pass state="new" to delete the record (so the
 * sidecar collection stays sparse — no entries for unmodified submissions).
 */
export async function setSubmissionState(
  source: SubmissionSourceCollection,
  sourceId: string,
  state: SubmissionState,
  updatedBy: string,
): Promise<void> {
  const db = getDb()
  const ref = db.collection(COLLECTION).doc(compositeId(source, sourceId))

  if (state === "new") {
    // Delete the sidecar record — back to implicit default.
    await ref.delete().catch(() => {
      /* doc may not exist; that's fine */
    })
    return
  }

  await ref.set({
    source,
    sourceId,
    state,
    updatedBy,
    updatedAt: new Date().toISOString(),
  })
}

interface BulkUpdate {
  source: SubmissionSourceCollection
  sourceId: string
  state: SubmissionState
}

/**
 * Apply state changes across many submissions in one transaction. Used by
 * the bulk action bar on the Submissions page.
 */
export async function bulkSetSubmissionStates(
  updates: BulkUpdate[],
  updatedBy: string,
): Promise<{ success: number; failed: number }> {
  if (updates.length === 0) return { success: 0, failed: 0 }
  const db = getDb()
  const now = new Date().toISOString()

  // Firestore batch caps at 500 writes — chunk for safety.
  const chunkSize = 500
  let success = 0
  let failed = 0

  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    const batch = db.batch()
    for (const u of chunk) {
      const ref = db.collection(COLLECTION).doc(compositeId(u.source, u.sourceId))
      if (u.state === "new") {
        batch.delete(ref)
      } else {
        batch.set(ref, {
          source: u.source,
          sourceId: u.sourceId,
          state: u.state,
          updatedBy,
          updatedAt: now,
        })
      }
    }
    try {
      await batch.commit()
      success += chunk.length
    } catch (err) {
      console.error("[bulkSetSubmissionStates] batch failed:", err)
      failed += chunk.length
    }
  }

  return { success, failed }
}

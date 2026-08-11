import admin from "firebase-admin"
import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type { Asset, GenerationJob, MediaKind } from "../components/crm/types"

// Async AI-generation jobs — a lightweight holder for a video generation while
// it runs (minutes), decoupled from content posts. The client polls the job;
// when complete it carries the generated Asset. Image generation is synchronous
// and never creates a job. No in-memory cache: jobs are read-once by polling and
// must reflect the latest write immediately.

const COLLECTION = CRM_COLLECTIONS.GENERATION_JOBS

// A job is finished by the after() callback that started it. If that callback is
// killed mid-flight — function timeout, redeploy, crash — nothing is left to
// write the failure, and the job stays "pending" forever. So any job still
// pending past the point where its callback *cannot* still be alive is resolved
// on read (see getGenerationJob).
//
// This must stay above `maxDuration` in app/api/admin/crm/generate-asset/route.ts
// (800s) — that's the platform's hard kill, so a job younger than it may still
// be legitimately generating. Raise this if you raise that.
const STALE_PENDING_MS = 14 * 60 * 1000

const STALE_PENDING_ERROR =
  "Generation was cut off before it finished — this usually means the clip took too long to render. Try again, or shorten the clip."

function toIso(value: unknown): string {
  const Timestamp = admin.firestore.Timestamp
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === "string") return value
  return new Date().toISOString()
}

export async function createGenerationJob(input: {
  kind: MediaKind
  model: string
  prompt: string
  created_by: string
}): Promise<GenerationJob> {
  const db = getDb()
  const FieldValue = admin.firestore.FieldValue
  const ref = await db.collection(COLLECTION).add({
    status: "pending",
    kind: input.kind,
    model: input.model,
    prompt: input.prompt,
    created_by: input.created_by,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  })
  const doc = await ref.get()
  const data = doc.data()!
  return {
    ...data,
    id: doc.id,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  } as GenerationJob
}

export async function getGenerationJob(id: string): Promise<GenerationJob | null> {
  const db = getDb()
  const doc = await db.collection(COLLECTION).doc(id).get()
  if (!doc.exists) return null
  const data = doc.data()!
  const job = {
    ...data,
    id: doc.id,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  } as GenerationJob

  // Self-heal an abandoned job (see STALE_PENDING_MS). Read-time rather than a
  // sweeper job: the client polls this every 5s, so the row that matters is
  // always the one being looked at. A write failure here is non-fatal — the
  // caller still gets the failed status, and the next poll retries the write.
  if (job.status === "pending" && Date.now() - new Date(job.created_at).getTime() > STALE_PENDING_MS) {
    const FieldValue = admin.firestore.FieldValue
    await db
      .collection(COLLECTION)
      .doc(id)
      .update({ status: "failed", error: STALE_PENDING_ERROR, updated_at: FieldValue.serverTimestamp() })
      .catch((err) => console.error(`[generation-jobs] stale sweep failed for ${id}:`, err))
    return { ...job, status: "failed", error: STALE_PENDING_ERROR }
  }

  return job
}

// Mark a job complete with its generated asset, or failed with an error.
export async function finishGenerationJob(
  id: string,
  outcome: { asset: Asset } | { error: string },
): Promise<void> {
  const db = getDb()
  const FieldValue = admin.firestore.FieldValue
  const patch =
    "asset" in outcome
      ? { status: "completed", asset: outcome.asset }
      : { status: "failed", error: outcome.error }
  await db
    .collection(COLLECTION)
    .doc(id)
    .update({ ...patch, updated_at: FieldValue.serverTimestamp() })
}

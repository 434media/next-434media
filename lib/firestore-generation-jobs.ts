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
  return {
    ...data,
    id: doc.id,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  } as GenerationJob
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

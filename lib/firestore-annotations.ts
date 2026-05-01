import { getDb } from "./firebase-admin"

/**
 * Chart annotations — pinned notes on the analytics page.
 *
 * Use case: "We launched the homepage redesign on Mar 12" — capture context
 * once, then every time someone looks at the chart later they see the flag
 * and understand why traffic spiked. Mixpanel / Amplitude / Vercel pattern.
 *
 * Scoped per GA4 property so each brand site has its own annotations.
 */

const COLLECTION = "analytics_annotations"

export interface Annotation {
  id: string
  /** GA4 property id this annotation belongs to. */
  propertyId: string
  /** YYYY-MM-DD — the day the annotation pins to. */
  date: string
  /** Short label, shown on the chart (~20 chars max for readability). */
  label: string
  /** Optional longer-form note, shown in the manager popover. */
  note?: string
  /** Email of the user who created the annotation. */
  createdBy: string
  /** ISO timestamp. */
  createdAt: string
}

export async function getAnnotations(propertyId: string): Promise<Annotation[]> {
  const db = getDb()
  const snap = await db
    .collection(COLLECTION)
    .where("propertyId", "==", propertyId)
    .orderBy("date", "desc")
    .get()
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      propertyId: data.propertyId,
      date: data.date,
      label: data.label,
      note: data.note || undefined,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
    }
  })
}

export interface CreateAnnotationInput {
  propertyId: string
  date: string
  label: string
  note?: string
  createdBy: string
}

export async function createAnnotation(input: CreateAnnotationInput): Promise<Annotation> {
  const db = getDb()
  const now = new Date().toISOString()
  const doc = {
    propertyId: input.propertyId,
    date: input.date,
    label: input.label.slice(0, 80), // hard cap so chart labels stay readable
    note: input.note || null,
    createdBy: input.createdBy,
    createdAt: now,
  }
  const ref = await db.collection(COLLECTION).add(doc)
  return {
    id: ref.id,
    propertyId: doc.propertyId,
    date: doc.date,
    label: doc.label,
    note: doc.note || undefined,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  }
}

export async function deleteAnnotation(id: string): Promise<void> {
  const db = getDb()
  await db.collection(COLLECTION).doc(id).delete()
}

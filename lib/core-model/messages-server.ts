// Writes a message record (lib/core-model/messages.ts) to the CRM: one Activity in `crm_activities`, plus, only for a
// broadcast whose recipient list is too long for one document, its overflow parts in `crm_message_recipients`.
// Nothing is written to a Person or a lead. The sink is injectable so each send path's wiring is tested offline, and
// Firestore is imported only when the live sink writes, so importing this module never loads the Admin SDK.

import { CRM_COLLECTIONS } from "@/types/crm-types"
import { buildMessageRecord, type MessageInput, type MessageRecord } from "./messages"
import type { ActivityInput } from "./activity"

export interface MessageSink {
  /** Write-once. False when a record with this id already exists. */
  createActivity(id: string, activity: ActivityInput): Promise<boolean>
  createRecipientPart(part: MessageRecord["recipientParts"][number]): Promise<void>
}

/** Firestore rejects `undefined` at any depth; a message record is plain JSON, so a round trip drops it. */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export const firestoreMessageSink: MessageSink = {
  async createActivity(id, activity) {
    const { createActivityWithId } = await import("@/lib/firestore-activities")
    const created = await createActivityWithId(id, plain(activity))
    if (created) {
      // The core view caches for 30 s; a new message should show on the Person's timeline at once.
      const { invalidateCoreView } = await import("./read")
      invalidateCoreView()
    }
    return created
  },
  async createRecipientPart(part) {
    const { getDb } = await import("@/lib/firebase-admin")
    await getDb()
      .collection(CRM_COLLECTIONS.MESSAGE_RECIPIENTS)
      .doc(part.id.replace(/\//g, "_"))
      .set({ activity_id: part.activity_id, part: part.part, emails: part.emails, created_at: new Date().toISOString() })
  },
}

export type RecordOutcome = { recorded: true; id: string; duplicate: boolean } | { recorded: false; error: string }

/**
 * Record one message. Never throws: by the time this runs the message has been sent (or received), so a failure to
 * record is logged loudly and returned, and the caller reports it rather than pretending the send failed.
 */
export async function recordMessage(input: MessageInput, sink: MessageSink = firestoreMessageSink): Promise<RecordOutcome> {
  try {
    const rec = buildMessageRecord(input)
    const created = await sink.createActivity(rec.id, rec.activity)
    if (created) for (const part of rec.recipientParts) await sink.createRecipientPart(part)
    return { recorded: true, id: rec.id, duplicate: !created }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    // No body, subject or address in the log: only the path and the provider id.
    console.error(`[messages] NOT RECORDED path=${input.path} message_id=${input.messageId ?? "none"}: ${error}`)
    return { recorded: false, error }
  }
}

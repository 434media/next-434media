import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import { safeDocId } from "./core-model/firestore-util"
import { invalidateActivities } from "./firestore-activities"

/**
 * Undo only (lib/core-model/service.ts undoTriage, within its window): the triage record goes and the activity is back
 * in the inbox. Kept apart from lib/firestore-activities.ts, whose Activities are never updated or deleted; a triage
 * record is a decision about an Activity, not the Activity. The undo is logged on the server.
 */
export async function removeTriage(activityId: string): Promise<void> {
  await getDb().collection(CRM_COLLECTIONS.ACTIVITY_TRIAGE).doc(safeDocId(activityId)).delete()
  console.info(`[triage] undone: ${activityId}`)
  invalidateActivities()
}

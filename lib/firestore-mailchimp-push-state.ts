import { getDb } from "./firebase-admin"
import { CRON_HEARTBEATS_COLLECTION } from "./cron-heartbeat"

/**
 * What the hourly Mailchimp push remembers between runs: the fingerprints of the
 * members it last pushed successfully, and when the current full pass began
 * (lib/mailchimp-push-plan.ts). Stored with the cron's own record, one document
 * at `cron_heartbeats/mailchimp-push/state/push`, overwritten in place. A
 * subcollection, so the watchdog's read of `cron_heartbeats` never loads it.
 *
 * Never cached: each run must read what the previous run wrote.
 */
const JOB = "mailchimp-push"

function stateRef() {
  return getDb().collection(CRON_HEARTBEATS_COLLECTION).doc(JOB).collection("state").doc("push")
}

export interface MailchimpPushState {
  /** Fingerprints (12 hex characters each) of members pushed and unchanged since. */
  sent: Set<string>
  /** ISO time the current full pass began; absent until the first one. */
  lastFullPassAt?: string
}

/** 12 hex characters and a comma each. Firestore's document limit is 1 MiB. */
const MAX_SENT_CHARS = 900_000

export async function readMailchimpPushState(): Promise<MailchimpPushState> {
  const snap = await stateRef().get()
  const raw = snap.exists ? snap.data() ?? {} : {}
  const sentStr = typeof raw.sent === "string" ? raw.sent : ""
  return {
    sent: new Set(sentStr ? sentStr.split(",") : []),
    ...(typeof raw.lastFullPassAt === "string" ? { lastFullPassAt: raw.lastFullPassAt } : {}),
  }
}

export async function writeMailchimpPushState(state: {
  sent: string[]
  lastFullPassAt: string
  updatedAt: string
  pending: number
}): Promise<void> {
  const sent = state.sent.join(",")
  if (sent.length > MAX_SENT_CHARS) {
    // Roughly 69,000 contacts. Fail loudly rather than write a document Firestore refuses.
    throw new Error(`Mailchimp push state too large (${state.sent.length} members); shard it before the list grows further`)
  }
  await stateRef().set({
    sent,
    count: state.sent.length,
    lastFullPassAt: state.lastFullPassAt,
    updatedAt: state.updatedAt,
    pending: state.pending,
  })
}

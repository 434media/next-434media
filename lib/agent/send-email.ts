/**
 * Sends one approved email, through every control (434 build sequence V1 item 4, the proof slice): only an approved,
 * unexpired, unconsumed, hash-matched draft sends, and the kill switch is read immediately before the provider is called.
 *
 *  1. The kill switch and the path's send flag, read now. Off: nothing happens beyond a `kill_blocked` entry.
 *  2. The recipients, against the allow-list. In the proof slice the list is the provider's test sink only, so no person
 *     can receive anything; real recipients wait for V1 item 6 (the intake suite passing and the founder's unlock).
 *  3. Claim (one run only), then intent (from here the approval can never send again), each with its ledger entry.
 *  4. The kill switch again, immediately before the provider call. Stopped: the approval is spent, nothing went out.
 *  5. The provider call, with the intent id as its idempotency key. A failure or a lost answer is `outcome unknown`: a
 *     person reconciles it, and nothing retries.
 *  6. The receipt, the approval marked consumed, the sent text kept in full on the CRM (#300's message record, one
 *     Activity in `crm_activities`) and the `sent` entry, in one transaction.
 *
 * Nothing calls this yet: the founder-review queue (PR 3 of the proof slice) is its first caller.
 */
import { CRM_COLLECTIONS } from "../../types/crm-types"
import { addressOf, buildMessageRecord } from "../core-model/messages"
import { contactFormReplyMessage } from "../core-model/message-paths"
import { safeDocId, stripUndefined } from "../core-model/firestore-util"
import {
  ApprovalBlocked,
  abortBeforeDispatch,
  claimSend,
  contentHash,
  markOutcomeUnknown,
  recordIntent,
  recordReceipt,
  type EmailPayload,
  type SendApproval,
} from "../send-approval"
import { sendAllowed, type AgentControls } from "./controls"
import { step, type AgentDb, type AgentTx } from "./ledger-server"

export const SEND_APPROVALS_COLLECTION = CRM_COLLECTIONS.SEND_APPROVALS

/**
 * Who may receive a send in the proof slice: Resend's test address, which accepts and reports delivery and reaches no
 * one (resend.com/docs/dashboard/emails/send-test-emails). The labelled form is the same test address ("All test
 * email addresses support labeling"), so a proof run can reject a second draft without the 72-hour duplicate guard
 * refusing it (2026-11-17). Widening this list beyond Resend's test address is V1 item 6, on the founder's word.
 */
export const TEST_SINK_RECIPIENTS: readonly string[] = ["delivered@resend.dev", "delivered+reject@resend.dev"]

/** Null when every recipient is allowed; otherwise why not. Compared by address, lower-cased. */
export function recipientRefusal(to: string[], allow: readonly string[] = TEST_SINK_RECIPIENTS): string | null {
  if (to.length !== 1) return "a reply goes to exactly one recipient"
  const allowed = new Set(allow.map((a) => a.toLowerCase()))
  return to.every((t) => allowed.has(addressOf(t))) ? null : "a recipient is outside the allow-list"
}

export interface SendDeps {
  db: AgentDb
  /** The kill switch, read uncached each call (lib/agent/controls.ts readAgentControls). */
  controls: () => Promise<AgentControls>
  /** The provider. `idempotencyKey` is the intent id, so a repeated call cannot send twice. */
  dispatch: (payload: EmailPayload, idempotencyKey: string) => Promise<{ messageId: string }>
  now: () => string
  /** This send's run id. */
  runId: string
  /** Who started the send: "founder" for the queue's Approve & send. */
  actor: string
  allow?: readonly string[]
  /** After the CRM record is written (the core view's cache). */
  afterRecord?: () => void
}

export type SendResult =
  | { sent: true; messageId: string; activityId: string; recorded: true }
  | { sent: true; messageId: string; recorded: false; error: string }
  | { sent: false; code: string; reason: string; uncertain?: boolean }

const approvalOf = (raw: unknown, id: string): SendApproval => {
  if (!raw) throw new ApprovalBlocked(`No approval ${id}`)
  return raw as SendApproval
}

export async function sendApprovedEmail(approvalId: string, deps: SendDeps): Promise<SendResult> {
  const first = approvalOf(await deps.db.run((tx) => tx.getDoc<SendApproval>(SEND_APPROVALS_COLLECTION, approvalId)), approvalId)
  const taskId = first.taskId
  const note = (kind: "kill_blocked" | "send_refused", reasonCode: string) =>
    step(deps.db, { taskId, at: deps.now(), decide: () => ({ fields: { kind, actor: deps.actor, refs: { approval: approvalId, run: deps.runId }, reasonCode } }) })

  // 1. The switch, now.
  if (!sendAllowed(await deps.controls(), first.path)) {
    await note("kill_blocked", "sends-stopped")
    return { sent: false, code: "sends-stopped", reason: "Sending is stopped or off for this path" }
  }
  // 2. The recipients.
  const refusal = recipientRefusal(first.payload.to, deps.allow)
  if (refusal) {
    await note("send_refused", "recipient-not-allowed")
    return { sent: false, code: "recipient-not-allowed", reason: refusal }
  }

  // 3. Claim, then intent. Each refuses unless the approval is sendable (approved, intact, unexpired, unconsumed, due).
  const readApproval = async (tx: AgentTx) => approvalOf(await tx.getDoc<SendApproval>(SEND_APPROVALS_COLLECTION, approvalId), approvalId)
  try {
    await step(deps.db, {
      taskId,
      at: deps.now(),
      read: readApproval,
      decide: (task, a) => {
        if (task.cancelled) throw new ApprovalBlocked("The task was cancelled")
        const next = claimSend(a, deps.runId, deps.now())
        return {
          fields: { kind: "send_claimed", actor: deps.actor, refs: { approval: approvalId, run: deps.runId }, hashes: { approval: a.hash } },
          to: "sending",
          write: (tx) => tx.setDoc(SEND_APPROVALS_COLLECTION, approvalId, next),
        }
      },
    })
  } catch (e) {
    if (!(e instanceof ApprovalBlocked)) throw e
    await note("send_refused", "not-sendable")
    return { sent: false, code: "not-sendable", reason: e.message }
  }
  let approval!: SendApproval
  await step(deps.db, {
    taskId,
    at: deps.now(),
    read: readApproval,
    decide: (_task, a) => {
      approval = recordIntent(a, deps.runId, deps.now())
      return {
        fields: { kind: "send_intent", actor: deps.actor, refs: { approval: approvalId, run: deps.runId }, hashes: { approval: a.hash } },
        write: (tx) => tx.setDoc(SEND_APPROVALS_COLLECTION, approvalId, approval),
      }
    },
  })
  const intentId = approval.intent!.id

  // 4. The switch again, immediately before the provider. Stopped: nothing has gone, and this approval never will.
  if (!sendAllowed(await deps.controls(), approval.path)) {
    await step(deps.db, {
      taskId,
      at: deps.now(),
      read: readApproval,
      decide: (_task, a) => {
        const next = abortBeforeDispatch(a, deps.runId, deps.now(), "Stopped between the intent and the send")
        return {
          fields: { kind: "kill_blocked", actor: deps.actor, refs: { approval: approvalId, run: deps.runId }, reasonCode: "stopped-before-dispatch" },
          to: "failed",
          write: (tx) => tx.setDoc(SEND_APPROVALS_COLLECTION, approvalId, next),
        }
      },
    })
    return { sent: false, code: "stopped-before-dispatch", reason: "Sending was stopped before this message went; nothing was sent" }
  }

  // 5. The provider.
  let messageId: string
  try {
    messageId = (await deps.dispatch(approval.payload, intentId)).messageId
    if (!messageId) throw new Error("The provider returned no message id")
  } catch (e) {
    console.error(`[agent:send] outcome unknown for approval ${approvalId} (intent ${intentId}):`, e instanceof Error ? e.message : e)
    await step(deps.db, {
      taskId,
      at: deps.now(),
      read: readApproval,
      decide: (_task, a) => {
        const next = markOutcomeUnknown(a, deps.runId, deps.now(), "The provider call failed or its answer was lost")
        return {
          fields: { kind: "send_outcome_unknown", actor: deps.actor, refs: { approval: approvalId, run: deps.runId }, reasonCode: "provider-error" },
          to: "needs_reconciliation",
          write: (tx) => tx.setDoc(SEND_APPROVALS_COLLECTION, approvalId, next),
        }
      },
    })
    return { sent: false, code: "outcome-unknown", reason: "The send may or may not have gone; a person checks before anything else", uncertain: true }
  }

  // 6. Receipt, consumed, the CRM record and the ledger entry, together.
  const at = deps.now()
  const record = buildMessageRecord(
    contactFormReplyMessage({
      from: approval.payload.from,
      to: approval.payload.to[0],
      replyTo: approval.payload.replyTo,
      subject: approval.payload.subject,
      text: approval.payload.text,
      messageId,
      at,
      sentBy: approval.approval?.by,
    }),
  )
  try {
    await step(deps.db, {
      taskId,
      at,
      read: readApproval,
      decide: (_task, a) => {
        const next = recordReceipt(a, deps.runId, messageId, at)
        return {
          fields: {
            kind: "sent",
            actor: deps.actor,
            refs: { approval: approvalId, run: deps.runId, activity: safeDocId(record.id), message: safeDocId(record.id) },
            hashes: { approval: a.hash, sent: contentHash(a.payload) },
          },
          to: "sent",
          write: (tx) => {
            tx.setDoc(SEND_APPROVALS_COLLECTION, approvalId, next)
            tx.createDoc(CRM_COLLECTIONS.ACTIVITIES, safeDocId(record.id), stripUndefined({ ...record.activity, created_at: at }))
          },
        }
      },
    })
  } catch (e) {
    // The message went. The record failed: said loudly, never hidden, and the approval still shows the intent.
    const error = e instanceof Error ? e.message : String(e)
    console.error(`[agent:send] SENT BUT NOT RECORDED approval=${approvalId} message_id=${messageId}: ${error}`)
    return { sent: true, messageId, recorded: false, error }
  }
  deps.afterRecord?.()
  return { sent: true, messageId, activityId: safeDocId(record.id), recorded: true }
}

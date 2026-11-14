/**
 * The founder-review queue's actions and the console's reads (434 build sequence V1 item 4, the proof slice, PR 3).
 *
 *  - `decideApproval`: the founder's approve or reject, on the hash he was shown, with a reason. In one transaction:
 *    the decision on the approval, a decision-memory record about the contact (`crm_decisions`), and the ledger entry.
 *  - `sendApproval`: the send, through lib/agent/send-email.ts (approval, expiry, consumed and hash checked; the kill
 *    switch read immediately before Resend; the sent text kept in full on the CRM).
 *  - `setControls`, `stopAgents`: the kill switch. A stop also cancels open tasks and sends in-flight ones to a person.
 *  - `readConsole`: everything the queue page shows.
 *
 * Every caller is a founder-only route. Nothing here decides who may act: the route's guard does.
 */
import { randomUUID } from "node:crypto"
import { CRM_COLLECTIONS } from "../../types/crm-types"
import { decide, ApprovalBlocked } from "../send-approval"
import { buildDecision } from "../core-model/decisions"
import { AGENT_CONTROLS_DOC, SKILL_MODES, parseControls, readAgentControls, type AgentControls, type SkillMode } from "./controls"
import { AGENT_LEDGER_COLLECTION, AGENT_TASKS_COLLECTION, OPEN_STATES, planStop, type AgentTask, type LedgerEntry } from "./ledger"
import { applyStop, firestoreAgentDb, step, type AgentDb } from "./ledger-server"
import { SEND_APPROVALS_COLLECTION, sendApprovedEmail, type SendResult } from "./send-email"
import { INTAKE_SKILL } from "./intake"
import { REASON_CODES, WEEK_MS, costSummary, groupReasons, handoffWaits, reviewItem, runSummary, sortQueue, type StoredApproval } from "./review"

const db = (): AgentDb => firestoreAgentDb()

export interface DecideInput {
  approvalId: string
  decision: "approved" | "rejected"
  shownHash: string
  reasonCode: string
  reason: string
}

/** The decision, the decision-memory record and the ledger entry, together. */
export async function decideApproval(input: DecideInput, now = new Date().toISOString(), store: AgentDb = db()): Promise<StoredApproval> {
  const codes = (input.decision === "approved" ? REASON_CODES.approve : REASON_CODES.reject).map((r) => r.code as string)
  if (!codes.includes(input.reasonCode)) throw new ApprovalBlocked("Pick a reason from the list")
  const first = await store.run((tx) => tx.getDoc<StoredApproval>(SEND_APPROVALS_COLLECTION, input.approvalId))
  if (!first) throw new ApprovalBlocked("No such draft")
  const { emailClaimId } = await import("../core-model/firestore-util")
  const { normalizeEmail } = await import("../core-model/identity")
  const contactId = emailClaimId(normalizeEmail(first.payload.to[0] ?? ""))
  const decisionId = `dec-${input.approvalId}`
  let next!: StoredApproval
  await step(store, {
    taskId: first.taskId,
    at: now,
    read: async (tx) => tx.getDoc<StoredApproval>(SEND_APPROVALS_COLLECTION, input.approvalId),
    decide: (task, a) => {
      if (!a) throw new ApprovalBlocked("No such draft")
      if (task.cancelled) throw new ApprovalBlocked("This task was cancelled; nothing can be decided on it")
      next = { ...a, ...decide(a, { decision: input.decision, by: "founder", at: now, shownHash: input.shownHash, reasonCode: input.reasonCode, reason: input.reason }) }
      const memory = buildDecision({
        id: decisionId,
        subject: { kind: "contact", id: contactId },
        chosen: `${input.decision === "approved" ? "Approved" : "Rejected"} the intake reply${a.routing?.outcome ? ` (routing: ${a.routing.outcome})` : ""}`,
        why: input.reason.trim().slice(0, 600),
        ...(input.decision === "rejected" ? { revisit_when: "They write again, or the founder reopens it" } : {}),
        by: "founder",
        at: now,
        task_id: a.taskId,
      })
      return {
        fields: { kind: input.decision, actor: "founder", refs: { approval: a.id, decision: decisionId }, hashes: { approval: a.hash }, reasonCode: input.reasonCode },
        to: input.decision === "approved" ? "approved" : "rejected",
        write: (tx) => {
          tx.setDoc(SEND_APPROVALS_COLLECTION, a.id, next)
          tx.createDoc(CRM_COLLECTIONS.DECISIONS, decisionId, memory)
        },
      }
    },
  })
  return next
}

/** The send, through every control in lib/agent/send-email.ts. */
export async function sendApproval(approvalId: string, store: AgentDb = db()): Promise<SendResult> {
  const { getResend } = await import("../resend")
  return sendApprovedEmail(approvalId, {
    db: store,
    controls: () => readAgentControls(),
    dispatch: async (p, idempotencyKey) => {
      const { data, error } = await getResend().emails.send({ from: p.from, to: p.to, ...(p.replyTo ? { replyTo: p.replyTo } : {}), subject: p.subject, text: p.text }, { idempotencyKey })
      if (error) throw new Error(error.message ?? "Resend refused the send")
      if (!data?.id) throw new Error("Resend returned no message id")
      return { messageId: data.id }
    },
    now: () => new Date().toISOString(),
    runId: `send-${randomUUID()}`,
    actor: "founder",
    afterRecord: () => {
      void import("../core-model/read").then((m) => m.invalidateCoreView()).catch(() => {})
    },
  })
}

async function controlsRef() {
  const { getDb } = await import("../firebase-admin")
  return getDb().collection(AGENT_CONTROLS_DOC.collection).doc(AGENT_CONTROLS_DOC.id)
}

/** The switch as stored (not the off-Production reading): what the page shows and edits. */
export async function readStoredControls(): Promise<AgentControls> {
  return parseControls((await (await controlsRef()).get()).data())
}

/** Sets intake's mode and its send flag, and resumes after a stop. A stop goes through `stopAgents`. */
export async function setControls(change: { intakeMode?: SkillMode; intakeSends?: boolean; resume?: boolean }, now = new Date().toISOString()): Promise<AgentControls> {
  if (change.intakeMode !== undefined && !(SKILL_MODES as readonly string[]).includes(change.intakeMode)) throw new Error("Unknown mode")
  const ref = await controlsRef()
  const { getDb } = await import("../firebase-admin")
  await getDb().runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as Record<string, unknown> | undefined
    const skills = { ...((cur?.skills as Record<string, unknown>) ?? {}) }
    const sends = { ...((cur?.sends as Record<string, unknown>) ?? {}) }
    if (change.intakeMode !== undefined) skills[INTAKE_SKILL] = change.intakeMode
    if (change.intakeSends !== undefined) sends.intake_reply = change.intakeSends
    // A document that never existed starts stopped (fails closed); only an explicit resume clears it.
    const stopped = change.resume ? false : typeof cur?.stopped === "boolean" ? cur.stopped : true
    t.set(ref, { ...(cur ?? {}), stopped, skills, sends, updated_at: now, updated_by: "founder", ...(change.resume ? { resumed_at: now } : {}) })
  })
  return readStoredControls()
}

/**
 * The stop: the switch first, so nothing new starts and no send passes its check; then every open task is cancelled
 * and every task caught mid-send goes to a person, each with its ledger entry.
 */
export async function stopAgents(now = new Date().toISOString()): Promise<{ cancelled: string[]; reconcile: string[] }> {
  const ref = await controlsRef()
  await ref.set({ stopped: true, stopped_at: now, stopped_by: "founder" }, { merge: true })
  const { getDb } = await import("../firebase-admin")
  const snap = await getDb().collection(AGENT_TASKS_COLLECTION).where("state", "in", [...OPEN_STATES]).limit(500).get()
  const tasks = snap.docs.map((d) => d.data() as AgentTask)
  return applyStop(db(), planStop(tasks), "founder", () => new Date().toISOString())
}

/** Everything the queue page shows. Read fresh: a draft decided a moment ago must not show as waiting. */
export async function readConsole(now = new Date().toISOString()) {
  const { getDb } = await import("../firebase-admin")
  const { readPin } = await import("./intake-server")
  const { AI_CALL_COSTS_COLLECTION } = await import("../engine/cost-ledger")
  const since = new Date(Date.parse(now) - WEEK_MS).toISOString()
  const d = getDb()
  const [approvalsSnap, tasksSnap, ledgerSnap, costsSnap, controls, pin] = await Promise.all([
    d.collection(SEND_APPROVALS_COLLECTION).orderBy("createdAt", "desc").limit(100).get(),
    d.collection(AGENT_TASKS_COLLECTION).where("updatedAt", ">=", since).limit(500).get(),
    d.collection(AGENT_LEDGER_COLLECTION).where("at", ">=", since).limit(3000).get(),
    d.collection(AI_CALL_COSTS_COLLECTION).where("at", ">=", since).limit(5000).get(),
    readStoredControls(),
    readPin(),
  ])
  const approvals = approvalsSnap.docs.map((x) => x.data() as StoredApproval)
  const tasks = tasksSnap.docs.map((x) => x.data() as AgentTask)
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const entries = ledgerSnap.docs.map((x) => x.data() as LedgerEntry)
  const costs = costsSnap.docs.map((x) => x.data() as { at: string; task: string; property?: string; usd: number })
  return {
    now,
    controls,
    pin,
    queue: sortQueue(approvals.map((a) => reviewItem(a, now, taskById.get(a.taskId)))),
    reasons: groupReasons(approvals, now),
    runs: runSummary(tasks, entries),
    waits: handoffWaits(entries),
    costs: costSummary(costs),
  }
}

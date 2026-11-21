/**
 * The founder-review queue's actions and the console's reads (434 build sequence V1 item 4, the proof slice, PR 3).
 *
 *  - `decideApproval`: the founder's approve or reject, on the hash he was shown, with a reason. In one transaction:
 *    the decision on the approval, a decision-memory record about the contact (`crm_decisions`), and the ledger entry.
 *  - `sendApproval`: the send, through lib/agent/send-email.ts (approval, expiry, consumed and hash checked; the kill
 *    switch read immediately before Resend; the sent text kept in full on the CRM).
 *  - `setControls`, `stopAgents`: the kill switch. A stop also cancels open tasks and sends in-flight ones to a person.
 *  - `readConsole`: everything the queue page shows, and To do's Today card (lib/agent/today.ts).
 *
 * Every caller is a founder-only route. Nothing here decides who may act: the route's guard does.
 */
import { randomUUID } from "node:crypto"
import { CRM_COLLECTIONS } from "../../types/crm-types"
import { decide, reviseDraft, ApprovalBlocked } from "../send-approval"
import { buildDecision } from "../core-model/decisions"
import { AGENT_CONTROLS_DOC, SKILL_MODES, parseControls, readAgentControls, type AgentControls, type SkillMode } from "./controls"
import { AGENT_LEDGER_COLLECTION, AGENT_TASKS_COLLECTION, OPEN_STATES, planStop, type AgentTask, type LedgerEntry } from "./ledger"
import { applyStop, firestoreAgentDb, step, type AgentDb } from "./ledger-server"
import { SEND_APPROVALS_COLLECTION, sendApprovedEmail, type SendResult } from "./send-email"
import { INTAKE_HOLDS_COLLECTION, INTAKE_SKILL, type IntakeHold } from "./intake"
import { DISMISSED_SENDERS_COLLECTION, senderDomain } from "./solicitation"
import { DISMISS_REASON_CODE, REASON_CODES, WEEK_MS, arrivalActivityId, costSummary, groupReasons, handoffWaits, reviewItem, runSummary, sortQueue, type ReviewItem, type StoredApproval } from "./review"
import { costSince, todayBrief } from "./today"
import { POLI_SKILL } from "./poli"
import type { Activity, Organization } from "../../types/core-model"
import type { Viewer } from "../core-model/read"

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
        chosen:
          input.reasonCode === DISMISS_REASON_CODE && input.decision === "rejected"
            ? "Dismissed the arrival as spam or a solicitation; no reply was sent"
            : `${input.decision === "approved" ? "Approved" : "Rejected"} the intake reply${a.routing?.outcome ? ` (routing: ${a.routing.outcome})` : ""}`,
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

/**
 * The founder's edit to a draft still waiting (one work area, 2026-11-16): the text is replaced and the draft re-hashed
 * (lib/send-approval.ts reviseDraft), so the approval that follows binds the edited text. The drafted text stays on the
 * approval as a revision, and the ledger records the edit as a re-queued draft with the reason code "edited" and both
 * hashes. Same task, same approval, same expiry: no new approval path.
 */
export async function editDraft(input: { approvalId: string; shownHash: string; text: string }, now = new Date().toISOString(), store: AgentDb = db()): Promise<StoredApproval> {
  const first = await store.run((tx) => tx.getDoc<StoredApproval>(SEND_APPROVALS_COLLECTION, input.approvalId))
  if (!first) throw new ApprovalBlocked("No such draft")
  let next!: StoredApproval
  await step(store, {
    taskId: first.taskId,
    at: now,
    read: async (tx) => tx.getDoc<StoredApproval>(SEND_APPROVALS_COLLECTION, input.approvalId),
    decide: (task, a) => {
      if (!a) throw new ApprovalBlocked("No such draft")
      if (task.cancelled) throw new ApprovalBlocked("This task was cancelled; its draft cannot be edited")
      next = { ...a, ...reviseDraft(a, { text: input.text, by: "founder", at: now, shownHash: input.shownHash }) }
      return {
        fields: { kind: "draft_queued", actor: "founder", refs: { approval: a.id }, hashes: { draft: next.hash, approval: a.hash }, reasonCode: "edited" },
        write: (tx) => tx.setDoc(SEND_APPROVALS_COLLECTION, a.id, next),
      }
    },
  })
  return next
}

/** What closing an arrival needs: its Activity as the inbox has it, and the triage. */
export interface CloseArrivalDeps {
  activity: (id: string) => Promise<Activity | null>
  triage: (activity: Activity) => Promise<void>
}

export type CloseArrivalResult = { closed: true; activityId: string } | { closed: false; reason: string }

/**
 * After an approved send: the reply is already an Activity (send-email.ts step 6); this takes the arrival out of the
 * People Inbox, so the inbox is true. The arrival is saved as a contact (triage `save`): answered, not yet decided as a
 * lead; Lead stays one move away on the person. Used after an approved draft and after a hand-written reply.
 * Never throws: the send has happened, and a failure here is reported, not raised.
 */
export async function closeArrivalAfterSend(approval: Pick<StoredApproval, "arrival">, deps: CloseArrivalDeps): Promise<CloseArrivalResult> {
  const activityId = arrivalActivityId(approval)
  if (!activityId) return { closed: false, reason: "The draft names no arrival" }
  try {
    const activity = await deps.activity(activityId)
    if (!activity) return { closed: false, reason: "The arrival is not in the inbox view" }
    if (!activity.triaged) await deps.triage(activity)
    return { closed: true, activityId }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    if (/already been triaged/.test(reason)) return { closed: true, activityId }
    console.error(`[agent:send] sent, but the arrival ${activityId} was not taken out of the inbox: ${reason}`)
    return { closed: false, reason }
  }
}

/** The live wiring: the core view as the founder sees it, and the core triage. */
export async function closeArrivalLive(approval: Pick<StoredApproval, "arrival">, actor: string, viewer: Viewer): Promise<CloseArrivalResult> {
  const [{ getVisibleCoreView, invalidateCoreView }, { firestoreCoreStore, firestoreLeadPath }, { triageActivity }, { listIcpCohorts }, { pendingArrivals }] = await Promise.all([
    import("../core-model/read"),
    import("../core-model/firestore-store"),
    import("../core-model/service"),
    import("../firestore-icp-cohorts"),
    import("../google-contacts/server"),
  ])
  invalidateCoreView()
  const out = await closeArrivalAfterSend(approval, {
    activity: async (id) => (await getVisibleCoreView(viewer)).activities.find((a) => a.id === id) ?? null,
    triage: async (activity) => {
      await triageActivity(firestoreCoreStore, firestoreLeadPath, { activity, decision: "save", actor, founder: true }, await listIcpCohorts(), pendingArrivals)
    },
  })
  invalidateCoreView()
  return out
}

/** One sender the founder dismissed: what the pre-check reads (lib/agent/solicitation.ts). */
export interface DismissedSender {
  id: string
  email: string
  /** The company domain, or "" for a free-mail address (one Gmail user never holds every Gmail sender). */
  domain: string
  formId: string
  at: string
  by: string
}

export interface DismissDeps {
  /** The arrival as the inbox shows it, or null when it is no longer there. */
  activity: (id: string) => Promise<Activity | null>
  /** The inbox's own Dismiss (triage `dismiss`): the arrival leaves the inbox and To do. */
  triage: (activity: Activity) => Promise<void>
  /** The submission marked spam (`submission_states`), so the token guard refuses any later run for it. */
  markSpam: (formId: string) => Promise<void>
  recordSender: (row: DismissedSender) => Promise<void>
  /** The decision-memory record, for an arrival with no draft (a draft's rejection writes its own). */
  recordDecision: (memory: ReturnType<typeof buildDecision>) => Promise<void>
}

export interface DismissInput {
  /** The arrival: `contact_forms:<formId>`. Only website-form arrivals are dismissed this way. */
  activityId: string
  /** The draft for it, when there is one, and the hash he was shown. */
  approvalId?: string
  shownHash?: string
  reason?: string
  actor: string
}

export type DismissResult = { dismissed: true; activityId: string; draftRejected: boolean; leftInbox: boolean; warnings: string[] }

export const DISMISS_DEFAULT_REASON = "Spam or solicitation; no reply."

/**
 * **Dismiss: spam or solicitation** (founder, 2026-11-19). Sends nothing. In order:
 *  1. the decision: a draft is rejected with the reason code `solicitation` (its decision memory and ledger entry
 *     with it); an arrival with no draft gets its decision-memory record;
 *  2. the submission is marked spam, so the token guard refuses any later run for it;
 *  3. the sender, and their company domain unless it is free mail, are recorded, so a later arrival from them is held
 *     by the pre-check with no draft;
 *  4. the arrival leaves the inbox and To do (triage `dismiss`).
 * The decision is the only step that can refuse. A later step that fails is reported as a warning, not raised: the
 * decision is already recorded, and the founder can finish the rest by hand.
 */
export async function dismissSolicitation(input: DismissInput, deps: DismissDeps, now = new Date().toISOString(), store: AgentDb = db()): Promise<DismissResult> {
  const formId = /^contact_forms:(.+)$/.exec(input.activityId)?.[1]
  if (!formId) throw new ApprovalBlocked("Only a website-form arrival can be dismissed as spam or a solicitation")
  const reason = (input.reason ?? "").trim() || DISMISS_DEFAULT_REASON
  const activity = await deps.activity(input.activityId)
  let email = activity?.contact.email ?? ""
  let draftRejected = false
  if (input.approvalId) {
    if (!input.shownHash) throw new ApprovalBlocked("The draft's hash is required")
    const a = await readApproval(input.approvalId, store)
    if (!a) throw new ApprovalBlocked("No such draft")
    if (a.arrival?.formId !== formId) throw new ApprovalBlocked("That draft answers a different arrival")
    await decideApproval({ approvalId: input.approvalId, decision: "rejected", shownHash: input.shownHash, reasonCode: DISMISS_REASON_CODE, reason }, now, store)
    draftRejected = true
    email ||= a.payload.to[0] ?? ""
  } else {
    if (!activity) throw new ApprovalBlocked("The arrival is not in the inbox")
  }
  const { emailClaimId } = await import("../core-model/firestore-util")
  const { normalizeEmail } = await import("../core-model/identity")
  const normalized = normalizeEmail(email)
  const warnings: string[] = []
  const attempt = async (what: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      console.error(`[agent:dismiss] ${input.activityId}: ${what} failed: ${m}`)
      warnings.push(`${what} failed: ${m}`)
    }
  }
  if (!draftRejected && normalized) {
    await attempt("The decision record", () =>
      deps.recordDecision(
        buildDecision({
          id: `dec-dismiss-${formId.replace(/[^A-Za-z0-9_-]/g, "_")}`,
          subject: { kind: "contact", id: emailClaimId(normalized) },
          chosen: "Dismissed the arrival as spam or a solicitation; no reply was sent",
          why: reason.slice(0, 600),
          revisit_when: "They write again with a real request, or the founder reopens it",
          by: "founder",
          at: now,
        }),
      ),
    )
  }
  await attempt("Marking the submission spam", () => deps.markSpam(formId))
  if (normalized) {
    await attempt("Recording the sender", () => deps.recordSender({ id: emailClaimId(normalized), email: normalized, domain: senderDomain(normalized), formId, at: now, by: input.actor }))
  } else {
    warnings.push("The arrival has no email address, so later arrivals from this sender cannot be held")
  }
  let leftInbox = !activity || activity.triaged
  if (activity && !activity.triaged) {
    await attempt("Taking the arrival out of the inbox", async () => {
      try {
        await deps.triage(activity)
      } catch (e) {
        if (!/already been triaged/.test(e instanceof Error ? e.message : String(e))) throw e
      }
      leftInbox = true
    })
  }
  return { dismissed: true, activityId: input.activityId, draftRejected, leftInbox, warnings }
}

/** The live wiring: the core view as the founder sees it, the core triage, and Firestore. */
export async function dismissSolicitationLive(input: DismissInput, viewer: Viewer): Promise<DismissResult> {
  const [{ getVisibleCoreView, invalidateCoreView }, { firestoreCoreStore, firestoreLeadPath }, { triageActivity }, { listIcpCohorts }, { pendingArrivals }, { setSubmissionState }, { getDb }] = await Promise.all([
    import("../core-model/read"),
    import("../core-model/firestore-store"),
    import("../core-model/service"),
    import("../firestore-icp-cohorts"),
    import("../google-contacts/server"),
    import("../firestore-submission-states"),
    import("../firebase-admin"),
  ])
  invalidateCoreView()
  const out = await dismissSolicitation(input, {
    activity: async (id) => (await getVisibleCoreView(viewer)).activities.find((a) => a.id === id) ?? null,
    triage: async (activity) => {
      await triageActivity(firestoreCoreStore, firestoreLeadPath, { activity, decision: "dismiss", actor: input.actor, founder: true }, await listIcpCohorts(), pendingArrivals)
    },
    markSpam: (formId) => setSubmissionState("contact_forms", formId, "spam", input.actor),
    recordSender: async (row) => {
      await getDb().collection(DISMISSED_SENDERS_COLLECTION).doc(row.id).set(row)
    },
    recordDecision: async (memory) => {
      await getDb().collection(CRM_COLLECTIONS.DECISIONS).doc(memory.id).set(memory)
    },
  })
  invalidateCoreView()
  return out
}

/** One row of "Waiting on you": the draft, and the arrival it answers as the inbox shows it. */
export interface WaitingItem extends ReviewItem {
  arrival?: { name: string; email?: string; company?: string; body?: string; occurredAt: string; triaged: boolean; fit?: { grade?: string; score?: number } }
}

/**
 * "Waiting on you" (one work area, 2026-11-16): a view over the approval records (`crm_send_approvals`), never a store
 * of its own. Every draft for the founder, waiting first, with the arrival it answers from the core view. The intake
 * hand-off names a next owner in words only, and the task registry records none, so nothing is routed to anyone else
 * yet: per-person routing follows the connector's per-person permissions.
 */
export async function readWaiting(viewer: Viewer, now = new Date().toISOString()): Promise<{ now: string; items: WaitingItem[]; holds: HeldArrival[]; poli: PoliRow[] }> {
  const { getDb } = await import("../firebase-admin")
  const { getVisibleCoreView } = await import("../core-model/read")
  const d = getDb()
  const [approvalsSnap, view, holdsSnap, poli] = await Promise.all([
    d.collection(SEND_APPROVALS_COLLECTION).orderBy("createdAt", "desc").limit(100).get(),
    getVisibleCoreView(viewer),
    // The pre-check's holds. A read error leaves them out: the arrivals still show in To do, without the hint.
    d.collection(INTAKE_HOLDS_COLLECTION).orderBy("at", "desc").limit(100).get().catch((e: unknown) => {
      console.error("[agent:waiting] the pre-check's holds could not be read:", e instanceof Error ? e.message : e)
      return null
    }),
    readPoliRows(),
  ])
  const approvals = approvalsSnap.docs.map((x) => x.data() as StoredApproval)
  const taskIds = [...new Set(approvals.map((a) => a.taskId))]
  const tasks = new Map<string, AgentTask>()
  for (let i = 0; i < taskIds.length; i += 100) {
    const refs = taskIds.slice(i, i + 100).map((id) => d.collection(AGENT_TASKS_COLLECTION).doc(id))
    if (refs.length) for (const s of await d.getAll(...refs)) if (s.exists) tasks.set(s.id, s.data() as AgentTask)
  }
  const activities = new Map(view.activities.map((a) => [a.id, a]))
  const orgs = new Map<string, Organization>(view.organizations.map((o) => [o.id, o]))
  const people = new Map(view.people.map((p) => [p.id, p]))
  const items = sortQueue(approvals.map((a) => reviewItem(a, now, tasks.get(a.taskId)))).map((item): WaitingItem => {
    const act = item.activityId ? activities.get(item.activityId) : undefined
    if (!act) return item
    const org = act.organization_id ? orgs.get(act.organization_id) : undefined
    return {
      ...item,
      arrival: {
        name: (act.person_id ? people.get(act.person_id)?.name : undefined) || act.contact.name || act.contact.email || "",
        email: act.contact.email,
        company: act.contact.company,
        body: act.body || act.summary,
        occurredAt: act.occurred_at,
        triaged: act.triaged,
        ...(org && typeof org.icp_fit_score === "number" ? { fit: { grade: org.icp_grade, score: org.icp_fit_score } } : {}),
      },
    }
  })
  // A hold shows only while its arrival is still waiting to be triaged.
  const holds = (holdsSnap?.docs ?? [])
    .map((x) => x.data() as IntakeHold)
    .filter((h) => { const act = activities.get(h.activityId); return act && !act.triaged })
    .map((h): HeldArrival => ({ activityId: h.activityId, why: h.why, summary: h.summary, at: h.at }))
  return { now, items, holds, poli }
}

/** A founder-owned task Polí's rule pass raised and still open, as To do shows it (V1 item 4, Polí slice 1). */
export interface PoliRow {
  id: string
  ref?: string
  title: string
  detail: string
  path: string
  recordRef?: string
  createdAt: string | null
}

/**
 * Polí's open tasks, oldest first. They live in `crm_tasks` (`source: "poli"`) and open on the Tasks page; To do is a
 * view over them, never a store. A read error leaves them out: they still show on the Tasks page.
 */
async function readPoliRows(): Promise<PoliRow[]> {
  try {
    const [{ getDb }, { taskView, toIso }, { POLI_SOURCE }] = await Promise.all([import("../firebase-admin"), import("./poli-server"), import("./poli")])
    const snap = await getDb().collection("crm_tasks").where("source", "==", POLI_SOURCE).limit(200).get()
    return snap.docs
      .map((d) => ({ d: d.data(), v: taskView(d.id, d.data()) }))
      .filter(({ v }) => v.status !== "completed" && v.status !== "deferred")
      .map(({ d, v }): PoliRow => {
        const poli = (d.poli ?? {}) as Record<string, unknown>
        const desc = typeof d.description === "string" ? d.description : ""
        return { id: v.id, ...(v.ref ? { ref: v.ref } : {}), title: v.title ?? "", detail: desc.split(" Raised by Polí")[0], path: typeof poli.path === "string" ? poli.path : "", ...(typeof poli.record_ref === "string" ? { recordRef: poli.record_ref } : {}), createdAt: toIso(d.created_at) }
      })
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
  } catch (e) {
    console.error("[agent:waiting] Polí's tasks could not be read:", e instanceof Error ? e.message : e)
    return []
  }
}

/** An arrival the pre-check held with no draft, as To do marks it. */
export interface HeldArrival {
  activityId: string
  why: IntakeHold["why"]
  summary: string
  at: string
}

/** One approval as stored, or null. */
export async function readApproval(approvalId: string, store: AgentDb = db()): Promise<StoredApproval | null> {
  return (await store.run((tx) => tx.getDoc<StoredApproval>(SEND_APPROVALS_COLLECTION, approvalId))) ?? null
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

/** Sets intake's mode and its send flag, Polí's mode, the Ask panel's on/off, and resumes after a stop. A stop goes through `stopAgents`. */
export async function setControls(change: { intakeMode?: SkillMode; intakeSends?: boolean; ask?: boolean; poliMode?: SkillMode; resume?: boolean }, now = new Date().toISOString()): Promise<AgentControls> {
  if (change.intakeMode !== undefined && !(SKILL_MODES as readonly string[]).includes(change.intakeMode)) throw new Error("Unknown mode")
  if (change.poliMode !== undefined && !(SKILL_MODES as readonly string[]).includes(change.poliMode)) throw new Error("Unknown mode")
  const ref = await controlsRef()
  const { getDb } = await import("../firebase-admin")
  await getDb().runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as Record<string, unknown> | undefined
    const skills = { ...((cur?.skills as Record<string, unknown>) ?? {}) }
    const sends = { ...((cur?.sends as Record<string, unknown>) ?? {}) }
    if (change.intakeMode !== undefined) skills[INTAKE_SKILL] = change.intakeMode
    if (change.poliMode !== undefined) skills[POLI_SKILL] = change.poliMode
    if (change.intakeSends !== undefined) sends.intake_reply = change.intakeSends
    // A document that never existed starts stopped (fails closed); only an explicit resume clears it.
    const stopped = change.resume ? false : typeof cur?.stopped === "boolean" ? cur.stopped : true
    const ask = change.ask !== undefined ? change.ask : cur?.ask === true
    t.set(ref, { ...(cur ?? {}), stopped, skills, sends, ask, updated_at: now, updated_by: "founder", ...(change.resume ? { resumed_at: now } : {}) })
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
  const watch = readWatch(new Date(now))
  const poli = import("./poli-server").then(({ readPoliToday }) => readPoliToday(now))
  const month = readAskMonth(now)
  const months = import("../spend-caps-server").then(({ monthStatus }) => Promise.all([monthStatus("engine-exam", now), monthStatus("intake", now)]))
  const [approvalsSnap, tasksSnap, ledgerSnap, costsSnap, controls, pin, askPin] = await Promise.all([
    d.collection(SEND_APPROVALS_COLLECTION).orderBy("createdAt", "desc").limit(100).get(),
    d.collection(AGENT_TASKS_COLLECTION).where("updatedAt", ">=", since).limit(500).get(),
    d.collection(AGENT_LEDGER_COLLECTION).where("at", ">=", since).limit(3000).get(),
    d.collection(AI_CALL_COSTS_COLLECTION).where("at", ">=", since).limit(5000).get(),
    readStoredControls(),
    readPin(),
    readPin("admin-ask"),
  ])
  const askMonth = await month
  const [examMonth, intakeMonth] = await months
  const approvals = approvalsSnap.docs.map((x) => x.data() as StoredApproval)
  const tasks = tasksSnap.docs.map((x) => x.data() as AgentTask)
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const entries = ledgerSnap.docs.map((x) => x.data() as LedgerEntry)
  const costs = costsSnap.docs.map((x) => x.data() as { at: string; task: string; property?: string; usd: number })
  const runs = runSummary(tasks, entries)
  const costTotals = costSummary(costs)
  return {
    now,
    controls,
    pin,
    askPin,
    askMonth,
    examMonth,
    intakeMonth,
    queue: sortQueue(approvals.map((a) => reviewItem(a, now, taskById.get(a.taskId)))),
    reasons: groupReasons(approvals, now),
    runs,
    waits: handoffWaits(entries),
    costs: costTotals,
    poli: await poliState(poli),
    today: todayBrief({ now, ...(await watch), runs, costs: costTotals, cost24hUsd: costSince(costs, now), poli: await poliLine(poli, now) }),
  }
}

/** Polí's line for Today (lib/agent/poli.ts poliTodayLine), or none when it could not be read. */
async function poliLine(p: Promise<Awaited<ReturnType<typeof import("./poli-server").readPoliToday>>>, now: string) {
  const r = await p
  if (!r) return null
  const { poliTodayLine } = await import("./poli")
  return poliTodayLine(r.plan, r.mode, now)
}

/** Polí's mode, for the Agents page's row. */
async function poliState(p: Promise<Awaited<ReturnType<typeof import("./poli-server").readPoliToday>>>) {
  const r = await p
  return r ? { mode: r.mode } : null
}

/**
 * The watchdog's two reads, for the Today card: jobs that did not fire when due and queues past their limit. The same
 * functions the hourly alert uses (app/api/cron/cron-watchdog), without its once-a-day dedupe: Today shows what is true
 * now. A read that fails is reported as unreadable rather than failing the page.
 */
/**
 * The Ask row's "This month: $x of $10" (lib/ask/limits.ts): Ask's spend since the month's start, against the cap in
 * force. `spentUsd` is null when the cost records could not be read; the panel itself then refuses (fails closed).
 */
async function readAskMonth(now: string): Promise<{ spentUsd: number | null; capUsd: number }> {
  const [{ askMonthlyCapUsd, monthStartOf }, { readAskMonthSpend }] = await Promise.all([import("../ask/limits"), import("../ask/server")])
  const capUsd = askMonthlyCapUsd()
  try {
    return { spentUsd: await readAskMonthSpend(monthStartOf(now)), capUsd }
  } catch (e) {
    console.error("[agents] Ask's month spend could not be read:", e instanceof Error ? e.message : e)
    return { spentUsd: null, capUsd }
  }
}

async function readWatch(now: Date) {
  const { getDb } = await import("../firebase-admin")
  const { readCronHeartbeats } = await import("../cron-heartbeat")
  const { missedCrons } = await import("../cron-watchdog")
  const { QUEUES, QUEUE_READ_LIMIT, overdueQueues, readQueue } = await import("../queue-age")
  const vercelConfig = (await import("../../vercel.json")).default as { crons?: { path: string; schedule: string }[] }
  const unreadable: string[] = []
  let missed: Awaited<ReturnType<typeof missedCrons>> = []
  try {
    const heartbeats = await readCronHeartbeats()
    const first = heartbeats.get("cron-watchdog")?.firstFiredAt
    missed = missedCrons(vercelConfig.crons ?? [], heartbeats, first ? new Date(first) : null, now)
  } catch (e) {
    unreadable.push(`cron heartbeats: ${(e as Error).message}`)
  }
  const d = getDb()
  const readings = await Promise.all(QUEUES.map(async (q) => {
    try {
      const snap = await d.collection(q.collection).where(q.where.field, "==", q.where.equals).limit(QUEUE_READ_LIMIT).get()
      return readQueue(q, snap.docs.map((x) => x.data()))
    } catch (e) {
      unreadable.push(`${q.name}: ${(e as Error).message}`)
      return null
    }
  }))
  return { missed, overdue: overdueQueues(readings.filter((r) => r !== null), now), unreadable }
}

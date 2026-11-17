/**
 * The approval core every send path shares (434 build sequence V1 item 4, build plan v3: "Sends and approvals extend the
 * owned-Meta publisher; they are not rebuilt. It already has hash-bound single approval, claim/intent/receipt records and
 * a per-brand kill state. Added: an expiry, the schedule inside the hash, and an explicit 'consumed' mark").
 *
 * What moved here from lib/owned-meta-publisher.ts, unchanged: `canonicalJson` and the sha256 over it, which is how a
 * Meta manifest is hashed (`manifestHash`). The publisher imports them from here, so a Meta hash is byte-for-byte what it
 * was (lib/__tests__/send-approval.test.ts pins it). The publisher keeps its own job state machine; adopting expiry and
 * `consumed` on Meta batches is a follow-up.
 *
 * What is added, for the paths that send to a person (the intake reply first):
 *  - the hash binds the path, the task, the payload, the schedule (`sendAt`) and the expiry (`expiresAt`), so changing
 *    any of them needs a new approval;
 *  - a decision is written once, by a signed-in person, against the hash they were shown, with a reason;
 *  - a send is claim → intent → receipt, as the publisher's final publication is: an intent with no receipt is never
 *    sent again (it is reconciled by a person), and a receipt marks the approval `consumed`.
 *
 * Pure: no environment, storage or network. The caller supplies `now`.
 */
import { createHash } from "node:crypto"

/** Moved verbatim from lib/owned-meta-publisher.ts: keys sorted, undefined dropped. Every approval hash is over this. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}

/** sha256 hex over canonicalJson. The owned-Meta manifest hash is this function applied to the manifest. */
export function contentHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

/** The send paths that go through this core. Each new path is added here, never by a free string. */
export const SEND_PATHS = ["intake_reply"] as const
export type SendPath = (typeof SEND_PATHS)[number]

/** One email as it will go out. The text is the message; nothing is added at send time. */
export interface EmailPayload {
  from: string
  to: string[]
  replyTo?: string
  subject: string
  text: string
}

/**
 * How long an approval stays good (D4, the coordinator's acceptance of the plan, 2026-11-14; pending the founder's
 * confirmation). An expired draft is regenerated, never revived.
 */
export const DEFAULT_APPROVAL_TTL_MS = 72 * 60 * 60 * 1000

export interface ApprovalDecision {
  /** The signed-in person who decided ("founder", or a team member id). Never taken from a model or a tool. */
  by: string
  at: string
  /** The hash they were shown. */
  hash: string
  /** A short code the weekly view groups by, e.g. "tone", "routing", "facts". */
  reasonCode: string
  /** Their words. Kept here, on the CRM record; the ledger keeps only the code. */
  reason: string
}

export interface SendApproval {
  id: string
  path: SendPath
  taskId: string
  payload: EmailPayload
  /** When it may go: null means at once on approval. Inside the hash. */
  sendAt: string | null
  /** After this the approval is void. Inside the hash. */
  expiresAt: string
  hash: string
  /** Why it reached the founder (the skill's routing reason). Not hashed: it is not what is sent. */
  reviewReason: string
  createdAt: string
  approval?: ApprovalDecision
  rejection?: ApprovalDecision
  claim?: string | null
  intent?: { id: string; at: string }
  receipt?: { messageId: string; at: string }
  consumed?: { at: string; runId: string }
  /** Stopped after the intent and before the provider was called: nothing went out, and it never goes. */
  abortedBeforeDispatch?: { at: string; why: string }
  /** The provider call failed or its answer was lost: whether it went is unknown. A person reconciles it. */
  outcomeUnknown?: { at: string; why: string }
  /**
   * Each edit a person made before deciding, oldest first: the text it replaced and the hash on each side. An edit
   * re-hashes the draft (`reviseDraft`), so the decision binds the edited text and the drafted text stays as evidence.
   */
  revisions?: DraftRevision[]
}

export interface DraftRevision {
  by: string
  at: string
  fromHash: string
  toHash: string
  /** The text the edit replaced, kept whole on the CRM record (the ledger keeps only the hashes). */
  previousText: string
}

export type ApprovalStatus =
  | "pending"
  | "rejected"
  | "expired"
  | "scheduled"
  | "approved"
  | "sending"
  | "sent"
  | "stopped"
  | "needs_reconciliation"

export class ApprovalBlocked extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApprovalBlocked"
  }
}

const REASON_CODE = /^[a-z0-9][a-z0-9-]{1,39}$/
const MAX_REASON = 1000
const isIso = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v))

/** The fields the hash covers. Anything outside it (the review reason, decisions, send records) is not what is sent. */
export function hashedFields(a: Pick<SendApproval, "path" | "taskId" | "payload" | "sendAt" | "expiresAt">) {
  return { path: a.path, taskId: a.taskId, payload: a.payload, sendAt: a.sendAt, expiresAt: a.expiresAt }
}

export function approvalHash(a: Pick<SendApproval, "path" | "taskId" | "payload" | "sendAt" | "expiresAt">): string {
  return contentHash(hashedFields(a))
}

function assertPayload(p: EmailPayload): void {
  if (!p || typeof p.from !== "string" || !p.from.trim()) throw new ApprovalBlocked("A sender is required")
  if (!Array.isArray(p.to) || !p.to.length || p.to.some((t) => typeof t !== "string" || !t.trim())) throw new ApprovalBlocked("At least one recipient is required")
  if (typeof p.subject !== "string" || !p.subject.trim()) throw new ApprovalBlocked("A subject is required")
  if (typeof p.text !== "string" || !p.text.trim()) throw new ApprovalBlocked("The message text is required")
  if (p.replyTo !== undefined && (typeof p.replyTo !== "string" || !p.replyTo.trim())) throw new ApprovalBlocked("Reply-to, when given, must be an address")
}

/** A new approval waiting for a decision. The hash is fixed here; nothing in `hashedFields` changes afterwards. */
export function draftApproval(input: {
  id: string
  path: SendPath
  taskId: string
  payload: EmailPayload
  reviewReason: string
  sendAt?: string | null
  now: string
  ttlMs?: number
}): SendApproval {
  if (!(SEND_PATHS as readonly string[]).includes(input.path)) throw new ApprovalBlocked(`Unknown send path "${input.path}"`)
  if (!input.id || !input.taskId) throw new ApprovalBlocked("An approval needs its id and its task")
  if (!isIso(input.now)) throw new ApprovalBlocked("A valid time is required")
  assertPayload(input.payload)
  const sendAt = input.sendAt ?? null
  if (sendAt !== null && !isIso(sendAt)) throw new ApprovalBlocked("The schedule must be a time")
  const ttl = input.ttlMs ?? DEFAULT_APPROVAL_TTL_MS
  if (!(ttl > 0)) throw new ApprovalBlocked("An approval must expire")
  const expiresAt = new Date(Date.parse(input.now) + ttl).toISOString()
  if (sendAt !== null && Date.parse(sendAt) >= Date.parse(expiresAt)) throw new ApprovalBlocked("The schedule falls after the approval would expire")
  const payload: EmailPayload = { from: input.payload.from, to: [...input.payload.to], subject: input.payload.subject, text: input.payload.text, ...(input.payload.replyTo ? { replyTo: input.payload.replyTo } : {}) }
  const base = { path: input.path, taskId: input.taskId, payload, sendAt, expiresAt }
  return { id: input.id, ...base, hash: approvalHash(base), reviewReason: input.reviewReason, createdAt: input.now }
}

/** The stored hash is the hash of what is stored. Any edit after drafting fails this. */
export function assertIntact(a: SendApproval): void {
  if (!a || !a.hash || a.hash !== approvalHash(a)) throw new ApprovalBlocked("The draft changed since it was hashed; a new approval is required")
}

const expired = (a: SendApproval, now: string) => Date.parse(now) >= Date.parse(a.expiresAt)

export function approvalStatus(a: SendApproval, now: string): ApprovalStatus {
  if (a.receipt || a.consumed) return "sent"
  if (a.outcomeUnknown) return "needs_reconciliation"
  if (a.abortedBeforeDispatch) return "stopped"
  if (a.intent) return "sending"
  if (a.rejection) return "rejected"
  if (expired(a, now)) return "expired"
  if (!a.approval) return "pending"
  if (a.sendAt && Date.parse(now) < Date.parse(a.sendAt)) return "scheduled"
  return "approved"
}

/**
 * Record the decision a signed-in person made on what they were shown. Written once: a second decision, a changed draft,
 * an expired one or a missing reason is refused. Returns the new record; the caller writes it in one transaction.
 */
export function decide(a: SendApproval, d: { decision: "approved" | "rejected"; by: string; at: string; shownHash: string; reasonCode: string; reason: string }): SendApproval {
  assertIntact(a)
  if (a.approval || a.rejection) throw new ApprovalBlocked("This draft already has a decision; a changed draft needs a new approval")
  if (d.shownHash !== a.hash) throw new ApprovalBlocked("The draft changed since it was shown; reload it before deciding")
  if (!isIso(d.at)) throw new ApprovalBlocked("A valid time is required")
  if (expired(a, d.at)) throw new ApprovalBlocked("This draft has expired; it is regenerated, never revived")
  if (typeof d.by !== "string" || !d.by.trim()) throw new ApprovalBlocked("The decision needs the signed-in person who made it")
  if (!REASON_CODE.test(d.reasonCode ?? "")) throw new ApprovalBlocked("A reason code is required")
  const reason = typeof d.reason === "string" ? d.reason.trim() : ""
  if (!reason) throw new ApprovalBlocked("A reason is required for every decision")
  if (reason.length > MAX_REASON) throw new ApprovalBlocked(`The reason is over ${MAX_REASON} characters`)
  const decision: ApprovalDecision = { by: d.by.trim(), at: d.at, hash: a.hash, reasonCode: d.reasonCode, reason }
  return d.decision === "approved" ? { ...a, approval: decision } : { ...a, rejection: decision }
}

/**
 * A person's edit to a draft that is still waiting: the new text replaces the old and the hash is computed again over
 * the same fields, so the approval that follows binds the edited text. Refused once decided, expired, or when the draft
 * changed since it was shown. The schedule and expiry do not move: an edit never extends an approval's life. Returns
 * the new record; the caller writes it in one transaction.
 */
export function reviseDraft(a: SendApproval, e: { text: string; by: string; at: string; shownHash: string }): SendApproval {
  assertIntact(a)
  if (a.approval || a.rejection) throw new ApprovalBlocked("This draft already has a decision; it can no longer be edited")
  if (e.shownHash !== a.hash) throw new ApprovalBlocked("The draft changed since it was shown; reload it before editing")
  if (!isIso(e.at)) throw new ApprovalBlocked("A valid time is required")
  if (expired(a, e.at)) throw new ApprovalBlocked("This draft has expired; it is regenerated, never revived")
  if (typeof e.by !== "string" || !e.by.trim()) throw new ApprovalBlocked("The edit needs the signed-in person who made it")
  const text = typeof e.text === "string" ? e.text.replace(/\r\n/g, "\n") : ""
  if (text === a.payload.text) throw new ApprovalBlocked("Nothing changed")
  const payload: EmailPayload = { ...a.payload, text }
  assertPayload(payload)
  const hash = approvalHash({ ...a, payload })
  const revision: DraftRevision = { by: e.by.trim(), at: e.at, fromHash: a.hash, toHash: hash, previousText: a.payload.text }
  return { ...a, payload, hash, revisions: [...(a.revisions ?? []), revision] }
}

/**
 * Only an approved, unexpired, unconsumed, hash-matched draft whose time has come can send. Also refuses anything that has
 * already started: an intent, with or without a receipt, is never followed by a second send.
 */
export function assertSendable(a: SendApproval, now: string): void {
  assertIntact(a)
  if (a.rejection) throw new ApprovalBlocked("This draft was rejected")
  if (!a.approval) throw new ApprovalBlocked("This draft has not been approved")
  if (a.approval.hash !== a.hash) throw new ApprovalBlocked("The approval is for a different draft")
  if (a.consumed || a.receipt) throw new ApprovalBlocked("This approval has been used")
  if (a.intent || a.abortedBeforeDispatch || a.outcomeUnknown) throw new ApprovalBlocked("A send was already attempted for this approval; it is reconciled, never retried")
  if (expired(a, now)) throw new ApprovalBlocked("This approval has expired")
  if (a.sendAt && Date.parse(now) < Date.parse(a.sendAt)) throw new ApprovalBlocked("This send is scheduled for later")
}

/** Step 1: one run claims the send. A second run, or a second tap, finds the claim and stops. */
export function claimSend(a: SendApproval, runId: string, now: string): SendApproval {
  assertSendable(a, now)
  if (a.claim) throw new ApprovalBlocked("Another run has claimed this send")
  return { ...a, claim: runId }
}

/** Step 2: the intent, recorded before the provider is called. From here on the approval can never send again. */
export function recordIntent(a: SendApproval, runId: string, now: string): SendApproval {
  assertSendable(a, now)
  if (a.claim !== runId) throw new ApprovalBlocked("The claim changed; no send from this run")
  return { ...a, intent: { id: `${runId}:send`, at: now } }
}

/** Step 3: the provider's receipt. The approval is consumed. */
export function recordReceipt(a: SendApproval, runId: string, messageId: string, now: string): SendApproval {
  if (!a.intent || a.intent.id !== `${runId}:send` || a.claim !== runId) throw new ApprovalBlocked("No matching intent for this receipt")
  if (a.receipt) throw new ApprovalBlocked("A receipt is already recorded")
  if (!messageId) throw new ApprovalBlocked("The provider returned no message id")
  return { ...a, receipt: { messageId, at: now }, consumed: { at: now, runId } }
}

/** The kill switch tripped after the intent and before the provider call: nothing went out, and this approval is spent. */
export function abortBeforeDispatch(a: SendApproval, runId: string, now: string, why: string): SendApproval {
  if (!a.intent || a.intent.id !== `${runId}:send` || a.receipt) throw new ApprovalBlocked("No open intent from this run")
  return { ...a, abortedBeforeDispatch: { at: now, why } }
}

/** The provider call failed or its answer was lost. Whether it went is unknown: a person checks; nothing retries. */
export function markOutcomeUnknown(a: SendApproval, runId: string, now: string, why: string): SendApproval {
  if (!a.intent || a.intent.id !== `${runId}:send` || a.receipt) throw new ApprovalBlocked("No open intent from this run")
  return { ...a, outcomeUnknown: { at: now, why } }
}

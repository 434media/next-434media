/**
 * At-most-once sending for the outreach sequence (2b fix 11).
 *
 * Every send of a sequence step goes through sendStepOnce:
 *   1. CLAIM — in one transaction, re-read the lead's sequence and continue only
 *      if it is active, still on this step, and the step is unclaimed. Write a
 *      claim {step, claimed_at, run_id}. Whoever loses a race skips.
 *   2. SEND  — with an idempotency key unique to (lead, enrolment, step), so a
 *      duplicate request that does reach Resend within its 24-hour window is
 *      answered with the original email instead of a second one.
 *   3. SETTLE — in one transaction, and only if this run still holds the claim:
 *      on success advance the sequence and clear the claim; on a Resend error
 *      release the claim so the next run can retry with the same key.
 *
 * A claim that is still there after CLAIM_STALE_MS means a run died between
 * SEND and SETTLE — the email may have gone out. The next daily run is outside
 * Resend's 24-hour key window, so the key cannot protect it. That step is never
 * retried automatically: the sequence is paused and flagged for review.
 *
 * Self-contained (no app imports) so the tests can compile it alone. The store
 * and sender are injected: production passes Firestore and Resend; the tests
 * pass an in-memory store with transaction semantics and a fake sender.
 */

export const CLAIM_STALE_MS = 10 * 60 * 1000

export interface StepClaim {
  step: number
  claimed_at: string
  run_id: string
}

/** The fields of an OutreachSequence this module reads and writes. */
export interface ClaimableSequence {
  status: string
  next_step: number | null
  enrolled_at: string
  claim?: StepClaim | null
  needs_review?: { step: number; claimed_at: string; flagged_at: string } | null
}

export type ClaimDecision =
  | { kind: "claim" }
  | { kind: "skip"; reason: "no_sequence" | "not_active" | "step_moved" | "claimed" }
  | { kind: "stale"; claim: StepClaim }

/** Decide, from the sequence as read inside the claim transaction, whether this run may send `step`. */
export function decideClaim(seq: ClaimableSequence | undefined | null, step: number, now: Date): ClaimDecision {
  if (!seq) return { kind: "skip", reason: "no_sequence" }
  if (seq.status !== "active") return { kind: "skip", reason: "not_active" }
  if (seq.next_step !== step) return { kind: "skip", reason: "step_moved" }
  if (seq.claim) {
    const age = now.getTime() - new Date(seq.claim.claimed_at).getTime()
    return age > CLAIM_STALE_MS ? { kind: "stale", claim: seq.claim } : { kind: "skip", reason: "claimed" }
  }
  return { kind: "claim" }
}

/** Resend idempotency key: one per lead, enrolment and step. Under Resend's 256-character limit. */
export function idempotencyKey(leadId: string, enrolledAt: string, step: number): string {
  return `seq-${leadId}-${enrolledAt}-step${step}`.slice(0, 256)
}

/**
 * Read-modify-write of one lead's sequence, atomically. `fn` sees the current
 * sequence and returns the new one (or undefined to write nothing), any other
 * top-level lead fields to set with it, and a result. Implementations must
 * re-run `fn` if the document changed underneath them, as Firestore
 * transactions do.
 */
export interface SequenceStore<S extends ClaimableSequence> {
  update<T>(
    leadId: string,
    fn: (seq: S | undefined) => { next?: S; extra?: Record<string, unknown>; result: T },
  ): Promise<T>
}

export interface StepSender {
  send(idempotencyKey: string): Promise<{ id: string }>
}

export type StepOutcome =
  | { action: "sent"; emailId: string }
  | { action: "skipped"; reason: "no_sequence" | "not_active" | "step_moved" | "claimed" }
  | { action: "stale"; claim: StepClaim }

/**
 * Send `step` of `leadId`'s sequence at most once. `advance` builds the
 * sequence (and any other lead fields) to store after a successful send; it
 * must clear `claim`. Throws the sender's error after releasing the claim.
 */
export async function sendStepOnce<S extends ClaimableSequence>(args: {
  leadId: string
  step: number
  runId: string
  now: () => Date
  store: SequenceStore<S>
  sender: StepSender
  advance: (seq: S, emailId: string, at: Date) => { next: S; extra?: Record<string, unknown> }
}): Promise<StepOutcome> {
  const { leadId, step, runId, now, store, sender, advance } = args

  // 1. Claim.
  const claimed = await store.update(leadId, (seq) => {
    const decision = decideClaim(seq, step, now())
    if (decision.kind === "claim" && seq) {
      return {
        next: { ...seq, claim: { step, claimed_at: now().toISOString(), run_id: runId } },
        result: { decision, enrolledAt: seq.enrolled_at },
      }
    }
    if (decision.kind === "stale" && seq) {
      // Pause and flag; never retry a step that may already have been sent.
      return {
        next: {
          ...seq,
          status: "paused",
          needs_review: { step, claimed_at: decision.claim.claimed_at, flagged_at: now().toISOString() },
        },
        result: { decision, enrolledAt: seq.enrolled_at },
      }
    }
    return { result: { decision, enrolledAt: seq?.enrolled_at ?? "" } }
  })

  if (claimed.decision.kind === "skip") return { action: "skipped", reason: claimed.decision.reason }
  if (claimed.decision.kind === "stale") return { action: "stale", claim: claimed.decision.claim }

  const holdsClaim = (seq: S | undefined): seq is S =>
    !!seq && !!seq.claim && seq.claim.run_id === runId && seq.claim.step === step

  // 2. Send.
  let emailId: string
  try {
    emailId = (await sender.send(idempotencyKey(leadId, claimed.enrolledAt, step))).id
  } catch (err) {
    // 3a. Release, so the next run retries this step with the same key.
    await store.update(leadId, (seq) =>
      holdsClaim(seq) ? { next: { ...seq, claim: null }, result: null } : { result: null },
    )
    throw err
  }

  // 3b. Settle.
  await store.update(leadId, (seq) => {
    if (!holdsClaim(seq)) return { result: null }
    const { next, extra } = advance(seq, emailId, now())
    return { next: { ...next, claim: null }, extra, result: null }
  })
  return { action: "sent", emailId }
}

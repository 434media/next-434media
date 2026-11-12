/**
 * D1, the engine durability test: the smallest run the plan needs (434-context `04 Build/434_Engine_Durability_D1.md`).
 * TEST BRANCH ONLY: never merged, never run in Production; made-up data in the staging store only.
 *
 * A run drafts, writes its run record to Firestore, waits on a hook for an approval, and on resume reads the current
 * rules version and kill flag from Firestore (not from the code it was pinned to) before it acts. Every step appends
 * its own event, so the run can be rebuilt from Firestore alone.
 */
import { createHook, getWorkflowMetadata } from "workflow"
import type { D1Approval, D1Input, D1Outcome } from "@/lib/d1/durability"

/** The hook token must match lib/d1/durability.ts d1HookToken; kept inline because the workflow bundle is sandboxed. */
function hookToken(runId: string): string {
  return `d1-approval-${runId}`
}

export async function d1DurabilityRun(input: D1Input): Promise<{ runId: string; outcome: D1Outcome }> {
  "use workflow"

  const { workflowRunId: runId } = getWorkflowMetadata()
  const token = hookToken(runId)

  await recordDraft(runId, token, input)

  const hook = createHook<D1Approval>({ token })
  const approval = await hook

  const outcome = await decideAtResume(runId, input, approval)
  if (outcome === "completed") await completeRun(runId)
  return { runId, outcome }
}

/** Step 1: draft (made-up text) and write the run record plus its first event. */
async function recordDraft(runId: string, token: string, input: D1Input): Promise<void> {
  "use step"
  const { getDb } = await import("@/lib/firebase-admin")
  const { D1_RUNS, D1_EVENTS, currentDeploymentId } = await import("@/lib/d1/durability")
  const db = getDb()
  const now = new Date().toISOString()
  const deploymentId = currentDeploymentId()
  const draft = `Made-up draft for "${input.label}" (D1 test, scope ${input.scope}). Not a real message; never sent.`
  const ref = db.collection(D1_RUNS).doc(runId)
  await ref.set(
    {
      run_id: runId,
      scope: input.scope,
      label: input.label,
      input,
      draft,
      rules_version_at_start: input.rulesVersionAtStart,
      started_deployment_id: deploymentId,
      started_at: now,
      hook_token: token,
      waiting_for: { kind: "approval", hook_token: token, since: now },
      status: "waiting_approval",
      restart_of: input.restartOf ?? null,
      updated_at: now,
    },
    { merge: true },
  )
  await ref.collection(D1_EVENTS).doc(`01-drafted`).set({
    step: "drafted",
    at: now,
    deployment_id: deploymentId,
    detail: { draft, rules_version_at_start: input.rulesVersionAtStart },
  })
}

/**
 * Step 3: on resume, read the controls from Firestore now, not the values the run started with. A changed rules version
 * or a set kill flag refuses the run (the plan's "security revocations always override that pinned version").
 */
async function decideAtResume(runId: string, input: D1Input, approval: D1Approval): Promise<D1Outcome> {
  "use step"
  const { getDb } = await import("@/lib/firebase-admin")
  const { D1_RUNS, D1_EVENTS, D1_CONTROLS, currentDeploymentId } = await import("@/lib/d1/durability")
  const db = getDb()
  const now = new Date().toISOString()
  const deploymentId = currentDeploymentId()
  const controls = (await db.collection(D1_CONTROLS).doc(input.scope).get()).data() ?? {}
  const rulesNow = typeof controls.rules_version === "string" ? controls.rules_version : null
  const killed = controls.kill === true

  let outcome: D1Outcome
  if (!approval.approved) outcome = "declined"
  else if (killed) outcome = "refused_kill"
  else if (rulesNow !== input.rulesVersionAtStart) outcome = "refused_rules_changed"
  else outcome = "completed"

  const ref = db.collection(D1_RUNS).doc(runId)
  await ref.collection(D1_EVENTS).doc(`02-resumed`).set({
    step: "resumed",
    at: now,
    deployment_id: deploymentId,
    detail: {
      approval,
      controls_read_at_resume: { rules_version: rulesNow, kill: killed },
      rules_version_at_start: input.rulesVersionAtStart,
      decision: outcome,
    },
  })
  await ref.set(
    {
      status: outcome === "completed" ? "approved_completing" : outcome,
      resumed_at: now,
      resumed_deployment_id: deploymentId,
      waiting_for: null,
      updated_at: now,
    },
    { merge: true },
  )
  return outcome
}

/** Step 4: the act itself. In D1 it only records that it would have acted; nothing is sent anywhere. */
async function completeRun(runId: string): Promise<void> {
  "use step"
  const { getDb } = await import("@/lib/firebase-admin")
  const { D1_RUNS, D1_EVENTS, currentDeploymentId } = await import("@/lib/d1/durability")
  const db = getDb()
  const now = new Date().toISOString()
  const ref = db.collection(D1_RUNS).doc(runId)
  await ref.collection(D1_EVENTS).doc(`03-completed`).set({
    step: "completed",
    at: now,
    deployment_id: currentDeploymentId(),
    detail: { acted: "recorded only; D1 sends nothing" },
  })
  await ref.set({ status: "completed", completed_at: now, updated_at: now }, { merge: true })
}

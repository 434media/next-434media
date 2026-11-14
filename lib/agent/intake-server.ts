/**
 * The live wiring for intake on the engine (lib/agent/intake.ts): Firestore, the kill switch, the founder's pin, the
 * skill read from 434-context through the GitHub App, decision memory, and models by slug through the guarded Gateway
 * (lib/engine/guard.ts installs itself as the default provider, so a slug is checked against the allow-list and every
 * call is recorded against the task).
 *
 * Server only. Firestore and the App are imported when called, never when this module loads.
 */
import { randomUUID } from "node:crypto"
import type { LanguageModel } from "ai"
import { COLLECTIONS } from "../firebase-admin"
import { readAgentControls } from "./controls"
import { firestoreAgentDb } from "./ledger-server"
import { AGENT_SKILLS_COLLECTION, INTAKE_SKILL, queueIntake, runIntake, type IntakeDeps, type IntakeSubmission, type SkillPin } from "./intake"
import { vercelSandbox } from "./skill-scripts"

const str = (v: unknown) => (typeof v === "string" ? v : undefined)

export async function readPin(skill = INTAKE_SKILL): Promise<SkillPin | null> {
  const { getDb } = await import("../firebase-admin")
  const snap = await getDb().collection(AGENT_SKILLS_COLLECTION).doc(skill).get()
  return snap.exists ? (snap.data() as SkillPin) : null
}

async function readSubmission(formId: string): Promise<IntakeSubmission | null> {
  const { getDb } = await import("../firebase-admin")
  const d = (await getDb().collection(COLLECTIONS.CONTACT_FORMS).doc(formId).get()).data()
  if (!d || typeof d.email !== "string") return null
  return {
    id: formId,
    firstName: str(d.firstName) ?? "",
    lastName: str(d.lastName) ?? "",
    company: str(d.company) ?? "",
    email: d.email,
    role: str(d.role),
    organizationType: str(d.organizationType),
    requestType: str(d.requestType),
    timeline: str(d.timeline),
    budgetRange: str(d.budgetRange),
    referralSource: str(d.referralSource),
    message: str(d.message),
    created_at: str(d.created_at) ?? "",
  }
}

/** The newest decisions about the person (by email) and their company (by domain), bounded. Never throws. */
async function readDecisionMemory(email: string): Promise<string> {
  try {
    const [{ findPersonByEmail }, { findOrganizationByDomain }, { domainFromEmail }, { listDecisions, summarizeForSkill }] = await Promise.all([
      import("../firestore-people"),
      import("../firestore-organizations"),
      import("../core-model/identity"),
      import("../core-model/decisions"),
    ])
    const person = await findPersonByEmail(email)
    const domain = domainFromEmail(email)
    const org = domain ? await findOrganizationByDomain(domain) : null
    const all = [...(person ? await listDecisions("person", person.id) : []), ...(org ? await listDecisions("organization", org.id) : [])]
    return summarizeForSkill(all, 5)
  } catch (e) {
    console.error("[agent:intake] decision memory could not be read; running without it:", e instanceof Error ? e.message : e)
    return ""
  }
}

export function liveIntakeDeps(): IntakeDeps {
  return {
    db: firestoreAgentDb(),
    controls: () => readAgentControls(),
    pin: () => readPin(),
    skillAt: async (commit) => (await import("../skills/source")).readSkillAt(INTAKE_SKILL, commit),
    submission: readSubmission,
    decisions: readDecisionMemory,
    // A slug resolves through the guarded Gateway, the AI SDK's default provider (instrumentation.ts).
    model: (slug) => slug as LanguageModel,
    sandbox: vercelSandbox,
    now: () => new Date().toISOString(),
    runId: `run-${randomUUID()}`,
  }
}

/**
 * Called from the contact-form route after the response is sent: the task, then the run. Best effort: a failure here
 * never touches the submission, and a task left `queued` is picked up by the sweep (app/api/cron/agent-sweep).
 */
export async function intakeOnArrival(arrival: { formId: string; email: string }): Promise<void> {
  const deps = liveIntakeDeps()
  const controls = await deps.controls()
  const taskId = await queueIntake(deps.db, arrival, controls, deps.now())
  if (!taskId) return
  const out = await runIntake(taskId, deps)
  console.info(`[agent:intake] task ${taskId}: ${out.ok ? `drafted (${out.outcome})` : `not drafted (${out.code})`}`)
}

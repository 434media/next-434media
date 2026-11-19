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
import { AGENT_SKILLS_COLLECTION, INTAKE_SKILL, queueIntake, runIntake, type ArrivalMark, type IntakeDeps, type IntakeSubmission, type SkillPin } from "./intake"
import { vercelSandbox } from "./skill-scripts"
import { monthlyCapUsd } from "../spend-caps"
import { DISMISSED_SENDERS_COLLECTION, type DismissedSenders } from "./solicitation"

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
    const [{ findPersonByEmail }, { findOrganizationByDomain }, { domainFromEmail, normalizeEmail }, { listDecisions, summarizeForSkill }] = await Promise.all([
      import("../firestore-people"),
      import("../firestore-organizations"),
      import("../core-model/identity"),
      import("../core-model/decisions"),
    ])
    const person = await findPersonByEmail(email)
    const domain = domainFromEmail(email)
    const org = domain ? await findOrganizationByDomain(domain) : null
    const { emailClaimId } = await import("../core-model/firestore-util")
    const all = [
      ...(person ? await listDecisions("person", person.id) : []),
      ...(org ? await listDecisions("organization", org.id) : []),
      ...(await listDecisions("contact", emailClaimId(normalizeEmail(email)))),
    ]
    return summarizeForSkill(all, 5)
  } catch (e) {
    console.error("[agent:intake] decision memory could not be read; running without it:", e instanceof Error ? e.message : e)
    return ""
  }
}

/**
 * The token guard's reading: "spam" when the old inbox marked the submission spam; "duplicate" when a draft to the same
 * address was made within an approval's life and was not rejected (waiting, approved or sent). Fails open to null on a
 * read error, so a broken read never blocks intake; the founder still reviews every draft.
 */
export async function readArrivalMark(formId: string, email: string): Promise<ArrivalMark> {
  try {
    const { getDb } = await import("../firebase-admin")
    const { DEFAULT_APPROVAL_TTL_MS } = await import("../send-approval")
    const { SEND_APPROVALS_COLLECTION } = await import("./send-email")
    const d = getDb()
    const state = (await d.collection("submission_states").doc(`contact_forms:${formId}`).get()).data()
    if (state?.state === "spam") return "spam"
    const since = new Date(Date.now() - DEFAULT_APPROVAL_TTL_MS).toISOString()
    const prior = await d.collection(SEND_APPROVALS_COLLECTION).where("payload.to", "array-contains", email).limit(20).get()
    const live = prior.docs.some((x) => {
      const a = x.data() as { createdAt?: string; rejection?: unknown; arrival?: { formId?: string } }
      return a.arrival?.formId !== formId && !a.rejection && typeof a.createdAt === "string" && a.createdAt >= since
    })
    return live ? "duplicate" : null
  } catch (e) {
    console.error("[agent:intake] the spam and duplicate check could not read; running without it:", e instanceof Error ? e.message : e)
    return null
  }
}

/** Every sender and company domain the founder dismissed (small: one row per dismissal). Throws on a read error. */
export async function readDismissedSenders(): Promise<DismissedSenders> {
  const { getDb } = await import("../firebase-admin")
  const snap = await getDb().collection(DISMISSED_SENDERS_COLLECTION).limit(5000).get()
  const emails = new Set<string>(), domains = new Set<string>()
  for (const d of snap.docs) {
    const x = d.data() as { email?: unknown; domain?: unknown }
    if (typeof x.email === "string" && x.email) emails.add(x.email)
    if (typeof x.domain === "string" && x.domain) domains.add(x.domain)
  }
  return { emails, domains }
}

export function liveIntakeDeps(): IntakeDeps {
  return {
    db: firestoreAgentDb(),
    controls: () => readAgentControls(),
    pin: () => readPin(),
    skillAt: async (commit) => (await import("../skills/source")).readSkillAt(INTAKE_SKILL, commit),
    submission: readSubmission,
    decisions: readDecisionMemory,
    arrivalMark: readArrivalMark,
    dismissedSenders: readDismissedSenders,
    // A slug resolves through the guarded Gateway, the AI SDK's default provider (instrumentation.ts).
    model: (slug) => slug as LanguageModel,
    taskSpend: async (root) => (await import("../engine/cost-ledger")).readTaskSpend(root),
    monthSpend: async () => (await import("../spend-caps-server")).readMonthSpend("intake"),
    monthlyCapUsd: monthlyCapUsd("intake"),
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

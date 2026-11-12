/**
 * D1, the engine durability test (434-context `04 Build/434_Engine_Durability_D1.md`). TEST BRANCH ONLY: never merged,
 * never run in Production. Everything here writes made-up data to the staging store (c434-staging) and nowhere else.
 *
 * Firestore is the record; the engine's state is a cache of it. Every material step of a run writes its own record, so
 * a run the engine has lost can be rebuilt from these collections alone (the test's step 5).
 */

/** The rules version this deployment ships. The 3-day step changes it and redeploys (the test's step 3). */
export const D1_RULES_VERSION = "d1-rules@1"

/** One document per run, keyed by the engine's run id. */
export const D1_RUNS = "d1_runs"
/** One events subcollection per run: every step appends its own record. */
export const D1_EVENTS = "events"
/** One document per scope: the published rules version and the kill flag, read at resume. */
export const D1_CONTROLS = "d1_controls"

/** The only store D1 may touch. */
export const D1_STAGING_PROJECT = "c434-staging"

/** The four runs the plan calls for, one scope each, so a change to one scope's controls touches only its run. */
export const D1_SCOPES = ["rule-change", "kill", "control", "rebuild"] as const
export type D1Scope = (typeof D1_SCOPES)[number]

export interface D1Input {
  scope: D1Scope
  /** Made-up label for the draft, so the records read as a real run would. */
  label: string
  /** The rules version the run started under (this deployment's D1_RULES_VERSION). */
  rulesVersionAtStart: string
  /** When a run restarts a lost one (step 5), the run it replaces. */
  restartOf?: string
}

export interface D1Approval {
  approved: boolean
  by: string
}

export type D1Outcome = "completed" | "declined" | "refused_rules_changed" | "refused_kill"

/** The hook token is derived from the run id, so it can be rebuilt from Firestore alone and is stable across replays. */
export function d1HookToken(runId: string): string {
  return `d1-approval-${runId}`
}

/** This function's deployment. On a resumed run it shows which deployment actually ran the step. */
export function currentDeploymentId(): string | null {
  return process.env.VERCEL_DEPLOYMENT_ID ?? null
}

/**
 * The preview-only guard. D1 refuses in Production, refuses outside a Vercel preview, and refuses unless the store it
 * would write is the staging project. Returns the reason it refuses, or null to proceed.
 */
export function d1Refusal(env: Record<string, string | undefined> = process.env): string | null {
  if (env.VERCEL_ENV === "production") return "D1 is test-only and refuses in Production"
  if (env.VERCEL_ENV !== "preview") return "D1 runs only on a Vercel preview"
  if (env.FIREBASE_PROJECT_ID !== D1_STAGING_PROJECT) return `D1 writes only to ${D1_STAGING_PROJECT}`
  // The keyless path takes precedence over any key (lib/firebase-admin.ts), so a staging service account here means
  // every Firestore call reaches the staging project.
  if (!env.GCP_SERVICE_ACCOUNT_EMAIL?.endsWith(`@${D1_STAGING_PROJECT}.iam.gserviceaccount.com`)) {
    return "D1 needs the keyless staging service account"
  }
  return null
}

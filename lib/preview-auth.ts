/**
 * Which sign-in a deployment may use (preview sign-in against the staging store, V1 item 2 follow-up).
 *
 * Production signs in against production, as before: nothing here changes what production accepts. A Vercel preview
 * signs in only against the staging project, `c434-staging` (made-up data only, System Map "staging store, R10"):
 *  - the server verifies Firebase ID tokens for c434-staging only, so a token from production's Firebase Auth fails;
 *  - Google OAuth is off, since it would bring a production Google identity into a preview;
 *  - the owners are `STAGING_ADMIN_OWNER_EMAILS`, the staging test accounts, never production's `ADMIN_OWNER_EMAILS`;
 *  - a session cookie signed on a preview never verifies anywhere else (lib/session-cookie.ts, sessionSigningContext).
 *
 * Fails closed. An unset or unknown VERCEL_ENV counts as production. A preview whose configuration does not name
 * c434-staging everywhere is refused sign-in rather than allowed to fall back to anything else.
 *
 * Pure: every function takes the environment, so the tests run without Vercel or Firebase
 * (lib/__tests__/preview-auth.test.ts).
 */

export const STAGING_PROJECT_ID = "c434-staging"

type Env = Record<string, string | undefined>

export type DeployEnv = "production" | "preview" | "development"

/** Vercel's VERCEL_ENV, with anything else (unset included) read as production. */
export function deployEnv(env: Env = process.env): DeployEnv {
  if (env.VERCEL_ENV === "preview") return "preview"
  if (env.VERCEL_ENV === "development") return "development"
  return "production"
}

export function isPreview(env: Env = process.env): boolean {
  return deployEnv(env) === "preview"
}

/** The five variables that switch the server to the keyless path (lib/gcp-keyless.ts). */
const KEYLESS_ENV = [
  "GCP_PROJECT_NUMBER",
  "GCP_WORKLOAD_IDENTITY_POOL_ID",
  "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
  "GCP_SERVICE_ACCOUNT_EMAIL",
  "FIREBASE_PROJECT_ID",
] as const

export type AuthProjectCheck =
  | { ok: true; env: DeployEnv; projectId: string | null }
  | { ok: false; env: DeployEnv; reason: string }

/**
 * Whether this deployment's sign-in configuration is allowed for its environment. Runs before any token is verified.
 *
 * Preview: the server must be on the keyless path (no key, which is production's credential) with
 * FIREBASE_PROJECT_ID = c434-staging, its service account must be staging's, and the browser's Firebase config
 * (NEXT_PUBLIC_FIREBASE_PROJECT_ID) must name c434-staging too, or the tokens it sends would be production's.
 *
 * Production and development: allowed as before (projectId null: the Firebase app's own project decides), except that
 * production never signs in against the staging project.
 */
export function checkAuthProject(env: Env = process.env): AuthProjectCheck {
  const de = deployEnv(env)
  if (de === "preview") {
    const missing = KEYLESS_ENV.filter((k) => !env[k])
    if (missing.length > 0) return { ok: false, env: de, reason: `preview is not on the keyless staging path (missing ${missing.join(", ")})` }
    if (env.FIREBASE_PROJECT_ID !== STAGING_PROJECT_ID) return { ok: false, env: de, reason: "preview server project is not c434-staging" }
    if (!env.GCP_SERVICE_ACCOUNT_EMAIL!.endsWith(`@${STAGING_PROJECT_ID}.iam.gserviceaccount.com`)) {
      return { ok: false, env: de, reason: "preview service account is not a c434-staging account" }
    }
    if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== STAGING_PROJECT_ID) {
      return { ok: false, env: de, reason: "preview browser Firebase config is not c434-staging" }
    }
    return { ok: true, env: de, projectId: STAGING_PROJECT_ID }
  }
  if (de === "production" && (env.FIREBASE_PROJECT_ID === STAGING_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === STAGING_PROJECT_ID)) {
    return { ok: false, env: de, reason: "production must not sign in against the staging project" }
  }
  return { ok: true, env: de, projectId: null }
}

/**
 * A verified Firebase ID token's project, checked against the one this deployment expects. firebase-admin already
 * checks `aud` against the app's project; this repeats it in the route so the preview rule does not depend on how the
 * Admin SDK was initialized.
 */
export function tokenProjectAllowed(token: { aud?: unknown; iss?: unknown }, check: AuthProjectCheck): boolean {
  if (!check.ok) return false
  if (check.projectId === null) return true
  return token.aud === check.projectId && token.iss === `https://securetoken.google.com/${check.projectId}`
}

/** Google OAuth signs in with a production Google identity, so it is closed on a preview. */
export function googleSignInAllowed(env: Env = process.env): boolean {
  return !isPreview(env)
}

/**
 * The variable that names the owners for this environment: production's `ADMIN_OWNER_EMAILS`, or on a preview the
 * staging test accounts in `STAGING_ADMIN_OWNER_EMAILS` (set in Vercel's Preview environment only). Production never
 * reads the staging list, and a preview never reads production's.
 */
export function ownerEmailsVariable(env: Env = process.env): "ADMIN_OWNER_EMAILS" | "STAGING_ADMIN_OWNER_EMAILS" {
  return isPreview(env) ? "STAGING_ADMIN_OWNER_EMAILS" : "ADMIN_OWNER_EMAILS"
}

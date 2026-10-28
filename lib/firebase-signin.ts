import type { AdminRole } from "./auth"

/**
 * The admin's email-and-password sign-in decision (security log ADM-1), kept apart from the route so it can be tested
 * without Firebase.
 *
 * The Firebase Auth tenant is shared across 434's web projects, and its accounts can be created with any address. A
 * token's `email` alone proves nothing about who holds that inbox, so:
 *  - the token must say `email_verified`: the holder has opened a link sent to the address;
 *  - in production, a 434 workspace address must come through Google sign-in instead. Previews keep the email path for
 *    workspace staff, because Google sign-in does not work on preview hosts.
 * Only then does the roster decide (authorizeAdminSignIn).
 */
export interface FirebaseIdentity {
  email?: string
  email_verified?: boolean
}

export type FirebaseSignInDecision =
  | { ok: true; email: string; role: AdminRole; name?: string }
  | { ok: false; status: 400 | 403; error: "email_missing" | "email_not_verified" | "workspace_use_google" | "not_authorized"; reason: string }

export interface FirebaseSignInDeps {
  authorize(email: string): Promise<{ authorized: true; role: AdminRole; name?: string } | { authorized: false; reason: string }>
  isWorkspaceEmail(email: string): boolean
  /** Vercel's VERCEL_ENV: "production", "preview" or "development"; undefined off Vercel. */
  vercelEnv?: string
}

export async function decideFirebaseSignIn(token: FirebaseIdentity, deps: FirebaseSignInDeps): Promise<FirebaseSignInDecision> {
  const email = token.email?.trim().toLowerCase()
  if (!email) return { ok: false, status: 400, error: "email_missing", reason: "no email in token" }
  if (token.email_verified !== true) return { ok: false, status: 403, error: "email_not_verified", reason: "email not verified" }
  if (deps.vercelEnv === "production" && deps.isWorkspaceEmail(email)) {
    return { ok: false, status: 403, error: "workspace_use_google", reason: "workspace address on the email path" }
  }
  const decision = await deps.authorize(email)
  if (!decision.authorized) return { ok: false, status: 403, error: "not_authorized", reason: decision.reason }
  return { ok: true, email, role: decision.role, name: decision.name }
}

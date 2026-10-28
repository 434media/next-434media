import { cookies } from "next/headers"
import { SESSION_COOKIE, parseSessionCookie, type User } from "./session-cookie"

/**
 * The founder-only guard (V1 item 1, finance Phase 0). Money data is the founder's alone, so this is narrower than every
 * role in lib/auth.ts: not a role, but one fixed identity.
 *
 * Why an identity and not a role: roles live in `crm_team_members` and are changed from admin settings by any super
 * admin, so a "founder" role could be granted from inside the admin by someone who is not the founder. The founder is
 * named instead in server-only configuration, `ADMIN_FOUNDER_EMAIL`, set in the Vercel project. Nothing in the admin can
 * change it, and no address is written into code.
 *
 * Deny by default: no session is 401; a missing or malformed setting, an unverified email or any other address is 403.
 * The check runs on the server on every request: in proxy.ts for the page's status, again in the page before it renders,
 * and on each API route. It reads only the signed session cookie and the setting, never Firestore, so the proxy can run it.
 */
export const FOUNDER_EMAIL_ENV = "ADMIN_FOUNDER_EMAIL"

const ONE_ADDRESS = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

/** The configured founder address, lower-cased, or null when unset or not exactly one address. */
export function founderEmail(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env[FOUNDER_EMAIL_ENV]?.trim().toLowerCase()
  return raw && ONE_ADDRESS.test(raw) ? raw : null
}

export type FounderDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; error: string; reason: "no_session" | "not_configured" | "unverified" | "not_founder" }

/**
 * The decision, kept pure so it can be tested without a request. The email must be verified at sign-in: Google sessions
 * are workspace accounts, and a Firebase session carries the token's `email_verified`. Without that, an unverified
 * account registered under the founder's address would pass on the address alone.
 */
export function founderDecision(session: User | null, founder: string | null): FounderDecision {
  if (!session) return { allowed: false, status: 401, error: "Unauthorized", reason: "no_session" }
  const forbidden = (reason: "not_configured" | "unverified" | "not_founder") =>
    ({ allowed: false, status: 403, error: "Forbidden: founder only", reason }) as const
  if (!founder) return forbidden("not_configured")
  if (session.email.toLowerCase() !== founder) return forbidden("not_founder")
  if (session.emailVerified !== true) return forbidden("unverified")
  return { allowed: true }
}

/** Logs a refusal with who and why; never the configured address. */
function logRefusal(where: string, session: User | null, decision: FounderDecision) {
  if (decision.allowed) return
  if (decision.reason === "not_configured") console.error(`[founder-guard] ${where}: ${FOUNDER_EMAIL_ENV} is not set to one address; denying`)
  else console.warn(`[founder-guard] ${where}: denied ${session?.email ?? "no session"} (${decision.reason})`)
}

async function getSession(): Promise<User | null> {
  return parseSessionCookie((await cookies()).get(SESSION_COOKIE)?.value)
}

/**
 * The API gate, in the admin-api-route shape: call it first in every handler, before reading params or the body.
 */
export async function requireFounder(where: string): Promise<{ session: User } | { error: string; status: 401 | 403 }> {
  const session = await getSession()
  const decision = founderDecision(session, founderEmail())
  if (!decision.allowed) {
    logRefusal(where, session, decision)
    return { error: decision.error, status: decision.status }
  }
  return { session: session! }
}

/** The page gate's answer, for a server component that renders sign-in, refusal or the page. */
export async function founderPageAccess(where: string): Promise<"signed_out" | "forbidden" | "allowed"> {
  const session = await getSession()
  const decision = founderDecision(session, founderEmail())
  if (decision.allowed) return "allowed"
  if (decision.reason === "no_session") return "signed_out"
  logRefusal(where, session, decision)
  return "forbidden"
}

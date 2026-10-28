import { cookies } from "next/headers"
import { SESSION_COOKIE, parseSessionCookie, type User } from "./session-cookie"

/**
 * The founder-only guard (V1 item 1, finance Phase 0). Money data is the founder's alone, so this is narrower than every
 * role in lib/auth.ts: not a role, but the founder's own addresses.
 *
 * Why an identity and not a role: roles live in `crm_team_members` and are changed from admin settings by any super
 * admin, so a "founder" role could be granted from inside the admin by someone who is not the founder. The founder is
 * named instead in server-only configuration, `ADMIN_FOUNDER_EMAIL`, set in the Vercel project: his address, or his
 * addresses comma-separated when he signs in with more than one (Google on the live site, email on previews). It names
 * the founder only, never anyone else. Nothing in the admin can change it, and no address is written into code.
 *
 * Deny by default: no session is 401; a missing or malformed setting, an unverified email or any other address is 403.
 * The check runs on the server on every request: in proxy.ts for the page's status, again in the page before it renders,
 * and on each API route. It reads only the signed session cookie and the setting, never Firestore, so the proxy can run it.
 */
export const FOUNDER_EMAIL_ENV = "ADMIN_FOUNDER_EMAIL"

const ADDRESS = /^[^\s@,;"'<>]+@[^\s@,;"'<>]+\.[^\s@,;"'<>]+$/

function entries(env: Record<string, string | undefined>): string[] {
  return (env[FOUNDER_EMAIL_ENV] ?? "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)
}

/** The founder's configured addresses, lower-cased; empty when unset or when no entry is an address. */
export function founderEmails(env: Record<string, string | undefined> = process.env): string[] {
  return entries(env).filter((e) => ADDRESS.test(e))
}

/** The setting's shape for a log line, never its contents: how many entries it holds and how many are addresses. */
export function founderSettingShape(env: Record<string, string | undefined> = process.env): string {
  const all = entries(env)
  return all.length === 0 ? "unset or empty" : `${all.length} entr${all.length === 1 ? "y" : "ies"}, ${all.filter((e) => ADDRESS.test(e)).length} valid`
}

export type FounderDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; error: string; reason: "no_session" | "not_configured" | "unverified" | "not_founder" }

/**
 * The decision, kept pure so it can be tested without a request. The email must be verified at sign-in: Google sessions
 * are workspace accounts, and a Firebase session carries the token's `email_verified`. Without that, an unverified
 * account registered under the founder's address would pass on the address alone.
 */
export function founderDecision(session: User | null, founders: string[]): FounderDecision {
  if (!session) return { allowed: false, status: 401, error: "Unauthorized", reason: "no_session" }
  const forbidden = (reason: "not_configured" | "unverified" | "not_founder") =>
    ({ allowed: false, status: 403, error: "Forbidden: founder only", reason }) as const
  if (founders.length === 0) return forbidden("not_configured")
  if (!founders.includes(session.email.toLowerCase())) return forbidden("not_founder")
  if (session.emailVerified !== true) return forbidden("unverified")
  return { allowed: true }
}

/** Logs a refusal with who and why; never the configured address. */
function logRefusal(where: string, session: User | null, decision: FounderDecision) {
  if (decision.allowed) return
  if (decision.reason === "not_configured") console.error(`[founder-guard] ${where}: ${FOUNDER_EMAIL_ENV} holds no address (${founderSettingShape()}); denying`)
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
  const decision = founderDecision(session, founderEmails())
  if (!decision.allowed) {
    logRefusal(where, session, decision)
    return { error: decision.error, status: decision.status }
  }
  return { session: session! }
}

/** The page gate's answer, for a server component that renders sign-in, refusal or the page. */
export async function founderPageAccess(where: string): Promise<"signed_out" | "forbidden" | "allowed"> {
  const session = await getSession()
  const decision = founderDecision(session, founderEmails())
  if (decision.allowed) return "allowed"
  if (decision.reason === "no_session") return "signed_out"
  logRefusal(where, session, decision)
  return "forbidden"
}

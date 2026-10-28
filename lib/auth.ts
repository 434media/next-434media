import { cookies } from 'next/headers'
import { ADMIN_ROLES, SESSION_COOKIE, parseSessionCookie, signPayload } from './session-cookie'
import type { AdminRole, AuthProvider, User } from './session-cookie'

export type { AdminRole, AuthProvider, User } from './session-cookie'
export { parseSessionCookie } from './session-cookie'

/**
 * The owners: super admins named in server-only configuration, `ADMIN_OWNER_EMAILS` (comma-separated), set in the
 * Vercel project. An owner is a super admin on every check, even with no roster record and while Firestore is
 * unreachable, so the people who run the admin can always reach its settings. Everyone else's role comes from the
 * roster (`crm_team_members`).
 *
 * No access check in this repository names an address: owners, and the owners-only Facebook recovery in the publisher
 * (app/api/admin/crm/content-posts/[id]/owned-meta), read this setting. Unset, it names no owner, every role comes from
 * the roster, and that recovery is open to no one.
 */

export function ownerEmails(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ADMIN_OWNER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

export function isOwnerEmail(email?: string | null, env: Record<string, string | undefined> = process.env): boolean {
  if (!email) return false
  return ownerEmails(env).includes(email.toLowerCase())
}


// Define which admin sections each role can access.
//
// `intern` is a broad-read / narrow-act role (cohort interns): it can VIEW the
// dashboard, CRM, and analytics (read-only — mutating analytics actions like
// goals/annotations are gated at the route level), but is excluded from publish
// and marketing-ops surfaces (blog, email lists, events, feed form). Page-level
// surfaces gated by <AdminRoleGuard> (leads, content, the cohort board, SOPs)
// grant `intern` separately on each page.
export const ADMIN_SECTIONS = {
  dashboard: { path: '/admin', roles: ['full_admin', 'crm_only', 'intern'] },
  analytics: { path: '/admin/analytics', roles: ['full_admin', 'intern'] },
  analyticsInstagram: { path: '/admin/analytics-instagram', roles: ['full_admin', 'intern'] },
  analyticsWeb: { path: '/admin/analytics-web', roles: ['full_admin', 'intern'] },
  blog: { path: '/admin/blog', roles: ['full_admin'] },
  crm: { path: '/admin/opportunities', roles: ['full_admin', 'crm_only', 'intern'] },
  emailLists: { path: '/admin/email-lists', roles: ['full_admin'] },
  events: { path: '/admin/events', roles: ['full_admin'] },
  feedForm: { path: '/admin/feed-form', roles: ['full_admin'] },
} as const

export type AdminSection = keyof typeof ADMIN_SECTIONS

/**
 * Check if a user has access to a specific admin section
 */
export function canAccessSection(user: User | null, section: AdminSection): boolean {
  if (!user) return false
  const role = user.role || 'crm_only'
  return (ADMIN_SECTIONS[section].roles as readonly AdminRole[]).includes(role)
}

/**
 * Check if a user can access a path
 */
export function canAccessPath(user: User | null, path: string): boolean {
  if (!user) return false
  const role = user.role || 'crm_only'
  
  // Find matching section for this path
  for (const section of Object.values(ADMIN_SECTIONS)) {
    if (path.startsWith(section.path) && section.path !== '/admin') {
      return (section.roles as readonly AdminRole[]).includes(role)
    }
  }
  
  // Default: allow access to /admin root for all authenticated users
  return true
}

/**
 * One roster record as the sign-in gate reads it (`crm_team_members`).
 */
export interface RosterRecord {
  isActive?: unknown
  role?: unknown
  name?: unknown
}

export type SignInDecision =
  | { authorized: true; role: AdminRole; name?: string }
  | {
      authorized: false
      reason: 'not_on_roster' | 'duplicate_roster_records' | 'deactivated' | 'no_role' | 'lookup_failed'
    }

/**
 * The sign-in decision for anyone who is not an owner, given the roster records that carry the address. Pure, so it is
 * tested without Firestore (lib/__tests__/admin-signin-roster.test.ts).
 *
 * The roster is the only source of a role, on every sign-in path (security log ADM-2). Least privilege throughout:
 *  - no record: refused. A workspace address or a Google account proves identity, not membership;
 *  - more than one record for the address: refused, since which one would decide is arbitrary;
 *  - `isActive: false`: refused. Deactivating someone in admin settings keeps them out, whichever way they sign in;
 *  - a role outside ADMIN_ROLES, or none: refused. No role is granted by default, least of all full_admin.
 */
export function decideRosterSignIn(records: RosterRecord[]): SignInDecision {
  if (records.length === 0) return { authorized: false, reason: 'not_on_roster' }
  if (records.length > 1) return { authorized: false, reason: 'duplicate_roster_records' }
  const data = records[0]
  if (data.isActive === false) return { authorized: false, reason: 'deactivated' }
  const role = data.role as AdminRole
  if (!ADMIN_ROLES.includes(role)) return { authorized: false, reason: 'no_role' }
  const name = typeof data.name === 'string' && data.name ? data.name : undefined
  return { authorized: true, role, name }
}

/**
 * Decide whether an authenticated identity may be issued an admin session.
 *
 * This is THE authorization gate, for the Google callback, the email-and-password sign-in, and the owned-meta service
 * and MCP entries alike. Neither way of proving who someone is says they may administer 434 Media: Firebase Auth is
 * shared across every 434 web project, and a Google account on the workspace domain stays valid for anyone who has
 * been deactivated here.
 *
 * Allowed:
 *  - an owner (ADMIN_OWNER_EMAILS), as a super admin, even with no roster record or Firestore unreachable;
 *  - anyone else only with exactly one ACTIVE `crm_team_members` record holding a valid role, managed in admin
 *    settings. That record's role is the session's role (decideRosterSignIn).
 *
 * The provider does not change the answer. Until ADM-2 a workspace address on Google was let in with no record, past a
 * deactivation, and defaulted to full_admin, even when the roster lookup failed.
 *
 * Fails CLOSED: if the Firestore lookup throws, everyone but the owners is denied.
 */
export async function authorizeAdminSignIn(email: string, _provider: AuthProvider): Promise<SignInDecision> {
  const lower = email.trim().toLowerCase()

  if (isOwnerEmail(lower)) {
    return { authorized: true, role: 'crm_super_admin' }
  }

  try {
    const { getDb } = await import('./firebase-admin')
    // Two is enough to tell one record from several.
    const snap = await getDb()
      .collection('crm_team_members')
      .where('email', '==', lower)
      .limit(2)
      .get()
    return decideRosterSignIn(snap.docs.map((d) => d.data() as RosterRecord))
  } catch (error) {
    console.error('[auth] authorizeAdminSignIn lookup failed; denying:', error)
    return { authorized: false, reason: 'lookup_failed' }
  }
}

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies()
  return parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value)
}

export async function setSession(user: User): Promise<void> {
  const cookieStore = await cookies()

  const sessionData = {
    user: {
      email: user.email,
      name: user.name,
      picture: user.picture,
      authProvider: user.authProvider,
      role: user.role,
      emailVerified: user.emailVerified === true,
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  }

  // Throws if the secret is missing — a login that can't be signed must fail,
  // not fall back to an unsigned cookie.
  const encodedPayload = Buffer.from(JSON.stringify(sessionData)).toString('base64url')
  const sessionValue = `${encodedPayload}.${signPayload(encodedPayload)}`

  cookieStore.set(SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export function workspaceDomain(): string {
  return process.env.WORKSPACE_DOMAIN || '434media.com'
}

export function isWorkspaceEmail(email: string): boolean {
  return email.endsWith(`@${workspaceDomain()}`)
}

/**
 * Cheap per-request sanity check on an already-verified session.
 *
 * This is NOT the authorization decision — `authorizeAdminSignIn` is, and it
 * runs once at login. By the time a route calls this, two things already hold:
 * the cookie carried a valid HMAC (so we minted it), and we only mint sessions
 * for owners and active roster members.
 *
 * It previously read `return !!email` while its docstring claimed Firebase
 * Console membership was an effective allowlist. It wasn't — the Console is
 * shared across every 434 web project — so this was the check that let a
 * partner-site account through. The real gate now lives at issuance; this
 * remains as a defensive non-null guard for the ~63 routes that call it.
 */
export function isAuthorizedAdmin(email: string): boolean {
  return !!email && email.includes('@')
}

/**
 * Async super-admin check. Reads the `role` field from `crm_team_members`
 * in Firestore. An owner (ADMIN_OWNER_EMAILS) is a super admin whatever
 * the roster says, including when the Firestore lookup fails.
 *
 * Server-side only — uses firebase-admin SDK.
 */
export async function isCrmSuperAdmin(email?: string | null): Promise<boolean> {
  if (!email) return false
  const lower = email.toLowerCase()
  if (isOwnerEmail(lower)) return true
  try {
    // Lazy import to keep this auth lib usable from edge runtime contexts
    const { getDb } = await import('./firebase-admin')
    const snap = await getDb()
      .collection('crm_team_members')
      .where('email', '==', lower)
      .limit(1)
      .get()
    if (snap.empty) return false
    return snap.docs[0].data().role === 'crm_super_admin'
  } catch (error) {
    console.error('[auth] isCrmSuperAdmin Firestore lookup failed; owners only:', error)
    return isOwnerEmail(lower)
  }
}

/**
 * The content permission (founder, 2026-10-19: the person who runs a brand's posts "needs to be able to create,
 * approve and schedule, full loop"). A team member whose `crm_team_members.permissions` includes "content" may use
 * the Create table (Human+, Run job), approve or reject content, and schedule and publish it, whatever their role;
 * their role still governs the rest of the Admin. Super-admins have it always. Recovery confirmations on the publisher
 * and connecting Canva stay super-admin only. Read from Firestore on every call; a failed lookup grants nothing beyond
 * the owners.
 */
export const CONTENT_PERMISSION = 'content'
export async function canRunContent(email?: string | null): Promise<boolean> {
  if (!email) return false
  const lower = email.toLowerCase()
  if (isOwnerEmail(lower)) return true
  try {
    // One read answers both: a super-admin by role (as isCrmSuperAdmin), or an active member holding "content".
    const { getDb } = await import('./firebase-admin')
    const snap = await getDb().collection('crm_team_members').where('email', '==', lower).limit(1).get()
    if (snap.empty) return false
    const data = snap.docs[0].data()
    if (data.role === 'crm_super_admin') return true
    return data.isActive !== false && Array.isArray(data.permissions) && data.permissions.includes(CONTENT_PERMISSION)
  } catch (error) {
    console.error('[auth] canRunContent Firestore lookup failed:', error)
    return false
  }
}

/**
 * Roles permitted to trigger OUTBOUND sends (Resend) on a user's behalf.
 * `crm_only` and `intern` can draft, not send.
 *
 * `intern` was temporarily included for the outreach-motion QA period (single
 * send + 3-email sequence enroll). That period is over and it has been removed,
 * restoring the draft-only posture — which also re-closes `requireFullAdmin`
 * below, since that guard is expressed in terms of this list.
 */
export const SEND_CAPABLE_ROLES: AdminRole[] = ['crm_super_admin', 'full_admin']

export function canSend(role?: AdminRole | null): boolean {
  return !!role && SEND_CAPABLE_ROLES.includes(role)
}

/**
 * Guard for outbound-send API routes (anything that calls Resend for a user).
 * Returns the session when the caller may send, otherwise an error to 4xx on.
 *
 * Blocks `crm_only` and `intern` sessions from firing 1:1 sends. Staff send with
 * a `full_admin` roster role. A super admin always passes via the Firestore-backed
 * check — even on a stale session role — so the owners are never locked out.
 */
export async function requireSendCapable(): Promise<
  { session: User } | { error: string; status: 401 | 403 }
> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized', status: 401 }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: 'Forbidden: Admin access required', status: 403 }
  }
  if (canSend(session.role) || (await isCrmSuperAdmin(session.email))) {
    return { session }
  }
  return {
    error: 'Forbidden: your role can draft but not send email. Ask an admin to send this.',
    status: 403,
  }
}

/**
 * Guard for operator-only API routes (cohort/sponsor/program management, etc.).
 * Allows full_admin + super admins; blocks crm_only and intern. Same role set as
 * sends/publishes, named for intent at the call site.
 */
export async function requireFullAdmin(): Promise<
  { session: User } | { error: string; status: 401 | 403 }
> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized', status: 401 }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: 'Forbidden: Admin access required', status: 403 }
  }
  if (canSend(session.role) || (await isCrmSuperAdmin(session.email))) {
    return { session }
  }
  return { error: 'Forbidden: full admin access required', status: 403 }
}

/**
 * Guard for any authenticated admin — INCLUDING interns / crm_only. Use for read
 * endpoints and intern-authorable surfaces (cohort board tasks, painpoints,
 * leads). Pair with requireFullAdmin for operator-only mutations.
 */
export async function requireAdmin(): Promise<
  { session: User } | { error: string; status: 401 | 403 }
> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized', status: 401 }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: 'Forbidden: Admin access required', status: 403 }
  }
  return { session }
}

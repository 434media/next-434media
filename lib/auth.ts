import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'

export type AuthProvider = 'google' | 'firebase'
export type AdminRole = 'crm_super_admin' | 'full_admin' | 'crm_only' | 'intern'

const SESSION_COOKIE = 'admin-auth-session'
const ADMIN_ROLES: AdminRole[] = ['crm_super_admin', 'full_admin', 'crm_only', 'intern']

/**
 * HMAC key for the session cookie.
 *
 * The cookie used to be plain base64 JSON with no signature, which meant anyone
 * could craft `{"email":"...","role":"crm_super_admin"}`, base64 it, set the
 * cookie and be a super admin — no Firebase account required. Signing closes
 * that. Rotating this value invalidates every outstanding session, which is the
 * correct response to a suspected compromise.
 *
 * Missing/short secret is fatal rather than a silent downgrade: setSession
 * throws (login fails loudly) and getSession returns null (everyone is logged
 * out). Both fail closed.
 */
function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET is missing or shorter than 32 chars. Admin sessions cannot be signed. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
    )
  }
  return secret
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

/** Constant-time compare that can't throw on length mismatch. */
function signatureMatches(expected: string, received: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Hardcoded fallback list of CRM super admins. Used when the Firestore
 * `crm_team_members.role` field hasn't been backfilled yet — guarantees
 * Marcos and Jesse can always reach the settings page even on a brand-new
 * environment. Once the backfill runs, role lookups read from Firestore.
 */
export const CRM_SUPER_ADMIN_FALLBACK = [
  'marcos@434media.com',
  'jesse@434media.com',
]

export function isCrmSuperAdminFromFallback(email?: string | null): boolean {
  if (!email) return false
  return CRM_SUPER_ADMIN_FALLBACK.includes(email.toLowerCase())
}

export interface User {
  email: string
  name: string
  picture?: string
  authProvider?: AuthProvider
  role?: AdminRole
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
 * Provider-based role FALLBACK — used only when a user has no explicit
 * `crm_team_members.role` record. Real roles come from `resolveRole` below.
 *  - Google OAuth is workspace-restricted to @434media.com (verified staff) → full_admin.
 *  - Firebase email/password is how the cohort self-registers → intern (least-privilege).
 */
export function getRoleForProvider(authProvider: AuthProvider): AdminRole {
  return authProvider === 'google' ? 'full_admin' : 'intern'
}

/**
 * Resolve a user's effective admin role at login. Firestore is the source of
 * truth; the provider fallback only catches users with no record yet. Order:
 *   1. super-admin fallback list (owners) → crm_super_admin
 *   2. explicit crm_team_members.role (set via settings / the 1.0 backfill)
 *   3. provider fallback (getRoleForProvider)
 *
 * Server-side only — uses firebase-admin via dynamic import.
 */
export async function resolveRole(email: string, provider: AuthProvider): Promise<AdminRole> {
  const lower = email.toLowerCase()
  if (isCrmSuperAdminFromFallback(lower)) return 'crm_super_admin'
  try {
    const { getDb } = await import('./firebase-admin')
    const snap = await getDb()
      .collection('crm_team_members')
      .where('email', '==', lower)
      .limit(1)
      .get()
    if (!snap.empty) {
      const role = snap.docs[0].data().role
      if (
        role === 'crm_super_admin' ||
        role === 'full_admin' ||
        role === 'crm_only' ||
        role === 'intern'
      ) {
        return role
      }
    }
  } catch (error) {
    console.error('[auth] resolveRole lookup failed; using provider fallback:', error)
  }
  return getRoleForProvider(provider)
}

/**
 * Read + verify the session cookie.
 *
 * Cookie format is `<base64url(payload)>.<base64url(hmac)>`. Anything that
 * doesn't carry a valid signature is rejected — including every legacy
 * unsigned cookie, which has no `.` separator at all. That is deliberate: the
 * unsigned format was forgeable, so existing sessions must not survive.
 */
/**
 * Decide whether an authenticated identity may be issued an admin session.
 *
 * This is THE authorization gate. It exists because Firebase Auth is shared
 * across every 434 web project in the GCP project — a user created for one site
 * holds a perfectly valid token for this admin. "Has a Firebase account" was
 * never the same thing as "may administer 434 Media", and treating them as
 * equivalent is how a partner account read data from every named database.
 *
 * Allowed:
 *  - @434media.com workspace addresses (Google OAuth, domain-verified)
 *  - the hardcoded owner fallback
 *  - an ACTIVE `crm_team_members` record, which is managed in admin settings
 *
 * Everything else is refused a session. Adding someone to Firebase Auth no
 * longer grants admin access on its own — they must also be on the roster.
 *
 * Fails CLOSED: if the Firestore lookup throws, non-workspace users are denied
 * rather than waved through on a provider default.
 */
export async function authorizeAdminSignIn(
  email: string,
  provider: AuthProvider,
): Promise<{ authorized: true; role: AdminRole; name?: string } | { authorized: false; reason: string }> {
  const lower = email.toLowerCase()

  if (isCrmSuperAdminFromFallback(lower)) {
    return { authorized: true, role: 'crm_super_admin' }
  }

  // Verified staff on the workspace domain. The Google callback already refuses
  // anything else, so this only ever passes real @434media.com accounts.
  if (provider === 'google' && isWorkspaceEmail(lower)) {
    const role = await resolveRole(lower, 'google')
    return { authorized: true, role }
  }

  try {
    const { getDb } = await import('./firebase-admin')
    const snap = await getDb()
      .collection('crm_team_members')
      .where('email', '==', lower)
      .limit(1)
      .get()

    if (snap.empty) {
      return {
        authorized: false,
        reason: 'not_on_roster',
      }
    }

    const data = snap.docs[0].data()
    if (data.isActive === false) {
      return { authorized: false, reason: 'deactivated' }
    }

    const stored = data.role
    const role: AdminRole = ADMIN_ROLES.includes(stored) ? stored : 'intern'
    return { authorized: true, role, name: data.name || undefined }
  } catch (error) {
    console.error('[auth] authorizeAdminSignIn lookup failed; denying:', error)
    return { authorized: false, reason: 'lookup_failed' }
  }
}

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE)

  if (!sessionCookie) {
    return null
  }

  try {
    const [encodedPayload, signature] = sessionCookie.value.split('.')
    if (!encodedPayload || !signature) {
      // Unsigned legacy cookie (or malformed) — never trust it.
      return null
    }

    if (!signatureMatches(signPayload(encodedPayload), signature)) {
      console.warn('[auth] rejected session cookie with an invalid signature')
      return null
    }

    const session = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'))

    // Verify session is not expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null
    }

    // A signed cookie proves we issued it; this guards against a session minted
    // by older code with a role we no longer recognize.
    const user: User | undefined = session.user
    if (!user?.email || !user.role || !ADMIN_ROLES.includes(user.role)) {
      return null
    }

    return user
  } catch (error) {
    console.error('Failed to parse session:', error)
    return null
  }
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

export function isWorkspaceEmail(email: string): boolean {
  const workspaceDomain = process.env.WORKSPACE_DOMAIN || '434media.com'
  return email.endsWith(`@${workspaceDomain}`)
}

/**
 * Cheap per-request sanity check on an already-verified session.
 *
 * This is NOT the authorization decision — `authorizeAdminSignIn` is, and it
 * runs once at login. By the time a route calls this, two things already hold:
 * the cookie carried a valid HMAC (so we minted it), and we only mint sessions
 * for identities on the roster or the workspace domain.
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
 * in Firestore. Falls back to `CRM_SUPER_ADMIN_FALLBACK` if Firestore
 * lookup fails or the user has no record yet.
 *
 * Server-side only — uses firebase-admin SDK.
 */
export async function isCrmSuperAdmin(email?: string | null): Promise<boolean> {
  if (!email) return false
  const lower = email.toLowerCase()
  if (isCrmSuperAdminFromFallback(lower)) return true
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
    console.error('[auth] isCrmSuperAdmin Firestore lookup failed; using fallback:', error)
    return isCrmSuperAdminFromFallback(lower)
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
 * Blocks `crm_only` and `intern` sessions from firing 1:1 sends. Staff send via
 * Google (`full_admin`). A super admin always passes via the Firestore-backed
 * check — even on a stale session role — so the two owners are never locked out.
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

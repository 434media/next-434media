import { cookies } from 'next/headers'

export type AuthProvider = 'google' | 'firebase'
export type AdminRole = 'crm_super_admin' | 'full_admin' | 'crm_only' | 'intern'

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
  crm: { path: '/admin/crm', roles: ['full_admin', 'crm_only', 'intern'] },
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

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('admin-auth-session')
  
  if (!sessionCookie) {
    return null
  }

  try {
    const session = JSON.parse(
      Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
    )
    
    // Verify session is not expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null
    }
    
    return session.user
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
  
  const sessionValue = Buffer.from(JSON.stringify(sessionData)).toString('base64')
  
  cookieStore.set('admin-auth-session', sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('admin-auth-session')
}

export function isWorkspaceEmail(email: string): boolean {
  const workspaceDomain = process.env.WORKSPACE_DOMAIN || '434media.com'
  return email.endsWith(`@${workspaceDomain}`)
}

/**
 * Check if a user is authorized to access admin areas.
 * Returns true for any authenticated session because:
 * - Google OAuth only allows @434media.com emails (enforced by isWorkspaceEmail in callback)
 * - Firebase Auth users are managed in Firebase Console (only approved users can log in)
 * 
 * This function should be used for API route protection instead of isWorkspaceEmail
 * to support both Google Workspace and Firebase email/password authentication.
 */
export function isAuthorizedAdmin(email: string): boolean {
  // Any authenticated user is authorized
  // Google Workspace: restricted at OAuth callback level to @434media.com
  // Firebase: restricted by who is added in Firebase Console
  return !!email
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
 * `crm_only` can draft, not send.
 *
 * QA: `intern` is temporarily included so the QA team can test the outreach
 * motion (single send + 3-email sequence enroll). Remove `intern` after QA to
 * restore the draft-only posture for cohort interns.
 */
export const SEND_CAPABLE_ROLES: AdminRole[] = ['crm_super_admin', 'full_admin', 'intern']

export function canSend(role?: AdminRole | null): boolean {
  return !!role && SEND_CAPABLE_ROLES.includes(role)
}

/**
 * Guard for outbound-send API routes (anything that calls Resend for a user).
 * Returns the session when the caller may send, otherwise an error to 4xx on.
 *
 * Blocks `crm_only` sessions (the interns) from firing 1:1 sends. Staff send via
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

import { cookies } from 'next/headers'

export type AuthProvider = 'google' | 'firebase'
export type AdminRole = 'crm_super_admin' | 'full_admin' | 'crm_only'

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

// Define which admin sections each role can access
export const ADMIN_SECTIONS = {
  dashboard: { path: '/admin', roles: ['full_admin', 'crm_only'] },
  analytics: { path: '/admin/analytics', roles: ['full_admin'] },
  analyticsInstagram: { path: '/admin/analytics-instagram', roles: ['full_admin'] },
  analyticsLinkedin: { path: '/admin/analytics-linkedin', roles: ['full_admin'] },
  analyticsMailchimp: { path: '/admin/analytics-mailchimp', roles: ['full_admin'] },
  analyticsWeb: { path: '/admin/analytics-web', roles: ['full_admin'] },
  blog: { path: '/admin/blog', roles: ['full_admin'] },
  crm: { path: '/admin/crm', roles: ['full_admin', 'crm_only'] },
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
  return ADMIN_SECTIONS[section].roles.includes(role)
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
      return section.roles.includes(role)
    }
  }
  
  // Default: allow access to /admin root for all authenticated users
  return true
}

/**
 * Get the role for a user based on their auth provider
 */
export function getRoleForProvider(authProvider: AuthProvider): AdminRole {
  // Google Workspace users get full admin access
  // Firebase email/password users get CRM-only access
  return authProvider === 'google' ? 'full_admin' : 'crm_only'
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

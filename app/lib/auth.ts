import { cookies } from 'next/headers'

export interface User {
  email: string
  name: string
  picture?: string
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
    user,
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

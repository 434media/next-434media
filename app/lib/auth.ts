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

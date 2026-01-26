import { cookies } from 'next/headers'
import admin from 'firebase-admin'

// Initialize Firebase Admin if not already initialized
function getFirebaseAuth() {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
    }
  }
  return admin.auth()
}

export interface User {
  email: string
  name: string
  picture?: string
  uid?: string
  authProvider?: 'google' | 'email' | 'legacy'
}

export interface SessionData {
  user: User
  expiresAt: string
  firebaseToken?: string
}

// Get session from cookie (supports both legacy and Firebase sessions)
export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('admin-auth-session')
  
  if (!sessionCookie) {
    return null
  }

  try {
    const session: SessionData = JSON.parse(
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

// Verify Firebase ID token and return user info
export async function verifyFirebaseToken(idToken: string): Promise<User | null> {
  try {
    const auth = getFirebaseAuth()
    const decodedToken = await auth.verifyIdToken(idToken)
    
    return {
      email: decodedToken.email || '',
      name: decodedToken.name || decodedToken.email || 'User',
      picture: decodedToken.picture,
      uid: decodedToken.uid,
      authProvider: decodedToken.firebase?.sign_in_provider === 'password' ? 'email' : 'google',
    }
  } catch (error) {
    console.error('Failed to verify Firebase token:', error)
    return null
  }
}

// Create a session cookie from Firebase token
export async function createSessionFromFirebaseToken(idToken: string): Promise<User | null> {
  const user = await verifyFirebaseToken(idToken)
  
  if (!user || !user.email) {
    return null
  }

  // For Google sign-in, verify workspace domain
  // Email/password users are managed in Firebase and don't require domain check
  if (user.authProvider === 'google' && !isWorkspaceEmail(user.email)) {
    return null
  }

  await setSession(user)
  return user
}

export async function setSession(user: User): Promise<void> {
  const cookieStore = await cookies()
  
  const sessionData: SessionData = {
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

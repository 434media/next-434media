import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase-admin'
import { setSession, authorizeAdminSignIn, isWorkspaceEmail } from '@/lib/auth'
import { decideFirebaseSignIn } from '@/lib/firebase-signin'

// Auto-registration used to live here: any address that could obtain a Firebase
// token was written into `crm_team_members` and handed a session. Because the
// Firebase project is shared across every 434 web property, that let a user
// created for another site self-provision admin access. Membership is now
// granted deliberately in admin settings; sign-in only reads it.

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Verify the token is genuine. This proves WHO they are — it says nothing about
    // whether they may administer 434 Media, because this Firebase project's Auth tenant is shared with our other web
    // properties. decideFirebaseSignIn then requires a verified email and the roster (lib/firebase-signin.ts).
    // Not checkRevoked: that reads the user record from Firebase Auth, which this site's service account may not do
    // (auth/insufficient-permission), and an ID token expires within the hour anyway.
    const decodedToken = await verifyFirebaseToken(idToken)
    const tokenName = decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
    const picture = decodedToken.picture

    const decision = await decideFirebaseSignIn(decodedToken, {
      authorize: (email) => authorizeAdminSignIn(email, 'firebase'),
      isWorkspaceEmail,
      vercelEnv: process.env.VERCEL_ENV,
    })
    if (!decision.ok) {
      console.warn(`[auth] denied admin sign-in for ${decodedToken.email ?? 'no email'} (${decision.reason})`)
      const messages: Record<typeof decision.error, string> = {
        email_missing: 'Email not found in token',
        email_not_verified: 'Verify your email address before signing in.',
        workspace_use_google: '434 Media workspace accounts sign in with Google.',
        not_authorized: 'This account is not authorized for the 434 Media admin. Ask an administrator to add you.',
      }
      return NextResponse.json({ error: decision.error, message: messages[decision.error] }, { status: decision.status })
    }
    const email = decision.email

    await setSession({
      email,
      name: decision.name || tokenName,
      picture,
      authProvider: 'firebase',
      role: decision.role,
    })

    return NextResponse.json({
      success: true,
      user: {
        email,
        name: decision.name || tokenName,
        picture,
        authProvider: 'firebase',
        role: decision.role,
      },
    })
  } catch (error) {
    console.error('Firebase auth error:', error)
    
    // Handle specific Firebase errors
    if (error instanceof Error) {
      if (error.message.includes('Firebase ID token has expired')) {
        return NextResponse.json(
          { error: 'token_expired', message: 'Session expired. Please sign in again.' },
          { status: 401 }
        )
      }
      if (error.message.includes('Firebase Admin credentials')) {
        return NextResponse.json(
          { error: 'config_error', message: 'Firebase is not properly configured' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'authentication_failed', message: 'Authentication failed. Please try again.' },
      { status: 401 }
    )
  }
}

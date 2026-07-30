import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase-admin'
import { setSession, authorizeAdminSignIn } from '@/lib/auth'

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

    // Verify the token is genuine. This proves WHO they are — it says nothing
    // about whether they may administer 434 Media, because this Firebase
    // project's Auth tenant is shared with our other web properties.
    const decodedToken = await verifyFirebaseToken(idToken)

    const email = decodedToken.email
    const tokenName = decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
    const picture = decodedToken.picture

    if (!email) {
      return NextResponse.json(
        { error: 'Email not found in token' },
        { status: 400 }
      )
    }

    // Authorization: must be on the roster (or workspace staff). No session is
    // issued otherwise — a valid token alone is not enough.
    const decision = await authorizeAdminSignIn(email, 'firebase')
    if (!decision.authorized) {
      console.warn(`[auth] denied admin sign-in for ${email} (${decision.reason})`)
      return NextResponse.json(
        {
          error: 'not_authorized',
          message:
            'This account is not authorized for the 434 Media admin. Ask an administrator to add you.',
        },
        { status: 403 }
      )
    }

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

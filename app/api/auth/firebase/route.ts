import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSessionFromFirebaseToken, isWorkspaceEmail } from '@/app/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { idToken, authProvider } = await request.json()

    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing ID token' },
        { status: 400 }
      )
    }

    const user = await createSessionFromFirebaseToken(idToken)

    if (!user) {
      // Check if it's a domain restriction issue for Google users
      if (authProvider === 'google') {
        return NextResponse.json(
          { error: 'unauthorized_domain', message: 'Only 434 Media workspace accounts are allowed for Google sign-in.' },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: 'authentication_failed', message: 'Failed to authenticate user.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
        authProvider: user.authProvider,
      },
    })
  } catch (error) {
    console.error('Firebase auth error:', error)
    return NextResponse.json(
      { error: 'authentication_failed', message: 'An error occurred during authentication.' },
      { status: 500 }
    )
  }
}

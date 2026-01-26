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

    // Log for debugging (remove in production if too verbose)
    console.log('[Firebase Auth] Processing authentication request for provider:', authProvider)

    const user = await createSessionFromFirebaseToken(idToken)

    if (!user) {
      // Check if it's a domain restriction issue for Google users
      if (authProvider === 'google') {
        console.log('[Firebase Auth] Domain verification failed for Google user')
        return NextResponse.json(
          { error: 'unauthorized_domain', message: 'Only 434 Media workspace accounts are allowed for Google sign-in.' },
          { status: 403 }
        )
      }
      console.log('[Firebase Auth] Token verification failed')
      return NextResponse.json(
        { error: 'authentication_failed', message: 'Failed to authenticate user. Please try signing in again.' },
        { status: 401 }
      )
    }

    console.log('[Firebase Auth] Successfully authenticated user:', user.email)

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
        authProvider: user.authProvider,
      },
    })
  } catch (error: any) {
    console.error('[Firebase Auth] Authentication error:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    })
    
    // Provide more specific error messages
    let errorMessage = 'An error occurred during authentication.'
    if (error?.message?.includes('not properly configured')) {
      errorMessage = 'Server authentication is misconfigured. Please contact an administrator.'
    } else if (error?.code === 'auth/id-token-expired') {
      errorMessage = 'Your session has expired. Please sign in again.'
    }
    
    return NextResponse.json(
      { error: 'authentication_failed', message: errorMessage },
      { status: 500 }
    )
  }
}

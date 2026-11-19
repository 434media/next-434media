import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { googleSignInAllowed } from '@/lib/preview-auth'
import { OAUTH_RETURN_COOKIE, safeTravelReturnPath } from '@/lib/travel/return-path'

export async function GET(request: NextRequest) {
  // A preview signs in only with a staging test account (lib/preview-auth.ts): Google sign-in would bring a production
  // Google identity into it, and its redirect is registered for production's hosts only.
  if (!googleSignInAllowed()) {
    return NextResponse.redirect(new URL('/admin?error=google_not_on_preview', request.url))
  }

  const searchParams = request.nextUrl.searchParams
  
  const clientId = process.env.GOOGLE_CLIENT_ID
  // Use current origin for redirect to support both dev and production
  const redirectUri = `${request.nextUrl.origin}/api/auth/callback/google`
  
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    )
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID()
  
  // Store state in cookie for verification
  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      hd: process.env.WORKSPACE_DOMAIN || '434media.com', // Restrict to workspace domain
      prompt: 'select_account',
    })}`
  )
  
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  // Started from a travel itinerary's sign-in page: return there after sign-in (lib/travel/return-path.ts). Only an
  // itinerary path is kept; anything else is dropped, and a stale value from an earlier attempt is cleared.
  const returnPath = safeTravelReturnPath(searchParams.get('next'))
  if (returnPath) {
    response.cookies.set(OAUTH_RETURN_COOKIE, returnPath, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes, as oauth_state
      path: '/',
    })
  } else {
    response.cookies.delete(OAUTH_RETURN_COOKIE)
  }

  return response
}

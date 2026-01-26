import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
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
  
  return response
}

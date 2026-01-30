import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { setSession, isWorkspaceEmail, getRoleForProvider } from '@/app/lib/auth'

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  scope: string
  id_token: string
}

interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture?: string
  hd?: string // Hosted domain
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for OAuth errors
  if (error) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/admin?error=${encodeURIComponent(error)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/admin?error=missing_params`
    )
  }

  // Verify state to prevent CSRF
  const storedState = request.cookies.get('oauth_state')?.value
  if (state !== storedState) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/admin?error=invalid_state`
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  // Use current origin for redirect to support both dev and production
  const redirectUri = `${request.nextUrl.origin}/api/auth/callback/google`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/admin?error=oauth_not_configured`
    )
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token')
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json()

    // Get user info
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    )

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info')
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json()

    // Verify email is from workspace domain
    if (!isWorkspaceEmail(userInfo.email)) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/admin?error=unauthorized_domain`
      )
    }

    // Note: Google Workspace accounts with 'hd' parameter are always verified,
    // so we don't need to check email_verified for workspace accounts

    // Create session with full admin role for Google Workspace users
    await setSession({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      authProvider: 'google',
      role: getRoleForProvider('google'),
    })

    // Clear OAuth state cookie
    const response = NextResponse.redirect(`${request.nextUrl.origin}/admin`)
    response.cookies.delete('oauth_state')
    
    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      `${request.nextUrl.origin}/admin?error=authentication_failed`
    )
  }
}

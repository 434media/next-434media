import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { setSession, isVerifiedWorkspaceGoogleAccount, authorizeAdminSignIn, workspaceDomain } from '@/lib/auth'

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  scope: string
  id_token: string
}

// The v2 userinfo endpoint's shape: `id` and `verified_email`, not the OpenID Connect `sub` and `email_verified`.
interface GoogleUserInfo {
  id: string
  email: string
  verified_email?: boolean
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

    // A verified account of the workspace itself (security log ADM-9): Google's `verified_email`, the hosted domain
    // `hd`, and the address on the domain. A suffix alone admitted any Google account whose address merely ends in it.
    if (!isVerifiedWorkspaceGoogleAccount(userInfo)) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/admin?error=unauthorized_domain`
      )
    }

    // Same authorization gate the Firebase path uses (security log ADM-2): the
    // domain check above proves identity only. Membership, active status and
    // role come from the roster; no record, a deactivated one or no role is refused.
    const decision = await authorizeAdminSignIn(userInfo.email, 'google')
    if (!decision.authorized) {
      console.warn(`[auth] denied admin sign-in for ${userInfo.email} (${decision.reason})`)
      return NextResponse.redirect(
        `${request.nextUrl.origin}/admin?error=not_authorized`
      )
    }

    await setSession({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      authProvider: 'google',
      role: decision.role,
      // Admission above already required `verified_email` and `hd`; kept explicit because the founder-only guard
      // reads it (lib/founder-guard.ts).
      emailVerified: userInfo.verified_email === true && userInfo.hd === workspaceDomain(),
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

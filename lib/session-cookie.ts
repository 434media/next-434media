import { createHmac, timingSafeEqual } from 'node:crypto'

// The admin session cookie's codec: signing and verifying, and nothing that reads Firestore, so the proxy can check a
// session without bundling firebase-admin. lib/auth.ts issues and reads sessions through it.

export type AuthProvider = 'google' | 'firebase'
export type AdminRole = 'crm_super_admin' | 'full_admin' | 'crm_only' | 'intern'

export const SESSION_COOKIE = 'admin-auth-session'
export const ADMIN_ROLES: AdminRole[] = ['crm_super_admin', 'full_admin', 'crm_only', 'intern']

export interface User {
  email: string
  name: string
  picture?: string
  authProvider?: AuthProvider
  role?: AdminRole
  /** The provider vouched for the address at sign-in: a Google workspace account, or a Firebase token with
   *  `email_verified`. Sessions minted before this field existed read as unverified. */
  emailVerified?: boolean
}

/**
 * HMAC key for the session cookie.
 *
 * The cookie used to be plain base64 JSON with no signature, which meant anyone
 * could craft `{"email":"...","role":"crm_super_admin"}`, base64 it, set the
 * cookie and be a super admin — no Firebase account required. Signing closes
 * that. Rotating this value invalidates every outstanding session, which is the
 * correct response to a suspected compromise.
 *
 * Missing/short secret is fatal rather than a silent downgrade: setSession
 * throws (login fails loudly) and getSession returns null (everyone is logged
 * out). Both fail closed.
 */
function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET is missing or shorter than 32 chars. Admin sessions cannot be signed. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
    )
  }
  return secret
}

export function signPayload(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

/** Constant-time compare that can't throw on length mismatch. */
function signatureMatches(expected: string, received: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Verify a session cookie's value and return its user, or null. getSession reads the cookie from the request scope;
 * proxy.ts passes the value from the request it is handling.
 */
export function parseSessionCookie(value: string | undefined): User | null {
  return parseSessionCookieWithExpiry(value)?.user ?? null
}

/** The session's default lifetime: 24 hours from issue. */
export const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000

/**
 * The expiry and cookie max-age for a session being issued. A new sign-in gets the full 24 hours. A re-issue of an
 * existing session (a profile edit) passes the original expiry and keeps it, never later than 24 hours from now, so
 * re-issuing cannot extend a session (security log ADM-13 follow-up).
 */
export function sessionLifetime(keepExpiresAt: Date | null | undefined, now: Date = new Date()): {
  expiresAt: string
  maxAge: number
} {
  const max = now.getTime() + SESSION_LIFETIME_MS
  const at = keepExpiresAt && !Number.isNaN(keepExpiresAt.getTime()) ? Math.min(keepExpiresAt.getTime(), max) : max
  return { expiresAt: new Date(at).toISOString(), maxAge: Math.max(0, Math.ceil((at - now.getTime()) / 1000)) }
}

/** As parseSessionCookie, with the session's signed expiry (null when the payload carries none). */
export function parseSessionCookieWithExpiry(value: string | undefined): { user: User; expiresAt: Date | null } | null {
  if (!value) {
    return null
  }

  try {
    const [encodedPayload, signature] = value.split('.')
    if (!encodedPayload || !signature) {
      // Unsigned legacy cookie (or malformed) — never trust it.
      return null
    }

    if (!signatureMatches(signPayload(encodedPayload), signature)) {
      console.warn('[auth] rejected session cookie with an invalid signature')
      return null
    }

    const session = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'))

    // Verify session is not expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null
    }

    // A signed cookie proves we issued it; this guards against a session minted
    // by older code with a role we no longer recognize.
    const user: User | undefined = session.user
    if (!user?.email || !user.role || !ADMIN_ROLES.includes(user.role)) {
      return null
    }

    return { user, expiresAt: session.expiresAt ? new Date(session.expiresAt) : null }
  } catch (error) {
    console.error('Failed to parse session:', error)
    return null
  }
}

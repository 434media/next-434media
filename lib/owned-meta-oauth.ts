import type { AuthInfo } from "@modelcontextprotocol/server"
import type { AdminRole } from "./auth"

/**
 * Verifies the OAuth access token ChatGPT presents to the publisher MCP connector.
 *
 * Google is the authorization server, the same identity provider as admin sign-in.
 * A Google access token is opaque, so it is checked with Google's tokeninfo endpoint
 * (sent in a POST body, never a URL). It must have been issued to one of our own client
 * IDs — a token minted for any other app is refused — with a verified email and an
 * unexpired lifetime. The email then passes the existing admin gate
 * (authorizeAdminSignIn) and must hold a send-capable role, exactly like the admin route.
 * Failure returns undefined, which mcp-handler turns into 401 + WWW-Authenticate.
 */
export interface GoogleTokenInfo { aud?: string; azp?: string; email?: string; email_verified?: string | boolean; expires_in?: string | number; scope?: string }
export interface OAuthDeps {
  clientIds: string[]
  fetcher: typeof fetch
  authorize(email: string): Promise<{ authorized: true; role: AdminRole; name?: string } | { authorized: false; reason: string }>
  sendCapable(email: string, role: AdminRole): Promise<boolean>
  nowSeconds(): number
}

export async function verifyConnectorToken(token: string | undefined, deps: OAuthDeps): Promise<AuthInfo | undefined> {
  if (!token || token.length > 4096 || !deps.clientIds.length) return undefined
  let info: GoogleTokenInfo
  try {
    const response = await deps.fetcher(new URL("https://oauth2.googleapis.com/tokeninfo"), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ access_token: token }), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return undefined
    info = await response.json() as GoogleTokenInfo
  } catch { return undefined }
  if (!info.aud || !deps.clientIds.includes(info.aud) || info.azp && !deps.clientIds.includes(info.azp)) return undefined
  if (!(info.email_verified === true || info.email_verified === "true") || typeof info.email !== "string" || !/^[^\s@]+@[^\s@]+$/.test(info.email)) return undefined
  const ttl = Number(info.expires_in)
  if (!Number.isFinite(ttl) || ttl <= 0) return undefined
  if (!(info.scope || "").split(" ").some(s => s === "email" || s === "https://www.googleapis.com/auth/userinfo.email")) return undefined
  const email = info.email.toLowerCase()
  const gate = await deps.authorize(email)
  if (!gate.authorized || !await deps.sendCapable(email, gate.role)) return undefined
  return { token, clientId: info.aud, scopes: ["owned-meta:publish"], expiresAt: deps.nowSeconds() + ttl, extra: { email, role: gate.role, ...(gate.name ? { name: gate.name } : {}) } }
}

export function connectorClientIds(raw: string | undefined): string[] {
  return (raw || "").split(",").map(s => s.trim()).filter(s => /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(s))
}

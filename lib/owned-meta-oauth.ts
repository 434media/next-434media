import { createPublicKey, verify as verifySignature, type JsonWebKey } from "node:crypto"
import type { AuthInfo } from "@modelcontextprotocol/server"
import type { AdminRole } from "./auth"

/**
 * Verifies the OAuth access token ChatGPT (Smartie) presents to the publisher MCP connector.
 *
 * Reuses Polí's working sign-in design (cos-crm-pilot, lib/cos-pilot/mcp-verifier.ts): Auth0 is the
 * authorization server and ChatGPT is a manually registered public PKCE client. Every request, fail-closed:
 *  1. `Authorization: Bearer <JWT>`; header `alg` RS256 only, key chosen by `kid` from the issuer's JWKS;
 *  2. RSA-SHA256 signature, exact `iss`, exact `aud`, `exp` required and `nbf` when present with ZERO clock
 *     tolerance, `sub` and `iat` required;
 *  3. `azp` (and `client_id`, if present) equals the configured client id;
 *  4. capabilities only from the space-delimited `scope` claim (owned-meta:read|write|publish); none → refused;
 *  5. identity only from the exact `sub` in the configured caller map — never from an email claim;
 *  6. the mapped email then passes the existing admin gate (authorizeAdminSignIn) and must hold a send-capable
 *     role, exactly like the admin publisher route.
 * Implemented with node:crypto rather than jose so no dependency is added; the checks match the pilot's
 * jose 4.15.9 jwtVerify options.
 */
export const CONNECTOR_SCOPES = ["owned-meta:read", "owned-meta:write", "owned-meta:publish"] as const
export type ConnectorScope = typeof CONNECTOR_SCOPES[number]
export interface ConnectorCaller { subject: string; email: string }
export interface ConnectorConfig { issuer: string; audience: string; clientId: string; jwksUrl: string; callers: ConnectorCaller[] }
export interface OAuthDeps {
  config: ConnectorConfig
  jwks(kid?: string): Promise<JsonWebKey[]>
  authorize(email: string): Promise<{ authorized: true; role: AdminRole; name?: string } | { authorized: false; reason: string }>
  sendCapable(email: string, role: AdminRole): Promise<boolean>
  nowSeconds(): number
  onRefuse?(reason: string): void
}

const b64json = (part: string): Record<string, unknown> | null => { try { const v = JSON.parse(Buffer.from(part, "base64url").toString("utf8")); return v && typeof v === "object" && !Array.isArray(v) ? v : null } catch { return null } }

export async function verifyConnectorToken(token: string | undefined, deps: OAuthDeps): Promise<AuthInfo | undefined> {
  const refuse = (reason: string) => { try { deps.onRefuse?.(reason) } catch { /* reporting never changes the decision */ } return undefined }
  const c = deps.config
  const m = token ? /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token) : null
  if (!m) return refuse("no_bearer_jwt")
  const header = b64json(m[1]), payload = b64json(m[2])
  if (!header || !payload) return refuse("malformed")
  if (header.alg !== "RS256" || typeof header.kid !== "string") return refuse("alg")
  let keys: JsonWebKey[]
  try { keys = await deps.jwks(header.kid) } catch { return refuse("jwks_unavailable") }
  const jwk = keys.find(k => k.kid === header.kid && k.kty === "RSA" && (!k.use || k.use === "sig") && (!k.alg || k.alg === "RS256"))
  if (!jwk) return refuse("kid")
  let valid = false
  try { valid = verifySignature("RSA-SHA256", Buffer.from(`${m[1]}.${m[2]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(m[3], "base64url")) } catch { valid = false }
  if (!valid) return refuse("signature")
  const now = deps.nowSeconds()
  if (payload.iss !== c.issuer) return refuse("iss")
  const aud = payload.aud
  if (!(aud === c.audience || Array.isArray(aud) && aud.includes(c.audience))) return refuse("aud")
  if (typeof payload.exp !== "number" || payload.exp <= now) return refuse("exp")
  if (payload.nbf !== undefined && (typeof payload.nbf !== "number" || payload.nbf > now)) return refuse("nbf")
  if (typeof payload.iat !== "number" || typeof payload.sub !== "string" || !payload.sub) return refuse("claims")
  if (payload.azp !== c.clientId || payload.client_id !== undefined && payload.client_id !== c.clientId) return refuse("client")
  const scopes = [...new Set(typeof payload.scope === "string" ? payload.scope.split(" ").filter((s): s is ConnectorScope => (CONNECTOR_SCOPES as readonly string[]).includes(s)) : [])]
  if (!scopes.length) return refuse("scope")
  const caller = c.callers.find(x => x.subject === payload.sub)
  if (!caller) return refuse("subject_not_mapped")
  const gate = await deps.authorize(caller.email)
  if (!gate.authorized || !await deps.sendCapable(caller.email, gate.role)) return refuse("admin_gate")
  return { token: token!, clientId: c.clientId, scopes, expiresAt: payload.exp, extra: { email: caller.email, role: gate.role, subject: payload.sub, ...(gate.name ? { name: gate.name } : {}) } }
}

/** Strict, fail-closed configuration. Returns null with problem names (never values) when incomplete. */
export function loadConnectorConfig(env: Record<string, string | undefined>): { config: ConnectorConfig | null; problems: string[] } {
  const problems: string[] = []
  const https = (v: string | undefined) => { try { const u = new URL(v || ""); return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash } catch { return false } }
  const issuer = env.OWNED_META_CONNECTOR_ISSUER, audience = env.OWNED_META_CONNECTOR_AUDIENCE, clientId = env.OWNED_META_CONNECTOR_CLIENT_ID, jwksUrl = env.OWNED_META_CONNECTOR_JWKS_URL
  if (!https(issuer) || !issuer!.endsWith("/")) problems.push("OWNED_META_CONNECTOR_ISSUER")
  if (!https(audience)) problems.push("OWNED_META_CONNECTOR_AUDIENCE")
  if (!clientId || !/^[A-Za-z0-9_-]{8,128}$/.test(clientId)) problems.push("OWNED_META_CONNECTOR_CLIENT_ID")
  if (!https(jwksUrl) || issuer && https(issuer) && new URL(jwksUrl!).origin !== new URL(issuer).origin) problems.push("OWNED_META_CONNECTOR_JWKS_URL")
  let callers: ConnectorCaller[] = []
  try {
    const raw = JSON.parse(env.OWNED_META_CONNECTOR_CALLERS || "null")
    if (!Array.isArray(raw) || !raw.length || raw.length > 8 || !raw.every(x => x && typeof x.subject === "string" && x.subject.length > 3 && typeof x.email === "string" && /^[^\s@]+@434media\.com$/i.test(x.email) && Object.keys(x).length === 2) || new Set(raw.map(x => x.subject)).size !== raw.length) throw new Error()
    callers = raw.map(x => ({ subject: x.subject, email: x.email.toLowerCase() }))
  } catch { problems.push("OWNED_META_CONNECTOR_CALLERS") }
  return problems.length ? { config: null, problems } : { config: { issuer: issuer!, audience: audience!, clientId: clientId!, jwksUrl: jwksUrl!, callers }, problems }
}

/**
 * JWKS fetch with a 10-minute cache and a 5-second timeout. An unknown `kid` (key rotation) refetches once,
 * at most every 30 seconds — the pilot's jose cooldown — so a forged kid cannot hammer the issuer.
 */
export function remoteJwks(url: string, fetcher: typeof fetch = fetch, nowMs: () => number = Date.now) {
  let cached: { at: number; keys: JsonWebKey[] } | null = null
  const load = async () => {
    const response = await fetcher(new URL(url), { method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5_000) })
    const body = await response.json() as { keys?: JsonWebKey[] }
    if (!response.ok || !Array.isArray(body.keys)) throw new Error("jwks")
    cached = { at: nowMs(), keys: body.keys }
    return body.keys
  }
  return async (kid?: string): Promise<JsonWebKey[]> => {
    if (!cached || nowMs() - cached.at >= 600_000) return load()
    if (kid && !cached.keys.some(k => k.kid === kid) && nowMs() - cached.at >= 30_000) return load()
    return cached.keys
  }
}

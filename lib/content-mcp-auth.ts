import { createPublicKey, verify as verifySignature, timingSafeEqual, constants } from "node:crypto"

/**
 * Bearer verification for the content MCP route.
 *
 * Two kinds of caller, two scope ceilings:
 * - An OAuth access token (RS256 JWT) from the configured issuer, bound to this
 *   resource's audience. This is how ChatGPT/Smartie connects: OpenAI custom
 *   MCP connectors support OAuth or no authentication only — no static key —
 *   so the existing static SOR token cannot be reused for that client
 *   (https://developers.openai.com/api/docs/guides/custom-mcp-server, read
 *   2026-10-16). The token's `scope` claim decides what it may do, and its
 *   email claim is the actor recorded on approvals and runs.
 * - The existing SOR_MCP_TOKEN_INTERNAL static token, for non-ChatGPT clients.
 *   It is read-only here on purpose: nothing publishes or approves without an
 *   identified person.
 *
 * Verification is done with Node's crypto against the issuer's JWKS; no new
 * dependency. Keys are cached briefly and refetched on an unknown `kid`.
 */
export const CONTENT_SCOPES = ["content:read", "content:write", "content:approve", "meta:read", "meta:publish"] as const
export type ContentScope = typeof CONTENT_SCOPES[number]
export interface ContentAuth { clientId: string; email: string | null; scopes: ContentScope[]; kind: "oauth" | "static" }

export interface JwtConfig { issuer: string; audience: string; jwksUrl?: string; emailClaims?: string[] }
interface Jwk { kid?: string; kty: string; n?: string; e?: string; alg?: string; use?: string }

const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")

export function parseJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown>; signed: string; signature: Buffer } | null {
  const parts = token.split(".")
  if (parts.length !== 3 || parts.some(p => !p || !/^[A-Za-z0-9_-]+$/.test(p))) return null
  try {
    const header = JSON.parse(b64url(parts[0]).toString("utf8")), payload = JSON.parse(b64url(parts[1]).toString("utf8"))
    if (!header || typeof header !== "object" || !payload || typeof payload !== "object") return null
    return { header, payload, signed: `${parts[0]}.${parts[1]}`, signature: b64url(parts[2]) }
  } catch { return null }
}

export function createJwksCache(url: string, fetcher: typeof fetch = fetch, ttlMs = 10 * 60_000) {
  let keys: Jwk[] = [], fetchedAt = 0
  const load = async () => {
    const response = await fetcher(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error("JWKS unavailable")
    const body = await response.json() as { keys?: unknown }
    if (!Array.isArray(body.keys)) throw new Error("JWKS malformed")
    keys = body.keys.filter((k): k is Jwk => !!k && typeof k === "object" && (k as Jwk).kty === "RSA"); fetchedAt = Date.now()
  }
  return async (kid: string | undefined): Promise<Jwk | null> => {
    if (!keys.length || Date.now() - fetchedAt > ttlMs) await load()
    let key = keys.find(k => !kid || k.kid === kid)
    if (!key && kid) { await load(); key = keys.find(k => k.kid === kid) }
    return key ?? null
  }
}

export async function verifyJwt(token: string, config: JwtConfig, getKey: (kid: string | undefined) => Promise<Jwk | null>, now = Date.now): Promise<Record<string, unknown> | null> {
  const parsed = parseJwt(token)
  if (!parsed || parsed.header.alg !== "RS256") return null
  const key = await getKey(typeof parsed.header.kid === "string" ? parsed.header.kid : undefined)
  if (!key?.n || !key.e) return null
  let ok = false
  try { ok = verifySignature("sha256", Buffer.from(parsed.signed), { key: createPublicKey({ key: { kty: "RSA", n: key.n, e: key.e }, format: "jwk" }), padding: constants.RSA_PKCS1_PADDING }, parsed.signature) } catch { return null }
  if (!ok) return null
  const p = parsed.payload, t = Math.floor(now() / 1000)
  if (p.iss !== config.issuer) return null
  const aud = Array.isArray(p.aud) ? p.aud : [p.aud]
  if (!aud.includes(config.audience)) return null
  if (typeof p.exp !== "number" || p.exp <= t) return null
  if (typeof p.nbf === "number" && p.nbf > t + 60) return null
  return p
}

export function scopesFromClaims(p: Record<string, unknown>): ContentScope[] {
  const raw = [...(typeof p.scope === "string" ? p.scope.split(/\s+/) : []), ...(Array.isArray(p.permissions) ? p.permissions.filter((s): s is string => typeof s === "string") : [])]
  return CONTENT_SCOPES.filter(s => raw.includes(s))
}

export function emailFromClaims(p: Record<string, unknown>, claims: string[] = ["email", "https://434media.com/email"]): string | null {
  for (const c of claims) { const v = p[c]; if (typeof v === "string" && /^[^\s@]+@[^\s@]+$/.test(v)) return v.toLowerCase() }
  return null
}

function staticMatches(bearer: string, expected?: string): boolean {
  if (!expected) return false
  const a = Buffer.from(bearer), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createContentAuthVerifier(args: { jwt?: JwtConfig; staticInternalToken?: string; fetcher?: typeof fetch; now?: () => number }) {
  const getKey = args.jwt ? createJwksCache(args.jwt.jwksUrl || `${args.jwt.issuer.replace(/\/?$/, "/")}.well-known/jwks.json`, args.fetcher) : null
  return async (bearer?: string): Promise<ContentAuth | undefined> => {
    if (!bearer) return undefined
    if (staticMatches(bearer, args.staticInternalToken)) return { clientId: "sor-internal", email: null, scopes: ["content:read", "meta:read"], kind: "static" }
    if (!args.jwt || !getKey || !bearer.includes(".")) return undefined
    const claims = await verifyJwt(bearer, args.jwt, getKey, args.now)
    if (!claims) return undefined
    const scopes = scopesFromClaims(claims)
    if (!scopes.length) return undefined
    return { clientId: typeof claims.azp === "string" ? claims.azp : typeof claims.sub === "string" ? claims.sub : "oauth", email: emailFromClaims(claims, args.jwt.emailClaims), scopes, kind: "oauth" }
  }
}

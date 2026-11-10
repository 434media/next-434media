import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * QuickBooks Online, read only (V1 item 1, finance Phase 1). One company, 434 MEDIA's own, shown to the founder only.
 *
 * Contract (developer.intuit.com, read 2026-10-28 and 2026-11-10):
 *  - OAuth 2.0 authorization code at https://appcenter.intuit.com/connect/oauth2, scope com.intuit.quickbooks.accounting
 *    (there is no read-only accounting scope: read-only is this module's own rule, and it has no write call at all).
 *    The callback carries `code`, `state` and `realmId` (the company id).
 *  - Token endpoint POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer with Basic client auth. The access
 *    token lasts an hour; the refresh token rotates, so the newest one returned is always the one stored.
 *    `invalid_grant` means the refresh token is dead: the founder reconnects.
 *  - Revoke POST https://developer.api.intuit.com/v2/oauth2/tokens/revoke {token}, Basic client auth.
 *  - Reports GET {base}/v3/company/{realmId}/reports/{name}; failures carry an `intuit_tid` header, which is logged
 *    (never a payload or a token) so Intuit support can trace a call.
 *
 * Every transport and store is injected, so the logic is tested offline (lib/__tests__/quickbooks.test.ts).
 */
export const QB_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2"
export const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
export const QB_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke"
export const QB_SCOPE = "com.intuit.quickbooks.accounting"
export const QB_API_BASE = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
} as const
/** Intuit retires minor versions below 75; every call names one. */
export const QB_MINOR_VERSION = "75"
/** The production callback the Intuit app registers (Phase 0 hand-over, step C). */
export const QB_PRODUCTION_REDIRECT = "https://www.434media.com/api/admin/finance/quickbooks/callback"
export const QB_CALLBACK_PATH = "/api/admin/finance/quickbooks/callback"

export type QbEnvironment = keyof typeof QB_API_BASE

export interface QbClient {
  clientId: string
  clientSecret: string
  environment: QbEnvironment
  redirectUri: string
  tokenKey: Buffer
}

export interface QbTokens {
  accessToken: string
  refreshToken: string
  /** ms since epoch */
  expiresAt: number
  realmId: string
}

/** Stored form: ciphertext only, plus who connected and when. `version` makes every rotation a compare-and-set. */
export interface QbTokenRecord {
  version: number
  sealed: string
  environment: QbEnvironment
  connectedBy: string
  connectedAt: string
}

export interface QbTokenStore {
  read(): Promise<QbTokenRecord | null>
  /** Writes only if the stored version still equals `expectedVersion` (null = no record yet). Returns false otherwise. */
  write(expectedVersion: number | null, record: QbTokenRecord): Promise<boolean>
  remove(): Promise<void>
}

export interface QbDeps {
  client: QbClient
  store: QbTokenStore
  fetcher: typeof fetch
  nowMs(): number
  log(line: string): void
}

/** `message` is ours and safe to show the founder. `code` is a short stage or Intuit error code for the log. */
export class QbError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly reconnect = false,
  ) {
    super(message)
    this.name = "QbError"
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------------------------------------------

/**
 * The client from server-only settings, or why it is not configured. The redirect URI is `QUICKBOOKS_REDIRECT_URI`
 * when set; on production the registered www callback; elsewhere the callback on the origin being served, so a
 * preview's branch URL works once it is added to the Intuit app's Development redirect URIs.
 */
export function qbClientFromEnv(
  env: Record<string, string | undefined>,
  origin: string,
): { client: QbClient } | { missing: string[] } {
  const missing: string[] = []
  const clientId = env.QUICKBOOKS_CLIENT_ID?.trim() || ""
  const clientSecret = env.QUICKBOOKS_CLIENT_SECRET?.trim() || ""
  const environment = env.QUICKBOOKS_ENVIRONMENT?.trim()
  const rawKey = env.QUICKBOOKS_TOKEN_KEY?.trim() || ""
  if (!clientId) missing.push("QUICKBOOKS_CLIENT_ID")
  if (!clientSecret) missing.push("QUICKBOOKS_CLIENT_SECRET")
  if (environment !== "sandbox" && environment !== "production") missing.push("QUICKBOOKS_ENVIRONMENT")
  let tokenKey: Buffer | null = null
  try {
    const k = Buffer.from(rawKey, "base64")
    if (k.length === 32) tokenKey = k
  } catch {}
  if (!tokenKey) missing.push("QUICKBOOKS_TOKEN_KEY")
  // A sandbox app must never be wired to the live site's books, nor production keys to a preview.
  if (environment === "production" && env.VERCEL_ENV && env.VERCEL_ENV !== "production") missing.push("QUICKBOOKS_ENVIRONMENT (production keys outside Production)")
  if (missing.length) return { missing }
  const redirectUri =
    env.QUICKBOOKS_REDIRECT_URI?.trim() ||
    (env.VERCEL_ENV === "production" ? QB_PRODUCTION_REDIRECT : new URL(QB_CALLBACK_PATH, origin).toString())
  return { client: { clientId, clientSecret, environment: environment as QbEnvironment, redirectUri, tokenKey: tokenKey! } }
}

// ---------------------------------------------------------------------------------------------------------------
// Sealing (AES-256-GCM, as lib/canva-export.ts)
// ---------------------------------------------------------------------------------------------------------------

export function sealJson(key: Buffer, value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".")
}

export function unsealJson<T>(key: Buffer, sealed: string): T {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"))
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")) as T
}

// ---------------------------------------------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------------------------------------------

export function newState(): string {
  return randomBytes(24).toString("base64url")
}

export function authorizeUrl(client: Pick<QbClient, "clientId" | "redirectUri">, state: string): string {
  const u = new URL(QB_AUTHORIZE_URL)
  u.search = new URLSearchParams({
    client_id: client.clientId,
    response_type: "code",
    scope: QB_SCOPE,
    redirect_uri: client.redirectUri,
    state,
  }).toString()
  return u.toString()
}

const basic = (c: QbClient) => `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`
const tid = (r: Response) => {
  const t = r.headers.get("intuit_tid")
  return t && /^[A-Za-z0-9-]{1,80}$/.test(t) ? t : "none"
}
/** Intuit's short error code when it is one; never Intuit's free text. */
const shortCode = (v: unknown) => (typeof v === "string" && /^[a-z0-9_]{1,64}$/.test(v) ? v : "unrecognised")

async function tokenRequest(deps: QbDeps, body: Record<string, string>, realmId: string): Promise<QbTokens> {
  const r = await deps.fetcher(QB_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", authorization: basic(deps.client) },
    body: new URLSearchParams(body),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string }
  if (!r.ok || !data.access_token || !data.refresh_token || !Number.isFinite(data.expires_in)) {
    const code = shortCode(data.error)
    deps.log(`[quickbooks] token ${body.grant_type} failed: http_${r.status} ${code} intuit_tid=${tid(r)}`)
    if (code === "invalid_grant") throw new QbError("QuickBooks needs to be reconnected", "invalid_grant", true)
    throw new QbError("QuickBooks sign-in failed; try again", `token_${code}`)
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: deps.nowMs() + data.expires_in! * 1000, realmId }
}

/** The callback step: validates the query, exchanges the code and stores the sealed tokens. */
export async function completeConnect(deps: QbDeps, input: { code: string; realmId: string; by: string }): Promise<void> {
  if (!/^\d{1,32}$/.test(input.realmId)) throw new QbError("QuickBooks returned no company", "bad_realm")
  if (!input.code || input.code.length > 2048) throw new QbError("Invalid QuickBooks callback", "bad_code")
  const tokens = await tokenRequest(
    deps,
    { grant_type: "authorization_code", code: input.code, redirect_uri: deps.client.redirectUri },
    input.realmId,
  )
  const current = await deps.store.read()
  const ok = await deps.store.write(current?.version ?? null, {
    version: (current?.version ?? 0) + 1,
    sealed: sealJson(deps.client.tokenKey, tokens),
    environment: deps.client.environment,
    connectedBy: input.by,
    connectedAt: new Date(deps.nowMs()).toISOString(),
  })
  if (!ok) throw new QbError("The QuickBooks connection changed at the same moment; connect again", "store_conflict")
}

function readTokens(deps: QbDeps, record: QbTokenRecord): QbTokens {
  if (record.environment !== deps.client.environment) {
    throw new QbError("The stored connection is for another QuickBooks environment; reconnect", "env_mismatch", true)
  }
  try {
    return unsealJson<QbTokens>(deps.client.tokenKey, record.sealed)
  } catch {
    throw new QbError("The stored QuickBooks connection is unreadable; reconnect", "unreadable", true)
  }
}

/**
 * A valid access token and the company id. Refreshes within 5 minutes of expiry, or when `force` (a 401). A lost
 * rotation race is resolved by re-reading the store, never by refreshing twice.
 */
export async function accessToken(deps: QbDeps, force = false): Promise<{ token: string; realmId: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const record = await deps.store.read()
    if (!record) throw new QbError("QuickBooks is not connected", "not_connected", true)
    const tokens = readTokens(deps, record)
    if (!force && tokens.expiresAt - 300_000 > deps.nowMs()) return { token: tokens.accessToken, realmId: tokens.realmId }
    let next: QbTokens
    try {
      next = await tokenRequest(deps, { grant_type: "refresh_token", refresh_token: tokens.refreshToken }, tokens.realmId)
    } catch (err) {
      const latest = await deps.store.read()
      if (latest && latest.version !== record.version) {
        force = false
        continue // another request rotated first; use its token
      }
      throw err
    }
    await deps.store.write(record.version, { ...record, version: record.version + 1, sealed: sealJson(deps.client.tokenKey, next) })
    return { token: next.accessToken, realmId: next.realmId }
  }
  throw new QbError("QuickBooks token rotation conflict; try again", "rotation_conflict")
}

/** Disconnect: revoke with Intuit (best effort), then delete the stored connection either way. */
export async function disconnect(deps: QbDeps): Promise<{ revoked: boolean }> {
  const record = await deps.store.read()
  let revoked = false
  if (record) {
    try {
      const tokens = readTokens(deps, record)
      const r = await deps.fetcher(QB_REVOKE_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", authorization: basic(deps.client) },
        body: JSON.stringify({ token: tokens.refreshToken }),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      })
      revoked = r.ok
      if (!r.ok) deps.log(`[quickbooks] revoke failed: http_${r.status} intuit_tid=${tid(r)}`)
    } catch (err) {
      deps.log(`[quickbooks] revoke skipped: ${err instanceof QbError ? err.code : "transport"}`)
    }
  }
  await deps.store.remove()
  return { revoked }
}

// ---------------------------------------------------------------------------------------------------------------
// Reads. GET only: this module has no call that writes to QuickBooks.
// ---------------------------------------------------------------------------------------------------------------

const PATH = /^(reports\/[A-Za-z]+|companyinfo\/\d+|query)$/

/** One read. Refreshes and retries once on a 401. */
export async function qbGet(deps: QbDeps, path: string, params: Record<string, string>): Promise<unknown> {
  if (!PATH.test(path)) throw new QbError("Unsupported QuickBooks read", "bad_path")
  let force = false
  for (let attempt = 0; attempt < 2; attempt++) {
    const { token, realmId } = await accessToken(deps, force)
    const u = new URL(`${QB_API_BASE[deps.client.environment]}/v3/company/${realmId}/${path}`)
    u.search = new URLSearchParams({ ...params, minorversion: QB_MINOR_VERSION }).toString()
    const r = await deps.fetcher(u, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    if (r.status === 401 && attempt === 0) {
      force = true
      continue
    }
    if (!r.ok) {
      deps.log(`[quickbooks] read ${path.split("/")[0]}/${path.split("/")[1] ?? ""} failed: http_${r.status} intuit_tid=${tid(r)}`)
      if (r.status === 401 || r.status === 403) throw new QbError("QuickBooks refused the read; reconnect", `http_${r.status}`, true)
      if (r.status === 429) throw new QbError("QuickBooks is rate limiting; try again in a minute", "http_429")
      throw new QbError("QuickBooks did not answer; try again", `http_${r.status}`)
    }
    return r.json()
  }
  throw new QbError("QuickBooks refused the read; reconnect", "http_401", true)
}

/** The store's realm, for the cache key, without a network call. */
export async function connectedRealm(deps: QbDeps): Promise<{ realmId: string; connectedAt: string } | null> {
  const record = await deps.store.read()
  if (!record) return null
  const t = readTokens(deps, record)
  return { realmId: t.realmId, connectedAt: record.connectedAt }
}

// The Google Contacts connection: OAuth for the founder's personal Gmail and the few People API calls the sync makes.
//
// Contract (developers.google.com/people and /identity/protocols/oauth2/web-server, read 2026-11-13):
//  - Authorization code flow at https://accounts.google.com/o/oauth2/v2/auth with `access_type=offline` and
//    `prompt=consent`, so Google returns a refresh token. Scope: https://www.googleapis.com/auth/contacts, and nothing
//    else (interface contract 1.5 §2: one contacts-only token). `include_granted_scopes` is not set, so no other scope
//    rides along.
//  - Token endpoint POST https://oauth2.googleapis.com/token. The refresh token does not rotate; `invalid_grant` means
//    it is dead (revoked by the founder, or the client was reset) and he reconnects.
//  - Revoke POST https://oauth2.googleapis.com/revoke?token=…
//  - People API v1: people.connections.list (with syncToken), people.get, people.updateContact (with the etag; a stale
//    one is refused with 400 FAILED_PRECONDITION), contactGroups.list, contactGroups.create,
//    contactGroups.members.modify (add only).
//
// **Never delete.** Every People API call goes through `peopleRequest`, which allows only the methods and paths
// listed in ALLOWED and refuses a members:modify that removes anyone. There is no delete call in this module, and a
// test fails if one appears.
//
// The refresh token is sealed (AES-256-GCM, lib/quickbooks.ts sealJson) with GOOGLE_CONTACTS_TOKEN_KEY and stored in
// Firestore `crm_meta/google_contacts_connection`, the same shape as the QuickBooks and Canva connections. Every
// transport and store is injected, so this is tested offline (lib/__tests__/google-contacts.test.ts).

import { randomBytes } from "node:crypto"
import { sealJson, unsealJson } from "@/lib/quickbooks"

export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
export const PEOPLE_API = "https://people.googleapis.com"
/** The one scope this connection asks for. */
export const CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts"
export const CALLBACK_PATH = "/api/admin/core/google-contacts/callback"
export const PRODUCTION_REDIRECT = "https://www.434media.com/api/admin/core/google-contacts/callback"

export interface GcClient {
  clientId: string
  clientSecret: string
  redirectUri: string
  tokenKey: Buffer
}

export interface GcTokens {
  accessToken: string
  refreshToken: string
  /** ms since epoch */
  expiresAt: number
  scope: string
}

/** Stored form: ciphertext only, plus who connected and when. `version` makes every write a compare-and-set. */
export interface GcTokenRecord {
  version: number
  sealed: string
  connectedBy: string
  connectedAt: string
}

export interface GcTokenStore {
  read(): Promise<GcTokenRecord | null>
  write(expectedVersion: number | null, record: GcTokenRecord): Promise<boolean>
  remove(): Promise<void>
}

export interface GcDeps {
  client: GcClient
  store: GcTokenStore
  fetcher: typeof fetch
  nowMs(): number
  log(line: string): void
}

/** `message` is ours and safe to show the founder. `code` is short, for the log. */
export class GcError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly reconnect = false,
    public readonly status?: number,
  ) {
    super(message)
    this.name = "GcError"
  }
}

// ── Configuration ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The OAuth client from server-only settings, or what is missing. Production only: the token belongs in Firestore,
 * and previews have none. The redirect URI is GOOGLE_CONTACTS_REDIRECT_URI when set, else the www callback.
 */
export function gcClientFromEnv(env: Record<string, string | undefined>): { client: GcClient } | { missing: string[] } {
  const missing: string[] = []
  const clientId = env.GOOGLE_CONTACTS_CLIENT_ID?.trim() || ""
  const clientSecret = env.GOOGLE_CONTACTS_CLIENT_SECRET?.trim() || ""
  let tokenKey: Buffer | null = null
  try {
    const k = Buffer.from(env.GOOGLE_CONTACTS_TOKEN_KEY?.trim() || "", "base64")
    if (k.length === 32) tokenKey = k
  } catch {}
  if (!clientId) missing.push("GOOGLE_CONTACTS_CLIENT_ID")
  if (!clientSecret) missing.push("GOOGLE_CONTACTS_CLIENT_SECRET")
  if (!tokenKey) missing.push("GOOGLE_CONTACTS_TOKEN_KEY")
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") missing.push("Production (the sync runs on Production only)")
  if (missing.length) return { missing }
  const redirectUri = env.GOOGLE_CONTACTS_REDIRECT_URI?.trim() || PRODUCTION_REDIRECT
  return { client: { clientId, clientSecret, redirectUri, tokenKey: tokenKey! } }
}

// ── OAuth ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function newState(): string {
  return randomBytes(24).toString("base64url")
}

export function authorizeUrl(client: Pick<GcClient, "clientId" | "redirectUri">, state: string): string {
  const u = new URL(GOOGLE_AUTHORIZE_URL)
  u.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: "code",
    scope: CONTACTS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString()
  return u.toString()
}

const shortCode = (v: unknown) => (typeof v === "string" && /^[a-z0-9_]{1,64}$/.test(v) ? v : "unrecognised")

async function tokenRequest(deps: GcDeps, body: Record<string, string>): Promise<Omit<GcTokens, "refreshToken"> & { refreshToken?: string }> {
  const r = await deps.fetcher(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ ...body, client_id: deps.client.clientId, client_secret: deps.client.clientSecret }),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string }
  if (!r.ok || !data.access_token || !Number.isFinite(data.expires_in)) {
    const code = shortCode(data.error)
    deps.log(`[google-contacts] token ${body.grant_type} failed: http_${r.status} ${code}`)
    if (code === "invalid_grant") throw new GcError("Google Contacts needs to be reconnected", "invalid_grant", true)
    throw new GcError("Google sign-in failed; try again", `token_${code}`)
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: deps.nowMs() + data.expires_in! * 1000, scope: data.scope ?? "" }
}

/** True when Google granted exactly the contacts scope and nothing broader. */
export function scopeIsContactsOnly(scope: string): boolean {
  const granted = scope.split(/\s+/).filter(Boolean)
  return granted.length === 1 && granted[0] === CONTACTS_SCOPE
}

/** The callback step: exchanges the code and stores the sealed tokens. Refuses any grant beyond the contacts scope. */
export async function completeConnect(deps: GcDeps, input: { code: string; by: string }): Promise<void> {
  if (!input.code || input.code.length > 2048) throw new GcError("Invalid Google callback", "bad_code")
  const t = await tokenRequest(deps, { grant_type: "authorization_code", code: input.code, redirect_uri: deps.client.redirectUri })
  if (!t.refreshToken) throw new GcError("Google returned no refresh token; disconnect and connect again", "no_refresh_token")
  if (!scopeIsContactsOnly(t.scope)) {
    deps.log("[google-contacts] connect refused: the grant is not the contacts scope alone")
    throw new GcError("Google granted more than the contacts scope; connect again", "scope")
  }
  const current = await deps.store.read()
  const ok = await deps.store.write(current?.version ?? null, {
    version: (current?.version ?? 0) + 1,
    sealed: sealJson(deps.client.tokenKey, { ...t, refreshToken: t.refreshToken }),
    connectedBy: input.by,
    connectedAt: new Date(deps.nowMs()).toISOString(),
  })
  if (!ok) throw new GcError("The connection changed at the same moment; connect again", "store_conflict")
}

function readTokens(deps: GcDeps, record: GcTokenRecord): GcTokens {
  try {
    return unsealJson<GcTokens>(deps.client.tokenKey, record.sealed)
  } catch {
    throw new GcError("The stored Google connection is unreadable; reconnect", "unreadable", true)
  }
}

/** A valid access token, refreshed within 5 minutes of expiry or when `force` (after a 401). */
export async function accessToken(deps: GcDeps, force = false): Promise<string> {
  const record = await deps.store.read()
  if (!record) throw new GcError("Google Contacts is not connected", "not_connected", true)
  const tokens = readTokens(deps, record)
  if (!force && tokens.expiresAt - 300_000 > deps.nowMs()) return tokens.accessToken
  const next = await tokenRequest(deps, { grant_type: "refresh_token", refresh_token: tokens.refreshToken })
  // Google does not rotate the refresh token; keep the stored one unless a new one is returned.
  const sealed = sealJson(deps.client.tokenKey, { ...next, refreshToken: next.refreshToken || tokens.refreshToken })
  await deps.store.write(record.version, { ...record, version: record.version + 1, sealed })
  return next.accessToken
}

export async function connectionInfo(deps: GcDeps): Promise<{ connectedBy: string; connectedAt: string } | null> {
  const record = await deps.store.read()
  return record ? { connectedBy: record.connectedBy, connectedAt: record.connectedAt } : null
}

/** Disconnect: revoke with Google (best effort), then delete the stored token either way. */
export async function disconnect(deps: GcDeps): Promise<{ revoked: boolean }> {
  const record = await deps.store.read()
  let revoked = false
  if (record) {
    try {
      const t = readTokens(deps, record)
      const r = await deps.fetcher(`${GOOGLE_REVOKE_URL}?${new URLSearchParams({ token: t.refreshToken })}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      })
      revoked = r.ok
      if (!r.ok) deps.log(`[google-contacts] revoke failed: http_${r.status}`)
    } catch (err) {
      deps.log(`[google-contacts] revoke skipped: ${err instanceof GcError ? err.code : "transport"}`)
    }
  }
  await deps.store.remove()
  return { revoked }
}

// ── The People API, behind an allow-list ────────────────────────────────────────────────────────────────────────

/** The only calls this connection makes. No DELETE, no deleteContact, no batchDelete, no photo delete. */
export const ALLOWED: Array<{ method: "GET" | "POST" | "PATCH"; path: RegExp; write: boolean }> = [
  { method: "GET", path: /^\/v1\/people\/me\/connections$/, write: false },
  { method: "GET", path: /^\/v1\/people\/c\d+$/, write: false },
  { method: "PATCH", path: /^\/v1\/people\/c\d+:updateContact$/, write: true },
  { method: "GET", path: /^\/v1\/contactGroups$/, write: false },
  { method: "POST", path: /^\/v1\/contactGroups$/, write: true },
  { method: "POST", path: /^\/v1\/contactGroups\/[A-Za-z0-9]+\/members:modify$/, write: true },
]

/** Null when the call is allowed; otherwise why not. Exported for the never-delete test. */
export function requestRefusal(method: string, path: string, body?: unknown): string | null {
  const rule = ALLOWED.find((r) => r.method === method && r.path.test(path))
  if (!rule) return `Not an allowed People API call: ${method} ${path}`
  if (/members:modify$/.test(path)) {
    const b = (body ?? {}) as { resourceNamesToRemove?: unknown[] }
    if (Array.isArray(b.resourceNamesToRemove) && b.resourceNamesToRemove.length) return "The sync never removes anyone from a group"
  }
  return null
}

export function isWriteCall(method: string, path: string): boolean {
  return Boolean(ALLOWED.find((r) => r.method === method && r.path.test(path))?.write)
}

/** One People API call: allow-listed, authenticated, refreshed and retried once on a 401. */
export async function peopleRequest<T>(
  deps: GcDeps,
  method: "GET" | "POST" | "PATCH",
  path: string,
  opts: { query?: Record<string, string | undefined>; body?: unknown } = {},
): Promise<T> {
  const refusal = requestRefusal(method, path, opts.body)
  if (refusal) throw new GcError(refusal, "refused")
  let force = false
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(deps, force)
    const u = new URL(path, PEOPLE_API)
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) u.searchParams.set(k, v)
    const r = await deps.fetcher(u, {
      method,
      headers: { accept: "application/json", authorization: `Bearer ${token}`, ...(opts.body ? { "content-type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
    if (r.status === 401 && attempt === 0) {
      force = true
      continue
    }
    if (!r.ok) {
      const data = (await r.json().catch(() => ({}))) as { error?: { status?: string; details?: Array<{ reason?: string }>; message?: string } }
      const status = data.error?.status ?? ""
      const reason = data.error?.details?.find((d) => d.reason)?.reason ?? ""
      // Never the payload or the person: only the call's shape and Google's codes.
      deps.log(`[google-contacts] ${method} ${path.replace(/c\d+/, "c…")} failed: http_${r.status} ${shortCode(status.toLowerCase())} ${shortCode(reason.toLowerCase())}`)
      if (r.status === 400 && /EXPIRED_SYNC_TOKEN/i.test(`${reason} ${data.error?.message ?? ""}`)) {
        throw new GcError("The sync token expired", "expired_sync_token", false, 400)
      }
      if (r.status === 400 && status === "FAILED_PRECONDITION") throw new GcError("The contact changed in Google since it was read", "stale_etag", false, 400)
      if (r.status === 401 || r.status === 403) throw new GcError("Google refused the call; reconnect", `http_${r.status}`, true, r.status)
      if (r.status === 429) throw new GcError("Google is rate limiting; the next run continues", "http_429", false, 429)
      throw new GcError("Google did not answer; the next run continues", `http_${r.status}`, false, r.status)
    }
    return (await r.json()) as T
  }
  throw new GcError("Google refused the call; reconnect", "http_401", true, 401)
}

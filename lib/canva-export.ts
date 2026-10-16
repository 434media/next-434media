import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/**
 * Canva Connect API: export a design's pages as JPG for the owned Meta publisher.
 * Canva stays the permanent creative source; the exported files are staged into Blob by attach_exports.
 *
 * Contract (canva.dev, read 2026-10-16):
 *  - OAuth: authorization code + PKCE S256 at https://www.canva.com/api/oauth/authorize; token at
 *    POST https://api.canva.com/rest/v1/oauth/token with Basic client auth. Refresh tokens are SINGLE-USE and
 *    rotate on every refresh, so the newest one must be stored. Access tokens are short-lived (example 4 h).
 *  - Export: POST /rest/v1/exports {design_id, format:{type:"jpg", quality 1–100, pages?}} (scope
 *    design:content:read), poll GET /rest/v1/exports/{id} until success|failed; urls are one per page in page
 *    order and expire after 24 h.
 * All transport and storage is injected. Tokens are AES-256-GCM encrypted at rest with a key held in env.
 */
export const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize"
export const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token"
export const CANVA_API = "https://api.canva.com/rest/v1"
export const CANVA_SCOPES = "design:content:read design:meta:read"

export interface CanvaClient { clientId: string; clientSecret: string; redirectUri: string; tokenKey: Buffer }
export interface CanvaTokens { accessToken: string; refreshToken: string; expiresAt: number }
/** Stored form: ciphertext only. `version` makes rotation a compare-and-set. */
export interface CanvaTokenRecord { version: number; sealed: string; connectedBy: string; connectedAt: string }
export interface CanvaTokenStore {
  read(): Promise<CanvaTokenRecord | null>
  /** Writes only if the stored version still equals `expectedVersion` (null = no record yet). Returns false otherwise. */
  write(expectedVersion: number | null, record: CanvaTokenRecord): Promise<boolean>
}
export interface CanvaDeps { client: CanvaClient; store: CanvaTokenStore; fetcher: typeof fetch; nowMs(): number; sleep(ms: number): Promise<void> }

export class CanvaError extends Error { constructor(message: string, public readonly code?: string) { super(message); this.name = "CanvaError" } }

export function seal(key: Buffer, value: CanvaTokens): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return [iv, cipher.getAuthTag(), body].map(b => b.toString("base64url")).join(".")
}
export function unseal(key: Buffer, sealed: string): CanvaTokens {
  const [iv, tag, body] = sealed.split(".").map(p => Buffer.from(p, "base64url"))
  const decipher = createDecipheriv("aes-256-gcm", key, iv); decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")) as CanvaTokens
}

/** PKCE pair and state for the one-time connect. The verifier never leaves the server. */
export function pkce(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(48).toString("base64url") // 64 chars, within 43–128
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url"), state: randomBytes(24).toString("base64url") }
}
export function authorizeUrl(client: Pick<CanvaClient, "clientId" | "redirectUri">, challenge: string, state: string): string {
  const u = new URL(CANVA_AUTHORIZE_URL)
  u.search = new URLSearchParams({ code_challenge: challenge, code_challenge_method: "S256", scope: CANVA_SCOPES, response_type: "code", client_id: client.clientId, state, redirect_uri: client.redirectUri }).toString()
  return u.toString()
}

async function tokenRequest(deps: CanvaDeps, body: Record<string, string>): Promise<CanvaTokens> {
  const { client } = deps
  const response = await deps.fetcher(new URL(CANVA_TOKEN_URL), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${Buffer.from(`${client.clientId}:${client.clientSecret}`).toString("base64")}` }, body: new URLSearchParams(body), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) })
  const data = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; code?: string; error?: string }
  // Never surface Canva's message or any token material.
  if (!response.ok || !data.access_token || !data.refresh_token || !Number.isFinite(data.expires_in)) throw new CanvaError("Canva sign-in failed; reconnect Canva", data.code || data.error || `http_${response.status}`)
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: deps.nowMs() + data.expires_in! * 1000 }
}

/** Callback step of the one-time connect: exchanges the code and stores sealed tokens. */
export async function completeConnect(deps: CanvaDeps, input: { code: string; verifier: string; by: string }): Promise<void> {
  const tokens = await tokenRequest(deps, { grant_type: "authorization_code", code: input.code, code_verifier: input.verifier, redirect_uri: deps.client.redirectUri })
  const current = await deps.store.read()
  if (!await deps.store.write(current?.version ?? null, { version: (current?.version ?? 0) + 1, sealed: seal(deps.client.tokenKey, tokens), connectedBy: input.by, connectedAt: new Date(deps.nowMs()).toISOString() })) throw new CanvaError("Canva connection changed concurrently; try again")
}

/**
 * A valid access token. Refreshes when within 60 s of expiry. Because a refresh token is single-use, a lost
 * race (another instance rotated first) is resolved by re-reading the store rather than refreshing again.
 */
export async function canvaAccessToken(deps: CanvaDeps): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const record = await deps.store.read()
    if (!record) throw new CanvaError("Canva is not connected; an admin must connect it once", "not_connected")
    let tokens: CanvaTokens
    try { tokens = unseal(deps.client.tokenKey, record.sealed) } catch { throw new CanvaError("Stored Canva connection is unreadable; reconnect Canva", "unreadable") }
    if (tokens.expiresAt - 60_000 > deps.nowMs()) return tokens.accessToken
    let next: CanvaTokens
    try { next = await tokenRequest(deps, { grant_type: "refresh_token", refresh_token: tokens.refreshToken }) }
    catch (error) {
      const latest = await deps.store.read()
      if (latest && latest.version !== record.version) continue // another instance rotated; use its token
      throw error
    }
    if (await deps.store.write(record.version, { ...record, version: record.version + 1, sealed: seal(deps.client.tokenKey, next) })) return next.accessToken
    // Lost the write race after a successful refresh: our refresh token is now orphaned but our access token is valid.
    return next.accessToken
  }
  throw new CanvaError("Canva token rotation conflict; try again")
}

/** Exports pages as JPG and returns their download URLs in page order (valid 24 h). Bounded polling. */
export async function exportDesignJpg(deps: CanvaDeps, input: { designId: string; pages?: number[]; quality?: number }, limits = { polls: 20, intervalMs: 2_000 }): Promise<string[]> {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(input.designId)) throw new CanvaError("Invalid Canva design id")
  if (input.pages && (!input.pages.length || input.pages.length > 10 || input.pages.some(p => !Number.isSafeInteger(p) || p < 1))) throw new CanvaError("Pages must be 1–10 page numbers")
  const token = await canvaAccessToken(deps)
  const call = async (path: string, init: RequestInit = {}) => {
    const response = await deps.fetcher(new URL(`${CANVA_API}${path}`), { ...init, headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) })
    const data = await response.json().catch(() => ({})) as { job?: { id?: string; status?: string; urls?: string[]; error?: { code?: string } }; code?: string }
    if (response.status === 401 || response.status === 403) throw new CanvaError("Canva refused access to this design or export; reconnect Canva or check sharing", data.code || `http_${response.status}`)
    if (!response.ok || !data.job?.id) throw new CanvaError("Canva export request failed", data.code || `http_${response.status}`)
    return data.job
  }
  let job = await call("/exports", { method: "POST", body: JSON.stringify({ design_id: input.designId, format: { type: "jpg", quality: input.quality ?? 95, ...(input.pages ? { pages: input.pages } : {}) } }) })
  for (let i = 0; job.status === "in_progress" && i < limits.polls; i++) {
    await deps.sleep(limits.intervalMs)
    job = await call(`/exports/${encodeURIComponent(job.id!)}`)
  }
  if (job.status === "failed") throw new CanvaError("Canva could not export this design", job.error?.code)
  if (job.status !== "success" || !Array.isArray(job.urls) || !job.urls.length) throw new CanvaError("Canva export is still running; try again shortly", "timeout")
  if (input.pages && job.urls.length !== input.pages.length) throw new CanvaError("Canva returned a different number of pages than requested")
  return job.urls
}

export function loadCanvaClient(env: Record<string, string | undefined>): { client: CanvaClient | null; problems: string[] } {
  const problems: string[] = []
  const key = Buffer.from(env.OWNED_META_CANVA_TOKEN_KEY || "", "base64")
  if (!env.OWNED_META_CANVA_CLIENT_ID) problems.push("OWNED_META_CANVA_CLIENT_ID")
  if (!env.OWNED_META_CANVA_CLIENT_SECRET) problems.push("OWNED_META_CANVA_CLIENT_SECRET")
  if (key.length !== 32) problems.push("OWNED_META_CANVA_TOKEN_KEY")
  const redirectUri = env.OWNED_META_CANVA_REDIRECT_URI || "https://www.434media.com/api/admin/owned-meta/canva/callback"
  return problems.length ? { client: null, problems } : { client: { clientId: env.OWNED_META_CANVA_CLIENT_ID!, clientSecret: env.OWNED_META_CANVA_CLIENT_SECRET!, redirectUri, tokenKey: key }, problems }
}

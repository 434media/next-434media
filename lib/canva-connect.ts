/**
 * Canva Connect API client — the server-side export path.
 *
 * Why this exists: the Canva app Smartie reaches through ChatGPT exposes no
 * export, and the publisher only accepts exports it has measured and hashed
 * itself. So the server exports the approved design directly, through a
 * Developer Portal app that the founder connects once.
 *
 * Verified against the Connect API reference on 2026-10-16:
 * - POST https://api.canva.com/rest/v1/exports, scope `design:content:read`,
 *   body { design_id, format: { type: "jpg", quality: 1–100, pages? } }.
 *   The job starts `in_progress`; GET /rest/v1/exports/{id} reports `success`
 *   with one URL per page in page order, or `failed` with an error code.
 *   Download URLs expire 24 hours after completion. Limits: 75 exports per
 *   document per 5 minutes, 500 per user per day.
 * - Token endpoint https://api.canva.com/rest/v1/oauth/token takes HTTP Basic
 *   client authentication. Refresh tokens are single-use and rotate: every
 *   refresh returns a new refresh token, which MUST be persisted before the old
 *   one is discarded, or the connection is lost until the founder reconnects.
 *   https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
 *   https://www.canva.dev/docs/connect/authentication/
 *
 * No credential is created here. The client ID/secret and the once-granted
 * refresh token are configuration; see docs/owned-meta-publisher.md.
 */
export const CANVA_API = "https://api.canva.com/rest/v1"
export const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize"
export const CANVA_EXPORT_SCOPES = ["design:content:read", "design:meta:read"] as const

export interface CanvaTokenSet { accessToken: string; refreshToken: string; expiresAt: string; scope?: string }
export interface CanvaTokenStore {
  read(): Promise<CanvaTokenSet | null>
  /** Must persist atomically; a lost rotated refresh token breaks the connection. */
  write(next: CanvaTokenSet): Promise<void>
}
export interface CanvaExportJob { id: string; status: "in_progress" | "success" | "failed"; urls?: string[]; error?: { code?: string; message?: string } }
export class CanvaBlocked extends Error { constructor(message: string, public readonly code?: string) { super(message); this.name = "CanvaBlocked" } }

/** Only safe, operator-readable facts leave the client. Vendor bodies are never echoed. */
function safeStatus(status: number, body: unknown): string {
  const code = body && typeof body === "object" && "code" in body && typeof (body as { code: unknown }).code === "string" ? (body as { code: string }).code : undefined
  return `HTTP ${status}${code ? ` ${code}` : ""}`
}

export function isCanvaDesignId(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(value) }

export function createCanvaClient(args: {
  clientId: string
  clientSecret: string
  store: CanvaTokenStore
  fetcher?: typeof fetch
  now?: () => number
}) {
  const fetcher = args.fetcher ?? fetch
  const now = args.now ?? Date.now
  const basic = `Basic ${Buffer.from(`${args.clientId}:${args.clientSecret}`).toString("base64")}`
  if (!args.clientId || !args.clientSecret) throw new CanvaBlocked("Canva integration is not configured")

  async function token(form: Record<string, string>): Promise<CanvaTokenSet> {
    const response = await fetcher(`${CANVA_API}/oauth/token`, { method: "POST", headers: { authorization: basic, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) })
    const body = await response.json().catch(() => null) as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; scope?: unknown } | null
    if (!response.ok || !body || typeof body.access_token !== "string" || typeof body.refresh_token !== "string" || typeof body.expires_in !== "number") {
      throw new CanvaBlocked(`Canva token request failed (${safeStatus(response.status, body)}); the founder may need to reconnect Canva`, "token")
    }
    const next: CanvaTokenSet = { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: new Date(now() + Math.max(60, body.expires_in - 60) * 1000).toISOString(), ...(typeof body.scope === "string" ? { scope: body.scope } : {}) }
    await args.store.write(next) // persist the rotated refresh token before it is used
    return next
  }

  async function accessToken(): Promise<string> {
    const current = await args.store.read()
    if (!current?.refreshToken) throw new CanvaBlocked("Canva is not connected; the founder connects it once from the admin", "not_connected")
    if (Date.parse(current.expiresAt) - now() > 60_000) return current.accessToken
    return (await token({ grant_type: "refresh_token", refresh_token: current.refreshToken })).accessToken
  }

  async function api<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
    if (!/^\/[a-z]+(?:\/[A-Za-z0-9_-]{1,128})?$/.test(path)) throw new CanvaBlocked("Unrecognized Canva endpoint")
    const bearer = await accessToken()
    const response = await fetcher(`${CANVA_API}${path}`, { method: init.method ?? "GET", headers: { authorization: `Bearer ${bearer}`, ...(init.body ? { "content-type": "application/json" } : {}) }, ...(init.body ? { body: JSON.stringify(init.body) } : {}), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000) })
    const body = await response.json().catch(() => null)
    if (response.status === 401) throw new CanvaBlocked("Canva rejected the connection; the founder may need to reconnect Canva", "unauthorized")
    if (response.status === 429) throw new CanvaBlocked("Canva export rate limit reached; retry later", "rate_limited")
    if (!response.ok) throw new CanvaBlocked(`Canva request failed (${safeStatus(response.status, body)})`, "request")
    return body as T
  }

  return {
    /** Authorization-code exchange for the one-time founder consent (PKCE). */
    exchangeCode: (code: string, codeVerifier: string, redirectUri: string) => token({ grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
    /** Read-only connection health: scope, expiry, and whether a refresh token is held. Never returns token material. */
    async health(): Promise<{ connected: boolean; expiresAt?: string; scope?: string }> {
      const current = await args.store.read()
      return current ? { connected: !!current.refreshToken, expiresAt: current.expiresAt, ...(current.scope ? { scope: current.scope } : {}) } : { connected: false }
    },
    async designTitle(designId: string): Promise<string | null> {
      if (!isCanvaDesignId(designId)) throw new CanvaBlocked("Invalid Canva design id")
      const r = await api<{ design?: { title?: unknown } }>(`/designs/${designId}`)
      return typeof r.design?.title === "string" ? r.design.title : null
    },
    /** Creates a JPG export job and polls it to completion. Returns page URLs in page order. */
    async exportJpg(designId: string, options: { quality?: number; pages?: number[]; width?: number; pollMs?: number; maxWaitMs?: number } = {}): Promise<{ jobId: string; urls: string[] }> {
      if (!isCanvaDesignId(designId)) throw new CanvaBlocked("Invalid Canva design id")
      const quality = options.quality ?? 92
      if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new CanvaBlocked("JPG quality must be 1–100")
      const format: Record<string, unknown> = { type: "jpg", quality, ...(options.width ? { width: options.width } : {}), ...(options.pages?.length ? { pages: options.pages } : {}) }
      const created = await api<{ job?: CanvaExportJob }>("/exports", { method: "POST", body: { design_id: designId, format } })
      let job = created.job
      if (!job || typeof job.id !== "string") throw new CanvaBlocked("Canva returned no export job")
      const started = now(), pollMs = options.pollMs ?? 1500, maxWaitMs = options.maxWaitMs ?? 45_000
      while (job.status === "in_progress") {
        if (now() - started > maxWaitMs) throw new CanvaBlocked(`Canva export ${job.id} is still processing; retry with the job id`, "in_progress")
        await new Promise(r => setTimeout(r, pollMs))
        job = (await api<{ job?: CanvaExportJob }>(`/exports/${job.id}`)).job ?? job
      }
      if (job.status !== "success" || !Array.isArray(job.urls) || !job.urls.length) throw new CanvaBlocked(`Canva export failed${job.error?.code ? ` (${job.error.code})` : ""}`, job.error?.code || "failed")
      for (const u of job.urls) { const parsed = new URL(u); if (parsed.protocol !== "https:") throw new CanvaBlocked("Canva returned a non-HTTPS download URL") }
      return { jobId: job.id, urls: job.urls }
    },
  }
}

import type { Credential } from "firebase-admin/app"
import { getVercelOidcTokenSync } from "@vercel/oidc"

/**
 * Keyless Google access for 434's own project, so GOOGLE_SERVICE_ACCOUNT_KEY can be removed.
 *
 * Same exchange as lib/techday-db.ts, which runs in production on this dependency set:
 *
 *   1. Vercel's OIDC token for this deployment is exchanged at Google STS through the Workload Identity provider
 *      named below;
 *   2. the federated token impersonates GCP_SERVICE_ACCOUNT_EMAIL (iamcredentials generateAccessToken, one hour,
 *      one token per scope);
 *   3. Firestore, GA4 and Search Console get that token through a minimal authClient, and firebase-admin through
 *      `keylessCredential`.
 *
 * Which path runs is decided by env, so this merges with no effect: keyless turns on only when all five variables
 * below are set, and until then every caller reads GOOGLE_SERVICE_ACCOUNT_KEY exactly as before. A partial set is a
 * configuration error and throws, rather than quietly falling back to the key.
 *
 * Which Vercel environments may use it is Google's call, not this file's: the service account's Workload Identity
 * User binding names `next-434media:production` (and, while testing, `:preview`).
 */

const KEYLESS_ENV = [
  "GCP_PROJECT_NUMBER",
  "GCP_WORKLOAD_IDENTITY_POOL_ID",
  "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
  "GCP_SERVICE_ACCOUNT_EMAIL",
  "FIREBASE_PROJECT_ID",
] as const

type KeylessConfig = Record<(typeof KEYLESS_ENV)[number], string>

export const SCOPES = {
  /** Firestore, Cloud Storage and firebase-admin. */
  cloud: "https://www.googleapis.com/auth/cloud-platform",
  analytics: "https://www.googleapis.com/auth/analytics.readonly",
  searchConsole: "https://www.googleapis.com/auth/webmasters.readonly",
} as const

const STS_URL = "https://sts.googleapis.com/v1/token"
const IAM_CREDENTIALS_URL = "https://iamcredentials.googleapis.com/v1"
const REFRESH_MARGIN_MS = 5 * 60 * 1000

export function keylessConfig(env: Record<string, string | undefined> = process.env): KeylessConfig | null {
  const set = KEYLESS_ENV.filter((k) => !!env[k])
  if (set.length === 0) return null
  if (set.length !== KEYLESS_ENV.length) {
    const missing = KEYLESS_ENV.filter((k) => !env[k])
    throw new Error(`Keyless Google access is half-configured; missing ${missing.join(", ")}`)
  }
  return Object.fromEntries(KEYLESS_ENV.map((k) => [k, env[k]!])) as KeylessConfig
}

export function isKeyless(): boolean {
  return keylessConfig() !== null
}

/** The Google Cloud project the keyless path reads (the key's `project_id` on the old path). */
export function keylessProjectId(): string {
  const cfg = keylessConfig()
  if (!cfg) throw new Error("Keyless Google access is not configured")
  return cfg.FIREBASE_PROJECT_ID
}

interface AccessToken {
  token: string
  expiresAtMs: number
}

async function exchange(cfg: KeylessConfig, scope: string): Promise<AccessToken> {
  const audience =
    `//iam.googleapis.com/projects/${cfg.GCP_PROJECT_NUMBER}` +
    `/locations/global/workloadIdentityPools/${cfg.GCP_WORKLOAD_IDENTITY_POOL_ID}` +
    `/providers/${cfg.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`
  const sts = await fetch(STS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience,
      scope: SCOPES.cloud,
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      // Read per call, never at module load: on Vercel the token arrives with the request.
      subjectToken: getVercelOidcTokenSync(),
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
    }),
  })
  if (!sts.ok) throw new Error(`Keyless Google access: STS exchange failed (HTTP ${sts.status})`)
  const federated = (await sts.json()) as { access_token?: string }
  if (!federated.access_token) throw new Error("Keyless Google access: STS returned no token")

  const iam = await fetch(
    `${IAM_CREDENTIALS_URL}/projects/-/serviceAccounts/${encodeURIComponent(cfg.GCP_SERVICE_ACCOUNT_EMAIL)}:generateAccessToken`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${federated.access_token}` },
      body: JSON.stringify({ scope: [scope], lifetime: "3600s" }),
    },
  )
  if (!iam.ok) throw new Error(`Keyless Google access: impersonation failed (HTTP ${iam.status})`)
  const sa = (await iam.json()) as { accessToken?: string; expireTime?: string }
  const expiresAtMs = sa.expireTime ? Date.parse(sa.expireTime) : NaN
  if (!sa.accessToken || !Number.isFinite(expiresAtMs)) throw new Error("Keyless Google access: impersonation returned no token")
  return { token: sa.accessToken, expiresAtMs }
}

const cached = new Map<string, AccessToken>()
const inflight = new Map<string, Promise<AccessToken>>()

/** A short-lived access token for the service account, for one scope. Cached until five minutes before expiry. */
export async function keylessAccessToken(scope: string): Promise<AccessToken> {
  const hit = cached.get(scope)
  if (hit && hit.expiresAtMs - REFRESH_MARGIN_MS > Date.now()) return hit
  cached.delete(scope)
  let pending = inflight.get(scope)
  if (!pending) {
    const cfg = keylessConfig()
    if (!cfg) throw new Error("Keyless Google access is not configured")
    pending = exchange(cfg, scope).then(
      (t) => {
        cached.set(scope, t)
        inflight.delete(scope)
        return t
      },
      (e) => {
        inflight.delete(scope)
        throw e
      },
    )
    inflight.set(scope, pending)
  }
  return pending
}

/**
 * The surface google-gax uses on a supplied authClient (as lib/techday-db.ts and cos-crm-pilot's wifAuthClient).
 * Headers come back as a plain record, which both gax 4 (Firestore) and gax 5 (GA4 Data) read.
 */
export function keylessAuthClient(scope: string) {
  return {
    universeDomain: "googleapis.com",
    async getRequestHeaders(): Promise<Record<string, string>> {
      return { Authorization: `Bearer ${(await keylessAccessToken(scope)).token}` }
    },
    async getAccessToken(): Promise<{ token: string; res: null }> {
      return { token: (await keylessAccessToken(scope)).token, res: null }
    },
  }
}

/** A firebase-admin credential on the same exchange, for the app that verifies sign-in tokens. */
export const keylessCredential: Credential = {
  async getAccessToken() {
    const t = await keylessAccessToken(SCOPES.cloud)
    return { access_token: t.token, expires_in: Math.max(0, Math.floor((t.expiresAtMs - Date.now()) / 1000)) }
  },
}

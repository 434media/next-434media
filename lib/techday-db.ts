import type admin from "firebase-admin"
import { Firestore } from "firebase-admin/firestore"
import { getVercelOidcTokenSync } from "@vercel/oidc"

/**
 * Tech Day's registrations database, wherever it lives.
 *
 * Tech Day lives in its own project, `c434-techday` (Security Policy 7.2), as
 * `c434-techday/techday`, reached WITHOUT a key:
 *
 *   1. Vercel's OIDC token for this deployment (the `x-vercel-oidc-token`
 *      request header, else VERCEL_OIDC_TOKEN) is exchanged at Google STS
 *      through the Workload Identity provider in c434-techday;
 *   2. the federated token impersonates the reader service account there
 *      (iamcredentials generateAccessToken, datastore scope, one hour);
 *   3. Firestore gets that token through a minimal authClient.
 *
 * Same exchange as cos-crm-pilot's lib/cos-pilot/google-wif.ts, which runs in
 * production on the same dependency set. The reader is configured only when
 * all four TECHDAY_* variables below are set, and they are set on Production
 * only. With none set (Preview, Development, local) it throws "not
 * configured", and the registrations list returns empty; the old copy in
 * 434's project is no longer read. A partial set is a configuration error
 * and throws too.
 *
 * The project and database are fixed here, not taken from env, so a wrong
 * variable cannot point this reader at another client's data.
 */

const TECHDAY_PROJECT_ID = "c434-techday"
const TECHDAY_DATABASE_ID = "techday"

const KEYLESS_ENV = [
  "TECHDAY_GCP_PROJECT_NUMBER",
  "TECHDAY_WIF_POOL_ID",
  "TECHDAY_WIF_PROVIDER_ID",
  "TECHDAY_SERVICE_ACCOUNT_EMAIL",
] as const

const STS_URL = "https://sts.googleapis.com/v1/token"
const IAM_CREDENTIALS_URL = "https://iamcredentials.googleapis.com/v1"
const REFRESH_MARGIN_MS = 5 * 60 * 1000

interface AccessToken {
  token: string
  expiresAtMs: number
}

function keylessConfig(): Record<(typeof KEYLESS_ENV)[number], string> | null {
  const set = KEYLESS_ENV.filter((k) => !!process.env[k])
  if (set.length === 0) return null
  if (set.length !== KEYLESS_ENV.length) {
    const missing = KEYLESS_ENV.filter((k) => !process.env[k])
    throw new Error(`Tech Day keyless reader is half-configured; missing ${missing.join(", ")}`)
  }
  return Object.fromEntries(KEYLESS_ENV.map((k) => [k, process.env[k]!])) as Record<
    (typeof KEYLESS_ENV)[number],
    string
  >
}

/** Refuse anything but a Production token before it leaves the process. Google's provider condition is the real gate. */
function productionOidcToken(): string {
  const token = getVercelOidcTokenSync()
  const parts = token.split(".")
  if (parts.length !== 3) throw new Error("Tech Day reader: malformed Vercel OIDC token")
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>
  if (claims.environment !== "production") throw new Error("Tech Day reader: keyless access is Production only")
  return token
}

function createTokenSource(cfg: NonNullable<ReturnType<typeof keylessConfig>>) {
  const audience =
    `//iam.googleapis.com/projects/${cfg.TECHDAY_GCP_PROJECT_NUMBER}` +
    `/locations/global/workloadIdentityPools/${cfg.TECHDAY_WIF_POOL_ID}` +
    `/providers/${cfg.TECHDAY_WIF_PROVIDER_ID}`
  let cached: AccessToken | null = null
  let inflight: Promise<AccessToken> | null = null

  async function exchange(): Promise<AccessToken> {
    const sts = await fetch(STS_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
        audience,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
        subjectToken: productionOidcToken(),
        subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
      }),
    })
    if (!sts.ok) throw new Error(`Tech Day reader: STS exchange failed (HTTP ${sts.status})`)
    const federated = (await sts.json()) as { access_token?: string }
    if (!federated.access_token) throw new Error("Tech Day reader: STS returned no token")

    const iam = await fetch(
      `${IAM_CREDENTIALS_URL}/projects/-/serviceAccounts/${encodeURIComponent(cfg.TECHDAY_SERVICE_ACCOUNT_EMAIL)}:generateAccessToken`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${federated.access_token}` },
        body: JSON.stringify({ scope: ["https://www.googleapis.com/auth/datastore"], lifetime: "3600s" }),
      },
    )
    if (!iam.ok) throw new Error(`Tech Day reader: impersonation failed (HTTP ${iam.status})`)
    const sa = (await iam.json()) as { accessToken?: string; expireTime?: string }
    const expiresAtMs = sa.expireTime ? Date.parse(sa.expireTime) : NaN
    if (!sa.accessToken || !Number.isFinite(expiresAtMs)) throw new Error("Tech Day reader: impersonation returned no token")
    return { token: sa.accessToken, expiresAtMs }
  }

  return async function getAccessToken(): Promise<AccessToken> {
    if (cached && cached.expiresAtMs - REFRESH_MARGIN_MS > Date.now()) return cached
    cached = null
    if (!inflight) {
      inflight = exchange().then(
        (t) => {
          cached = t
          inflight = null
          return t
        },
        (e) => {
          inflight = null
          throw e
        },
      )
    }
    return inflight
  }
}

let keylessDb: admin.firestore.Firestore | undefined

/** The Firestore instance holding Tech Day's `registrations`. */
export function getTechdayDb(): admin.firestore.Firestore {
  const cfg = keylessConfig()
  if (!cfg) throw new Error(`Tech Day database is not configured; set ${KEYLESS_ENV.join(", ")}`)
  if (keylessDb) return keylessDb

  const getAccessToken = createTokenSource(cfg)
  // The surface google-gax uses on a supplied authClient (see cos-crm-pilot's wifAuthClient).
  const authClient = {
    universeDomain: "googleapis.com",
    async getRequestHeaders(): Promise<Record<string, string>> {
      return { Authorization: `Bearer ${(await getAccessToken()).token}` }
    },
    async getAccessToken(): Promise<{ token: string; res: null }> {
      return { token: (await getAccessToken()).token, res: null }
    },
  }
  keylessDb = new Firestore({
    projectId: TECHDAY_PROJECT_ID,
    databaseId: TECHDAY_DATABASE_ID,
    authClient,
    ignoreUndefinedProperties: true,
  }) as unknown as admin.firestore.Firestore
  console.log(`[Firestore] Tech Day database '${TECHDAY_PROJECT_ID}/${TECHDAY_DATABASE_ID}' initialized (keyless)`)
  return keylessDb
}

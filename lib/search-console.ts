import { GoogleAuth } from "google-auth-library"

/**
 * Google Search Console (Webmasters v3) integration.
 *
 * Fills the gap GA4 can't: organic search performance — what queries
 * brought users to the site, with impressions, CTR, and average rank.
 *
 * Setup per property (manual, one-time):
 * 1. In Search Console, add the GA4 service account email
 *    (project_id@iam.gserviceaccount.com) as a User on each verified site.
 * 2. Set SEARCH_CONSOLE_SITE_<KEY> env var to either:
 *      - "https://434media.com/" (URL-prefix property — note trailing slash)
 *      - "sc-domain:434media.com" (Domain property — preferred, covers all
 *        subdomains and protocols)
 *    The KEY suffix maps to GA4_PROPERTY_ID_<KEY>; for the main property
 *    (env GA4_PROPERTY_ID, no suffix) use SEARCH_CONSOLE_SITE_MAIN.
 *
 * No new SDK dep — uses google-auth-library (already installed transitively
 * via @google-analytics/data) + native fetch to the REST endpoint.
 */

const SC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
const SC_BASE = "https://searchconsole.googleapis.com/webmasters/v3"

let _auth: GoogleAuth | null = null

function getAuth(): GoogleAuth {
  if (_auth) return _auth
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured")

  // Same parse-and-fix-newlines pattern as lib/google-analytics.ts to stay
  // tolerant of Vercel's literal-control-char encoding for multiline values.
  const sanitized = raw.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
  let credentials: { client_email?: string; private_key?: string }
  try {
    credentials = JSON.parse(sanitized)
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON")
  }
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n")
  }

  _auth = new GoogleAuth({
    credentials: credentials as { client_email: string; private_key: string },
    scopes: [SC_SCOPE],
  })
  return _auth
}

/**
 * Map a GA4 property id to its configured Search Console site URL.
 * Returns null when the env var isn't set — caller should treat that as
 * "Search Console not configured for this property" and surface a quiet
 * empty state, not an error.
 */
const PROPERTY_TO_SC_KEY: Record<string, string> = {
  "488543948": "MAIN", // 434 MEDIA
  "492867424": "TXMX", // TXMX Boxing
  "492895637": "VEMOSVAMOS", // Vemos Vamos
  "492925168": "AIM", // AIM Health R&D Summit
  "492857375": "SALUTE", // Salute to Troops
  "488563710": "AMPD", // The AMPD Project
  "492925088": "DIGITALCANVAS", // Digital Canvas
}

export function getSearchConsoleSite(propertyId: string): string | null {
  const key = PROPERTY_TO_SC_KEY[propertyId]
  if (!key) return null
  return process.env[`SEARCH_CONSOLE_SITE_${key}`] || null
}

/**
 * Result tag for the fetch helper. We distinguish "configured but inaccessible"
 * (403 — service account not granted in SC UI yet) from "not found" and from
 * other transient errors so callers can return graceful empty-state UIs
 * instead of bubbling 500s up to the dashboard.
 */
type SearchConsoleFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; reason: string }

async function searchConsoleFetch<T>(
  siteUrl: string,
  path: string,
  body: unknown,
): Promise<SearchConsoleFetchResult<T>> {
  const auth = getAuth()
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  const token = tokenResponse.token
  if (!token) {
    return { ok: false, status: 401, reason: "Failed to get Search Console access token" }
  }

  const url = `${SC_BASE}/sites/${encodeURIComponent(siteUrl)}${path}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    return {
      ok: false,
      status: res.status,
      reason: `${res.status}: ${errText.slice(0, 200)}`,
    }
  }
  return { ok: true, data: (await res.json()) as T }
}

export interface SearchConsoleQueryRow {
  query: string
  clicks: number
  impressions: number
  /** 0–1, multiply by 100 for percent. */
  ctr: number
  /** Average rank in SERPs. Lower is better. */
  position: number
}

export interface SearchConsoleQueriesResponse {
  data: SearchConsoleQueryRow[]
  totalClicks: number
  totalImpressions: number
  averagePosition: number
  siteUrl: string
  propertyId: string
}

/**
 * Top organic search queries for a property in the given date range.
 * Returns up to 25 rows by default. Filtered to the "web" search type —
 * Discover, Google News, and Image search are excluded so the report
 * reflects what's typically meant by "SEO traffic."
 */
export async function getSearchConsoleQueries(
  startDate: string,
  endDate: string,
  propertyId: string,
  limit = 25,
): Promise<SearchConsoleQueriesResponse | null> {
  const siteUrl = getSearchConsoleSite(propertyId)
  if (!siteUrl) return null

  const body = {
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: limit,
    type: "web" as const,
  }

  interface RawRow {
    keys: string[]
    clicks: number
    impressions: number
    ctr: number
    position: number
  }
  interface RawResponse {
    rows?: RawRow[]
  }

  const result = await searchConsoleFetch<RawResponse>(siteUrl, "/searchAnalytics/query", body)
  if (!result.ok) {
    // 403/404/401 = "service account not yet granted access in SC UI" or
    // "site not in this SC account" or "auth failed". Treat all as a soft
    // "not accessible" — the UI shows the same empty state as "not configured"
    // with messaging that covers both setup steps.
    // Server-side log preserves the actual reason for debugging.
    console.warn(
      `[SearchConsole] ${siteUrl} returned ${result.status}: ${result.reason}`,
    )
    return null
  }

  const rows = (result.data.rows ?? []).map((r) => ({
    query: r.keys?.[0] ?? "(unknown)",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }))

  const totalClicks = rows.reduce((sum, r) => sum + r.clicks, 0)
  const totalImpressions = rows.reduce((sum, r) => sum + r.impressions, 0)
  // Position is averaged weighted by impressions (the GA-equivalent way to roll up rank).
  const weightedPosition = rows.reduce((sum, r) => sum + r.position * r.impressions, 0)
  const averagePosition = totalImpressions > 0 ? weightedPosition / totalImpressions : 0

  return {
    data: rows,
    totalClicks,
    totalImpressions,
    averagePosition,
    siteUrl,
    propertyId,
  }
}

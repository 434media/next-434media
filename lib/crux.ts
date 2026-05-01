/**
 * Chrome User Experience Report (CrUX) integration.
 *
 * CrUX is Google's real-user-monitoring dataset, sourced from Chrome users
 * who opted into anonymous usage statistics. It exposes the field metrics
 * Google actually uses for Core Web Vitals scoring (and SEO ranking signal):
 *   - LCP (Largest Contentful Paint) — loading performance
 *   - INP (Interaction to Next Paint) — responsiveness (replaces FID)
 *   - CLS (Cumulative Layout Shift) — visual stability
 * Plus secondary: TTFB (Time to First Byte), FCP (First Contentful Paint).
 *
 * Why this matters: GA4 doesn't surface CWV. Without CrUX (or our own
 * web-vitals instrumentation) we have zero visibility into whether the
 * sites meet Google's "Good" thresholds — which directly affects search
 * ranking. CrUX is free, requires no instrumentation, and historical data
 * is available out of the box.
 *
 * Setup:
 * 1. In GCP Console (same project as GA4): APIs & Services → Library →
 *    enable "Chrome UX Report API".
 * 2. APIs & Services → Credentials → Create Credentials → API key.
 *    Restrict the key to: Chrome UX Report API only.
 * 3. Set CRUX_API_KEY env var.
 *
 * Site origin per property is derived from SEARCH_CONSOLE_SITE_<KEY> when
 * possible (sc-domain:foo.com → https://foo.com), or set explicitly via
 * CRUX_ORIGIN_<KEY> for sites where the SC value isn't a usable origin.
 */

const CRUX_ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryRecord"

/** Same property→key suffix map used by lib/search-console.ts. */
const PROPERTY_TO_KEY: Record<string, string> = {
  "488543948": "MAIN",
  "492867424": "TXMX",
  "492895637": "VEMOSVAMOS",
  "492925168": "AIM",
  "492857375": "SALUTE",
  "488563710": "AMPD",
  "492925088": "DIGITALCANVAS",
}

/**
 * Resolve a GA4 property id to a CrUX-compatible origin URL
 * (e.g. "https://434media.com" — no trailing slash, https only).
 *
 * Order of resolution:
 *   1. CRUX_ORIGIN_<KEY> env var (explicit override)
 *   2. Derive from SEARCH_CONSOLE_SITE_<KEY> if it starts with "sc-domain:"
 *      or "https://" — otherwise null
 */
export function getCruxOrigin(propertyId: string): string | null {
  const key = PROPERTY_TO_KEY[propertyId]
  if (!key) return null

  const explicit = process.env[`CRUX_ORIGIN_${key}`]
  if (explicit) return explicit.replace(/\/$/, "")

  const sc = process.env[`SEARCH_CONSOLE_SITE_${key}`]
  if (!sc) return null

  if (sc.startsWith("sc-domain:")) {
    return `https://${sc.slice("sc-domain:".length)}`
  }
  if (sc.startsWith("https://") || sc.startsWith("http://")) {
    return sc.replace(/\/$/, "")
  }
  return null
}

export type CruxFormFactor = "PHONE" | "DESKTOP" | "TABLET" | "ALL_FORM_FACTORS"

interface CruxApiResponseRecord {
  metrics?: Record<
    string,
    {
      histogram?: Array<{ start: number; end?: number; density: number }>
      percentiles?: { p75?: number | string }
    }
  >
  collectionPeriod?: {
    firstDate?: { year: number; month: number; day: number }
    lastDate?: { year: number; month: number; day: number }
  }
}

interface CruxApiResponse {
  record?: CruxApiResponseRecord
  urlNormalizationDetails?: { originalUrl?: string; normalizedUrl?: string }
}

export type CruxRating = "good" | "needs-improvement" | "poor" | "unknown"

export interface CruxMetric {
  /** Numeric p75. Units: ms for LCP / INP / TTFB / FCP, unitless score for CLS. */
  p75: number
  rating: CruxRating
  /** Histogram densities (Good / Needs improvement / Poor) — sums to 1.0. */
  goodDensity: number
  needsImprovementDensity: number
  poorDensity: number
}

export interface CruxResponse {
  /** True when CRUX_API_KEY is configured AND the origin returned data. */
  available: boolean
  /** Reason it's unavailable (when available=false). */
  reason?: string
  origin?: string
  formFactor?: CruxFormFactor
  collectionPeriod?: { from: string; to: string }
  metrics?: {
    LCP?: CruxMetric
    INP?: CruxMetric
    CLS?: CruxMetric
    TTFB?: CruxMetric
    FCP?: CruxMetric
  }
}

/**
 * Standard Core Web Vitals "Good" / "Needs improvement" / "Poor" thresholds
 * per https://web.dev/articles/vitals. Used to color-code metrics in the UI.
 */
function rateMetric(name: string, p75: number): CruxRating {
  switch (name) {
    case "LCP":
    case "largest_contentful_paint":
      if (p75 <= 2500) return "good"
      if (p75 <= 4000) return "needs-improvement"
      return "poor"
    case "INP":
    case "interaction_to_next_paint":
      if (p75 <= 200) return "good"
      if (p75 <= 500) return "needs-improvement"
      return "poor"
    case "CLS":
    case "cumulative_layout_shift":
      if (p75 <= 0.1) return "good"
      if (p75 <= 0.25) return "needs-improvement"
      return "poor"
    case "TTFB":
    case "experimental_time_to_first_byte":
      if (p75 <= 800) return "good"
      if (p75 <= 1800) return "needs-improvement"
      return "poor"
    case "FCP":
    case "first_contentful_paint":
      if (p75 <= 1800) return "good"
      if (p75 <= 3000) return "needs-improvement"
      return "poor"
    default:
      return "unknown"
  }
}

function readMetric(name: string, raw: CruxApiResponseRecord["metrics"] | undefined): CruxMetric | undefined {
  if (!raw) return undefined
  // CrUX response keys are snake_case, e.g. "largest_contentful_paint".
  const apiKey = (
    {
      LCP: "largest_contentful_paint",
      INP: "interaction_to_next_paint",
      CLS: "cumulative_layout_shift",
      TTFB: "experimental_time_to_first_byte",
      FCP: "first_contentful_paint",
    } as const
  )[name as "LCP" | "INP" | "CLS" | "TTFB" | "FCP"]

  if (!apiKey) return undefined
  const m = raw[apiKey]
  if (!m) return undefined

  // CLS comes back as a string (it's a decimal score). Everything else is a number ms.
  const p75Raw = m.percentiles?.p75
  if (p75Raw === undefined || p75Raw === null) return undefined
  const p75 = typeof p75Raw === "string" ? parseFloat(p75Raw) : p75Raw
  if (Number.isNaN(p75)) return undefined

  const histogram = m.histogram ?? []
  return {
    p75,
    rating: rateMetric(name, p75),
    goodDensity: histogram[0]?.density ?? 0,
    needsImprovementDensity: histogram[1]?.density ?? 0,
    poorDensity: histogram[2]?.density ?? 0,
  }
}

/**
 * Pull Core Web Vitals for an origin (= aggregate site-wide). Returns a
 * `available: false` payload when:
 *   - CRUX_API_KEY isn't set
 *   - The property doesn't have a derivable origin
 *   - CrUX has no data (low-traffic site, < ~100 daily samples)
 *
 * Errors from CrUX are caught and surfaced as `available: false` with the
 * reason — so the UI can render an empty state instead of an error toast.
 */
export async function getCoreWebVitals(
  propertyId: string,
  formFactor: CruxFormFactor = "ALL_FORM_FACTORS",
): Promise<CruxResponse> {
  const apiKey = process.env.CRUX_API_KEY
  if (!apiKey) {
    return { available: false, reason: "CRUX_API_KEY not configured" }
  }

  const origin = getCruxOrigin(propertyId)
  if (!origin) {
    return { available: false, reason: "No origin configured for this property" }
  }

  const body: Record<string, unknown> = { origin }
  if (formFactor !== "ALL_FORM_FACTORS") body.formFactor = formFactor

  let response: Response
  try {
    response = await fetch(`${CRUX_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : "Network error",
      origin,
    }
  }

  // CrUX returns 404 for origins with insufficient data. Treat that as
  // "not enough samples" rather than a hard error.
  if (response.status === 404) {
    return {
      available: false,
      reason: "CrUX has no data for this origin yet (low traffic — typically needs 100+ daily Chrome samples)",
      origin,
    }
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    return {
      available: false,
      reason: `CrUX ${response.status}: ${text.slice(0, 200)}`,
      origin,
    }
  }

  const data = (await response.json()) as CruxApiResponse
  const metrics = data.record?.metrics

  const period = data.record?.collectionPeriod
  const fmtDate = (d?: { year: number; month: number; day: number }) =>
    d ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : ""

  return {
    available: true,
    origin,
    formFactor,
    collectionPeriod: period
      ? { from: fmtDate(period.firstDate), to: fmtDate(period.lastDate) }
      : undefined,
    metrics: {
      LCP: readMetric("LCP", metrics),
      INP: readMetric("INP", metrics),
      CLS: readMetric("CLS", metrics),
      TTFB: readMetric("TTFB", metrics),
      FCP: readMetric("FCP", metrics),
    },
  }
}

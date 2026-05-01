/**
 * GA4 Measurement Protocol — server-side event sending.
 *
 * Use this to push events to GA4 from places where there's no browser:
 *   - Server API routes that mutate state (lead conversion, opportunity won)
 *   - Cron jobs (scheduled scoring updates, weekly summaries)
 *   - Webhooks (Resend engagement → re-score → log to GA4)
 *
 * Why this matters: it closes the attribution loop. Without it, GA4 only
 * knows "user X visited /work last Tuesday." With it, GA4 also knows
 * "user X became a $50K closed opportunity 3 weeks later" — and can
 * attribute the revenue back to the original acquisition source.
 *
 * Setup (per property): GA4 Admin → Data Streams → Web Stream → Measurement
 * Protocol API secrets → Create. Store the secret as an env var. The
 * measurement_id (G-XXXXXXXXXX) is on the same Data Streams page.
 *
 * Spec: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

import { createHash } from "node:crypto"

const GA4_ENDPOINT = "https://www.google-analytics.com/mp/collect"
// Optional debug endpoint — POSTs return validation errors, won't show in
// the GA4 UI. Use for local dev only by setting GA4_MP_DEBUG=1.
const GA4_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect"

export interface MeasurementProtocolEvent {
  /** Event name, snake_case. Custom events should match what we filter on in GA4 reports. */
  name: string
  /** Event params. Currency-valued events should include `currency: "USD"` and `value`. */
  params?: Record<string, string | number | boolean | undefined>
}

interface MeasurementProtocolPayload {
  /** Deterministic per-user id. We hash the email so a CRM event ties to the same user across visits. */
  client_id: string
  /** Optional cross-device user id. Same hash policy as client_id. */
  user_id?: string
  /** Up to 25 events per request. Default to one. */
  events: MeasurementProtocolEvent[]
  /** When true, GA4 won't update DAU/MAU. Use for backfill / replay. */
  non_personalized_ads?: boolean
  /** Unix epoch microseconds — let GA4 default to "now" unless you're backfilling. */
  timestamp_micros?: number
}

/**
 * Hash an email into a stable, non-PII client identifier.
 * Same email always maps to the same id, but the id can't be reversed.
 */
export function clientIdFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return "anonymous"
  // GA4 client_id is conventionally `<random>.<timestamp>`; hash format works fine
  // as long as it's stable per user. Truncate for readability in GA4 reports.
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32)
}

interface SendOptions {
  /**
   * Override the default property the event is sent to. When unset, falls
   * back to `GA4_MEASUREMENT_ID_MAIN` + `GA4_MEASUREMENT_PROTOCOL_SECRET_MAIN`.
   * Pass `propertyKey: "TXMX"` to route to TXMX env vars instead.
   */
  propertyKey?: string
}

function getCredentials(propertyKey: string): { measurementId: string; apiSecret: string } | null {
  const idEnv = `GA4_MEASUREMENT_ID_${propertyKey.toUpperCase()}`
  const secretEnv = `GA4_MEASUREMENT_PROTOCOL_SECRET_${propertyKey.toUpperCase()}`
  const measurementId = process.env[idEnv]
  const apiSecret = process.env[secretEnv]
  if (!measurementId || !apiSecret) return null
  return { measurementId, apiSecret }
}

/**
 * Send one or more events to GA4 via Measurement Protocol.
 *
 * Fire-and-forget: never throws, never blocks the caller. If the GA4 env vars
 * aren't configured, returns silently — same shape as Resend in `lib/resend.ts`.
 * The whole point is that CRM operations stay correct even if analytics is down.
 */
export async function sendMeasurementProtocolEvents(
  payload: MeasurementProtocolPayload,
  options: SendOptions = {},
): Promise<{ ok: boolean; reason?: string }> {
  const propertyKey = options.propertyKey ?? "MAIN"
  const creds = getCredentials(propertyKey)
  if (!creds) {
    // No env vars set — no-op. This is the expected path until the user
    // configures Measurement Protocol secrets per property in Vercel.
    return { ok: false, reason: `No GA4 MP credentials for property "${propertyKey}"` }
  }

  const useDebug = process.env.GA4_MP_DEBUG === "1"
  const url = `${useDebug ? GA4_DEBUG_ENDPOINT : GA4_ENDPOINT}?measurement_id=${encodeURIComponent(creds.measurementId)}&api_secret=${encodeURIComponent(creds.apiSecret)}`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    // Production endpoint returns 204 with no body. Debug endpoint returns
    // 200 with validation errors as JSON — log them so misconfigured events
    // surface in dev.
    if (useDebug) {
      const debugBody = await res.text().catch(() => "")
      if (debugBody && debugBody !== "{}") {
        console.warn(`[GA4 MP debug] ${propertyKey}:`, debugBody)
      }
    }
    if (!res.ok && res.status !== 204) {
      console.warn(`[GA4 MP] ${propertyKey} non-OK response: ${res.status}`)
      return { ok: false, reason: `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    // Never throw — analytics shouldn't break business logic.
    console.warn(`[GA4 MP] ${propertyKey} send failed:`, err)
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Meta Pixel jurisdiction gate, decided in proxy.ts and read by
 * components/MetaPixel.tsx.
 *
 * The pixel sets cookies before any consent is given, so it does not run for
 * visitors in the GDPR/CASL jurisdictions 434 already excludes from outbound
 * (EXCLUDED_COUNTRY_CODES — the list is not restated here). The proxy is the
 * only place that sees the visitor's country without making every page
 * dynamic, so it decides and leaves its answer in a cookie the client reads.
 *
 * Allowed visitors get `434_px=1`. Excluded visitors get no cookie at all from
 * this gate, and a stale one is deleted.
 *
 * A missing country header fails CLOSED on Vercel (no cookie, no pixel), by
 * founder decision on 2026-10-07: every real visitor arrives with the header,
 * so its absence there is an anomaly, not a reason to track. Off Vercel (local
 * development) there is never a header, and the pixel is allowed so dev
 * behaves like US traffic.
 */
import { EXCLUDED_COUNTRY_CODES } from "@/lib/prospecting/scorer"

export { META_PIXEL_COOKIE } from "@/lib/tracking-scope"

export function metaPixelAllowed(country: string | null | undefined, onVercel: boolean): boolean {
  const code = country?.trim().toUpperCase()
  if (!code) return !onVercel
  return !EXCLUDED_COUNTRY_CODES.has(code)
}

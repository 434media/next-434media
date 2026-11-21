/**
 * Fetch Metadata check for the admin session (security log ADM-14).
 *
 * The admin cookie is `SameSite=Lax`, which treats every `*.434media.com` origin as same-site, and the admin API has no
 * CSRF token. Browsers send `Sec-Fetch-Site` on every request (W3C Fetch Metadata Request Headers), so a request that a
 * page on another site, or on a sibling subdomain, makes with the cookie is recognisable and is treated as signed out.
 *
 * Allowed: `same-origin`; `none` (typed or bookmarked); no header at all (server-to-server callers, cron, older
 * clients); and a top-level GET navigation (`Sec-Fetch-Mode: navigate` with no `Origin`), so a link to /admin in an
 * email still opens it. Refused: any other `cross-site` or `same-site` request, which covers fetch, XHR, images and
 * cross-site form POSTs (a navigating POST carries `Origin`).
 */
export type HeaderReader = { get(name: string): string | null }

export function crossSiteRefused(headers: HeaderReader): boolean {
  const site = headers.get("sec-fetch-site")
  if (!site || site === "same-origin" || site === "none") return false
  const isGetNavigation = headers.get("sec-fetch-mode") === "navigate" && !headers.get("origin")
  return !isGetNavigation
}

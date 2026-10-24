/**
 * Origin allowlist for public form routes that accept browser POSTs only.
 *
 * Browsers send Origin on every cross-origin and same-origin POST from fetch,
 * so a request without one, or from anywhere else, did not come from one of
 * our pages. Production is 434media.com (with and without www); a Vercel
 * preview is its own deployment URL or branch alias, read from Vercel's system
 * environment variables; local development is localhost.
 */
function allowedOrigins(): Set<string> {
  const origins = new Set(["https://www.434media.com", "https://434media.com"])
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (host) origins.add(`https://${host}`)
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000")
    origins.add("http://127.0.0.1:3000")
  }
  return origins
}

export function isAllowedFormOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  return origin !== null && allowedOrigins().has(origin)
}

import { NextResponse } from "next/server"
import { decideSharedSecret, secretMatches } from "./secret-compare"

export { secretMatches }

/**
 * The shared API-key gate for public routes that external sites call (security sweep 2026-10-29).
 *
 * The key is read from one header only: `x-api-key`, or `Authorization: Bearer <key>`. Never from the query string, which
 * lands in URLs, referrers and request logs. Compared in constant time. When the env var is unset in production the route
 * refuses with 503 instead of opening; outside production it stays open so local development needs no key.
 *
 * Returns null when the request may proceed, otherwise the response to return.
 */
export function requireSecret(
  request: Request,
  envVar: string,
  opts: { where: string; headers?: Record<string, string> },
): NextResponse | null {
  const expected = process.env[envVar]
  const authorization = request.headers.get("authorization")
  const bearer = authorization && /^Bearer (.+)$/.exec(authorization)?.[1]
  const provided = request.headers.get("x-api-key") || bearer || null
  const decision = decideSharedSecret(provided, expected, process.env.NODE_ENV === "production")

  if (decision === "ok") return null
  if (decision === "dev_open") {
    console.warn(`[${opts.where}] ${envVar} is not set; allowing the request outside production only`)
    return null
  }
  if (decision === "unconfigured") {
    console.error(`[${opts.where}] ${envVar} is not set; refusing every request`)
    return NextResponse.json({ error: "API not configured" }, { status: 503, headers: opts.headers })
  }
  return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401, headers: opts.headers })
}

/** Whether the request tried to pass a key in the removed `?api_key=` form, for a deprecation log line. */
export function hasQueryApiKey(request: Request): boolean {
  return new URL(request.url).searchParams.has("api_key")
}

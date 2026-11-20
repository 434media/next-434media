/**
 * Offline. The site-wide security headers (lib/security-headers.ts, security log SW-9): every header present, the
 * policy enforced (not report-only), framing limited to this origin, and no eval.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { contentSecurityPolicy, securityHeaders } from "../security-headers"

test("every security header is set", () => {
  const keys = securityHeaders.map((h) => h.key)
  for (const key of ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
    assert.ok(keys.includes(key), key)
  }
  assert.ok(!keys.includes("Content-Security-Policy-Report-Only"))
})

test("the policy blocks framing, plugins and base-tag tricks, and allows no eval", () => {
  assert.match(contentSecurityPolicy, /frame-ancestors 'self'/)
  assert.match(contentSecurityPolicy, /object-src 'none'/)
  assert.match(contentSecurityPolicy, /base-uri 'self'/)
  assert.match(contentSecurityPolicy, /form-action 'self'/)
  assert.doesNotMatch(contentSecurityPolicy, /unsafe-eval/)
})

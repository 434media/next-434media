/** Offline. The admin session ignores cross-site and sibling-subdomain requests (ADM-14), but not navigations. */
import { test } from "node:test"
import assert from "node:assert/strict"
import { crossSiteRefused } from "../fetch-metadata"

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null })

test("same-origin, none and missing headers pass", () => {
  assert.equal(crossSiteRefused(h({ "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" })), false)
  assert.equal(crossSiteRefused(h({ "sec-fetch-site": "none", "sec-fetch-mode": "navigate" })), false)
  assert.equal(crossSiteRefused(h({})), false)
})

test("a cross-site or same-site fetch is refused", () => {
  assert.equal(crossSiteRefused(h({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", origin: "https://evil.example" })), true)
  assert.equal(crossSiteRefused(h({ "sec-fetch-site": "same-site", "sec-fetch-mode": "no-cors" })), true)
})

test("a GET navigation from another site passes; a form POST navigation does not", () => {
  assert.equal(crossSiteRefused(h({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" })), false)
  assert.equal(crossSiteRefused(h({ "sec-fetch-site": "same-site", "sec-fetch-mode": "navigate", origin: "https://x.434media.com" })), true)
})

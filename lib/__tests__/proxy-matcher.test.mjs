/**
 * proxy.ts must run on every public page route, or that page never receives
 * the Meta Pixel cookie and the pixel silently never loads there. It must skip
 * build assets, API routes and the files at the app root, which have no use
 * for it.
 *
 * Uses Next's own matcher (unstable_doesMiddlewareMatch), against the matcher
 * string read out of proxy.ts, so the test exercises exactly what ships.
 *
 * Run: node --test lib/__tests__/proxy-matcher.test.mjs
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js"

const source = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8")
const literal = source.match(/matcher:\s*\[\s*("(?:[^"\\]|\\.)*")/)
assert.ok(literal, "matcher string not found in proxy.ts")
const config = { matcher: [JSON.parse(literal[1])] }
const matches = (url) => unstable_doesMiddlewareMatch({ config, url })

// Every page route under app/(site) and app/(shop), plus the 404 path.
const PAGES = [
  "/", "/work", "/contact", "/blog", "/blog/some-post", "/en/sdoh", "/es/sdoh", "/sdoh", "/SDOH",
  "/en/SDOH", "/deck/abc123", "/privacy-policy", "/terms-of-service", "/underwriter-intake",
  "/shop", "/search", "/search/txmx", "/product/txmx-boxing-founders-tee", "/does-not-exist", "/events",
  // Untracked, but still pages: the proxy runs and leaves them alone.
  "/admin", "/admin/leads", "/travel/sign-in", "/squads",
]

const SKIPPED = [
  "/_next/static/chunks/app.js", "/_next/static/immutable/chunks/x.css", "/_next/image?url=%2Fa.png&w=64&q=75",
  "/api/contact-form", "/api/cron/outreach-sequence", "/favicon.ico", "/robots.txt", "/sitemap.xml",
  "/llms.txt", "/opengraph-image", "/twitter-image", "/apple-icon.png", "/apple-touch-icon-precomposed.png",
  "/deck/abc123/opengraph-image", "/travel/x/twitter-image", "/hero/hero-720p.mp4", "/brand/434-primary-light.svg",
  "/marks/que/que-mark-v2.webp", "/sdoh/sdoh-poster-v2.jpg",
]

for (const url of PAGES) {
  test(`runs on ${url}`, () => assert.equal(matches(url), true))
}
for (const url of SKIPPED) {
  test(`skips ${url}`, () => assert.equal(matches(url), false))
}

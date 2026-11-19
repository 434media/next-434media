/**
 * Offline. The staff Google sign-in's return path (founder, 2026-11-19): only a same-site itinerary path,
 * `/travel/<project>/<traveler>`, is kept; anything else is ignored and the callback lands on /admin, so the return
 * path cannot become an open redirect. The sign-in route is exercised directly; the callback needs Google, so its
 * landing is checked through `postSignInPath` and its source. The signed-in round trip is checked on production after
 * merge, because previews refuse Google sign-in.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { NextRequest } from "next/server"
import {
  ADMIN_LANDING,
  OAUTH_RETURN_COOKIE,
  TRAVEL_ITINERARY_PATH,
  postSignInPath,
  safeTravelReturnPath,
} from "../travel/return-path"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")

const BAD = [
  // absolute and protocol-relative URLs
  "https://evil.example/travel/a/b",
  "http://evil.example",
  "//evil.example",
  "//evil.example/travel/a/b",
  "/\\evil.example",
  "\\\\evil.example",
  "javascript:alert(1)",
  // encoded tricks
  "/travel/%2F%2Fevil.example/b",
  "%2Ftravel%2Fa%2Fb",
  "/travel/a/b%0d%0aSet-Cookie:x=1",
  "/travel/a%2Fb/c",
  "/%2F%2Fevil.example",
  // wrong shape
  "/admin",
  "/travel",
  "/travel/",
  "/travel/a",
  "/travel/a/",
  "/travel/a/b/",
  "/travel/a/b/c",
  "/travel/a/b?x=1",
  "/travel/a/b#x",
  "/travel/../admin/x",
  "/travel/A/b",
  "/travel/a b/c",
  "/travel/a/b\n",
  "travel/a/b",
  " /travel/a/b",
  "/travel/sign-in",
  `/travel/${"a".repeat(200)}/b`,
  // not a string
  "",
  undefined,
  null,
  42,
  ["/travel/a/b"],
]

test("an itinerary path is kept", () => {
  for (const p of ["/travel/bvc-agm-2026/aj", "/travel/a/b", "/travel/0-x/y-9"]) {
    assert.equal(safeTravelReturnPath(p), p)
    assert.equal(postSignInPath(p), p)
  }
})

test("anything else is ignored and the callback lands on /admin", () => {
  assert.equal(ADMIN_LANDING, "/admin")
  for (const p of BAD) {
    assert.equal(safeTravelReturnPath(p), null, JSON.stringify(p))
    assert.equal(postSignInPath(p), "/admin", JSON.stringify(p))
  }
})

test("a kept path resolves on the site's own origin", () => {
  const origin = "https://www.434media.com"
  assert.equal(new URL(`${origin}${postSignInPath("/travel/a/b")}`).origin, origin)
  for (const p of BAD) assert.equal(new URL(`${origin}${postSignInPath(p)}`).origin, origin, JSON.stringify(p))
})

test("the travel sign-in page accepts the same shape", () => {
  assert.match("/travel/bvc-agm-2026/aj", TRAVEL_ITINERARY_PATH)
  const page = read("app/travel/sign-in/page.tsx")
  assert.match(page, /next\.match\(TRAVEL_ITINERARY_PATH\)/)
})

async function startSignIn(query: string, cookie?: string) {
  const saved = { ...process.env }
  process.env.GOOGLE_CLIENT_ID = "test-client-id"
  delete process.env.VERCEL_ENV
  try {
    const { GET } = await import("../../app/api/auth/signin/google/route")
    const headers = cookie ? { cookie } : undefined
    return await GET(new NextRequest(`https://www.434media.com/api/auth/signin/google${query}`, { headers }))
  } finally {
    process.env = saved
  }
}

test("the sign-in route stores a valid return path in an httpOnly, short-lived cookie", async () => {
  const response = await startSignIn(`?next=${encodeURIComponent("/travel/bvc-agm-2026/aj")}`)
  assert.match(response.headers.get("location") ?? "", /^https:\/\/accounts\.google\.com\//)
  const state = response.cookies.get("oauth_state")
  assert.ok(state?.value, "oauth_state still set")
  const back = response.cookies.get(OAUTH_RETURN_COOKIE)
  assert.equal(back?.value, "/travel/bvc-agm-2026/aj")
  assert.equal(back?.httpOnly, true)
  assert.equal(back?.maxAge, 600)
  assert.equal(back?.path, "/")
  assert.equal(back?.sameSite, "lax")
})

test("the sign-in route drops an invalid return path and clears a stale one", async () => {
  for (const next of ["//evil.example", "https://evil.example/travel/a/b", "/admin", "/travel/%2F%2Fevil/b"]) {
    const response = await startSignIn(`?next=${encodeURIComponent(next)}`, `${OAUTH_RETURN_COOKIE}=/travel/a/b`)
    const back = response.cookies.get(OAUTH_RETURN_COOKIE)
    assert.equal(back?.value ?? "", "", next)
    assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`${OAUTH_RETURN_COOKIE}=;[^,]*(Max-Age=0|Expires=Thu, 01 Jan 1970)`), next)
    assert.ok(response.cookies.get("oauth_state")?.value)
  }
  const none = await startSignIn("")
  assert.equal(none.cookies.get(OAUTH_RETURN_COOKIE)?.value ?? "", "")
})

test("the Google request is unchanged: workspace restriction and state", async () => {
  const response = await startSignIn(`?next=${encodeURIComponent("/travel/a/b")}`)
  const url = new URL(response.headers.get("location") ?? "")
  assert.equal(url.searchParams.get("hd"), process.env.WORKSPACE_DOMAIN || "434media.com")
  assert.equal(url.searchParams.get("state"), response.cookies.get("oauth_state")?.value)
  assert.equal(url.searchParams.get("redirect_uri"), "https://www.434media.com/api/auth/callback/google")
  assert.equal(url.searchParams.has("next"), false)
})

test("the callback lands through postSignInPath and clears both cookies, after the state, domain and role checks", () => {
  const src = read("app/api/auth/callback/google/route.ts")
  assert.match(src, /postSignInPath\(request\.cookies\.get\(OAUTH_RETURN_COOKIE\)\?\.value\)/)
  assert.match(src, /cookies\.delete\('oauth_state'\)/)
  assert.match(src, /cookies\.delete\(OAUTH_RETURN_COOKIE\)/)
  const landing = src.indexOf("postSignInPath(")
  for (const gate of ["state !== storedState", "isVerifiedWorkspaceGoogleAccount(userInfo)", "decision.authorized", "await setSession("]) {
    const at = src.indexOf(gate)
    assert.ok(at > 0 && at < landing, `${gate} runs before the landing`)
  }
  // No other success redirect: every remaining /admin redirect is an error.
  assert.doesNotMatch(src, /redirect\(`\$\{request\.nextUrl\.origin\}\/admin`\)/)
})

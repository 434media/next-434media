/**
 * Offline. The small admin findings ADM-7 to ADM-11 and ADM-13 (security log, 2026-10-28). Invented addresses on the
 * reserved .test domain and made-up secrets; no Firestore, no network.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import {
  isVerifiedWorkspaceGoogleAccount,
  rosterCanRunContent,
  rosterIsSuperAdmin,
  withProfileChanges,
  type User,
} from "../auth"
import { blogFiltersFor } from "../blog-access"
import { bearerSecretMatches } from "../secret-compare"
import { normalizeTeamMemberEmail } from "../team-member-email"
import { SESSION_LIFETIME_MS, parseSessionCookieWithExpiry, sessionLifetime, signPayload } from "../session-cookie"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")

// ADM-7
test("ADM-7: without an admin session, blog reads are forced to published", () => {
  for (const given of [{}, { status: "draft" }, { status: undefined }, undefined, null, "draft", { category: "x", status: "draft" }]) {
    assert.equal(blogFiltersFor(given, false).status, "published", JSON.stringify(given))
  }
  assert.equal(blogFiltersFor({ category: "x", status: "draft" }, false).category, "x")
})

test("ADM-7: an admin session keeps the filters as given, drafts included", () => {
  assert.deepEqual(blogFiltersFor({ status: "draft" }, true), { status: "draft" })
  assert.deepEqual(blogFiltersFor({}, true), {})
})

test("ADM-7: the server action passes its filters through blogFiltersFor with the session", () => {
  const src = read("actions/blog.ts")
  assert.match(src, /getBlogPostsFromFirestore\(blogFiltersFor\(filters, isAdmin\)\)/)
  assert.doesNotMatch(src, /getBlogPostsFromFirestore\(filters\)/)
})

// ADM-8
test("ADM-8: a deactivated super admin has no super-admin or content powers", () => {
  assert.equal(rosterIsSuperAdmin({ role: "crm_super_admin", isActive: false }), false)
  assert.equal(rosterCanRunContent({ role: "crm_super_admin", isActive: false }), false)
  assert.equal(rosterCanRunContent({ role: "full_admin", isActive: false, permissions: ["content"] }), false)
})

test("ADM-8: active records keep their powers; a missing isActive reads as active, as at sign-in", () => {
  assert.equal(rosterIsSuperAdmin({ role: "crm_super_admin", isActive: true }), true)
  assert.equal(rosterIsSuperAdmin({ role: "crm_super_admin" }), true)
  assert.equal(rosterIsSuperAdmin({ role: "full_admin", isActive: true }), false)
  assert.equal(rosterCanRunContent({ role: "crm_super_admin", isActive: true }), true)
  assert.equal(rosterCanRunContent({ role: "intern", isActive: true, permissions: ["content"] }), true)
  assert.equal(rosterCanRunContent({ role: "intern", isActive: true, permissions: [] }), false)
  assert.equal(rosterCanRunContent({ role: "intern", isActive: true, permissions: "content" }), false)
})

// ADM-9
test("ADM-9: Google admission needs verified_email, hd and the address on the domain", () => {
  const d = "workspace.test"
  assert.equal(isVerifiedWorkspaceGoogleAccount({ email: "a@workspace.test", verified_email: true, hd: d }, d), true)
  assert.equal(isVerifiedWorkspaceGoogleAccount({ email: "a@workspace.test", verified_email: false, hd: d }, d), false)
  assert.equal(isVerifiedWorkspaceGoogleAccount({ email: "a@workspace.test", hd: d }, d), false)
  assert.equal(isVerifiedWorkspaceGoogleAccount({ email: "a@workspace.test", verified_email: true }, d), false)
  assert.equal(isVerifiedWorkspaceGoogleAccount({ email: "a@workspace.test", verified_email: true, hd: "other.test" }, d), false)
  assert.equal(isVerifiedWorkspaceGoogleAccount({ email: "a@other.test", verified_email: true, hd: d }, d), false)
  assert.equal(isVerifiedWorkspaceGoogleAccount({ email: "a@evil-workspace.test", verified_email: true, hd: d }, d), false)
  assert.equal(isVerifiedWorkspaceGoogleAccount({ verified_email: true, hd: d }, d), false)
})

test("ADM-9: the Google callback admits through the verified check, not the suffix alone", () => {
  const src = read("app/api/auth/callback/google/route.ts")
  assert.match(src, /if \(!isVerifiedWorkspaceGoogleAccount\(userInfo\)\)/)
  assert.doesNotMatch(src, /isWorkspaceEmail\(/)
  assert.match(src, /authorizeAdminSignIn\(userInfo\.email, 'google'\)/) // ADM-2 gate still in place
  assert.doesNotMatch(src, /checkRevoked/)
})

// ADM-10
test("ADM-10: the bearer check accepts only the exact secret in the Authorization header", () => {
  const s = "made-up-cron-secret"
  assert.equal(bearerSecretMatches(`Bearer ${s}`, s), true)
  assert.equal(bearerSecretMatches(`Bearer ${s}x`, s), false)
  assert.equal(bearerSecretMatches(`Bearer ${s.slice(0, -1)}`, s), false)
  assert.equal(bearerSecretMatches(s, s), false)
  assert.equal(bearerSecretMatches(`Basic ${s}`, s), false)
  assert.equal(bearerSecretMatches("Bearer ", s), false)
  assert.equal(bearerSecretMatches(null, s), false)
  assert.equal(bearerSecretMatches(`Bearer ${s}`, undefined), false)
  assert.equal(bearerSecretMatches("Bearer ", ""), false)
})

test("ADM-10: every cron route authorizes through lib/cron-auth, and nothing reads CRON_SECRET from a query", () => {
  const cronDir = join(ROOT, "app", "api", "cron")
  for (const name of readdirSync(cronDir)) {
    const route = join("app", "api", "cron", name, "route.ts")
    if (!existsSync(join(ROOT, route))) continue
    assert.match(read(route), /runCronJob|authorizeCronRequest/, route)
  }
  assert.match(read("lib/cron-auth.ts"), /bearerSecretMatches\(/)
  const migrate = read("app/api/admin/migrate-partner-leads-to-audience/route.ts")
  assert.doesNotMatch(migrate, /searchParams\.get\("secret"\)/)
  assert.match(migrate, /bearerSecretMatches\(request\.headers\.get\("authorization"\), process\.env\.CRON_SECRET\)/)
})

// ADM-11
test("ADM-11: a member's address must stay on the workspace domain, on edit as on create", () => {
  assert.deepEqual(normalizeTeamMemberEmail(" Staff@434Media.com "), { email: "staff@434media.com" })
  assert.deepEqual(normalizeTeamMemberEmail(""), { email: "" })
  assert.deepEqual(normalizeTeamMemberEmail(undefined), { email: "" })
  for (const bad of ["someone@example.com", "x@434media.com.evil.test", "x@not434media.test", 42, {}]) {
    assert.ok("error" in normalizeTeamMemberEmail(bad), String(bad))
  }
  const src = read("app/api/admin/team-members/route.ts")
  assert.equal(src.match(/normalizeTeamMemberEmail\(email\)/g)?.length, 1, "POST checks the address")
  assert.equal(src.match(/normalizeTeamMemberEmail\(email, \{ required: true \}\)/g)?.length, 1, "PATCH checks it too")
})

test("ADM-11 follow-up: an edit cannot clear a member's address, which would lock them out", () => {
  for (const empty of ["", "   ", null]) {
    assert.ok("error" in normalizeTeamMemberEmail(empty, { required: true }), JSON.stringify(empty))
  }
  assert.deepEqual(normalizeTeamMemberEmail("a@434media.com", { required: true }), { email: "a@434media.com" })
  assert.ok("error" in normalizeTeamMemberEmail("someone@example.com", { required: true }))
})

// ADM-13
test("ADM-13: a profile edit re-issues the session with its role, provider and verified flag", () => {
  const session: User = {
    email: "staffer@workspace.test",
    name: "Old",
    picture: "https://example.test/a.png",
    authProvider: "firebase",
    role: "full_admin",
    emailVerified: true,
  }
  assert.deepEqual(withProfileChanges(session, { name: "New", picture: "https://example.test/b.png" }), {
    ...session,
    name: "New",
    picture: "https://example.test/b.png",
  })
  const cleared = withProfileChanges(session, { name: "New", picture: null })
  assert.equal(cleared.picture, undefined)
  assert.equal(cleared.role, "full_admin")
  const src = read("app/api/admin/profile/route.ts")
  assert.match(src, /setSession\(withProfileChanges\(session,/)
  assert.doesNotMatch(src, /\.add\(/, "a profile edit never creates a roster record")
})

test("ADM-13 follow-up: a re-issue keeps the session's expiry, so a profile edit cannot extend it", () => {
  const now = new Date("2026-10-28T12:00:00.000Z")
  const fresh = sessionLifetime(undefined, now)
  assert.equal(fresh.expiresAt, new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString())
  assert.equal(fresh.maxAge, 24 * 60 * 60)
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  assert.deepEqual(sessionLifetime(inTwoHours, now), { expiresAt: inTwoHours.toISOString(), maxAge: 2 * 60 * 60 })
  const inThreeDays = new Date(now.getTime() + 3 * SESSION_LIFETIME_MS)
  assert.equal(sessionLifetime(inThreeDays, now).expiresAt, fresh.expiresAt, "never later than 24 hours from now")
  assert.equal(sessionLifetime(new Date(now.getTime() - 1000), now).maxAge, 0)
  assert.equal(sessionLifetime(new Date("not a date"), now).expiresAt, fresh.expiresAt)
})

test("ADM-13 follow-up: the signed expiry is read back from the cookie", () => {
  const before = process.env.ADMIN_SESSION_SECRET
  process.env.ADMIN_SESSION_SECRET = "made-up-test-secret-at-least-32-characters-long"
  try {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const payload = Buffer.from(
      JSON.stringify({ user: { email: "staffer@workspace.test", name: "S", role: "crm_only" }, expiresAt }),
    ).toString("base64url")
    const parsed = parseSessionCookieWithExpiry(`${payload}.${signPayload(payload)}`)
    assert.equal(parsed?.expiresAt?.toISOString(), expiresAt)
    assert.equal(parsed?.user.role, "crm_only")
    assert.equal(parseSessionCookieWithExpiry(`${payload}.bad`), null)
  } finally {
    if (before === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = before
  }
})

test("ADM-13 follow-up: the profile route keeps the expiry and refuses a deactivated member", () => {
  const src = read("app/api/admin/profile/route.ts")
  assert.match(src, /keepExpiresAt: current\?\.expiresAt/)
  assert.match(src, /isActive === false\) \{\s*return NextResponse\.json\(\{ error: "Forbidden: this account is deactivated" \}, \{ status: 403 \}\)/)
})

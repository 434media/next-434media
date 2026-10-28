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
  for (const bad of ["someone@gmail.com", "x@434media.com.evil.test", "x@not434media.com", 42, {}]) {
    assert.ok("error" in normalizeTeamMemberEmail(bad), String(bad))
  }
  const src = read("app/api/admin/team-members/route.ts")
  assert.equal(src.match(/normalizeTeamMemberEmail\(email\)/g)?.length, 2, "POST and PATCH both check the address")
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

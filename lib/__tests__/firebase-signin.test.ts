/**
 * Offline. The email-and-password sign-in decision (lib/firebase-signin.ts, security log ADM-1): a verified email is
 * required, a workspace address must use Google in production, and only then does the roster decide. Invented
 * addresses only; the roster is a fake.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { decideFirebaseSignIn, type FirebaseSignInDeps } from "../firebase-signin"

const authorized: string[] = []
const deps = (vercelEnv?: string): FirebaseSignInDeps => ({
  vercelEnv,
  isWorkspaceEmail: (e) => e.endsWith("@workspace.test"),
  authorize: async (email) => {
    authorized.push(email)
    return email === "member@example.test" || email.endsWith("@workspace.test")
      ? { authorized: true, role: "full_admin" }
      : { authorized: false, reason: "not_on_roster" }
  },
})

test("an unverified email is refused before the roster is read", async () => {
  authorized.length = 0
  for (const email_verified of [false, undefined]) {
    const d = await decideFirebaseSignIn({ email: "member@example.test", email_verified }, deps("production"))
    assert.deepEqual(d.ok ? null : [d.status, d.error], [403, "email_not_verified"])
  }
  assert.deepEqual(authorized, [], "the roster is never consulted for an unverified token")
})

test("a workspace address on the email path is refused in production, verified or not", async () => {
  const d = await decideFirebaseSignIn({ email: "Staff@Workspace.test", email_verified: true }, deps("production"))
  assert.deepEqual(d.ok ? null : [d.status, d.error], [403, "workspace_use_google"])
})

test("a verified workspace address may use the email path on a preview, where Google sign-in does not work", async () => {
  const d = await decideFirebaseSignIn({ email: "staff@workspace.test", email_verified: true }, deps("preview"))
  assert.equal(d.ok, true)
})

test("a verified roster member is admitted with the roster's role", async () => {
  const d = await decideFirebaseSignIn({ email: "Member@Example.test", email_verified: true }, deps("production"))
  assert.deepEqual(d, { ok: true, email: "member@example.test", role: "full_admin", name: undefined })
})

test("a verified address off the roster is refused", async () => {
  const d = await decideFirebaseSignIn({ email: "stranger@example.test", email_verified: true }, deps("production"))
  assert.deepEqual(d.ok ? null : [d.status, d.error], [403, "not_authorized"])
})

test("a token with no email is refused", async () => {
  const d = await decideFirebaseSignIn({ email_verified: true }, deps("production"))
  assert.deepEqual(d.ok ? null : [d.status, d.error], [400, "email_missing"])
})

/**
 * Offline. The founder-only guard's decision (lib/founder-guard.ts): deny by default, one configured identity, a
 * verified address. No session cookie, no Firestore. The invented addresses use the reserved .test domain.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { FOUNDER_EMAIL_ENV, founderDecision, founderEmail } from "../founder-guard"
import type { AdminRole, User } from "../auth"

const FOUNDER = "founder@example.test"
const session = (email: string, role: AdminRole, emailVerified = true): User => ({ email, name: "x", role, emailVerified })

test("founderEmail reads one address from the setting, trimmed and lower-cased", () => {
  assert.equal(founderEmail({ [FOUNDER_EMAIL_ENV]: "  Founder@Example.TEST " }), FOUNDER)
})

test("founderEmail is null when unset, empty or not exactly one address", () => {
  for (const v of [undefined, "", "   ", "founder", "a@example.test,b@example.test", "a@example.test b@example.test", "@example.test"]) {
    assert.equal(founderEmail({ [FOUNDER_EMAIL_ENV]: v }), null, String(v))
  }
})

test("no session is 401", () => {
  const d = founderDecision(null, FOUNDER)
  assert.equal(d.allowed, false)
  assert.equal(!d.allowed && d.status, 401)
})

test("every role other than the founder's identity is 403, super admin included", () => {
  for (const role of ["crm_super_admin", "full_admin", "crm_only", "intern"] as const) {
    const d = founderDecision(session("someone@example.test", role), FOUNDER)
    assert.deepEqual(d.allowed ? null : [d.status, d.reason], [403, "not_founder"], role)
  }
})

test("the founder is allowed whatever the role on the session", () => {
  for (const role of ["crm_super_admin", "full_admin", "crm_only", "intern"] as const) {
    assert.equal(founderDecision(session("Founder@Example.test", role), FOUNDER).allowed, true, role)
  }
})

test("the founder's address with an unverified email is 403", () => {
  const d = founderDecision(session(FOUNDER, "crm_super_admin", false), FOUNDER)
  assert.deepEqual(d.allowed ? null : [d.status, d.reason], [403, "unverified"])
  const legacy: User = { email: FOUNDER, name: "x", role: "crm_super_admin" }
  assert.equal(founderDecision(legacy, FOUNDER).allowed, false, "a session minted before emailVerified existed")
})

test("unconfigured denies everyone, the founder included", () => {
  const d = founderDecision(session(FOUNDER, "crm_super_admin"), null)
  assert.deepEqual(d.allowed ? null : [d.status, d.reason], [403, "not_configured"])
})

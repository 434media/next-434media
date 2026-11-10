/**
 * Offline. Owners come only from ADMIN_OWNER_EMAILS (lib/auth.ts): no address in code, so an unset setting names no
 * owner. Run without GOOGLE_SERVICE_ACCOUNT_KEY, so every roster read fails, which is the case the old hardcoded
 * fallback existed for. Invented addresses on the reserved .test domain stand in for the two the code used to hold.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { authorizeAdminSignIn, isCrmSuperAdmin, isOwnerEmail, ownerEmails } from "../auth"

const FORMER = ["founder@example.test", "second-owner@example.test"] // stand-ins for the two owners lib/auth.ts held in code
const FOUNDER = "founder@example.test"

function withOwners(value: string | undefined, fn: () => Promise<void>) {
  return async () => {
    const before = process.env.ADMIN_OWNER_EMAILS, key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY // no Firestore: the roster can't answer
    if (value === undefined) delete process.env.ADMIN_OWNER_EMAILS
    else process.env.ADMIN_OWNER_EMAILS = value
    try { await fn() } finally {
      if (before === undefined) delete process.env.ADMIN_OWNER_EMAILS; else process.env.ADMIN_OWNER_EMAILS = before
      if (key !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_KEY = key
    }
  }
}

test("unset, the setting names no owner: neither former address is an owner", () => {
  assert.deepEqual(ownerEmails({}), [])
  for (const e of FORMER) assert.equal(isOwnerEmail(e, {}), false, e)
})

test("the setting is read case-insensitively; malformed entries are dropped", () => {
  assert.deepEqual(ownerEmails({ ADMIN_OWNER_EMAILS: " Founder@Example.TEST , not-an-address,, " }), [FOUNDER])
  assert.equal(isOwnerEmail("FOUNDER@example.test", { ADMIN_OWNER_EMAILS: FOUNDER }), true)
  assert.equal(isOwnerEmail("second-owner@example.test", { ADMIN_OWNER_EMAILS: FOUNDER }), false)
})

test("a former fallback address is no longer a super admin by code, on either sign-in path", withOwners(undefined, async () => {
  for (const email of FORMER) {
    const firebase = await authorizeAdminSignIn(email, "firebase")
    assert.deepEqual(firebase, { authorized: false, reason: "lookup_failed" }, `${email} via email: fails closed, no super admin`)
    const google = await authorizeAdminSignIn(email, "google")
    assert.deepEqual(google, { authorized: false, reason: "lookup_failed" }, `${email} via Google: fails closed, no super admin`)
    assert.equal(await isCrmSuperAdmin(email), false, `${email}: isCrmSuperAdmin`)
  }
}))

test("an owner in the setting is a super admin with the roster unreachable, on both paths", withOwners(FOUNDER, async () => {
  assert.deepEqual(await authorizeAdminSignIn(FOUNDER, "firebase"), { authorized: true, role: "crm_super_admin" })
  assert.deepEqual(await authorizeAdminSignIn(FOUNDER, "google"), { authorized: true, role: "crm_super_admin" })
  assert.equal(await isCrmSuperAdmin(FOUNDER), true)
}))

test("with only the founder in the setting, the other former owner is not a super admin", withOwners(FOUNDER, async () => {
  assert.equal(await isCrmSuperAdmin(FOUNDER), true)
  assert.equal(await isCrmSuperAdmin("second-owner@example.test"), false)
  assert.deepEqual(await authorizeAdminSignIn("second-owner@example.test", "firebase"), { authorized: false, reason: "lookup_failed" })
}))

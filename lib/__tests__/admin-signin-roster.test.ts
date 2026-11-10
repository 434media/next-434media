/**
 * Offline. The roster decides every admin sign-in (lib/auth.ts, security log ADM-2): Google sign-in on a workspace
 * address used to skip the roster, ignore `isActive` and default to full_admin. Invented addresses on the reserved .test
 * domain; the roster records are fakes. Run without GOOGLE_SERVICE_ACCOUNT_KEY, so a real roster read fails.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { authorizeAdminSignIn, decideRosterSignIn } from "../auth"

const STAFF = "staffer@workspace.test"

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  return async () => {
    const keys = ["ADMIN_OWNER_EMAILS", "GOOGLE_SERVICE_ACCOUNT_KEY", "WORKSPACE_DOMAIN", ...Object.keys(vars)]
    const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY // no Firestore: the roster can't answer
    delete process.env.ADMIN_OWNER_EMAILS
    for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k]; else process.env[k] = v
    try { await fn() } finally {
      for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k]; else process.env[k] = v
    }
  }
}

test("no roster record: refused, not full_admin", () => {
  assert.deepEqual(decideRosterSignIn([]), { authorized: false, reason: "not_on_roster" })
})

test("a deactivated member is refused, whatever their role", () => {
  for (const role of ["crm_super_admin", "full_admin", "crm_only", "intern"]) {
    assert.deepEqual(decideRosterSignIn([{ isActive: false, role, name: "X" }]), { authorized: false, reason: "deactivated" }, role)
  }
})

test("no role, or a role outside the four, is refused: least privilege, nothing granted by default", () => {
  for (const role of [undefined, null, "", "admin", "FULL_ADMIN", "owner"]) {
    assert.deepEqual(decideRosterSignIn([{ isActive: true, role }]), { authorized: false, reason: "no_role" }, String(role))
  }
})

test("more than one record for the address is refused", () => {
  const records = [{ isActive: true, role: "full_admin" }, { isActive: false, role: "crm_only" }]
  assert.deepEqual(decideRosterSignIn(records), { authorized: false, reason: "duplicate_roster_records" })
})

test("an active member gets exactly the roster's role and name", () => {
  for (const role of ["crm_super_admin", "full_admin", "crm_only", "intern"] as const) {
    assert.deepEqual(decideRosterSignIn([{ isActive: true, role, name: "Staffer" }]), { authorized: true, role, name: "Staffer" })
  }
  // isActive unset counts as active, as in admin settings; an empty name is left out.
  assert.deepEqual(decideRosterSignIn([{ role: "crm_only", name: "" }]), { authorized: true, role: "crm_only", name: undefined })
})

test("Google on a workspace address with the roster unreachable: denied, not full_admin", withEnv({ WORKSPACE_DOMAIN: "workspace.test" }, async () => {
  assert.deepEqual(await authorizeAdminSignIn(STAFF, "google"), { authorized: false, reason: "lookup_failed" })
  assert.deepEqual(await authorizeAdminSignIn(STAFF, "firebase"), { authorized: false, reason: "lookup_failed" })
}))

test("an owner still signs in with Google as a super admin with the roster unreachable", withEnv({ ADMIN_OWNER_EMAILS: STAFF }, async () => {
  assert.deepEqual(await authorizeAdminSignIn(" Staffer@Workspace.TEST ", "google"), { authorized: true, role: "crm_super_admin" })
}))

test("every Google-identity entry goes through the roster gate and takes its role from it", () => {
  const root = join(__dirname, "..", "..")
  const read = (p: string) => readFileSync(join(root, p), "utf8")
  const callback = read("app/api/auth/callback/google/route.ts")
  assert.match(callback, /authorizeAdminSignIn\(userInfo\.email, 'google'\)/)
  assert.match(callback, /if \(!decision\.authorized\)/)
  assert.match(callback, /role: decision\.role/)
  for (const p of ["app/api/owned-meta/service/route.ts", "app/api/owned-meta/mcp/route.ts"]) {
    assert.match(read(p), /authorize: email => authorizeAdminSignIn\(email, "google"\)/, p)
  }
  const auth = read("lib/auth.ts")
  assert.doesNotMatch(auth, /getRoleForProvider|resolveRole/, "no provider-based role fallback")
})

/**
 * Offline. The 2026-10-29 security sweep fixes: escaped JSON-LD, the shared API-key gate, the roster re-check on every
 * session read, and the BotID protect list. Needs only tsx: nothing here imports next or firebase-admin.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { jsonLdScript } from "../json-ld"
import { decideSharedSecret, secretMatches } from "../secret-compare"
import { applyRosterDecision, createRosterChecker, type RosterDecision } from "../session-roster"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === "node_modules" || name.startsWith(".")) continue
    const rel = join(dir, name)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

// --- JSON-LD ---------------------------------------------------------------------------------------------------------

test("jsonLdScript: a </script> in a value cannot close the element, and the JSON still parses to the same value", () => {
  const data = { headline: "</script><script>alert(1)</script>", note: "a & b > c <!-- d \u2028 \u2029" }
  const out = jsonLdScript(data)
  assert.doesNotMatch(out, /[<>&\u2028\u2029]/)
  assert.deepEqual(JSON.parse(out), data)
})

test("every JSON-LD script body goes through jsonLdScript", () => {
  const offenders = [...walk("app"), ...walk("components")].filter((f) =>
    /__html:\s*JSON\.stringify\(/.test(readFileSync(join(ROOT, f), "utf-8")),
  )
  assert.deepEqual(offenders, [])
})

// --- Shared API keys -------------------------------------------------------------------------------------------------

test("secretMatches: exact match only; empty or missing never matches", () => {
  assert.equal(secretMatches("k3y-value", "k3y-value"), true)
  assert.equal(secretMatches("k3y-valu", "k3y-value"), false)
  assert.equal(secretMatches("", ""), false)
  assert.equal(secretMatches(null, "x"), false)
  assert.equal(secretMatches("x", undefined), false)
})

test("decideSharedSecret: unset in production fails closed; unset in development stays open", () => {
  assert.equal(decideSharedSecret("anything", undefined, true), "unconfigured")
  assert.equal(decideSharedSecret(null, "", true), "unconfigured")
  assert.equal(decideSharedSecret(null, undefined, false), "dev_open")
  assert.equal(decideSharedSecret("right", "right", true), "ok")
  assert.equal(decideSharedSecret("wrong", "right", true), "denied")
  assert.equal(decideSharedSecret(null, "right", true), "denied")
})

test("public routes: no fail-open key check, no ?api_key= acceptance, no plain === on a secret", () => {
  for (const f of ["app/api/public/contact-form/route.ts", "app/api/public/email-signup/route.ts"]) {
    const src = read(f)
    assert.match(src, /requireSecret\(request, "EMAIL_SIGNUP_API_KEY"/, f)
    assert.doesNotMatch(src, /allowing all requests/, f)
  }
  const feed = read("app/api/public/feed/route.ts")
  assert.match(feed, /requireSecret\(request, "FEED_API_SECRET"/)
  assert.doesNotMatch(feed, /providedKey === /)
  assert.doesNotMatch(feed, /status === "all"/)
  // The events API was retired on 2026-11-01: its only caller, aimsatx.com, now redirects to velocitytx.org.
  assert.ok(!existsSync(join(ROOT, "app/api/public/events")), "the retired events API stays deleted")
  assert.match(read("app/api/webhooks/mailchimp/route.ts"), /secretMatches\(provided, expected\)/)
  assert.doesNotMatch(read("lib/shopify/index.ts"), /secret !== process\.env/)
})

test("the Mailchimp analytics route is admin-gated", () => {
  const src = read("app/api/mailchimp/route.ts")
  assert.match(src, /const auth = await requireAdmin\(\)/)
  assert.ok(src.indexOf("requireAdmin()") < src.indexOf("searchParams"), "the gate runs before the params are read")
})

// --- Roster re-check -------------------------------------------------------------------------------------------------

const USER = { email: "staffer@workspace.test", name: "Staffer", role: "full_admin" as const, emailVerified: true }

test("applyRosterDecision: refused → no session; admitted → the roster's current role, identity unchanged", () => {
  assert.equal(applyRosterDecision(USER, { authorized: false, reason: "deactivated" }), null)
  assert.equal(applyRosterDecision(USER, { authorized: false, reason: "not_on_roster" }), null)
  assert.deepEqual(applyRosterDecision(USER, { authorized: true, role: "intern" }), { ...USER, role: "intern" })
})

test("roster checker: reuses an answer within the TTL, asks again after it, and sees a deactivation", async () => {
  let t = 0
  let answer: RosterDecision = { authorized: true, role: "full_admin" }
  let calls = 0
  const checker = createRosterChecker(async () => { calls++; return answer }, { now: () => t, ttlMs: 60_000, graceMs: 300_000 })

  assert.deepEqual(await checker.decide("Staffer@Workspace.test"), { authorized: true, role: "full_admin" })
  answer = { authorized: false, reason: "deactivated" }
  t = 30_000
  assert.equal((await checker.decide("staffer@workspace.test")).authorized, true, "cached within the minute")
  assert.equal(calls, 1)
  t = 61_000
  assert.deepEqual(await checker.decide("staffer@workspace.test"), { authorized: false, reason: "deactivated" })
  assert.equal(calls, 2)
})

test("roster checker: a failed lookup reuses a recent good answer, then fails closed past the grace", async () => {
  let t = 0
  let answer: RosterDecision = { authorized: true, role: "crm_only" }
  const checker = createRosterChecker(async () => answer, { now: () => t, ttlMs: 60_000, graceMs: 300_000 })
  await checker.decide("a@workspace.test")

  answer = { authorized: false, reason: "lookup_failed" }
  t = 120_000
  assert.deepEqual(await checker.decide("a@workspace.test"), { authorized: true, role: "crm_only" })
  t = 301_000
  assert.deepEqual(await checker.decide("a@workspace.test"), { authorized: false, reason: "lookup_failed" })

  const fresh = createRosterChecker(async () => ({ authorized: false, reason: "lookup_failed" }))
  assert.equal((await fresh.decide("b@workspace.test")).authorized, false, "no prior answer: refused")
})

test("getSession and getSessionWithExpiry both go through the roster re-check", () => {
  const src = read("lib/auth.ts")
  assert.match(src, /export async function getSession\(\): Promise<User \| null> \{\n  return \(await currentSession\(\)\)\?\.user \?\? null\n\}/)
  assert.match(src, /export async function getSessionWithExpiry\(\)[^\n]*\n  return currentSession\(\)\n\}/)
})

// --- BotID -----------------------------------------------------------------------------------------------------------

test("every route that calls requireHumanRequest is in the BotID protect list, for the method it exports", () => {
  const protect = read("instrumentation-client.ts")
  const listed = new Set([...protect.matchAll(/path:\s*'([^']+)',\s*method:\s*'([A-Z]+)'/g)].map((m) => `${m[2]} ${m[1]}`))
  const missing: string[] = []
  for (const f of walk("app/api")) {
    if (!f.endsWith(`${sep}route.ts`)) continue
    const src = readFileSync(join(ROOT, f), "utf-8")
    if (!src.includes("requireHumanRequest()")) continue
    const path = "/" + relative("app", f).split(sep).slice(0, -1).join("/")
    for (const m of src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)) {
      if (!listed.has(`${m[1]} ${path}`)) missing.push(`${m[1]} ${path}`)
    }
  }
  assert.deepEqual(missing, [])
})

test("the BotID guard fails closed when the check itself errors", () => {
  const src = read("lib/botid-guard.ts")
  assert.doesNotMatch(src, /allowing request/)
  assert.match(src, /status: 503/)
})

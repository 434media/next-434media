/**
 * Proves the founder-only guard over HTTP (V1 item 1, finance Phase 0): the page and the API answer 200 to the founder
 * and 401 or 403 to everyone else. It mints signed session cookies, so it runs only against a local server started with
 * a throwaway ADMIN_SESSION_SECRET and an invented ADMIN_FOUNDER_EMAIL, never against a deployment.
 *
 *   ADMIN_SESSION_SECRET=<32+ chars> ADMIN_FOUNDER_EMAIL=founder@example.test pnpm dev   # in one shell
 *   ADMIN_SESSION_SECRET=<same> ADMIN_FOUNDER_EMAIL=founder@example.test \
 *     tsx scripts/finance/verify-founder-guard.ts http://localhost:3000
 */
import { createHmac } from "node:crypto"

const base = process.argv[2] || "http://localhost:3000"
const host = new URL(base).hostname
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) throw new Error(`refusing to run against ${host}: local servers only`)
const secret = process.env.ADMIN_SESSION_SECRET || ""
const founder = process.env.ADMIN_FOUNDER_EMAIL || ""
if (secret.length < 32 || !founder) throw new Error("set ADMIN_SESSION_SECRET (32+ chars) and ADMIN_FOUNDER_EMAIL to the server's values")

/** The cookie lib/auth.ts setSession writes: base64url(payload).base64url(hmac). */
function cookie(user: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify({ user, expiresAt: new Date(Date.now() + 3600_000).toISOString() })).toString("base64url")
  return `admin-auth-session=${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`
}
const as = (email: string, role: string, emailVerified = true) => cookie({ email, name: "Verify", authProvider: "firebase", role, emailVerified })

const cases: Array<{ who: string; cookie?: string; page: number; api: number }> = [
  { who: "signed out", page: 200, api: 401 }, // the page renders only the sign-in refresh; nothing behind the lock
  { who: "crm_super_admin (not the founder)", cookie: as("other-super@example.test", "crm_super_admin"), page: 403, api: 403 },
  { who: "full_admin", cookie: as("staff@example.test", "full_admin"), page: 403, api: 403 },
  { who: "crm_only", cookie: as("sales@example.test", "crm_only"), page: 403, api: 403 },
  { who: "intern", cookie: as("intern@example.test", "intern"), page: 403, api: 403 },
  { who: "founder, email unverified", cookie: as(founder, "crm_super_admin", false), page: 403, api: 403 },
  { who: "founder", cookie: as(founder, "crm_super_admin"), page: 200, api: 200 },
]

const MARKER = "QuickBooks is not connected yet"

async function main() {
  let failed = 0
  for (const c of cases) {
    const headers = c.cookie ? { cookie: c.cookie } : undefined
    const page = await fetch(`${base}/admin/finance`, { headers, redirect: "manual" })
    const html = await page.text()
    const api = await fetch(`${base}/api/admin/finance`, { headers })
    // The page's content must reach only the founder, whatever the status says.
    const leaked = html.includes(MARKER) && c.page !== 200
    const shown = c.page === 200 && c.cookie ? html.includes(MARKER) : !html.includes(MARKER)
    const ok = page.status === c.page && api.status === c.api && !leaked && shown
    if (!ok) failed++
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.who.padEnd(36)} page ${page.status} (want ${c.page})  api ${api.status} (want ${c.api})${leaked ? "  CONTENT LEAKED" : ""}${!shown ? "  content wrong" : ""}`)
  }
  console.log(failed ? `\n${failed} case(s) failed` : "\nall cases pass")
  process.exit(failed ? 1 : 0)
}

main()

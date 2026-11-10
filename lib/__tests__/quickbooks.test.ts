/**
 * Offline. The QuickBooks client (lib/quickbooks.ts) and the snapshot parsers (lib/quickbooks-snapshot.ts), on invented
 * reports shaped like Intuit's JSON. No network, no keys: every figure and name here is made up.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import {
  accessToken,
  authorizeUrl,
  completeConnect,
  disconnect,
  qbClientFromEnv,
  qbGet,
  sealJson,
  unsealJson,
  QB_PRODUCTION_REDIRECT,
  QbError,
  type QbDeps,
  type QbTokenRecord,
  type QbTokens,
} from "../quickbooks"
import { agingTotals, buildSnapshot, costsByCategory, monthStart, snapshotQueries, type QbReport } from "../quickbooks-snapshot"

// ---------------------------------------------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------------------------------------------

const KEY = randomBytes(32)
const ENV = { QUICKBOOKS_CLIENT_ID: "id", QUICKBOOKS_CLIENT_SECRET: "secret", QUICKBOOKS_ENVIRONMENT: "sandbox", QUICKBOOKS_TOKEN_KEY: KEY.toString("base64") }

test("config: missing settings are named, values never", () => {
  const r = qbClientFromEnv({}, "https://preview.example.test")
  assert.ok("missing" in r)
  assert.deepEqual(r.missing, ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET", "QUICKBOOKS_ENVIRONMENT", "QUICKBOOKS_TOKEN_KEY"])
  const short = qbClientFromEnv({ ...ENV, QUICKBOOKS_TOKEN_KEY: randomBytes(16).toString("base64") }, "https://x.test")
  assert.ok("missing" in short && short.missing.includes("QUICKBOOKS_TOKEN_KEY"))
})

test("config: production keys are refused outside Production", () => {
  const r = qbClientFromEnv({ ...ENV, QUICKBOOKS_ENVIRONMENT: "production", VERCEL_ENV: "preview" }, "https://x.test")
  assert.ok("missing" in r)
})

test("config: redirect is the www callback on production, the served origin elsewhere, or the override", () => {
  const prod = qbClientFromEnv({ ...ENV, QUICKBOOKS_ENVIRONMENT: "production", VERCEL_ENV: "production" }, "https://www.434media.com")
  assert.ok("client" in prod && prod.client.redirectUri === QB_PRODUCTION_REDIRECT)
  const prev = qbClientFromEnv({ ...ENV, VERCEL_ENV: "preview" }, "https://branch.vercel.app")
  assert.ok("client" in prev && prev.client.redirectUri === "https://branch.vercel.app/api/admin/finance/quickbooks/callback")
  const over = qbClientFromEnv({ ...ENV, QUICKBOOKS_REDIRECT_URI: "http://localhost:3000/cb" }, "https://x.test")
  assert.ok("client" in over && over.client.redirectUri === "http://localhost:3000/cb")
})

test("authorize URL asks for the accounting scope only, with the state", () => {
  const u = new URL(authorizeUrl({ clientId: "id", redirectUri: "https://x.test/cb" }, "state-abc"))
  assert.equal(u.origin + u.pathname, "https://appcenter.intuit.com/connect/oauth2")
  assert.equal(u.searchParams.get("scope"), "com.intuit.quickbooks.accounting")
  assert.equal(u.searchParams.get("state"), "state-abc")
  assert.equal(u.searchParams.get("response_type"), "code")
})

test("sealing round-trips and refuses another key", () => {
  const sealed = sealJson(KEY, { a: 1 })
  assert.deepEqual(unsealJson(KEY, sealed), { a: 1 })
  assert.throws(() => unsealJson(randomBytes(32), sealed))
})

// ---------------------------------------------------------------------------------------------------------------
// Tokens and reads, with an in-memory store and a scripted fetch
// ---------------------------------------------------------------------------------------------------------------

function harness(responses: Array<(url: string, init: RequestInit) => Response>, start?: QbTokens) {
  let record: QbTokenRecord | null = start
    ? { version: 1, sealed: sealJson(KEY, start), environment: "sandbox", connectedBy: "founder@example.test", connectedAt: "2026-11-01T00:00:00Z" }
    : null
  const calls: { url: string; method: string; body?: string }[] = []
  const logs: string[] = []
  let now = 1_000_000
  const client = qbClientFromEnv(ENV, "https://x.test")
  assert.ok("client" in client)
  const deps: QbDeps = {
    client: client.client,
    store: {
      async read() {
        return record
      },
      async write(expected, next) {
        if ((record?.version ?? null) !== expected) return false
        record = next
        return true
      },
      async remove() {
        record = null
      },
    },
    fetcher: (async (url: string | URL, init: RequestInit = {}) => {
      calls.push({ url: String(url), method: init.method ?? "GET", body: init.body ? String(init.body) : undefined })
      const next = responses.shift()
      assert.ok(next, `unexpected call to ${url}`)
      return next(String(url), init)
    }) as typeof fetch,
    nowMs: () => now,
    log: (l) => logs.push(l),
  }
  return { deps, calls, logs, record: () => record, tokens: () => (record ? unsealJson<QbTokens>(KEY, record.sealed) : null), advance: (ms: number) => (now += ms) }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
const tokenBody = (n: number) => ({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 3600, x_refresh_token_expires_in: 8_640_000 })

test("connect: exchanges the code and stores sealed tokens with the company id", async () => {
  const h = harness([() => json(tokenBody(1))])
  await completeConnect(h.deps, { code: "the-code", realmId: "1234567890", by: "founder@example.test" })
  assert.equal(h.calls[0].method, "POST")
  assert.match(h.calls[0].body ?? "", /grant_type=authorization_code/)
  const rec = h.record()!
  assert.equal(rec.version, 1)
  assert.ok(!rec.sealed.includes("access-1"), "the stored record holds ciphertext only")
  assert.deepEqual({ ...h.tokens()!, expiresAt: 0 }, { accessToken: "access-1", refreshToken: "refresh-1", expiresAt: 0, realmId: "1234567890" })
})

test("connect: a company id that is not a number is refused before any call", async () => {
  const h = harness([])
  await assert.rejects(completeConnect(h.deps, { code: "c", realmId: "../x", by: "f" }), /no company/)
  assert.equal(h.calls.length, 0)
})

test("token: a fresh token is used as is; a near-expiry one is refreshed and the newest refresh token kept", async () => {
  const h = harness([() => json(tokenBody(2))], { accessToken: "access-1", refreshToken: "refresh-1", expiresAt: 1_000_000 + 3_600_000, realmId: "42" })
  assert.equal((await accessToken(h.deps)).token, "access-1")
  assert.equal(h.calls.length, 0)
  h.advance(3_400_000) // within five minutes of expiry
  assert.deepEqual(await accessToken(h.deps), { token: "access-2", realmId: "42" })
  assert.equal(h.tokens()!.refreshToken, "refresh-2")
  assert.equal(h.record()!.version, 2)
})

test("token: invalid_grant asks for a reconnect and logs the code and intuit_tid only", async () => {
  const h = harness([() => json({ error: "invalid_grant", error_description: "secret detail" }, 400, { intuit_tid: "tid-123" })], {
    accessToken: "a",
    refreshToken: "r",
    expiresAt: 0,
    realmId: "42",
  })
  await assert.rejects(accessToken(h.deps), (e: unknown) => e instanceof QbError && e.reconnect && e.code === "invalid_grant")
  assert.equal(h.logs.length, 1)
  assert.match(h.logs[0], /invalid_grant intuit_tid=tid-123/)
  assert.ok(!h.logs[0].includes("secret detail"))
})

test("read: a 401 refreshes once and retries; only GET is ever sent to the API", async () => {
  const h = harness(
    [() => json({}, 401), () => json(tokenBody(2)), (url) => json({ ok: url.includes("/v3/company/42/reports/ProfitAndLoss") && url.includes("minorversion=75") })],
    { accessToken: "a", refreshToken: "r", expiresAt: 1_000_000 + 3_600_000, realmId: "42" },
  )
  assert.deepEqual(await qbGet(h.deps, "reports/ProfitAndLoss", { start_date: "2026-01-01" }), { ok: true })
  const api = h.calls.filter((c) => c.url.includes("quickbooks.api.intuit.com"))
  assert.ok(api.every((c) => c.method === "GET"))
  assert.ok(api[0].url.startsWith("https://sandbox-quickbooks.api.intuit.com/"))
})

test("read: only report, company-info and query paths are allowed", async () => {
  const h = harness([], { accessToken: "a", refreshToken: "r", expiresAt: 9e15, realmId: "42" })
  await assert.rejects(qbGet(h.deps, "invoice", {}), /Unsupported/)
  await assert.rejects(qbGet(h.deps, "reports/../invoice", {}), /Unsupported/)
})

test("disconnect: revokes with Intuit and removes the stored connection", async () => {
  const h = harness([() => new Response(null, { status: 200 })], { accessToken: "a", refreshToken: "refresh-x", expiresAt: 0, realmId: "42" })
  assert.deepEqual(await disconnect(h.deps), { revoked: true })
  assert.equal(h.record(), null)
  assert.equal(h.calls[0].url, "https://developer.api.intuit.com/v2/oauth2/tokens/revoke")
  assert.deepEqual(JSON.parse(h.calls[0].body!), { token: "refresh-x" })
})

test("disconnect: the stored connection is removed even when the revoke fails", async () => {
  const h = harness([() => new Response(null, { status: 500 })], { accessToken: "a", refreshToken: "r", expiresAt: 0, realmId: "42" })
  assert.deepEqual(await disconnect(h.deps), { revoked: false })
  assert.equal(h.record(), null)
})

// ---------------------------------------------------------------------------------------------------------------
// Reports (invented figures)
// ---------------------------------------------------------------------------------------------------------------

const col = (title: string, start?: string, end?: string): any => ({
  ColTitle: title,
  ColType: "Money",
  MetaData: start ? [{ Name: "StartDate", Value: start }, { Name: "EndDate", Value: end }] : [],
})
const section = (group: string, values: string[], rows: any[] = []) => ({ type: "Section", group, Header: { ColData: [{ value: group }] }, Rows: { Row: rows }, Summary: { ColData: [{ value: `Total ${group}` }, ...values.map((value) => ({ value }))] } })
const data = (name: string, values: string[]) => ({ type: "Data", ColData: [{ value: name }, ...values.map((value) => ({ value }))] })

const months = [
  ["2026-06-01", "2026-06-30"],
  ["2026-07-01", "2026-07-31"],
  ["2026-08-01", "2026-08-31"],
  ["2026-09-01", "2026-09-30"],
  ["2026-10-01", "2026-10-31"],
  ["2026-11-01", "2026-11-10"],
]
const byMonth: QbReport = {
  Header: { Currency: "USD", ReportBasis: "Accrual" },
  Columns: { Column: [{ ColTitle: "", ColType: "Account" }, ...months.map(([s, e]) => col(s.slice(0, 7), s, e)), col("Total")] },
  Rows: {
    Row: [
      section("Income", ["10,000.00", "12000", "9000", "11000", "13000", "4000", "59000"]),
      section("COGS", ["1000", "1000", "1000", "1000", "1000", "", "5000"]),
      section("GrossProfit", ["9000", "11000", "8000", "10000", "12000", "4000", "54000"]),
      section("Expenses", ["6000", "6000", "6000", "7000", "8000", "2000", "35000"]),
      section("NetIncome", ["3000", "5000", "2000", "3000", "4000", "2000", "19000"]),
    ],
  },
}
const ytd: QbReport = {
  Header: { Currency: "USD", ReportBasis: "Accrual" },
  Columns: { Column: [{ ColTitle: "", ColType: "Account" }, col("Total")] },
  Rows: {
    Row: [
      section("Income", ["100000"]),
      section("COGS", ["8000"]),
      section("Expenses", ["60000"], [
        data("Contractors", ["30000"]),
        { ...section("Software", ["9000"]), Header: { ColData: [{ value: "Software" }] } },
        data("Rent", ["12000"]),
        data("Travel", ["6000"]),
        data("Meals", ["3000"]),
        data("Zero line", [""]),
      ]),
      section("OtherExpenses", ["2000"], [data("Interest", ["2000"])]),
      section("NetIncome", ["30000"]),
    ],
  },
}
const balance: QbReport = {
  Columns: { Column: [{ ColTitle: "", ColType: "Account" }, col("Oct 2026", "2026-10-01", "2026-10-31"), col("Nov 2026", "2026-11-01", "2026-11-10")] },
  Rows: { Row: [section("TotalAssets", ["90000", "95000"], [section("CurrentAssets", ["80000", "85000"], [section("BankAccounts", ["40000", "46500"])])])] },
}
const aged: QbReport = {
  Columns: { Column: [{ ColTitle: "", ColType: "Customer" }, col("Current"), col("1 - 30"), col("31 - 60"), col("61 - 90"), col("91 and over"), col("Total")] },
  Rows: {
    Row: [
      data("Customer A", ["1000", "", "", "", "500", "1500"]),
      data("Customer B", ["2000", "300", "", "", "", "2300"]),
      { type: "Section", group: "GrandTotal", Summary: { ColData: [{ value: "TOTAL" }, { value: "3000" }, { value: "300" }, { value: "" }, { value: "" }, { value: "500" }, { value: "3800" }] } },
    ],
  },
}

test("aging: totals by bucket and over 90 from the grand total", () => {
  const a = agingTotals(aged)
  assert.equal(a.total, 3800)
  assert.equal(a.over90, 500)
  assert.deepEqual(a.buckets.map((b) => b.label), ["Current", "1 - 30", "31 - 60", "61 - 90", "91 and over"])
})

test("costs by category: COGS as one line, sections and data rows, zero lines dropped, largest first", () => {
  const c = costsByCategory(ytd)
  assert.deepEqual(c[0], { name: "Contractors", amount: 30000 })
  assert.ok(c.some((l) => l.name === "Cost of goods sold" && l.amount === 8000))
  assert.ok(c.some((l) => l.name === "Software" && l.amount === 9000))
  assert.ok(c.some((l) => l.name === "Interest"))
  assert.ok(!c.some((l) => l.name === "Zero line"))
  const capped = costsByCategory(ytd, 3)
  assert.equal(capped.length, 3)
  assert.equal(capped[2].name, "Everything else")
  assert.equal(capped.reduce((s, l) => s + l.amount, 0), c.reduce((s, l) => s + l.amount, 0))
})

test("snapshot: tiles and months from the reports", () => {
  const s = buildSnapshot({ company: "Invented Co", environment: "sandbox", nowMs: Date.parse("2026-11-10T15:00:00Z"), today: "2026-11-10", byMonth, ytd, balance, receivable: aged, payable: aged, openInvoices: 2 })
  assert.equal(s.cash.balance, 46500)
  assert.equal(s.cash.change, 6500)
  // Costs of the last three complete months (Aug–Oct): 7000, 8000, 9000; average 8000.
  assert.equal(s.cash.monthsOfCosts, 46500 / 8000)
  assert.equal(s.months.length, 6)
  assert.equal(s.months[0].income, 10000)
  assert.equal(s.months[0].costs, 7000)
  assert.equal(s.months.at(-1)!.partial, true)
  assert.equal(s.months.filter((m) => m.partial).length, 1)
  assert.deepEqual(s.profitYtd, { income: 100000, costs: 70000, net: 30000, margin: 0.3 })
  assert.equal(s.receivable.openInvoices, 2)
  assert.equal(s.basis, "Accrual")
})

test("snapshot: empty reports give zeros, not errors", () => {
  const empty: QbReport = {}
  const s = buildSnapshot({ company: "x", environment: "sandbox", nowMs: 0, today: "2026-11-10", byMonth: empty, ytd: empty, balance: empty, receivable: empty, payable: empty, openInvoices: null })
  assert.equal(s.cash.balance, 0)
  assert.equal(s.cash.monthsOfCosts, null)
  assert.equal(s.profitYtd.margin, null)
  assert.deepEqual(s.months, [])
})

test("queries: six months of history on accrual, and year to date from January", () => {
  assert.equal(monthStart("2026-11-10", 5), "2026-06-01")
  assert.equal(monthStart("2026-02-28", 5), "2025-09-01")
  const q = snapshotQueries("2026-11-10")
  assert.equal(q.byMonth.params.start_date, "2026-06-01")
  assert.equal(q.byMonth.params.accounting_method, "Accrual")
  assert.equal(q.ytd.params.start_date, "2026-01-01")
  assert.equal(q.balance.params.start_date, "2026-10-01")
})

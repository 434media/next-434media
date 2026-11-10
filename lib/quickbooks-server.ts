import "server-only"
import { createHash } from "node:crypto"
import { cookies } from "next/headers"
import {
  connectedRealm,
  qbClientFromEnv,
  qbGet,
  sealJson,
  unsealJson,
  QbError,
  type QbClient,
  type QbDeps,
  type QbTokenRecord,
  type QbTokenStore,
} from "./quickbooks"
import { buildSnapshot, localDate, snapshotQueries, type FinanceSnapshot, type QbReport } from "./quickbooks-snapshot"

/**
 * Wiring for the QuickBooks routes: the client from settings, the token store, the connect state and the snapshot
 * cache. Callers are the finance routes only, each behind requireFounder (lib/founder-guard.ts).
 *
 * Where the tokens live depends on which Intuit environment the keys are for, and the keys decide that, not a flag:
 *  - **production** (Production only): one sealed document in Firestore `crm_meta/quickbooks_connection`, as the
 *    Canva connection, with the connect state in `crm_meta/quickbooks_pending/states`. This is the store the Intuit
 *    questionnaire describes.
 *  - **sandbox** (Preview and Development): Intuit's invented test company, never 434's books. Previews have no
 *    Firestore, so the sealed tokens and the connect state are HttpOnly cookies scoped to the finance API, sealed
 *    with the sandbox key. A sandbox connection ends when the cookie does (100 days) or on disconnect.
 */

const TOKEN_COOKIE = "qb_sandbox_connection"
const STATE_COOKIE = "qb_sandbox_state"
const COOKIE_PATH = "/api/admin/finance"
const SNAPSHOT_TTL_MS = 120_000

export type QbSetup = { ok: true; client: QbClient } | { ok: false; missing: string[] }

export function qbSetup(origin: string): QbSetup {
  const r = qbClientFromEnv(process.env, origin)
  return "client" in r ? { ok: true, client: r.client } : { ok: false, missing: r.missing }
}

const secure = () => Boolean(process.env.VERCEL_ENV) || process.env.NODE_ENV === "production"

async function firestore() {
  const { getDb } = await import("./firebase-admin")
  return getDb()
}

function firestoreTokenStore(): QbTokenStore {
  const ref = async () => (await firestore()).collection("crm_meta").doc("quickbooks_connection")
  return {
    async read() {
      const d = (await (await ref()).get()).data()
      return d && typeof d.sealed === "string" && Number.isSafeInteger(d.version)
        ? { version: d.version, sealed: d.sealed, environment: d.environment, connectedBy: String(d.connectedBy || ""), connectedAt: String(d.connectedAt || "") }
        : null
    },
    async write(expectedVersion, record) {
      const db = await firestore()
      const doc = await ref()
      return db.runTransaction(async (tx) => {
        const current = (await tx.get(doc)).data()
        if ((current?.version ?? null) !== expectedVersion) return false
        tx.set(doc, record)
        return true
      })
    },
    async remove() {
      await (await ref()).delete()
    },
  }
}

function cookieTokenStore(key: Buffer): QbTokenStore {
  return {
    async read() {
      const raw = (await cookies()).get(TOKEN_COOKIE)?.value
      if (!raw) return null
      try {
        return unsealJson<QbTokenRecord>(key, raw)
      } catch {
        return null
      }
    },
    async write(expectedVersion, record) {
      const current = await this.read()
      if ((current?.version ?? null) !== expectedVersion) return false
      ;(await cookies()).set(TOKEN_COOKIE, sealJson(key, record), {
        httpOnly: true,
        secure: secure(),
        sameSite: "lax",
        path: COOKIE_PATH,
        maxAge: 100 * 24 * 3600,
      })
      return true
    },
    async remove() {
      ;(await cookies()).delete({ name: TOKEN_COOKIE, path: COOKIE_PATH })
    },
  }
}

export function qbDeps(client: QbClient): QbDeps {
  return {
    client,
    store: client.environment === "production" ? firestoreTokenStore() : cookieTokenStore(client.tokenKey),
    fetcher: fetch,
    nowMs: () => Date.now(),
    log: (line) => console.error(line),
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Connect state: single use, ten minutes, bound to the founder who started it
// ---------------------------------------------------------------------------------------------------------------

const hash = (state: string) => createHash("sha256").update(state).digest("hex")

export async function saveConnectState(client: QbClient, state: string, by: string, nowMs: number): Promise<void> {
  const expiresAtMs = nowMs + 600_000
  if (client.environment === "production") {
    const db = await firestore()
    await db.collection("crm_meta").doc("quickbooks_pending").collection("states").doc(hash(state)).create({ by, expiresAtMs })
    return
  }
  ;(await cookies()).set(STATE_COOKIE, sealJson(client.tokenKey, { h: hash(state), by, expiresAtMs }), {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 600,
  })
}

/** Consumes the state: returns who started it, or null when unknown, used or expired. */
export async function takeConnectState(client: QbClient, state: string, nowMs: number): Promise<{ by: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(state)) return null
  if (client.environment === "production") {
    const db = await firestore()
    const ref = db.collection("crm_meta").doc("quickbooks_pending").collection("states").doc(hash(state))
    return db.runTransaction(async (tx) => {
      const d = (await tx.get(ref)).data()
      if (!d) return null
      tx.delete(ref)
      return typeof d.expiresAtMs === "number" && d.expiresAtMs > nowMs ? { by: String(d.by) } : null
    })
  }
  const jar = await cookies()
  const raw = jar.get(STATE_COOKIE)?.value
  jar.delete({ name: STATE_COOKIE, path: COOKIE_PATH })
  if (!raw) return null
  try {
    const d = unsealJson<{ h: string; by: string; expiresAtMs: number }>(client.tokenKey, raw)
    return d.h === hash(state) && d.expiresAtMs > nowMs ? { by: d.by } : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The snapshot, with a short cache per company
// ---------------------------------------------------------------------------------------------------------------

const cache = new Map<string, { at: number; snapshot: FinanceSnapshot }>()

export type SnapshotResult =
  | { state: "not_configured"; missing: string[] }
  | { state: "not_connected" }
  | { state: "reconnect"; message: string }
  | { state: "error"; message: string }
  | { state: "ok"; snapshot: FinanceSnapshot; cached: boolean }

export async function readSnapshot(origin: string, opts: { fresh: boolean }): Promise<SnapshotResult> {
  const setup = qbSetup(origin)
  if (!setup.ok) return { state: "not_configured", missing: setup.missing }
  const deps = qbDeps(setup.client)
  try {
    const realm = await connectedRealm(deps)
    if (!realm) return { state: "not_connected" }
    const key = `${setup.client.environment}:${realm.realmId}`
    const hit = cache.get(key)
    const now = deps.nowMs()
    if (!opts.fresh && hit && now - hit.at < SNAPSHOT_TTL_MS) return { state: "ok", snapshot: hit.snapshot, cached: true }

    const today = localDate(now)
    const q = snapshotQueries(today)
    // Sequential, so a token refresh happens once rather than racing across parallel reads.
    const info = (await qbGet(deps, `companyinfo/${realm.realmId}`, {})) as { CompanyInfo?: { CompanyName?: string } }
    const byMonth = (await qbGet(deps, q.byMonth.path, q.byMonth.params)) as QbReport
    const ytd = (await qbGet(deps, q.ytd.path, q.ytd.params)) as QbReport
    const balance = (await qbGet(deps, q.balance.path, q.balance.params)) as QbReport
    const receivable = (await qbGet(deps, q.receivable.path, q.receivable.params)) as QbReport
    const payable = (await qbGet(deps, q.payable.path, q.payable.params)) as QbReport
    let openInvoices: number | null = null
    try {
      const r = (await qbGet(deps, q.openInvoices.path, q.openInvoices.params)) as { QueryResponse?: { totalCount?: number } }
      openInvoices = typeof r.QueryResponse?.totalCount === "number" ? r.QueryResponse.totalCount : null
    } catch (err) {
      if (err instanceof QbError && err.reconnect) throw err
    }
    const snapshot = buildSnapshot({
      company: info.CompanyInfo?.CompanyName?.trim() || "QuickBooks company",
      environment: setup.client.environment,
      nowMs: now,
      today,
      byMonth,
      ytd,
      balance,
      receivable,
      payable,
      openInvoices,
    })
    cache.set(key, { at: now, snapshot })
    return { state: "ok", snapshot, cached: false }
  } catch (err) {
    if (err instanceof QbError) {
      if (err.code !== "not_connected") console.error(`[quickbooks] snapshot: ${err.code}`)
      if (err.code === "not_connected") return { state: "not_connected" }
      return err.reconnect ? { state: "reconnect", message: err.message } : { state: "error", message: err.message }
    }
    console.error(`[quickbooks] snapshot: ${err instanceof Error ? err.name : "error"}`)
    return { state: "error", message: "The QuickBooks read failed; try again" }
  }
}

export function clearSnapshotCache(): void {
  cache.clear()
}

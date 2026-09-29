/**
 * Firestore reads for the system-of-record connector. Read-only by
 * construction: nothing here writes, and the connector holds no tool that does.
 *
 * Every response carries `source` (the row's own provenance, set by the loader
 * from the master version) and `last_updated` for the collection, so a job can
 * state what it applied rather than implying currency it cannot vouch for.
 */
import { getDb } from "../firebase-admin"
import { project, projectAll, withStaleFlag, type Scope } from "./visibility"

export type Envelope<T> = {
  source: string
  last_updated: string | null
  count?: number
  data: T
}

type Row = Record<string, unknown> & { key: string }

/** The most recent `updated_at` in a set of rows — the collection's last-updated time. */
function lastUpdated(rows: Row[]): string | null {
  const stamps = rows.map((r) => r.updated_at).filter((v): v is string => typeof v === "string").sort()
  return stamps.length ? stamps[stamps.length - 1] : null
}

/** Distinct row sources, joined. Usually one master version; more than one means a partial load. */
function sourceOf(rows: Row[]): string {
  const sources = [...new Set(rows.map((r) => r.source).filter((v): v is string => typeof v === "string"))]
  return sources.length ? sources.join("; ") : "unknown"
}

async function all(collection: string): Promise<Row[]> {
  const snap = await getDb().collection(collection).get()
  return snap.docs.map((d) => ({ key: d.id, ...d.data() }) as Row)
}

export async function listCollection(
  collection: string,
  scope: Scope,
  filter?: (row: Row) => boolean
): Promise<Envelope<Row[]>> {
  const rows = await all(collection)
  const filtered = filter ? rows.filter(filter) : rows
  const visible = projectAll(collection, filtered, scope) as Row[]
  return { source: sourceOf(filtered), last_updated: lastUpdated(filtered), count: visible.length, data: visible }
}

export async function getOne(collection: string, key: string, scope: Scope): Promise<Envelope<Row | null>> {
  const doc = await getDb().collection(collection).doc(key).get()
  if (!doc.exists) return { source: "unknown", last_updated: null, data: null }
  const row = { key: doc.id, ...doc.data() } as Row
  return { source: sourceOf([row]), last_updated: lastUpdated([row]), data: project(collection, row, scope) as Row | null }
}

/** Partner services carry a computed freshness flag; see visibility.isStale. */
export async function listPartnerServices(scope: Scope, tier?: string): Promise<Envelope<Row[]>> {
  const rows = await all("partner_services")
  const filtered = tier ? rows.filter((r) => r.tier === tier) : rows
  const visible = projectAll("partner_services", filtered, scope) as (Row & { last_reviewed?: string })[]
  return {
    source: sourceOf(filtered),
    last_updated: lastUpdated(filtered),
    count: visible.length,
    data: withStaleFlag(visible) as Row[],
  }
}

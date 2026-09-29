/**
 * The Work page's records, read from the system of record.
 *
 * Reads `portfolio_records`, keeps the published ones, maps them to the shape
 * the page renders, and restores the master's Section 4 ordering — Firestore
 * returns documents by id, which is alphabetical by record key and not the
 * editorial sequence.
 *
 * **It falls back to the generated extract on any failure.** The Work page is
 * the public marketing surface; a credential problem, a cold Firestore, or a
 * transient network fault must not empty it. The generated file is built from
 * the same master by the same pipeline, so the fallback is the same content,
 * not a degraded version of it — `scripts/sor/compare-work-records.ts` asserts
 * that field by field.
 *
 * The fallback is logged, loudly and with the error, because a page that
 * silently serves its fallback forever looks exactly like a page that is
 * working.
 */
import { WORK_RECORDS, type WorkRecord } from "../work-records"
import { toWorkRecords } from "./work-records"

export type WorkPageData = {
  records: readonly WorkRecord[]
  source: "portfolio_records" | "generated-extract"
}

/** The master's ordering, taken from the generated extract. */
const ORDER = WORK_RECORDS.map((r) => r.recordKey ?? "")

/**
 * An in-process cache with a one-hour life.
 *
 * `export const revalidate` on the route declares the same hour and is the right
 * declaration to have, but it only governs static rendering — and essentially
 * every route in this app renders dynamically (two of 195 are static at time of
 * writing). Left at that, the page would read Firestore on every request for a
 * set of records that changes when the master changes, which is rarely.
 *
 * So the read is memoised here too. Per function instance, not globally: a cold
 * start pays for one read, and a warm instance serves from memory. A failure is
 * never cached, so a transient fault does not pin the fallback in place for an
 * hour.
 */
const TTL_MS = 3_600_000
let cached: { at: number; value: WorkPageData } | null = null

export async function getWorkPageRecords(): Promise<WorkPageData> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value

  try {
    const { getDb } = await import("../firebase-admin")
    const snap = await getDb().collection("portfolio_records").get()
    if (snap.empty) throw new Error("portfolio_records is empty")

    const records = toWorkRecords(snap.docs.map((d) => ({ key: d.id, ...d.data() })), ORDER)
    if (records.length === 0) throw new Error("no published records in portfolio_records")

    const value: WorkPageData = { records, source: "portfolio_records" }
    cached = { at: Date.now(), value }
    return value
  } catch (error) {
    console.error(
      "[work] portfolio_records unavailable, serving the generated extract:",
      error instanceof Error ? error.message : error
    )
    // Deliberately not cached: a transient fault must not pin the fallback in
    // place for an hour after the store comes back.
    return { records: WORK_RECORDS, source: "generated-extract" }
  }
}

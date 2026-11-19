/**
 * Offline. Short references on records (build sequence V1 item 4): the TSK-/OPP-/PRJ- format, one counter per type
 * that only goes up, the reference taken in the same transaction as the record, never reused, and the backfill's
 * selection (a rule proposed and awaiting the founder). No network, no Firestore: an in-memory store that behaves as a
 * Firestore transaction does where the code depends on it (reads before writes, all-or-nothing commit, optimistic
 * retry when a read changed underneath).
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  REF_COUNTER_COLLECTION, assignRefIfMissing, createWithRef, formatRef, nextNumberFrom, parseRef, refCounterDocId, refsInText,
  type RefStore, type RefTx,
} from "../record-refs"
import { TRIAGE_RULE_STATUS, planBackfill, survivesTriage, type BackfillCandidate } from "../record-refs-backfill"

class MemoryRefStore implements RefStore {
  docs = new Map<string, Record<string, unknown>>()
  versions = new Map<string, number>()
  retries = 0
  private ids = 0
  /** Runs between a transaction's reads and its commit: lets a test interleave a rival commit. */
  beforeCommit?: () => Promise<void>

  newId(collection: string) { return `${collection}-id-${++this.ids}` }
  get(collection: string, id: string) { return this.docs.get(`${collection}/${id}`) }

  async transact<T>(fn: (tx: RefTx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const seen = new Map<string, number>()
      const writes: { key: string; data: Record<string, unknown>; merge: boolean }[] = []
      let writing = false
      const tx: RefTx = {
        get: async (c, id) => {
          if (writing) throw new Error("read after write")
          const key = `${c}/${id}`
          seen.set(key, this.versions.get(key) ?? 0)
          const v = this.docs.get(key)
          return v ? structuredClone(v) : null
        },
        set: (c, id, data, opts) => { writing = true; writes.push({ key: `${c}/${id}`, data, merge: !!opts?.merge }) },
      }
      const result = await fn(tx)
      const hook = this.beforeCommit
      this.beforeCommit = undefined
      if (hook) await hook()
      if ([...seen].some(([k, v]) => (this.versions.get(k) ?? 0) !== v)) { this.retries++; continue }
      for (const w of writes) {
        this.docs.set(w.key, w.merge ? { ...(this.docs.get(w.key) ?? {}), ...w.data } : { ...w.data })
        this.versions.set(w.key, (this.versions.get(w.key) ?? 0) + 1)
      }
      return result
    }
    throw new Error("too much contention")
  }
}

const counter = (s: MemoryRefStore, t: "TSK" | "OPP" | "PRJ") => s.get(REF_COUNTER_COLLECTION, refCounterDocId(t))

test("format and parse: people type references loosely; the canonical form is PREFIX-n", () => {
  assert.equal(formatRef("TSK", 142), "TSK-142")
  for (const s of ["TSK-142", "tsk-142", " tsk 142 ", "TSK#142", "TSK142", "TSK-0142"]) assert.equal(parseRef(s)?.ref, "TSK-142", s)
  assert.deepEqual(parseRef("opp-1045"), { type: "OPP", n: 1045, ref: "OPP-1045" })
  for (const s of ["TSK-0", "TSK-", "ABC-12", "TSK-12x", "my TSK-12", "", 12, null, undefined]) assert.equal(parseRef(s), null, String(s))
  assert.throws(() => formatRef("OPP", 0))
  assert.deepEqual(refsInText("respond to tsk-142, then OPP-7 and TSK-142 again"), ["TSK-142", "OPP-7"])
})

test("a counter starts at 1 and reads a damaged counter as a fresh one", () => {
  assert.equal(nextNumberFrom(null), 1)
  assert.equal(nextNumberFrom({ next: 9 }), 9)
  for (const bad of [{ next: 0 }, { next: -3 }, { next: "4" }, { next: 1.5 }, {}]) assert.equal(nextNumberFrom(bad), 1)
})

test("create: the record and its reference are written together, and each type counts on its own", async () => {
  const s = new MemoryRefStore()
  const a = await createWithRef(s, "crm_tasks", "TSK", { title: "Call venue" })
  const b = await createWithRef(s, "crm_tasks", "TSK", { title: "Send deck" })
  const o = await createWithRef(s, "crm_clients", "OPP", { title: "Riverwalk", is_opportunity: true })
  assert.deepEqual([a.ref, b.ref, o.ref], ["TSK-1", "TSK-2", "OPP-1"])
  assert.deepEqual(s.get("crm_tasks", a.id), { title: "Call venue", ref: "TSK-1" })
  assert.equal(counter(s, "TSK")?.next, 3)
  assert.equal(counter(s, "OPP")?.next, 2)
  assert.equal(counter(s, "PRJ"), undefined, "nothing takes a PRJ number until projections exist")
})

test("create: a promotion keeps where the record came from, and refuses a from_ref that isn't one", async () => {
  const s = new MemoryRefStore()
  const o = await createWithRef(s, "crm_clients", "OPP", { title: "From plan" }, { fromRef: "prj 205" })
  assert.equal(s.get("crm_clients", o.id)?.from_ref, "PRJ-205")
  await assert.rejects(() => createWithRef(s, "crm_clients", "OPP", {}, { fromRef: "not-a-ref" }))
})

test("never reused: deleting a record does not give its number back", async () => {
  const s = new MemoryRefStore()
  const first = await createWithRef(s, "crm_tasks", "TSK", { title: "x" })
  s.docs.delete(`crm_tasks/${first.id}`)
  const next = await createWithRef(s, "crm_tasks", "TSK", { title: "y" })
  assert.equal(next.ref, "TSK-2")
})

test("two creates racing on one counter get different numbers (optimistic retry)", async () => {
  const s = new MemoryRefStore()
  let rival: { ref: string } | undefined
  s.beforeCommit = async () => { rival = await createWithRef(s, "crm_tasks", "TSK", { title: "rival" }) }
  const mine = await createWithRef(s, "crm_tasks", "TSK", { title: "mine" })
  assert.equal(rival?.ref, "TSK-1")
  assert.equal(mine.ref, "TSK-2")
  assert.ok(s.retries >= 1)
  const many = await Promise.all(Array.from({ length: 8 }, (_, i) => createWithRef(s, "crm_tasks", "TSK", { i })))
  assert.equal(new Set(many.map((m) => m.ref)).size, 8)
  assert.equal(counter(s, "TSK")?.next, 11)
})

test("assignRefIfMissing: numbers a record once; a record that has one keeps it; a missing record takes no number", async () => {
  const s = new MemoryRefStore()
  s.docs.set("crm_clients/c1", { name: "Acme", is_opportunity: true })
  assert.deepEqual(await assignRefIfMissing(s, "crm_clients", "c1", "OPP"), { ref: "OPP-1", assigned: true })
  assert.deepEqual(await assignRefIfMissing(s, "crm_clients", "c1", "OPP"), { ref: "OPP-1", assigned: false })
  assert.equal(s.get("crm_clients", "c1")?.name, "Acme", "merge keeps the record's fields")
  assert.equal(await assignRefIfMissing(s, "crm_clients", "missing", "OPP"), null)
  assert.equal(counter(s, "OPP")?.next, 2)
})

const cand = (type: "TSK" | "OPP", collection: string, id: string, data: Record<string, unknown>): BackfillCandidate => ({ type, collection, id, data })

test("backfill rule: proposed and awaiting the founder, so the script cannot write", () => {
  assert.equal(TRIAGE_RULE_STATUS, "proposed")
})

test("backfill rule (proposed): live tasks in crm_tasks and open or won opportunities survive; the rest do not", () => {
  assert.deepEqual(survivesTriage(cand("TSK", "crm_tasks", "t", { status: "in_progress" })), { keep: true })
  assert.equal(survivesTriage(cand("TSK", "crm_tasks", "t", { status: "completed" })).keep, false)
  assert.equal(survivesTriage(cand("TSK", "crm_tasks", "t", { status: "not_started", is_archived: true })).keep, false)
  assert.equal(survivesTriage(cand("TSK", "crm_tasks_jake", "t", { status: "not_started" })).keep, false)
  assert.deepEqual(survivesTriage(cand("OPP", "crm_clients", "o", { is_opportunity: true, disposition: "proposal" })), { keep: true })
  assert.deepEqual(survivesTriage(cand("OPP", "crm_clients", "o", { is_opportunity: true, disposition: "closed_won" })), { keep: true })
  assert.equal(survivesTriage(cand("OPP", "crm_clients", "o", { is_opportunity: true, disposition: "closed_lost" })).keep, false)
  assert.equal(survivesTriage(cand("OPP", "crm_clients", "o", { is_opportunity: true, is_archived: true })).keep, false)
  assert.equal(survivesTriage(cand("OPP", "crm_clients", "o", { is_opportunity: false })).keep, false)
})

test("backfill plan: oldest first, skips records that already have a reference, and says why each is left out", () => {
  const plan = planBackfill([
    cand("TSK", "crm_tasks", "new", { status: "not_started", created_at: "2026-11-01T00:00:00Z" }),
    cand("TSK", "crm_tasks", "old", { status: "not_started", created_at: { toMillis: () => Date.parse("2025-01-01") } }),
    cand("TSK", "crm_tasks", "has", { status: "not_started", ref: "TSK-9" }),
    cand("TSK", "crm_tasks", "done", { status: "completed" }),
  ])
  assert.deepEqual(plan.assign.map((c) => c.id), ["old", "new"])
  assert.deepEqual(plan.skipped.map((s) => [s.candidate.id, s.reason]), [["has", "already has a reference"], ["done", "completed"]])
})

test("backfill twice numbers nothing twice", async () => {
  const s = new MemoryRefStore()
  s.docs.set("crm_tasks/a", { status: "not_started" })
  s.docs.set("crm_tasks/b", { status: "in_progress" })
  const run = async () => {
    const cands = ["a", "b"].map((id) => cand("TSK", "crm_tasks", id, s.get("crm_tasks", id)!))
    for (const c of planBackfill(cands).assign) await assignRefIfMissing(s, c.collection, c.id, c.type)
  }
  await run(); await run()
  assert.deepEqual([s.get("crm_tasks", "a")?.ref, s.get("crm_tasks", "b")?.ref].sort(), ["TSK-1", "TSK-2"])
  assert.equal(counter(s, "TSK")?.next, 3)
})

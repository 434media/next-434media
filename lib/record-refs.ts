/**
 * Short references on records (build sequence V1 item 4, "Short references on records"; founder approval 2026-10-27,
 * sequenced 2026-11-19). Every record people work with shows a short reference: `TSK-142` for a task, `OPP-1045` for
 * an opportunity, `PRJ-205` for a projection. Firestore ids stay the keys; a reference is for display and lookup only.
 *
 * - Each type has its own counter: one document per type, `crm_meta/ref_counter_<TYPE>`, holding `{ next }`.
 * - A reference is taken in the same transaction that writes the record, so a failed write takes no number, and a
 *   counter only ever goes up, so a number is never reused (deleting a record does not give its number back).
 * - Promotion keeps where a record came from: a projection promoted to an opportunity gets its own OPP number and
 *   carries `from_ref: "PRJ-x"`. Projections do not exist yet (finance Phase 2), so nothing takes a PRJ number today.
 *
 * This module is pure and storage-agnostic: `RefStore` is the narrow slice of Firestore it needs, so the counter rules
 * are tested offline against an in-memory store. `firestoreRefStore` adapts the Admin SDK.
 */

export const REF_TYPES = ["TSK", "OPP", "PRJ"] as const
export type RefType = (typeof REF_TYPES)[number]

/** What each prefix names, for labels and the connector's descriptions. */
export const REF_TYPE_LABEL: Record<RefType, string> = { TSK: "task", OPP: "opportunity", PRJ: "projection" }

/** Counters live beside the other CRM bookkeeping documents. One document per type. */
export const REF_COUNTER_COLLECTION = "crm_meta"
export const refCounterDocId = (type: RefType): string => `ref_counter_${type}`

/** The first number a type hands out. Linear's convention: a fresh counter starts at 1. */
export const FIRST_REF_NUMBER = 1

export function formatRef(type: RefType, n: number): string {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`record-refs: bad reference number ${n}`)
  return `${type}-${n}`
}

const REF_PATTERN = /^\s*(TSK|OPP|PRJ)[\s#-]?0*(\d{1,9})\s*$/i

/** Reads a reference as people type it: `TSK-142`, `tsk 142`, `TSK#142`, `opp-0045`. Null when it isn't one. */
export function parseRef(input: unknown): { type: RefType; n: number; ref: string } | null {
  if (typeof input !== "string") return null
  const m = REF_PATTERN.exec(input)
  if (!m) return null
  const type = m[1].toUpperCase() as RefType
  const n = Number(m[2])
  if (!Number.isSafeInteger(n) || n < 1) return null
  return { type, n, ref: formatRef(type, n) }
}

/** Every reference written inside free text ("respond to TSK-142 and OPP-7"), canonical and de-duplicated. */
export function refsInText(text: unknown): string[] {
  if (typeof text !== "string") return []
  const out = new Set<string>()
  for (const m of text.matchAll(/\b(TSK|OPP|PRJ)[-#]0*(\d{1,9})\b/gi)) {
    const parsed = parseRef(`${m[1]}-${m[2]}`)
    if (parsed) out.add(parsed.ref)
  }
  return [...out]
}

/** The number a counter document will hand out next. A missing or unreadable counter starts at FIRST_REF_NUMBER. */
export function nextNumberFrom(counter: unknown): number {
  const next = (counter as { next?: unknown } | null | undefined)?.next
  return typeof next === "number" && Number.isSafeInteger(next) && next >= FIRST_REF_NUMBER ? next : FIRST_REF_NUMBER
}

// ── Storage ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** One transaction: every read before every write, as Firestore requires. */
export interface RefTx {
  get(collection: string, id: string): Promise<Record<string, unknown> | null>
  set(collection: string, id: string, data: Record<string, unknown>, opts?: { merge?: boolean }): void
}

export interface RefStore {
  transact<T>(fn: (tx: RefTx) => Promise<T>): Promise<T>
  /** A fresh document id in a collection, as `collection.doc().id` gives. */
  newId(collection: string): string
}

/** The fields a reference adds to a record. */
export interface RefFields {
  ref?: string
  /** Where a promoted record came from, e.g. "PRJ-205" on the opportunity a projection became. */
  from_ref?: string
}

/**
 * Writes a new record and its reference together. `data` is written as given plus `ref` (and `from_ref` when set);
 * the counter advances in the same transaction. Returns the new id and reference.
 */
export async function createWithRef(
  store: RefStore,
  collection: string,
  type: RefType,
  data: Record<string, unknown>,
  opts: { fromRef?: string; now?: unknown } = {},
): Promise<{ id: string; ref: string }> {
  const fromRef = opts.fromRef === undefined ? undefined : parseRef(opts.fromRef)?.ref
  if (opts.fromRef !== undefined && !fromRef) throw new Error(`record-refs: from_ref "${opts.fromRef}" is not a reference`)
  const id = store.newId(collection)
  return store.transact(async (tx) => {
    const n = nextNumberFrom(await tx.get(REF_COUNTER_COLLECTION, refCounterDocId(type)))
    const ref = formatRef(type, n)
    tx.set(collection, id, { ...data, ref, ...(fromRef ? { from_ref: fromRef } : {}) })
    tx.set(REF_COUNTER_COLLECTION, refCounterDocId(type), { next: n + 1, ...(opts.now !== undefined ? { updated_at: opts.now } : {}) }, { merge: true })
    return { id, ref }
  })
}

/**
 * Gives an existing record a reference if it has none; a record that already has one keeps it. Used when a record
 * becomes a type it was not (a client marked as an opportunity) and by the backfill. Returns the record's reference,
 * or null when the record does not exist.
 */
export async function assignRefIfMissing(
  store: RefStore,
  collection: string,
  id: string,
  type: RefType,
  opts: { now?: unknown } = {},
): Promise<{ ref: string; assigned: boolean } | null> {
  return store.transact(async (tx) => {
    const record = await tx.get(collection, id)
    const counter = await tx.get(REF_COUNTER_COLLECTION, refCounterDocId(type))
    if (!record) return null
    const existing = parseRef(record.ref)
    if (existing) return { ref: existing.ref, assigned: false }
    const n = nextNumberFrom(counter)
    const ref = formatRef(type, n)
    tx.set(collection, id, { ref }, { merge: true })
    tx.set(REF_COUNTER_COLLECTION, refCounterDocId(type), { next: n + 1, ...(opts.now !== undefined ? { updated_at: opts.now } : {}) }, { merge: true })
    return { ref, assigned: true }
  })
}

/** The Admin SDK behind `RefStore`. */
export function firestoreRefStore(db: FirebaseFirestore.Firestore): RefStore {
  return {
    newId: (collection) => db.collection(collection).doc().id,
    transact: (fn) =>
      db.runTransaction((t) =>
        fn({
          async get(collection, id) {
            const snap = await t.get(db.collection(collection).doc(id))
            return snap.exists ? ((snap.data() ?? {}) as Record<string, unknown>) : null
          },
          set(collection, id, data, opts) {
            const ref = db.collection(collection).doc(id)
            if (opts?.merge) t.set(ref, data, { merge: true })
            else t.set(ref, data)
          },
        }),
      ),
  }
}

/** Whether a search box's text names this reference: "tsk 142" finds TSK-142 exactly; "TSK-14" finds it by prefix. */
export function refMatches(ref: unknown, query: string): boolean {
  if (typeof ref !== "string" || !ref) return false
  const parsed = parseRef(query)
  if (parsed) return parsed.ref === ref
  const q = query.trim().toUpperCase()
  return q.length >= 4 && /^(TSK|OPP|PRJ)-\d*$/.test(q) && ref.startsWith(q)
}

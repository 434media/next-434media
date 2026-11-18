/**
 * An in-memory AgentDb (lib/agent/ledger-server.ts) for offline tests. It behaves as a Firestore transaction does where
 * the code depends on it: every read comes before every write, `create` fails on an existing document, a
 * transaction's writes land all together or not at all, and a transaction whose reads changed under it before it
 * committed is run again (Firestore's optimistic retry), so two runs racing on one document behave as they do live.
 */
import { AGENT_LEDGER_COLLECTION, AGENT_TASKS_COLLECTION, type AgentTask, type LedgerEntry } from "../../agent/ledger"
import type { AgentDb, AgentTx } from "../../agent/ledger-server"

export class MemoryAgentDb implements AgentDb {
  docs = new Map<string, Map<string, unknown>>()
  versions = new Map<string, number>()
  commits = 0
  retries = 0
  /** Runs before each commit; throw to make the commit fail. */
  failNextCommit?: string

  col(name: string): Map<string, unknown> {
    let c = this.docs.get(name)
    if (!c) this.docs.set(name, (c = new Map()))
    return c
  }

  get<T>(collection: string, id: string): T | undefined {
    const v = this.col(collection).get(id)
    return v === undefined ? undefined : (structuredClone(v) as T)
  }

  entries(taskId: string): LedgerEntry[] {
    return [...this.col(AGENT_LEDGER_COLLECTION).values()]
      .map((e) => e as LedgerEntry)
      .filter((e) => e.taskId === taskId)
      .sort((a, b) => a.seq - b.seq)
  }

  task(id: string): AgentTask | undefined {
    return this.get<AgentTask>(AGENT_TASKS_COLLECTION, id)
  }

  async run<T>(fn: (tx: AgentTx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const out = await this.attempt(fn)
      if (out.ok) return out.result
      this.retries++
    }
    throw new Error("ABORTED: too much contention")
  }

  private async attempt<T>(fn: (tx: AgentTx) => Promise<T>): Promise<{ ok: true; result: T } | { ok: false }> {
    const writes: { kind: "create" | "set" | "merge"; collection: string; id: string; data: unknown }[] = []
    const seen = new Map<string, number>()
    let writing = false
    const read = <D,>(collection: string, id: string): D | null => {
      if (writing) throw new Error("agent ledger: a read after a write in one transaction")
      const key = `${collection}/${id}`
      seen.set(key, this.versions.get(key) ?? 0)
      return this.get<D>(collection, id) ?? null
    }
    const tx: AgentTx = {
      getTask: async (id) => read<AgentTask>(AGENT_TASKS_COLLECTION, id),
      getDoc: async <D,>(collection: string, id: string) => read<D>(collection, id),
      createDoc: (collection, id, data) => ((writing = true), writes.push({ kind: "create", collection, id, data: structuredClone(data) })),
      setDoc: (collection, id, data) => ((writing = true), writes.push({ kind: "set", collection, id, data: structuredClone(data) })),
      mergeDoc: (collection, id, patch, opts) => ((writing = true), writes.push({ kind: "merge", collection, id, data: structuredClone({ ...patch, ...(opts?.touchUpdatedAt ? { updated_at: "(server time)" } : {}) }) })),
      putTask: (task) => ((writing = true), writes.push({ kind: "set", collection: AGENT_TASKS_COLLECTION, id: task.id, data: structuredClone(task) })),
      appendEntry: (entry) => ((writing = true), writes.push({ kind: "create", collection: AGENT_LEDGER_COLLECTION, id: entry.id, data: structuredClone(entry) })),
    }
    const result = await fn(tx)
    // Let a racing transaction reach its commit first, as two requests would.
    await new Promise((r) => setImmediate(r))
    if (this.failNextCommit) {
      const why = this.failNextCommit
      this.failNextCommit = undefined
      throw new Error(why)
    }
    for (const [key, v] of seen) if ((this.versions.get(key) ?? 0) !== v) return { ok: false }
    for (const w of writes) if (w.kind === "create" && this.col(w.collection).has(w.id)) throw new Error(`ALREADY_EXISTS ${w.collection}/${w.id}`)
    for (const w of writes) {
      const key = `${w.collection}/${w.id}`
      const prior = w.kind === "merge" ? ((this.col(w.collection).get(w.id) as Record<string, unknown> | undefined) ?? {}) : {}
      this.col(w.collection).set(w.id, JSON.parse(JSON.stringify(w.kind === "merge" ? { ...prior, ...(w.data as object) } : w.data)))
      this.versions.set(key, (this.versions.get(key) ?? 0) + 1)
    }
    this.commits++
    return { ok: true, result }
  }
}

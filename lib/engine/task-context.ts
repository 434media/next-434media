/**
 * Which business task a model call belongs to (434 build sequence V1 item 2, Foundation A: "Cost per task recorded from
 * day one"). A caller wraps its work in withTask(); every model call made inside it, however deep, is recorded against
 * that task and checked against its property's budget by the guard (lib/engine/guard.ts). A call made outside any task
 * is still recorded, under the task "untracked", so nothing is spent unseen.
 *
 * `property` is the brand the work is for, by its stored identifier (CLAUDE.md: "Brands" … the code still says
 * `brand`, `platform` and, in places, `property"), or "434" for 434's own work. It never holds personal data, and
 * neither does `task`: an id, never a name or an address.
 */
import { AsyncLocalStorage } from "node:async_hooks"

export interface TaskContext {
  /** A stable id for the business task: a draft id, a lead id, a run id. */
  task: string
  /** What kind of work: "content-pipeline", "outreach-draft", "skill:<name>", … */
  kind: string
  property?: string
  skill?: string
}

/**
 * One store per process, kept on globalThis. The guard is installed from instrumentation.ts, which Next.js bundles
 * apart from the routes, so each bundle gets its own copy of this module. A module-level store would leave the guard
 * reading a store no route ever writes to, and every call would be recorded as "untracked" (V1 item 4 proof run,
 * 2026-11-14 and 2026-11-17). Symbol.for gives every copy the same key.
 */
const STORE_KEY = Symbol.for("434.engine.taskContext")
const holder = globalThis as unknown as Record<symbol, AsyncLocalStorage<TaskContext> | undefined>
const store = (holder[STORE_KEY] ??= new AsyncLocalStorage<TaskContext>())

export function withTask<T>(ctx: TaskContext, fn: () => T): T {
  return store.run(ctx, fn)
}

export function currentTask(): TaskContext | undefined {
  return store.getStore()
}

export const UNTRACKED: TaskContext = { task: "untracked", kind: "untracked" }

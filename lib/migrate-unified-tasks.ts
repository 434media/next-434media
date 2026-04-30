import { getDb } from "./firebase-admin"
import { getAllTasks, invalidateCache } from "./firestore-crm"
import type { Task } from "../types/crm-types"

export const UNIFIED_TASKS_COLLECTION = "crm_tasks"
const META_COLLECTION = "crm_meta"
const MIGRATION_DOC = "task_migration"

const LEGACY_TASK_COLLECTIONS = [
  "crm_tasks_jake",
  "crm_tasks_pm",
  "crm_tasks_marc",
  "crm_tasks_stacy",
  "crm_tasks_jesse",
  "crm_tasks_barb",
  "crm_tasks_teams",
  "crm_tasks_completed",
] as const

export interface TaskMigrationStatus {
  completed: boolean
  completedAt: string | null
  totalCopied: number
  totalConflicts: number
  totalSkipped: number
  lastDryRunAt: string | null
}

interface MigrationConflict {
  id: string
  reason: string
  kept: { source: string; updated_at: string }
  dropped: { source: string; updated_at: string }
}

export interface MigrationRunResult {
  dryRun: boolean
  startedAt: string
  finishedAt: string
  durationMs: number
  sourceCounts: Record<string, number>
  uniqueTaskCount: number
  copied: number
  conflicts: MigrationConflict[]
  skipped: { id: string; reason: string }[]
  alreadyMigrated: boolean
}

const DEFAULT_STATUS: TaskMigrationStatus = {
  completed: false,
  completedAt: null,
  totalCopied: 0,
  totalConflicts: 0,
  totalSkipped: 0,
  lastDryRunAt: null,
}

export async function getTaskMigrationStatus(): Promise<TaskMigrationStatus> {
  try {
    const db = getDb()
    const snap = await db.collection(META_COLLECTION).doc(MIGRATION_DOC).get()
    if (!snap.exists) return DEFAULT_STATUS
    return { ...DEFAULT_STATUS, ...(snap.data() as Partial<TaskMigrationStatus>) }
  } catch (error) {
    console.error("[migrate-tasks] Failed to read status:", error)
    return DEFAULT_STATUS
  }
}

async function setTaskMigrationStatus(patch: Partial<TaskMigrationStatus>): Promise<void> {
  const db = getDb()
  await db.collection(META_COLLECTION).doc(MIGRATION_DOC).set(patch, { merge: true })
}

async function countDocs(collection: string): Promise<number> {
  try {
    const db = getDb()
    const snap = await db.collection(collection).count().get()
    return snap.data().count
  } catch {
    // count() not supported in older SDK paths — fall back
    const db = getDb()
    const snap = await db.collection(collection).select().get()
    return snap.size
  }
}

/**
 * Run the unified-tasks migration.
 *
 * Reads from the 8 legacy per-rep collections AND from the `crm_master_list`
 * task entries (via `getAllTasks()` which already merges and shape-converts
 * both sources), dedupes by document `id`, and writes one document per task
 * to `crm_tasks`. Idempotent — safe to re-run.
 *
 * Conflict resolution: when the same `id` appears in two sources, keep the
 * one with the most recent `updated_at`.
 */
export async function runTaskMigration(opts: { dryRun: boolean }): Promise<MigrationRunResult> {
  const startedAt = new Date()
  const result: MigrationRunResult = {
    dryRun: opts.dryRun,
    startedAt: startedAt.toISOString(),
    finishedAt: "",
    durationMs: 0,
    sourceCounts: {},
    uniqueTaskCount: 0,
    copied: 0,
    conflicts: [],
    skipped: [],
    alreadyMigrated: false,
  }

  // Source-counts breakdown — independent of getAllTasks() which already merges
  for (const col of LEGACY_TASK_COLLECTIONS) {
    result.sourceCounts[col] = await countDocs(col)
  }
  result.sourceCounts.crm_master_list_tasks = -1 // populated below

  // Use the existing merged getter — it already applies the master-list
  // → Task transformation logic.
  const allTasks: Task[] = await getAllTasks()

  // Dedupe by id, keep most recently updated
  const byId = new Map<string, { task: Task; sourceHint: string }>()
  for (const task of allTasks) {
    if (!task.id) {
      result.skipped.push({ id: "(missing)", reason: "task has no id" })
      continue
    }
    const existing = byId.get(task.id)
    const sourceHint = (task as Task & { _source?: string })._source ?? "unknown"
    if (!existing) {
      byId.set(task.id, { task, sourceHint })
      continue
    }
    const a = existing.task.updated_at || existing.task.created_at || ""
    const b = task.updated_at || task.created_at || ""
    const keepNew = b > a
    const kept = keepNew ? task : existing.task
    const dropped = keepNew ? existing.task : task
    result.conflicts.push({
      id: task.id,
      reason: "duplicate id across sources — kept most recently updated",
      kept: { source: keepNew ? sourceHint : existing.sourceHint, updated_at: keepNew ? b : a },
      dropped: { source: keepNew ? existing.sourceHint : sourceHint, updated_at: keepNew ? a : b },
    })
    byId.set(task.id, { task: kept, sourceHint: keepNew ? sourceHint : existing.sourceHint })
  }

  result.uniqueTaskCount = byId.size
  result.sourceCounts.crm_master_list_tasks =
    allTasks.length - Object.values(result.sourceCounts).reduce((sum, v) => sum + (v > 0 ? v : 0), 0)

  if (opts.dryRun) {
    await setTaskMigrationStatus({ lastDryRunAt: startedAt.toISOString() })
    const finishedAt = new Date()
    result.finishedAt = finishedAt.toISOString()
    result.durationMs = finishedAt.getTime() - startedAt.getTime()
    return result
  }

  // Commit: write each task to crm_tasks using its original id as doc id
  const db = getDb()
  const now = new Date().toISOString()
  const entries = Array.from(byId.values())

  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch()
    const slice = entries.slice(i, i + 400)
    for (const { task } of slice) {
      const docRef = db.collection(UNIFIED_TASKS_COLLECTION).doc(task.id)
      const { id, ...rest } = task
      batch.set(
        docRef,
        {
          ...rest,
          id,
          created_at: task.created_at || now,
          updated_at: task.updated_at || now,
          _migrated_at: now,
        },
        { merge: true },
      )
    }
    await batch.commit()
    result.copied += slice.length
  }

  invalidateCache(UNIFIED_TASKS_COLLECTION)
  invalidateCache("all_tasks_combined")

  const finishedAt = new Date()
  result.finishedAt = finishedAt.toISOString()
  result.durationMs = finishedAt.getTime() - startedAt.getTime()

  await setTaskMigrationStatus({
    completed: true,
    completedAt: finishedAt.toISOString(),
    totalCopied: result.copied,
    totalConflicts: result.conflicts.length,
    totalSkipped: result.skipped.length,
  })

  return result
}

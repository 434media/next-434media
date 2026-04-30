"use client"

import { useEffect, useState } from "react"
import {
  Loader2,
  Database,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Play,
  RefreshCw,
} from "lucide-react"
import type { CurrentUser } from "../types"

interface MigrationStatus {
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

interface MigrationRunResult {
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

function fmtDate(iso: string | null): string {
  if (!iso) return "Never"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function DataExportsTab({ currentUser: _currentUser }: { currentUser: CurrentUser }) {
  void _currentUser
  const [status, setStatus] = useState<MigrationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<"dry" | "commit" | null>(null)
  const [lastResult, setLastResult] = useState<MigrationRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/crm/migrate-tasks")
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to load status")
      setStatus(body.status as MigrationStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  const runMigration = async (dryRun: boolean) => {
    if (!dryRun && !confirm("Commit the unified-tasks migration? This writes to a new collection and flips the system to use it. Old per-rep collections are left intact for 30-day rollback.")) {
      return
    }
    setRunning(dryRun ? "dry" : "commit")
    setError(null)
    try {
      const res = await fetch("/api/admin/crm/migrate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Migration failed")
      setLastResult(body.result as MigrationRunResult)
      await refreshStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed")
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Data & Migrations</h2>
        <p className="text-[12px] text-neutral-500">
          One-off operations. Each is idempotent and safe to re-run.
        </p>
      </div>

      {/* Unified Tasks card */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-neutral-500" />
          <h3 className="text-[13px] font-semibold text-neutral-800">Unified Tasks Migration</h3>
          {status?.completed && (
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Completed
            </span>
          )}
          <button
            type="button"
            onClick={refreshStatus}
            className="ml-auto p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
            title="Refresh status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-[12px] text-neutral-500 leading-relaxed">
            Collapses the 8 per-rep task collections (<code className="text-[11px] bg-neutral-100 px-1 rounded">crm_tasks_jake</code>,
            <code className="text-[11px] bg-neutral-100 px-1 rounded mx-0.5">crm_tasks_marc</code>, …) plus master-list-derived
            tasks into a single <code className="text-[11px] bg-neutral-100 px-1 rounded">crm_tasks</code> collection.
            After commit, every read/write flips to the unified collection. The legacy collections
            stay in place for ~30 days for rollback.
          </p>

          {loading && !status ? (
            <div className="flex items-center gap-2 text-[12px] text-neutral-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading status…
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="rounded-md border border-neutral-200 px-2 py-1.5">
                <div className="text-neutral-400 uppercase tracking-wider">Status</div>
                <div className="font-semibold text-neutral-900 mt-0.5">
                  {status?.completed ? "Completed" : "Pending"}
                </div>
              </div>
              <div className="rounded-md border border-neutral-200 px-2 py-1.5">
                <div className="text-neutral-400 uppercase tracking-wider">Completed at</div>
                <div className="font-semibold text-neutral-900 mt-0.5 truncate">
                  {fmtDate(status?.completedAt ?? null)}
                </div>
              </div>
              <div className="rounded-md border border-neutral-200 px-2 py-1.5">
                <div className="text-neutral-400 uppercase tracking-wider">Tasks copied</div>
                <div className="font-semibold text-neutral-900 mt-0.5">{status?.totalCopied ?? 0}</div>
              </div>
              <div className="rounded-md border border-neutral-200 px-2 py-1.5">
                <div className="text-neutral-400 uppercase tracking-wider">Last dry-run</div>
                <div className="font-semibold text-neutral-900 mt-0.5 truncate">
                  {fmtDate(status?.lastDryRunAt ?? null)}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-[12px]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => runMigration(true)}
              disabled={running !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-neutral-300 text-neutral-800 text-[12px] font-semibold hover:bg-neutral-50 disabled:opacity-50"
            >
              {running === "dry" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              Dry-run
            </button>
            <button
              type="button"
              onClick={() => runMigration(false)}
              disabled={running !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] font-semibold hover:bg-neutral-800 disabled:opacity-50"
            >
              {running === "commit" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Commit
            </button>
            {!status?.completed && (
              <span className="text-[11px] text-neutral-400 ml-1">
                Always run a dry-run first.
              </span>
            )}
          </div>

          {lastResult && (
            <div className="mt-3 border border-neutral-200 rounded-md p-3 bg-neutral-50 text-[11px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-800">
                  Last run · {lastResult.dryRun ? "Dry-run" : "Commit"}
                </span>
                <span className="text-neutral-500">{lastResult.durationMs}ms</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <div className="text-neutral-400 uppercase tracking-wider">Unique tasks</div>
                  <div className="font-semibold text-neutral-900">{lastResult.uniqueTaskCount}</div>
                </div>
                <div>
                  <div className="text-neutral-400 uppercase tracking-wider">Copied</div>
                  <div className="font-semibold text-neutral-900">{lastResult.copied}</div>
                </div>
                <div>
                  <div className="text-neutral-400 uppercase tracking-wider">Conflicts</div>
                  <div className="font-semibold text-neutral-900">{lastResult.conflicts.length}</div>
                </div>
                <div>
                  <div className="text-neutral-400 uppercase tracking-wider">Skipped</div>
                  <div className="font-semibold text-neutral-900">{lastResult.skipped.length}</div>
                </div>
              </div>
              {Object.keys(lastResult.sourceCounts).length > 0 && (
                <details className="text-neutral-500">
                  <summary className="cursor-pointer text-neutral-700 font-medium">Source counts</summary>
                  <ul className="mt-1.5 space-y-0.5 ml-3">
                    {Object.entries(lastResult.sourceCounts).map(([col, n]) => (
                      <li key={col}>
                        <code className="text-[10px]">{col}</code>: {n}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {lastResult.conflicts.length > 0 && (
                <details className="text-neutral-500">
                  <summary className="cursor-pointer text-neutral-700 font-medium">
                    Conflicts ({lastResult.conflicts.length})
                  </summary>
                  <ul className="mt-1.5 space-y-1 ml-3 max-h-40 overflow-y-auto">
                    {lastResult.conflicts.slice(0, 25).map((c, i) => (
                      <li key={i}>
                        <code className="text-[10px]">{c.id}</code> — kept{" "}
                        <span className="font-medium">{c.kept.source}</span> over{" "}
                        <span>{c.dropped.source}</span>
                      </li>
                    ))}
                    {lastResult.conflicts.length > 25 && <li>… and {lastResult.conflicts.length - 25} more</li>}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

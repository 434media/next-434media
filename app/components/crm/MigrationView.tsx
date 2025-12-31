"use client"

import { RefreshCw, AlertCircle, ArrowUpRight, Loader2 } from "lucide-react"
import type { MigrationTableStatus, MigrationResult } from "./types"

interface MigrationViewProps {
  migrationStatus: MigrationTableStatus[]
  migrationResult: MigrationResult | null
  isMigrating: boolean
  onDryRun: () => void
  onMigrate: () => void
  onRefresh: () => void
}

export function MigrationView({
  migrationStatus,
  migrationResult,
  isMigrating,
  onDryRun,
  onMigrate,
  onRefresh,
}: MigrationViewProps) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Airtable to Firestore Migration</p>
            <p className="text-xs text-amber-400/80 mt-1">
              This will migrate data from your Airtable CRM base (app6lXqEqHFG9ZJ20) to Firestore. 
              Run a dry run first to preview the migration.
            </p>
          </div>
        </div>
      </div>

      {/* Migration Actions */}
      <div className="flex gap-3">
        <button
          onClick={onDryRun}
          disabled={isMigrating}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Dry Run
        </button>
        <button
          onClick={onMigrate}
          disabled={isMigrating}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
          Run Migration
        </button>
        <button
          onClick={onRefresh}
          disabled={isMigrating}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Status
        </button>
      </div>

      {/* Migration Result */}
      {migrationResult && (
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <h4 className="font-medium mb-3">Migration Result</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-neutral-400">Tables Processed</p>
              <p className="text-lg font-semibold">{migrationResult.summary?.tablesProcessed || 0}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Successful</p>
              <p className="text-lg font-semibold text-emerald-400">{migrationResult.summary?.successCount || 0}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Errors</p>
              <p className="text-lg font-semibold text-red-400">{migrationResult.summary?.errorCount || 0}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Records Migrated</p>
              <p className="text-lg font-semibold">{migrationResult.summary?.totalRecordsMigrated || 0}</p>
            </div>
          </div>
          {migrationResult.dryRun && (
            <p className="text-xs text-amber-400">This was a dry run. No data was actually migrated.</p>
          )}
        </div>
      )}

      {/* Migration Status Table */}
      {migrationStatus.length > 0 && (
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Airtable Table</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Firestore Collection</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Records</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {migrationStatus.map((table, index) => (
                <tr key={index} className="hover:bg-neutral-900/50">
                  <td className="px-4 py-3 text-sm">{table.tableName}</td>
                  <td className="px-4 py-3 text-sm text-neutral-400">{table.firestoreCollection}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {table.recordCount === -1 ? (
                      <span className="text-red-400">Error</span>
                    ) : (
                      table.recordCount
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

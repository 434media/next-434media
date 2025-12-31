"use client"

import { motion } from "motion/react"
import { RefreshCw } from "lucide-react"
import { formatCurrency, formatDate } from "./types"
import type { PipelineColumn } from "./types"

interface PipelineViewProps {
  pipeline: PipelineColumn[]
  onRefresh: () => void
}

export function PipelineView({ pipeline, onRefresh }: PipelineViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Sales Pipeline</h3>
          <p className="text-sm text-neutral-400 mt-1">
            Track deal progression from lead to close. Each column represents a stage in your sales process.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Pipeline Legend */}
      <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span>Lead</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Qualified</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="w-3 h-3 rounded-full bg-violet-500" />
          <span>Proposal</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Negotiation</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Closed Won</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Closed Lost</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {pipeline.map((column) => (
          <div key={column.stage} className="min-w-[250px] md:min-w-0">
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-neutral-900">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: column.color }}
              />
              <span className="text-sm font-medium">{column.label}</span>
              <span className="ml-auto text-xs text-neutral-500">
                {column.opportunities.length}
              </span>
            </div>

            {/* Column Total */}
            <div className="mb-3 p-2 rounded-lg bg-neutral-800/50 text-center">
              <p className="text-xs text-neutral-400">Total Value</p>
              <p className="text-sm font-semibold">{formatCurrency(column.totalValue)}</p>
            </div>

            {/* Opportunity Cards */}
            <div className="space-y-2">
              {column.opportunities.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-neutral-700 text-center text-sm text-neutral-500">
                  No opportunities
                </div>
              ) : (
                column.opportunities.map((opp) => (
                  <motion.div
                    key={opp.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium mb-1 line-clamp-1">{opp.name}</p>
                    {opp.client_name && (
                      <p className="text-xs text-neutral-400 mb-2">{opp.client_name}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400">
                        {formatCurrency(opp.value || 0)}
                      </span>
                      {opp.expected_close_date && (
                        <span className="text-xs text-neutral-500">
                          {formatDate(opp.expected_close_date)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

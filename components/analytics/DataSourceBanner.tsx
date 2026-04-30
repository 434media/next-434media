"use client"

import { Database, Zap } from "lucide-react"

interface DataSourceBannerProps {
  dataSource: "snapshot" | "live"
  snapshotMeta: { snapshotDate: string; generatedAt: string } | null
  onToggle: (next: "snapshot" | "live") => void
}

function formatGenerated(generatedAt: string): string {
  try {
    const d = new Date(generatedAt)
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return generatedAt
  }
}

export function DataSourceBanner({ dataSource, snapshotMeta, onToggle }: DataSourceBannerProps) {
  const isSnapshot = dataSource === "snapshot"
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[12px] ${
        isSnapshot
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-amber-50 border-amber-200 text-amber-800"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isSnapshot ? <Database className="w-3.5 h-3.5 shrink-0" /> : <Zap className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">
          {isSnapshot
            ? snapshotMeta
              ? `Cached snapshot from ${formatGenerated(snapshotMeta.generatedAt)} (${snapshotMeta.snapshotDate})`
              : "Loading from cached snapshot…"
            : "Showing live data — fetched from upstream APIs on every request"}
        </span>
      </div>
      <button
        onClick={() => onToggle(isSnapshot ? "live" : "snapshot")}
        className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
          isSnapshot
            ? "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
            : "bg-white text-amber-800 border border-amber-200 hover:bg-amber-100"
        }`}
      >
        {isSnapshot ? "Refresh from live" : "Use cached snapshot"}
      </button>
    </div>
  )
}

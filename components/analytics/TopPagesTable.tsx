"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { FileText, Loader2, ExternalLink } from "lucide-react"
import type { DateRange, AnalyticsFilters } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"
import { DashboardCard } from "./DashboardCard"

interface TopPagesTableProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  propertyId?: string
  useSnapshot?: boolean
  filters?: AnalyticsFilters
}

interface PageRow {
  path: string
  title: string
  pageViews: number
  sessions: number
  bounceRate: number
  engagementRate: number
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatPct(v: number): string {
  if (!v) return "—"
  return `${(v * 100).toFixed(0)}%`
}

/**
 * Color the engagement rate cell so the eye finds high-engagement pages
 * quickly. Same thresholds the GA4 community uses (>=60% green, 30-60% neutral,
 * <30% amber).
 */
function engagementColor(rate: number): string {
  if (!rate) return "text-neutral-300"
  if (rate >= 0.6) return "text-emerald-700 font-semibold"
  if (rate >= 0.3) return "text-neutral-700"
  return "text-amber-700"
}

export function TopPagesTable({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
  useSnapshot,
  filters,
}: TopPagesTableProps) {
  const [data, setData] = useState<PageRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setIsLoading(true)
      try {
        const url = buildAnalyticsUrl({ endpoint: "toppages", dateRange, propertyId, useSnapshot, filters })
        const response = await fetch(url)
        if (!response.ok) {
          if (response.status >= 500) setError("Failed to load top pages")
          if (!cancelled) setData([])
          return
        }
        const result = await response.json()
        if (!cancelled) setData(result.data ?? [])
      } catch (err) {
        console.warn("[TopPagesTable]", err)
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadData()
    return () => {
      cancelled = true
    }
  }, [dateRange, setError, propertyId, useSnapshot, filters])

  const rows = data.slice(0, 12)
  const totalViews = rows.reduce((sum, r) => sum + r.pageViews, 0)
  const topViews = rows[0]?.pageViews || 1

  return (
    <DashboardCard
      title="Top pages"
      icon={FileText}
      subtitle={`${rows.length} ${rows.length === 1 ? "page" : "pages"} · ${formatNumber(totalViews)} views`}
      flush
    >
      {isLoading || parentLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-xs text-neutral-400">
          No page data for this period
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              <th className="text-left px-4 py-2">Page</th>
              <th className="text-right px-4 py-2 w-24">Views</th>
              <th className="text-right px-4 py-2 w-20">Engaged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => {
              const widthPct = (row.pageViews / topViews) * 100
              const isInternal = row.path.startsWith("/") || !row.path.startsWith("http")
              const href = isInternal ? row.path : row.path
              return (
                <tr key={row.path} className="group hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-2.5 max-w-0">
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-neutral-900 truncate">
                          {row.title || row.path}
                        </div>
                        <div className="text-[11px] text-neutral-400 truncate font-mono">
                          {row.path}
                        </div>
                      </div>
                      {isInternal && row.path && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-neutral-700 transition-opacity shrink-0 mt-0.5"
                          aria-label="Open page"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="text-[13px] font-semibold text-neutral-900 tabular-nums">
                      {formatNumber(row.pageViews)}
                    </div>
                    <div className="mt-0.5 h-0.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neutral-700"
                        style={{ width: `${widthPct.toFixed(1)}%` }}
                      />
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 text-right text-[12px] tabular-nums ${engagementColor(row.engagementRate)}`}>
                    {formatPct(row.engagementRate)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </DashboardCard>
  )
}

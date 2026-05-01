"use client"

import { useEffect, useState } from "react"
import { Search, Loader2, ExternalLink, MousePointer, Eye } from "lucide-react"
import type { DateRange } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"

interface SearchPerformancePanelProps {
  dateRange: DateRange
  propertyId: string
  setError?: (e: string | null) => void
}

interface QueryRow {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface SearchPerformancePayload {
  configured: boolean
  data?: QueryRow[]
  totalClicks?: number
  totalImpressions?: number
  averagePosition?: number
  siteUrl?: string
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatPosition(p: number): string {
  if (!p) return "—"
  return p.toFixed(1)
}

function formatPct(v: number): string {
  if (!v) return "—"
  return `${(v * 100).toFixed(1)}%`
}

/**
 * Color-codes the average position. Top 3 = green, top 10 = neutral,
 * 11-20 = amber, beyond = red. Mirrors how SEO tools surface SERP rank.
 */
function positionColor(p: number): string {
  if (!p) return "text-neutral-300"
  if (p <= 3) return "text-emerald-700 font-semibold"
  if (p <= 10) return "text-neutral-700"
  if (p <= 20) return "text-amber-700"
  return "text-red-700"
}

export function SearchPerformancePanel({
  dateRange,
  propertyId,
  setError,
}: SearchPerformancePanelProps) {
  const [payload, setPayload] = useState<SearchPerformancePayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!propertyId || !dateRange.startDate || !dateRange.endDate) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(
          buildAnalyticsUrl({ endpoint: "search-queries", dateRange, propertyId }),
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as SearchPerformancePayload
        if (!cancelled) setPayload(data)
      } catch (err) {
        if (setError) setError(err instanceof Error ? err.message : "Search Console fetch failed")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [dateRange, propertyId, setError])

  if (isLoading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (!payload?.configured) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
        <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-neutral-700">Search Console not connected</p>
        <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
          Set <span className="font-mono">SEARCH_CONSOLE_SITE_&lt;KEY&gt;</span> in env (e.g.
          <span className="font-mono"> sc-domain:434media.com</span>) and grant the GA4 service
          account read access in Search Console for that site.
        </p>
      </div>
    )
  }

  const rows = payload.data ?? []
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
        <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-neutral-700">No queries in this period</p>
        <p className="text-xs text-neutral-500 mt-1">
          Either no organic traffic, or Search Console hasn't indexed enough data yet.
        </p>
      </div>
    )
  }

  const topClicks = rows.reduce((max, r) => Math.max(max, r.clicks), 1)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Aggregate hero — total clicks, impressions, position */}
      <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-xl p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-blue-600" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            Organic search
          </span>
        </div>
        <div className="text-3xl font-bold text-neutral-900 tabular-nums leading-none">
          {(payload.totalClicks ?? 0).toLocaleString()}
        </div>
        <div className="text-xs text-neutral-500 mt-1">clicks from Google search</div>
        <div className="mt-4 pt-4 border-t border-blue-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-700 inline-flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-neutral-400" /> Impressions
            </span>
            <span className="font-semibold text-neutral-900 tabular-nums">
              {formatNumber(payload.totalImpressions ?? 0)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-700 inline-flex items-center gap-1.5">
              <MousePointer className="w-3 h-3 text-neutral-400" /> Avg CTR
            </span>
            <span className="font-semibold text-neutral-900 tabular-nums">
              {payload.totalImpressions
                ? `${(((payload.totalClicks ?? 0) / payload.totalImpressions) * 100).toFixed(2)}%`
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-700">Avg position</span>
            <span className={`font-semibold tabular-nums ${positionColor(payload.averagePosition ?? 0)}`}>
              {formatPosition(payload.averagePosition ?? 0)}
            </span>
          </div>
        </div>
        {payload.siteUrl && (
          <div className="mt-4 pt-4 border-t border-blue-100">
            <p className="text-[10px] text-neutral-400 truncate" title={payload.siteUrl}>
              {payload.siteUrl}
            </p>
          </div>
        )}
      </div>

      {/* Top queries table */}
      <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100">
          <Search className="w-4 h-4 text-neutral-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Top queries
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                <th className="text-left px-5 py-2">Query</th>
                <th className="text-right px-5 py-2">Clicks</th>
                <th className="text-right px-5 py-2">Impressions</th>
                <th className="text-right px-5 py-2">CTR</th>
                <th className="text-right px-5 py-2">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.slice(0, 12).map((row) => {
                // Inline horizontal bar weighted to the top-clicker for visual scanning
                const barPct = (row.clicks / topClicks) * 100
                return (
                  <tr key={row.query} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-2.5 text-[13px] font-medium text-neutral-900 max-w-xs truncate" title={row.query}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{row.query}</span>
                      </div>
                      <div className="mt-1 w-full h-0.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400" style={{ width: `${barPct.toFixed(1)}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-[13px] text-neutral-900 text-right tabular-nums font-semibold">
                      {row.clicks.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-[12px] text-neutral-500 text-right tabular-nums">
                      {formatNumber(row.impressions)}
                    </td>
                    <td className="px-5 py-2.5 text-[12px] text-neutral-500 text-right tabular-nums">
                      {formatPct(row.ctr)}
                    </td>
                    <td className={`px-5 py-2.5 text-[12px] text-right tabular-nums ${positionColor(row.position)}`}>
                      {formatPosition(row.position)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {payload.siteUrl && (
          <div className="px-5 py-2 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
            <span>Filtered to web search · top 12 of {rows.length}</span>
            <a
              href={`https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(payload.siteUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-neutral-700"
            >
              Open in Search Console
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

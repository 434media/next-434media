"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { Loader2, GitBranch, ChevronDown, ChevronRight } from "lucide-react"
import type { DateRange } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"
import { DashboardCard } from "./DashboardCard"

interface TrafficSourcesChartProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  propertyId?: string
  useSnapshot?: boolean
}

interface SourceRow {
  source: string
  medium: string
  channelGroup: string
  sessions: number
  users: number
  newUsers: number
  engagedSessions: number
  engagementRate: number
}

interface ChannelBucket {
  channel: string
  sessions: number
  users: number
  engagedSessions: number
  engagementRate: number
  rows: SourceRow[]
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatPct(v: number): string {
  if (!v) return "—"
  return `${(v * 100).toFixed(1)}%`
}

/**
 * Bucket raw GA4 source/medium rows by GA4's defaultChannelGrouping.
 * Sessions-weighted average for engagement rate keeps the math correct
 * across grouped rows (raw averaging would overweight tiny sources).
 */
function bucketByChannel(rows: SourceRow[]): ChannelBucket[] {
  const buckets = new Map<string, ChannelBucket>()
  for (const row of rows) {
    const key = row.channelGroup || "Other"
    const existing = buckets.get(key)
    if (existing) {
      existing.sessions += row.sessions
      existing.users += row.users
      existing.engagedSessions += row.engagedSessions
      existing.rows.push(row)
    } else {
      buckets.set(key, {
        channel: key,
        sessions: row.sessions,
        users: row.users,
        engagedSessions: row.engagedSessions,
        engagementRate: 0, // computed in second pass
        rows: [row],
      })
    }
  }
  // Second pass — sessions-weighted engagement rate per bucket
  for (const b of buckets.values()) {
    b.engagementRate = b.sessions > 0 ? b.engagedSessions / b.sessions : 0
    b.rows.sort((a, b) => b.sessions - a.sessions)
  }
  return Array.from(buckets.values()).sort((a, b) => b.sessions - a.sessions)
}

export function TrafficSourcesChart({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
  useSnapshot,
}: TrafficSourcesChartProps) {
  const [data, setData] = useState<SourceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setIsLoading(true)
      try {
        const url = buildAnalyticsUrl({ endpoint: "trafficsources", dateRange, propertyId, useSnapshot })
        const response = await fetch(url)
        if (!response.ok) {
          if (response.status >= 500) setError("Failed to load traffic sources")
          if (!cancelled) setData([])
          return
        }
        const result = await response.json()
        if (!cancelled) setData(result.data ?? [])
      } catch (err) {
        console.warn("[TrafficSourcesChart]", err)
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadData()
    return () => {
      cancelled = true
    }
  }, [dateRange, setError, propertyId, useSnapshot])

  const buckets = useMemo(() => bucketByChannel(data), [data])
  const totalSessions = buckets.reduce((sum, b) => sum + b.sessions, 0)

  const toggle = (channel: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(channel)) next.delete(channel)
      else next.add(channel)
      return next
    })
  }

  return (
    <DashboardCard
      title="Traffic by channel"
      icon={GitBranch}
      subtitle={`${buckets.length} ${buckets.length === 1 ? "channel" : "channels"} · ${formatNumber(totalSessions)} sessions`}
      flush
    >
      {isLoading || parentLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        </div>
      ) : buckets.length === 0 ? (
        <div className="py-12 text-center text-xs text-neutral-400">
          No traffic data for this period
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {buckets.map((bucket) => {
            const share = totalSessions > 0 ? bucket.sessions / totalSessions : 0
            const isExpanded = expanded.has(bucket.channel)
            const drilldownLimit = 5
            return (
              <li key={bucket.channel}>
                <button
                  type="button"
                  onClick={() => toggle(bucket.channel)}
                  className="w-full px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-neutral-400 shrink-0" />
                    )}
                    <span className="text-[13px] font-medium text-neutral-900 min-w-0 flex-1 truncate">
                      {bucket.channel}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {formatPct(bucket.engagementRate)}
                      </span>
                      <span className="text-[13px] font-semibold text-neutral-900 tabular-nums w-16 text-right">
                        {formatNumber(bucket.sessions)}
                      </span>
                      <span className="text-[10px] text-neutral-400 tabular-nums w-12 text-right">
                        {(share * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 ml-6 h-1 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700"
                      style={{ width: `${(share * 100).toFixed(1)}%` }}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="bg-neutral-50/50 border-t border-neutral-100 px-4 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 ml-6">
                      Source / medium
                    </div>
                    <ul className="space-y-1">
                      {bucket.rows.slice(0, drilldownLimit).map((r, i) => {
                        const subShare = bucket.sessions > 0 ? r.sessions / bucket.sessions : 0
                        return (
                          <li key={`${r.source}-${r.medium}-${i}`} className="flex items-center gap-3 ml-6 py-1">
                            <span className="text-[12px] text-neutral-700 min-w-0 flex-1 truncate font-mono">
                              {r.source === "(direct)" ? "Direct" : r.source}
                              {r.medium && r.medium !== "(none)" && (
                                <span className="text-neutral-400"> / {r.medium}</span>
                              )}
                            </span>
                            <span className="text-[11px] text-neutral-700 tabular-nums w-16 text-right">
                              {formatNumber(r.sessions)}
                            </span>
                            <span className="text-[10px] text-neutral-400 tabular-nums w-12 text-right">
                              {(subShare * 100).toFixed(1)}%
                            </span>
                          </li>
                        )
                      })}
                      {bucket.rows.length > drilldownLimit && (
                        <li className="ml-6 py-1 text-[11px] text-neutral-400">
                          +{bucket.rows.length - drilldownLimit} more sources
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </DashboardCard>
  )
}

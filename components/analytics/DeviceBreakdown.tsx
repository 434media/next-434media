"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Smartphone, Monitor, Tablet, Loader2, MonitorSmartphone } from "lucide-react"
import type { DateRange } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"
import { DashboardCard } from "./DashboardCard"

interface DeviceBreakdownProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  propertyId?: string
  useSnapshot?: boolean
}

interface DeviceRow {
  deviceCategory: string
  sessions: number
  users: number
}

// Single neutral palette — three shades to differentiate, no rainbow.
const DEVICE_COLOR: Record<string, string> = {
  mobile: "bg-neutral-800",
  desktop: "bg-neutral-500",
  tablet: "bg-neutral-300",
}
const DEVICE_FALLBACK = "bg-neutral-400"

const DEVICE_ICON = (cat: string) => {
  const norm = cat.toLowerCase()
  if (norm === "mobile") return Smartphone
  if (norm === "desktop") return Monitor
  if (norm === "tablet") return Tablet
  return MonitorSmartphone
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function colorFor(cat: string): string {
  return DEVICE_COLOR[cat.toLowerCase()] ?? DEVICE_FALLBACK
}

export function DeviceBreakdown({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
  useSnapshot,
}: DeviceBreakdownProps) {
  const [data, setData] = useState<DeviceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setIsLoading(true)
      try {
        const url = buildAnalyticsUrl({ endpoint: "devices", dateRange, propertyId, useSnapshot })
        const response = await fetch(url)
        if (!response.ok) {
          if (response.status >= 500) setError("Failed to load device data")
          if (!cancelled) setData([])
          return
        }
        const result = await response.json()
        if (!cancelled) setData(result.data ?? [])
      } catch (err) {
        console.warn("[DeviceBreakdown]", err)
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

  const total = data.reduce((sum, r) => sum + r.sessions, 0)
  const sorted = [...data].sort((a, b) => b.sessions - a.sessions)

  return (
    <DashboardCard
      title="Device types"
      icon={MonitorSmartphone}
      subtitle={`${formatNumber(total)} sessions`}
    >
      {isLoading || parentLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-400">
          No device data for this period
        </div>
      ) : (
        <div className="space-y-3">
          {/* Stacked horizontal bar — single, dense, scannable */}
          <div className="flex h-2 rounded-full overflow-hidden bg-neutral-100">
            {sorted.map((row) => {
              const pct = total > 0 ? (row.sessions / total) * 100 : 0
              if (pct === 0) return null
              return (
                <div
                  key={row.deviceCategory}
                  className={colorFor(row.deviceCategory)}
                  style={{ width: `${pct.toFixed(2)}%` }}
                  title={`${row.deviceCategory}: ${pct.toFixed(1)}%`}
                />
              )
            })}
          </div>

          {/* Legend rows */}
          <ul className="divide-y divide-neutral-100">
            {sorted.map((row) => {
              const pct = total > 0 ? (row.sessions / total) * 100 : 0
              const Icon = DEVICE_ICON(row.deviceCategory)
              return (
                <li
                  key={row.deviceCategory}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${colorFor(row.deviceCategory)} shrink-0`} />
                  <Icon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="text-[13px] font-medium text-neutral-900 capitalize flex-1 truncate">
                    {row.deviceCategory}
                  </span>
                  <span className="text-[11px] text-neutral-500 tabular-nums w-20 text-right">
                    {formatNumber(row.sessions)} sessions
                  </span>
                  <span className="text-[13px] font-semibold text-neutral-900 tabular-nums w-12 text-right">
                    {pct.toFixed(1)}%
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </DashboardCard>
  )
}

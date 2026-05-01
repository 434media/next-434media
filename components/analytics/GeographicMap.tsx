"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { Globe, Loader2, MapPin } from "lucide-react"
import type { DateRange } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"
import { DashboardCard } from "./DashboardCard"

interface GeographicMapProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  propertyId?: string
  useSnapshot?: boolean
}

interface GeographicRow {
  country: string
  city: string
  sessions: number
  users: number
  newUsers: number
}

interface AggregatedRow {
  label: string
  /** For city rows, the country adds context. Empty for country-level rows. */
  context?: string
  sessions: number
  newUsers: number
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

/**
 * Aggregate raw country/city rows into country-level totals (since GA4
 * returns one row per country/city pair). Same for city-level — pass through
 * with country attached as context.
 */
function aggregateGeographic(rows: GeographicRow[]): { countries: AggregatedRow[]; cities: AggregatedRow[] } {
  const countryMap = new Map<string, AggregatedRow>()
  const cities: AggregatedRow[] = []

  for (const row of rows) {
    if (!row.country || row.country === "(not set)") continue

    const existing = countryMap.get(row.country)
    if (existing) {
      existing.sessions += row.sessions
      existing.newUsers += row.newUsers
    } else {
      countryMap.set(row.country, {
        label: row.country,
        sessions: row.sessions,
        newUsers: row.newUsers,
      })
    }

    if (row.city && row.city !== "(not set)") {
      cities.push({
        label: row.city,
        context: row.country,
        sessions: row.sessions,
        newUsers: row.newUsers,
      })
    }
  }

  return {
    countries: Array.from(countryMap.values()).sort((a, b) => b.sessions - a.sessions),
    cities: cities.sort((a, b) => b.sessions - a.sessions),
  }
}

export function GeographicMap({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
  useSnapshot,
}: GeographicMapProps) {
  const [data, setData] = useState<GeographicRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setIsLoading(true)
      try {
        const url = buildAnalyticsUrl({ endpoint: "geographic", dateRange, propertyId, useSnapshot })
        const response = await fetch(url)
        if (!response.ok) {
          if (response.status >= 500) setError("Failed to load geographic data")
          if (!cancelled) setData([])
          return
        }
        const result = await response.json()
        if (!cancelled) setData(result.data ?? [])
      } catch (err) {
        console.warn("[GeographicMap]", err)
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

  const { countries, cities } = useMemo(() => aggregateGeographic(data), [data])
  const totalSessions = countries.reduce((sum, c) => sum + c.sessions, 0)

  return (
    <DashboardCard
      title="Geographic distribution"
      icon={Globe}
      subtitle={`${countries.length} ${countries.length === 1 ? "country" : "countries"} · ${cities.length} ${cities.length === 1 ? "city" : "cities"}`}
      flush
    >
      {isLoading || parentLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        </div>
      ) : countries.length === 0 ? (
        <div className="py-12 text-center text-xs text-neutral-400">
          No geographic data for this period
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
          <GeoSection
            heading="Top countries"
            icon={Globe}
            rows={countries.slice(0, 8)}
            totalSessions={totalSessions}
          />
          <GeoSection
            heading="Top cities"
            icon={MapPin}
            rows={cities.slice(0, 8)}
            totalSessions={totalSessions}
          />
        </div>
      )}
    </DashboardCard>
  )
}

function GeoSection({
  heading,
  icon: Icon,
  rows,
  totalSessions,
}: {
  heading: string
  icon: React.ComponentType<{ className?: string }>
  rows: AggregatedRow[]
  totalSessions: number
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-100 bg-neutral-50/50">
        <Icon className="w-3.5 h-3.5 text-neutral-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          {heading}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-[11px] text-neutral-400">No data</div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map((row) => {
            const share = totalSessions > 0 ? row.sessions / totalSessions : 0
            return (
              <li key={`${row.label}-${row.context ?? ""}`} className="px-4 py-2.5 hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-neutral-900 truncate">
                      {row.label}
                    </div>
                    {row.context && (
                      <div className="text-[10px] text-neutral-400 truncate">{row.context}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-semibold text-neutral-900 tabular-nums w-14 text-right">
                      {formatNumber(row.sessions)}
                    </span>
                    <span className="text-[10px] text-neutral-400 tabular-nums w-10 text-right">
                      {(share * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 h-0.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neutral-700"
                    style={{ width: `${(share * 100).toFixed(1)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Globe, ExternalLink, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { buildAnalyticsUrl } from "@/lib/analytics-url"
import type { DateRange } from "@/types/analytics"
import type { PortfolioBrandRow } from "@/app/admin/analytics-portfolio/PortfolioAnalyticsClientPage"

interface PageRow {
  path: string
  title: string
  pageViews: number
  sessions: number
  bounceRate: number
  engagementRate: number
}

interface BrandPeekDrawerWebProps {
  open: boolean
  onClose: () => void
  brand: PortfolioBrandRow | null
  dateRange: DateRange
}

export function BrandPeekDrawerWeb({
  open,
  onClose,
  brand,
  dateRange,
}: BrandPeekDrawerWebProps) {
  const [pages, setPages] = useState<PageRow[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !brand) return
    let cancelled = false
    setIsLoading(true)
    setPages(null)

    fetch(
      buildAnalyticsUrl({
        endpoint: "toppages",
        dateRange,
        propertyId: brand.propertyId,
      }),
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((payload: { data?: PageRow[] }) => {
        if (!cancelled) setPages(payload.data?.slice(0, 5) ?? [])
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[BrandPeekDrawerWeb]", err)
          setPages([])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, brand?.propertyId, dateRange.startDate, dateRange.endDate])

  const fullDashboardUrl = brand
    ? `/admin/analytics-web?range=30d&property=${encodeURIComponent(brand.propertyId)}`
    : "#"

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="truncate">{brand?.name ?? "Property"}</span>
        </span>
      }
      subtitle={brand ? `Property ID ${brand.propertyId}` : undefined}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] font-medium text-neutral-600 hover:text-neutral-900"
          >
            Close
          </button>
          <Link
            href={fullDashboardUrl}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
          >
            Open full dashboard
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      }
    >
      {brand && (
        <div className="p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Sessions"
              value={brand.totalSessions.toLocaleString()}
              change={brand.sessionsChange}
            />
            <StatTile
              label="Users"
              value={brand.totalUsers.toLocaleString()}
              change={brand.usersChange}
            />
            <StatTile
              label="Page views"
              value={brand.totalPageViews.toLocaleString()}
              change={brand.pageViewsChange}
            />
            <StatTile
              label="Engagement rate"
              value={`${(brand.engagementRate * 100).toFixed(1)}%`}
              change={brand.engagementRateChange}
            />
          </div>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Top pages · {dateRange.label}
            </h3>
            {isLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-neutral-100 rounded animate-pulse" />
                ))}
              </div>
            ) : pages && pages.length > 0 ? (
              <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden">
                {pages.map((page) => (
                  <li
                    key={page.path}
                    className="px-3 py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-neutral-900 truncate">
                        {page.title || page.path}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate font-mono">
                        {page.path}
                      </div>
                    </div>
                    <div className="text-[13px] font-semibold text-neutral-900 tabular-nums shrink-0">
                      {page.pageViews.toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-400 italic">No top pages data.</p>
            )}
          </section>
        </div>
      )}
    </DetailDrawer>
  )
}

interface StatTileProps {
  label: string
  value: string
  change: number
}

function StatTile({ label, value, change }: StatTileProps) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          {label}
        </span>
        <DeltaBadge change={change} />
      </div>
      <div className="text-xl font-bold text-neutral-900 tabular-nums mt-1 truncate">
        {value}
      </div>
    </div>
  )
}

function DeltaBadge({ change }: { change: number }) {
  if (!change) return <span className="text-[10px] text-neutral-300">—</span>
  const isUp = change > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
        isUp ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {isUp ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  )
}

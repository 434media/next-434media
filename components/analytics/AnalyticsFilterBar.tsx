"use client"

import { useEffect, useRef, useState } from "react"
import { Smartphone, Globe, Filter, ChevronDown, X } from "lucide-react"
import type { AnalyticsFilters, DateRange } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters
  onFiltersChange: (next: AnalyticsFilters) => void
  /** Used to fetch the country options dynamically from the geographic endpoint. */
  dateRange: DateRange
  propertyId: string
}

// GA4 device categories — closed enum
const DEVICE_OPTIONS = [
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
]

// GA4 default channel grouping — stable list
const CHANNEL_OPTIONS = [
  { value: "Direct", label: "Direct" },
  { value: "Organic Search", label: "Organic Search" },
  { value: "Paid Search", label: "Paid Search" },
  { value: "Organic Social", label: "Organic Social" },
  { value: "Paid Social", label: "Paid Social" },
  { value: "Email", label: "Email" },
  { value: "Referral", label: "Referral" },
  { value: "Display", label: "Display" },
  { value: "Other", label: "Other" },
]

export function AnalyticsFilterBar({
  filters,
  onFiltersChange,
  dateRange,
  propertyId,
}: AnalyticsFilterBarProps) {
  const [countryOptions, setCountryOptions] = useState<string[]>([])

  // Pull top countries from the existing geographic endpoint to populate
  // the country dropdown. Stays in sync with what's currently visible on
  // the geographic chart.
  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(buildAnalyticsUrl({ endpoint: "geographic", dateRange, propertyId }))
        if (!res.ok) return
        const data = await res.json()
        const seen = new Set<string>()
        const unique: string[] = []
        for (const row of (data.data ?? []) as Array<{ country?: string }>) {
          if (!row.country) continue
          if (seen.has(row.country)) continue
          seen.add(row.country)
          unique.push(row.country)
          if (unique.length >= 20) break
        }
        if (!cancelled) setCountryOptions(unique)
      } catch {
        /* silent — country dropdown is non-critical */
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [dateRange, propertyId])

  const activeCount =
    (filters.deviceCategory ? 1 : 0) + (filters.channelGroup ? 1 : 0) + (filters.country ? 1 : 0)

  const clearAll = () => onFiltersChange({})

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-3 py-2 mb-4 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 pr-1">
        <Filter className="w-3.5 h-3.5" />
        Filter audience
      </div>

      <FilterChip
        label="Device"
        icon={Smartphone}
        value={filters.deviceCategory}
        options={DEVICE_OPTIONS}
        onChange={(v) => onFiltersChange({ ...filters, deviceCategory: v || undefined })}
      />

      <FilterChip
        label="Channel"
        icon={Filter}
        value={filters.channelGroup}
        options={CHANNEL_OPTIONS}
        onChange={(v) => onFiltersChange({ ...filters, channelGroup: v || undefined })}
      />

      <FilterChip
        label="Country"
        icon={Globe}
        value={filters.country}
        options={countryOptions.map((c) => ({ value: c, label: c }))}
        onChange={(v) => onFiltersChange({ ...filters, country: v || undefined })}
        emptyHint={countryOptions.length === 0 ? "Loading…" : undefined}
      />

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded"
        >
          <X className="w-3 h-3" />
          Clear all
        </button>
      )}
    </div>
  )
}

interface FilterChipProps {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value: string | undefined
  options: Array<{ value: string; label: string }>
  onChange: (next: string) => void
  emptyHint?: string
}

function FilterChip({ label, icon: Icon, value, options, onChange, emptyHint }: FilterChipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = !!value

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const displayValue = value && options.find((o) => o.value === value)?.label

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors border ${
          isActive
            ? "bg-neutral-900 text-white border-neutral-900"
            : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
        }`}
      >
        <Icon className="w-3 h-3" />
        {label}
        {isActive && (
          <>
            <span className="text-neutral-400">·</span>
            <span className="text-white">{displayValue}</span>
          </>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[160px] max-h-[260px] overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
          {/* "Any" / clear option always at the top */}
          <button
            type="button"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
            className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-neutral-50 ${
              !isActive ? "font-semibold text-neutral-900" : "text-neutral-600"
            }`}
          >
            Any {label.toLowerCase()}
          </button>

          {options.length === 0 && emptyHint && (
            <div className="px-3 py-1.5 text-[11px] text-neutral-400 italic">{emptyHint}</div>
          )}

          {options.map((opt) => {
            const selected = value === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-neutral-50 ${
                  selected ? "font-semibold text-neutral-900 bg-neutral-50" : "text-neutral-700"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

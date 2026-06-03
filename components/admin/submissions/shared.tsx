"use client"

import { useState } from "react"
import { Loader2, Download, ChevronDown, Calendar, Check } from "lucide-react"

// =====================================================================
// Sprint B — export menu. Single button + dropdown collapses the three
// previous CSV controls (Export All in header, Download Filtered in the
// summary line, CSV in the table footer) into one canonical surface.
// =====================================================================

export interface ExportMenuProps {
  disabled?: boolean
  isDownloading?: boolean
  allCount: number
  filteredCount: number
  selectedCount: number
  onExportAll: () => void
  onExportFiltered: () => void
  onExportSelected: () => void
}

export function ExportMenu({
  disabled,
  isDownloading,
  allCount,
  filteredCount,
  selectedCount,
  onExportAll,
  onExportFiltered,
  onExportSelected,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  // Filtered is only a useful option when it differs from the All count.
  // Selected is only useful when something is selected.
  const filteredDiffers = filteredCount !== allCount
  const hasSelection = selectedCount > 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isDownloading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-56 py-1 rounded-md border border-neutral-200 bg-white shadow-md"
        >
          <ExportMenuItem
            label="Export all"
            count={allCount}
            onClick={() => {
              setOpen(false)
              onExportAll()
            }}
          />
          {filteredDiffers && (
            <ExportMenuItem
              label="Export filtered"
              count={filteredCount}
              onClick={() => {
                setOpen(false)
                onExportFiltered()
              }}
            />
          )}
          {hasSelection && (
            <ExportMenuItem
              label="Export selected"
              count={selectedCount}
              onClick={() => {
                setOpen(false)
                onExportSelected()
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ExportMenuItem({
  label,
  count,
  onClick,
}: {
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[12px] hover:bg-neutral-50 transition-colors text-left"
    >
      <span className="text-neutral-700">{label}</span>
      <span className="text-[11px] text-neutral-400 tabular-nums">
        {count.toLocaleString()}
      </span>
    </button>
  )
}

// =====================================================================
// Date range dropdown — one trigger (Vercel-style) instead of a row of
// preset chips. The button shows the active range ("Last 30 days" / "All
// time" / "Custom"); the menu holds the presets + a custom from/to range.
// =====================================================================

export interface DateRangeDropdownProps {
  preset: string
  startDate: string
  endDate: string
  onPresetChange: (preset: string) => void
  onCustomChange: (start: string, end: string) => void
  onClear: () => void
}

const DATE_CHIPS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 days" },
  { value: "last30days", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
]

export function DateRangeDropdown({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onCustomChange,
  onClear,
}: DateRangeDropdownProps) {
  const [open, setOpen] = useState(false)
  const customActive = preset === "custom" || (preset === "" && (!!startDate || !!endDate))
  const anyActive = !!preset || !!startDate || !!endDate
  const activeChip = DATE_CHIPS.find((c) => c.value === preset)
  const label = activeChip ? activeChip.label : customActive ? "Custom" : "All time"

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded transition-colors ${
          anyActive
            ? "bg-neutral-900 text-white"
            : "bg-white text-neutral-600 border border-neutral-200/70 hover:bg-neutral-50 hover:text-neutral-900"
        }`}
      >
        <Calendar className={`w-3.5 h-3.5 ${anyActive ? "opacity-80" : "text-neutral-400"}`} />
        {label}
        <ChevronDown className={`w-3 h-3 ${anyActive ? "opacity-70" : "text-neutral-400"}`} />
      </button>

      {open && (
        <>
          {/* Click-away backdrop — keeps the custom date inputs focusable
              (an onBlur-close would fire the moment you click into one). */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-20 w-56 py-1 rounded-md border border-neutral-200 bg-white shadow-md"
          >
            {DATE_CHIPS.map((chip) => {
              const active = preset === chip.value
              return (
                <button
                  key={chip.value}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onPresetChange(active ? "" : chip.value)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-[12px] hover:bg-neutral-50 transition-colors ${
                    active ? "text-neutral-900 font-medium" : "text-neutral-600"
                  }`}
                >
                  {chip.label}
                  {active && <Check className="w-3.5 h-3.5 text-neutral-900" />}
                </button>
              )
            })}

            <div className="my-1 border-t border-neutral-100" />

            {/* Custom range — reveals two date inputs inline in the menu. */}
            <button
              type="button"
              role="menuitem"
              onClick={() => onPresetChange("custom")}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[12px] hover:bg-neutral-50 transition-colors ${
                customActive ? "text-neutral-900 font-medium" : "text-neutral-600"
              }`}
            >
              Custom range
              {customActive && <Check className="w-3.5 h-3.5 text-neutral-900" />}
            </button>
            {customActive && (
              <div className="px-3 py-2 space-y-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onCustomChange(e.target.value, endDate)}
                  className="w-full px-2.5 py-1 text-[12px] font-normal text-neutral-700 bg-white border border-neutral-200/70 rounded focus:outline-none focus:border-neutral-400"
                  aria-label="Start date"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onCustomChange(startDate, e.target.value)}
                  className="w-full px-2.5 py-1 text-[12px] font-normal text-neutral-700 bg-white border border-neutral-200/70 rounded focus:outline-none focus:border-neutral-400"
                  aria-label="End date"
                />
              </div>
            )}

            {anyActive && (
              <>
                <div className="my-1 border-t border-neutral-100" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onClear()
                    setOpen(false)
                  }}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors"
                >
                  Clear · All time
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// =====================================================================
// Detail drawer helpers — Linear-style flat field rows + slim inputs.
// =====================================================================

export interface DetailRowProps {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}

export function DetailRow({ label, icon: Icon, children }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-24 shrink-0 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
        {Icon && <Icon className="w-3 h-3 text-neutral-400" />}
        {label}
      </div>
      <div className="min-w-0 flex-1 text-neutral-800">{children}</div>
    </div>
  )
}

export interface FieldInputProps {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  type?: string
}

export function FieldInput({ label, value, onChange, type = "text" }: FieldInputProps) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 text-[13px] text-neutral-800"
      />
    </div>
  )
}

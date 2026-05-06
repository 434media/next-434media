"use client"

import { useState } from "react"
import { Loader2, Download, ChevronDown } from "lucide-react"

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
// Sprint B — date preset chips. Replaces the date-range dropdown with a
// row of clickable chips: Today · 7d · 30d · This month · Custom. Active
// preset gets a filled neutral-900 chip; idle chips are ghosts. "Custom"
// reveals two date inputs inline + a Clear button.
// =====================================================================

export interface DatePresetChipsProps {
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
  { value: "last7days", label: "7d" },
  { value: "last30days", label: "30d" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
]

export function DatePresetChips({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onCustomChange,
  onClear,
}: DatePresetChipsProps) {
  const customActive = preset === "custom" || (preset === "" && (!!startDate || !!endDate))
  const anyActive = !!preset || !!startDate || !!endDate

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {DATE_CHIPS.map((chip) => {
          const active = preset === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onPresetChange(active ? "" : chip.value)}
              className={`px-2.5 py-1 text-[12px] font-medium rounded transition-colors ${
                active
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 border border-neutral-200/70 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              {chip.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => {
            // Toggle custom mode. When activating, leave dates blank — user
            // picks them. When deactivating, clear everything.
            if (customActive) onClear()
            else onPresetChange("custom")
          }}
          className={`px-2.5 py-1 text-[12px] font-medium rounded transition-colors ${
            customActive
              ? "bg-neutral-900 text-white"
              : "bg-white text-neutral-600 border border-neutral-200/70 hover:bg-neutral-50 hover:text-neutral-900"
          }`}
        >
          Custom
        </button>
        {anyActive && (
          <button
            type="button"
            onClick={onClear}
            className="px-2 py-1 text-[12px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Custom range inputs — only render when "Custom" is active. */}
      {customActive && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onCustomChange(e.target.value, endDate)}
            className="flex-1 min-w-[10rem] px-2.5 py-2 sm:py-1 text-[13px] sm:text-[12px] font-normal text-neutral-700 bg-white border border-neutral-200/70 rounded focus:outline-none focus:border-neutral-400"
            aria-label="Start date"
          />
          <span className="text-[12px] text-neutral-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onCustomChange(startDate, e.target.value)}
            className="flex-1 min-w-[10rem] px-2.5 py-2 sm:py-1 text-[13px] sm:text-[12px] font-normal text-neutral-700 bg-white border border-neutral-200/70 rounded focus:outline-none focus:border-neutral-400"
            aria-label="End date"
          />
        </div>
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

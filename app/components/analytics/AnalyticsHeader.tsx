"use client"

import { useState } from "react"
import { Button } from "./Button"
import { 
  Loader2, 
  ChevronDown, 
  Globe, 
  Calendar,
  CalendarDays,
  FileText,
  Image,
  Download
} from "lucide-react"
import type { AnalyticsProperty, DateRange } from "../../types/analytics"

interface AnalyticsHeaderProps {
  // Dashboard controls
  isLoading?: boolean
  availableProperties?: AnalyticsProperty[]
  selectedPropertyId?: string
  onPropertyChange?: (propertyId: string) => void
  // Date range
  selectedRange: DateRange
  onRangeChange: (range: DateRange) => void
  // Download options
  onDownloadCSV?: () => void
  onDownloadPNG?: () => void
}

const dateRangeOptions: DateRange[] = [
  { startDate: "today", endDate: "today", label: "Today" },
  { startDate: "7daysAgo", endDate: "today", label: "Last 7 days" },
  { startDate: "30daysAgo", endDate: "today", label: "Last 30 days" },
  { startDate: "90daysAgo", endDate: "today", label: "Last 90 days" },
]

export function AnalyticsHeader({
  isLoading = false,
  availableProperties = [],
  selectedPropertyId = "",
  onPropertyChange,
  selectedRange,
  onRangeChange,
  onDownloadCSV,
  onDownloadPNG,
}: AnalyticsHeaderProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  const selectedProperty = availableProperties.find((p) => p.id === selectedPropertyId)
  const isPropertiesLoading = !availableProperties.length && onPropertyChange

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      const customRange: DateRange = {
        startDate: customStartDate,
        endDate: customEndDate,
        label: `${customStartDate} to ${customEndDate}`,
      }
      onRangeChange(customRange)
      setShowCustom(false)
    }
  }

  const formatDateForInput = (dateString: string) => {
    if (dateString === "today") return new Date().toISOString().split("T")[0]
    if (dateString.includes("daysAgo")) {
      const days = Number.parseInt(dateString.replace("daysAgo", ""))
      const date = new Date()
      date.setDate(date.getDate() - days)
      return date.toISOString().split("T")[0]
    }
    return dateString
  }

  return (
    <div className="bg-white border-b border-neutral-200 w-full pt-20 relative z-10">
      {/* Main Header Row */}
      <div className="px-4 sm:px-5 lg:px-6 w-full">
        <div className="flex flex-col gap-4 py-4 sm:py-5">
          {/* Top section: Title and Export Actions */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Title with GA4 Icon */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg sm:rounded-xl border border-neutral-200 shrink-0">
                <GA4Icon className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg font-bold text-neutral-900 truncate leading-tight">
                  {selectedProperty?.name || "Analytics Dashboard"}
                </h1>
                <p className="text-neutral-500 text-xs sm:text-sm font-medium truncate leading-snug mt-0.5">
                  {selectedRange.label} • {selectedPropertyId ? `ID: ${selectedPropertyId}` : "Select a property"}
                </p>
              </div>
            </div>

            {/* Right: Export Actions */}
            {(onDownloadCSV || onDownloadPNG) && (
              <div className="flex items-center gap-2 shrink-0">
                {onDownloadCSV && (
                  <button
                    onClick={onDownloadCSV}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-neutral-700 hover:text-emerald-600 bg-neutral-100 hover:bg-emerald-50 rounded-lg border border-neutral-200 hover:border-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export as CSV"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">CSV</span>
                  </button>
                )}
                {onDownloadPNG && (
                  <button
                    onClick={onDownloadPNG}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg border border-emerald-600 hover:border-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export as PNG"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">PNG</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Property Selector - Full width */}
          {onPropertyChange && (
            <div className="w-full">
              {isPropertiesLoading ? (
                <div className="bg-neutral-100 border border-neutral-200 text-neutral-900 rounded-lg px-3 py-2.5 text-sm flex items-center">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span className="text-neutral-500 font-medium">Loading properties...</span>
                </div>
              ) : availableProperties.length > 0 ? (
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-600 pointer-events-none z-10" />
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => onPropertyChange(e.target.value)}
                    className="bg-neutral-100 border border-neutral-200 text-neutral-900 rounded-lg pl-10 pr-10 py-2.5 text-sm font-medium hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer w-full transition-colors"
                  >
                    {!selectedPropertyId && (
                      <option value="" className="bg-white text-neutral-500">
                        Select Property
                      </option>
                    )}
                    {availableProperties.map((property) => (
                      <option key={property.id} value={property.id} className="bg-white text-neutral-900">
                        {property.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Date Range Options */}
      <div className="border-t border-neutral-100 bg-neutral-50 w-full">
        <div className="px-4 sm:px-5 lg:px-6 py-3 w-full">
          {/* Date Range Options - Wrap on mobile */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
            {dateRangeOptions.map((option) => (
              <button
                key={option.label}
                onClick={() => onRangeChange(option)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                  selectedRange.label === option.label
                    ? "bg-emerald-600 text-white border border-emerald-600"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(!showCustom)}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                showCustom
                  ? "bg-emerald-600 text-white border border-emerald-600"
                  : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Custom
            </button>
          </div>
        </div>
      </div>

      {/* Custom Date Range Picker - Expandable with CSS transition */}
      <div
        className={`overflow-hidden border-t border-neutral-100 transition-all duration-200 ease-in-out ${
          showCustom ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 max-w-xl">
            <div className="flex-1 space-y-1.5 w-full sm:w-auto">
              <label className="text-neutral-500 text-xs font-medium">Start Date</label>
              <input
                type="date"
                value={customStartDate || formatDateForInput(selectedRange.startDate)}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="flex-1 space-y-1.5 w-full sm:w-auto">
              <label className="text-neutral-500 text-xs font-medium">End Date</label>
              <input
                type="date"
                value={customEndDate || formatDateForInput(selectedRange.endDate)}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCustomDateApply}
                disabled={!customStartDate || !customEndDate}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </Button>
              <Button
                onClick={() => setShowCustom(false)}
                variant="outline"
                size="sm"
                className="bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// GA4 SVG icon
function GA4Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M22.84 2.998v17.999a2.983 2.983 0 01-2.967 2.998 2.98 2.98 0 01-.368-.02 3.06 3.06 0 01-2.61-3.1V3.12A3.06 3.06 0 0119.51.02a2.983 2.983 0 013.329 2.978zM4.133 18.055a2.973 2.973 0 100 5.945 2.973 2.973 0 000-5.945zm7.872-9.01h-.05a3.06 3.06 0 00-2.892 3.126v7.985c0 2.167.954 3.482 2.35 3.763a2.978 2.978 0 003.57-2.927v-8.959a2.983 2.983 0 00-2.978-2.988z" />
    </svg>
  )
}

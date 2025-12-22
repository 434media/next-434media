"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "./Button"
import { 
  RefreshCw, 
  LogOut, 
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
  onRefresh: () => void
  onLogout: () => void
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
  onRefresh,
  onLogout,
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
    <div className="bg-black border-b border-white/10 overflow-hidden w-full max-w-full">
      {/* Top Row: Title, Property Selector, Actions */}
      <div className="mx-auto px-3 sm:px-4 max-w-7xl overflow-hidden w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 py-3 sm:py-4">
          {/* Left: Title and Property */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-lg sm:rounded-xl border border-white/10 shrink-0">
                <GA4Icon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-white truncate">
                  {selectedProperty?.name || "Analytics Dashboard"}
                </h1>
                <p className="text-white/50 text-[10px] sm:text-xs truncate">
                  {selectedPropertyId ? `ID: ${selectedPropertyId}` : "Select a property"}
                </p>
              </div>
            </div>

            {/* Property Selector */}
            {onPropertyChange && (
              <div className="relative w-full sm:w-auto sm:min-w-[160px]">
                {isPropertiesLoading ? (
                  <div className="bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span className="text-white/50">Loading...</span>
                  </div>
                ) : availableProperties.length > 0 ? (
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-400 pointer-events-none z-10" />
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => onPropertyChange(e.target.value)}
                      className="bg-white/5 border border-white/10 text-white rounded-lg pl-9 pr-8 py-2 text-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer w-full transition-colors"
                    >
                      {!selectedPropertyId && (
                        <option value="" className="bg-neutral-900 text-white/50">
                          Select Property
                        </option>
                      )}
                      {availableProperties.map((property) => (
                        <option key={property.id} value={property.id} className="bg-neutral-900 text-white">
                          {property.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors"
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>

            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Date Range and Download - This is the sticky part */}
      <div className="border-t border-white/5 bg-neutral-950/80 backdrop-blur-md overflow-hidden w-full">
        <div className="mx-auto px-3 sm:px-4 max-w-7xl py-2 sm:py-3 overflow-hidden w-full">
          <div className="flex flex-col gap-2 sm:gap-3">
            {/* Date Range Options - Wrap on mobile, no horizontal scroll */}
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-400 hidden sm:block shrink-0" />
              {dateRangeOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => onRangeChange(option)}
                  className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-sm rounded-lg transition-all whitespace-nowrap ${
                    selectedRange.label === option.label
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/5 text-white/70 border border-transparent hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                onClick={() => setShowCustom(!showCustom)}
                className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-sm rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  showCustom
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-white/70 border border-transparent hover:bg-white/10 hover:text-white"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Custom
              </button>
            </div>

            {/* Download Options */}
            {(onDownloadCSV || onDownloadPNG) && (
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-xs hidden sm:block">Export:</span>
                {onDownloadCSV && (
                  <button
                    onClick={onDownloadCSV}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/60 hover:text-emerald-400 bg-white/5 hover:bg-emerald-500/10 rounded-lg border border-white/10 hover:border-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download CSV"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>CSV</span>
                  </button>
                )}
                {onDownloadPNG && (
                  <button
                    onClick={onDownloadPNG}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/60 hover:text-emerald-400 bg-white/5 hover:bg-emerald-500/10 rounded-lg border border-white/10 hover:border-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download PNG"
                  >
                    <Image className="h-3.5 w-3.5" />
                    <span>PNG</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Date Range Picker - Expandable */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="container mx-auto px-4 max-w-7xl py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 max-w-xl">
                <div className="flex-1 space-y-1.5 w-full sm:w-auto">
                  <label className="text-white/60 text-xs font-medium">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate || formatDateForInput(selectedRange.startDate)}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <div className="flex-1 space-y-1.5 w-full sm:w-auto">
                  <label className="text-white/60 text-xs font-medium">End Date</label>
                  <input
                    type="date"
                    value={customEndDate || formatDateForInput(selectedRange.endDate)}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
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
                    className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

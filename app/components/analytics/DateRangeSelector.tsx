"use client"

import { useState } from "react"
import { Button } from "./Button"
import { Calendar, Clock, CalendarDays, FileText, Image } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface DateRangeSelectorProps {
  selectedRange: DateRange
  onRangeChange: (range: DateRange) => void
  onDownloadCSV?: () => void
  onDownloadPNG?: () => void
  isLoading?: boolean
}

const dateRangeOptions: DateRange[] = [
  { startDate: "today", endDate: "today", label: "Today" },
  { startDate: "7daysAgo", endDate: "today", label: "Last 7 days" },
  { startDate: "30daysAgo", endDate: "today", label: "Last 30 days" },
  { startDate: "90daysAgo", endDate: "today", label: "Last 90 days" },
]

export function DateRangeSelector({ selectedRange, onRangeChange, onDownloadCSV, onDownloadPNG, isLoading = false }: DateRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

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
    <div className="space-y-3">
      {/* Main Date Range Selector */}
      <div
        className="p-6 bg-gradient-to-r from-emerald-50 to-white rounded-xl border border-neutral-200 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 bg-emerald-100 rounded-xl shadow-sm transition-transform duration-200 hover:scale-105"
              style={{ willChange: "transform" }}
            >
              <Calendar className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-neutral-900 text-xl font-bold mb-1">Date Range</h3>
              <p className="text-neutral-500 text-sm font-medium">Select your analytics period</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1">
          {dateRangeOptions.map((option, index) => (
            <div key={option.label}>
              <Button
                onClick={() => onRangeChange(option)}
                variant={selectedRange.label === option.label ? "default" : "outline"}
                size="sm"
                className={`relative transition-all duration-300 hover:scale-105 ${
                  selectedRange.label === option.label
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white border-0 shadow-lg"
                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900"
                }`}
              >
                {option.label}
              </Button>
            </div>
          ))}

          <div>
            <Button
              onClick={() => setShowCustom(!showCustom)}
              variant="outline"
              size="sm"
              className={`transition-all duration-300 hover:scale-105 ${
                showCustom
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0"
                  : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900"
              }`}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Custom Range
            </Button>
          </div>
        </div>

          <div className="flex items-center gap-2 text-neutral-500 text-sm">
            <Clock className="h-4 w-4" />
            <span>Auto-refresh: 30s</span>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Download Options - Below date range as a subtle row */}
        {(onDownloadCSV || onDownloadPNG) && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <div className="flex items-center gap-4">
              <span className="text-neutral-500 text-sm">Export:</span>
              {onDownloadCSV && (
                <button
                  onClick={onDownloadCSV}
                  disabled={isLoading}
                  className="flex items-center gap-2 text-sm text-neutral-600 hover:text-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download CSV"
                >
                  <FileText className="h-4 w-4" />
                  <span>CSV</span>
                </button>
              )}
              {onDownloadPNG && (
                <button
                  onClick={onDownloadPNG}
                  disabled={isLoading}
                  className="flex items-center gap-2 text-sm text-neutral-600 hover:text-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download PNG"
                >
                  <Image className="h-4 w-4" />
                  <span>PNG</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Date Range Picker */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          showCustom ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-6 bg-gradient-to-r from-neutral-50 to-white rounded-xl border border-neutral-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-neutral-700 text-sm font-medium">Start Date</label>
              <input
                type="date"
                value={customStartDate || formatDateForInput(selectedRange.startDate)}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="flex-1 space-y-2">
              <label className="text-neutral-700 text-sm font-medium">End Date</label>
              <input
                type="date"
                value={customEndDate || formatDateForInput(selectedRange.endDate)}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCustomDateApply}
                disabled={!customStartDate || !customEndDate}
                className="bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white border-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Apply
              </Button>
              <Button
                onClick={() => setShowCustom(false)}
                variant="outline"
                className="bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-all duration-200"
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

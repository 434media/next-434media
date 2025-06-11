"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "./Button"
import { Calendar, Clock, CalendarDays } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface DateRangeSelectorProps {
  selectedRange: DateRange
  onRangeChange: (range: DateRange) => void
}

const dateRangeOptions: DateRange[] = [
  { startDate: "today", endDate: "today", label: "Today" },
  { startDate: "7daysAgo", endDate: "today", label: "Last 7 days" },
  { startDate: "30daysAgo", endDate: "today", label: "Last 30 days" },
  { startDate: "90daysAgo", endDate: "today", label: "Last 90 days" },
]

export function DateRangeSelector({ selectedRange, onRangeChange }: DateRangeSelectorProps) {
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
      style={{ willChange: "transform" }}
    >
      {/* Main Date Range Selector */}
      <div
        className="flex flex-col lg:flex-row items-start lg:items-center gap-4 p-6 bg-gradient-to-r from-white/10 to-white/5 rounded-xl border border-white/10 shadow-xl"
        style={{
          willChange: "auto",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl shadow-lg transition-transform duration-200 hover:scale-105"
            style={{ willChange: "transform" }}
          >
            <Calendar className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white text-xl font-bold mb-1">Date Range</h3>
            <p className="text-white/60 text-sm font-medium">Select your analytics period</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          {dateRangeOptions.map((option, index) => (
            <motion.div
              key={option.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              style={{ willChange: "transform" }}
            >
              <Button
                onClick={() => onRangeChange(option)}
                variant={selectedRange.label === option.label ? "default" : "outline"}
                size="sm"
                className={`relative transition-all duration-300 hover:scale-105 ${
                  selectedRange.label === option.label
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg"
                    : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:border-white/30 hover:text-white"
                }`}
                style={{ willChange: "transform" }}
              >
                {option.label}
                {selectedRange.label === option.label && (
                  <motion.div
                    layoutId="activeRange"
                    className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-md -z-10"
                    style={{ willChange: "transform" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Button>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            style={{ willChange: "transform" }}
          >
            <Button
              onClick={() => setShowCustom(!showCustom)}
              variant="outline"
              size="sm"
              className={`transition-all duration-300 hover:scale-105 ${
                showCustom
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0"
                  : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:border-white/30 hover:text-white"
              }`}
              style={{ willChange: "transform" }}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Custom Range
            </Button>
          </motion.div>
        </div>

        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Clock className="h-4 w-4" />
          <span>Auto-refresh: 30s</span>
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Custom Date Range Picker */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
            style={{ willChange: "height, transform" }}
          >
            <div
              className="p-6 bg-gradient-to-r from-white/5 to-white/10 rounded-xl border border-white/10"
              style={{
                willChange: "auto",
                backfaceVisibility: "hidden",
                transform: "translateZ(0)",
              }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-white/80 text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate || formatDateForInput(selectedRange.startDate)}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div className="flex-1 space-y-2">
                  <label className="text-white/80 text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={customEndDate || formatDateForInput(selectedRange.endDate)}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCustomDateApply}
                    disabled={!customStartDate || !customEndDate}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Apply
                  </Button>
                  <Button
                    onClick={() => setShowCustom(false)}
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white/80 hover:bg-white/20 transition-all duration-200"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

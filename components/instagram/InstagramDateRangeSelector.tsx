"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Calendar, CalendarDays } from 'lucide-react'
import type { InstagramTimeRange } from "../../types/instagram-insights"

interface InstagramDateRangeSelectorProps {
  selectedRange: InstagramTimeRange
  onRangeChange: (range: InstagramTimeRange) => void
}

const dateRangeOptions: Array<{ value: InstagramTimeRange; label: string }> = [
  { value: "1d", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
]

export function InstagramDateRangeSelector({ selectedRange, onRangeChange }: InstagramDateRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      // For Instagram API, we'll use the closest predefined range
      // This is a simplified approach since Instagram API has specific time ranges
      const daysDiff = Math.ceil((new Date(customEndDate).getTime() - new Date(customStartDate).getTime()) / (1000 * 60 * 60 * 24))
      
      let closestRange: InstagramTimeRange = "30d"
      if (daysDiff <= 1) closestRange = "1d"
      else if (daysDiff <= 7) closestRange = "7d"
      else if (daysDiff <= 30) closestRange = "30d"
      else closestRange = "90d"
      
      onRangeChange(closestRange)
      setShowCustom(false)
    }
  }

  const formatDateForInput = (range: InstagramTimeRange) => {
    const today = new Date()
    let startDate = new Date()
    
    switch (range) {
      case "1d":
        startDate.setDate(today.getDate() - 1)
        break
      case "7d":
        startDate.setDate(today.getDate() - 7)
        break
      case "30d":
        startDate.setDate(today.getDate() - 30)
        break
      case "90d":
        startDate.setDate(today.getDate() - 90)
        break
    }
    
    return startDate.toISOString().split("T")[0]
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
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6 bg-gradient-to-r from-pink-50 to-white rounded-xl border border-neutral-200 shadow-sm"
        style={{
          willChange: "auto",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-3 bg-pink-100 rounded-xl shadow-sm transition-transform duration-200 hover:scale-105"
            style={{ willChange: "transform" }}
          >
            <Calendar className="h-6 w-6 text-pink-600" />
          </div>
          <div>
            <h3 className="text-neutral-900 text-xl font-bold mb-1">Date Range</h3>
            <p className="text-neutral-500 text-sm font-medium">Select your Instagram analytics period</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dateRangeOptions.map((option, index) => (
            <motion.div
              key={option.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              style={{ willChange: "transform" }}
            >
              <button
                onClick={() => onRangeChange(option.value)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 ${
                  selectedRange === option.value
                    ? "bg-pink-500 hover:bg-pink-600 text-white border-0 shadow-lg"
                    : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900"
                }`}
                style={{ willChange: "transform" }}
              >
                {option.label}
                {selectedRange === option.value && (
                  <motion.div
                    layoutId="activeRange"
                    className="absolute inset-0 bg-pink-500/20 rounded-md -z-10"
                    style={{ willChange: "transform" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            style={{ willChange: "transform" }}
          >
            <button
              onClick={() => setShowCustom(!showCustom)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 ${
                showCustom
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0"
                  : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900"
              }`}
              style={{ willChange: "transform" }}
            >
              <CalendarDays className="h-4 w-4 mr-2 inline" />
              Custom Range
            </button>
          </motion.div>
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
              className="p-6 bg-gradient-to-r from-neutral-50 to-white rounded-xl border border-neutral-200"
              style={{
                willChange: "auto",
                backfaceVisibility: "hidden",
                transform: "translateZ(0)",
              }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-neutral-700 text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate || formatDateForInput(selectedRange)}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-neutral-700 text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={customEndDate || new Date().toISOString().split("T")[0]}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCustomDateApply}
                    disabled={!customStartDate || !customEndDate}
                    className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white border-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 rounded-lg text-sm font-medium"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setShowCustom(false)}
                    className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-all duration-200 rounded-lg text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

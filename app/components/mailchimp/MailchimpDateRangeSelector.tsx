"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "../analytics/Button"
import { Calendar, CalendarDays } from 'lucide-react'
import type { MailchimpDateRangeProps } from "../../types/mailchimp-analytics"

interface DateRange {
  startDate: string
  endDate: string
  label: string
}

const dateRangeOptions: DateRange[] = [
  { startDate: "today", endDate: "today", label: "Today" },
  { startDate: "7daysAgo", endDate: "today", label: "Last 7 days" },
  { startDate: "30daysAgo", endDate: "today", label: "Last 30 days" },
  { startDate: "90daysAgo", endDate: "today", label: "Last 90 days" },
]

export function MailchimpDateRangeSelector({ dateRange, onDateRangeChange }: MailchimpDateRangeProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  
  // Create current range object for comparison
  const currentRange = {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    label: `${dateRange.startDate} to ${dateRange.endDate}`
  }

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      onDateRangeChange({
        startDate: customStartDate,
        endDate: customEndDate,
      })
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

  const handlePresetRange = (option: DateRange) => {
    const startDate = formatDateForInput(option.startDate)
    const endDate = formatDateForInput(option.endDate)
    
    onDateRangeChange({
      startDate,
      endDate,
    })
  }

  const isRangeActive = (option: DateRange) => {
    const optionStart = formatDateForInput(option.startDate)
    const optionEnd = formatDateForInput(option.endDate)
    return dateRange.startDate === optionStart && dateRange.endDate === optionEnd
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
        className="flex flex-col lg:flex-row items-start lg:items-center lg:justify-between gap-4 p-6 bg-gradient-to-r from-white/60 to-white/50 rounded-xl border border-black shadow-xl"
        style={{
          willChange: "auto",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl shadow-lg transition-transform duration-200 hover:scale-105 border border-black/20 text-black/80 hover:text-black"
            style={{ 
              background: 'linear-gradient(135deg, #FFE01B20, #FFE01B10)',
              willChange: "transform" 
            }}
          >
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-black text-xl font-bold mb-1">Date Range</h3>
            <p className="text-black/60 text-sm font-medium">Select your Mailchimp analytics period</p>
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
              <Button
                onClick={() => handlePresetRange(option)}
                variant={isRangeActive(option) ? "default" : "outline"}
                size="sm"
                className={`relative transition-all duration-300 hover:scale-105 ${
                  isRangeActive(option)
                    ? "text-black border-0 shadow-lg"
                    : "bg-black/10 border-black/20 text-black/80 hover:bg-black/20 hover:border-black/30 hover:text-black"
                }`}
                style={{ 
                  willChange: "transform",
                  ...(isRangeActive(option) ? {
                    background: 'linear-gradient(135deg, #FFE01B, #FFE01B90)',
                  } : {})
                }}
              >
                {option.label}
                {isRangeActive(option) && (
                  <motion.div
                    layoutId="activeMailchimpRange"
                    className="absolute inset-0 rounded-md -z-10"
                    style={{ 
                      background: 'linear-gradient(135deg, #FFE01B20, #FFE01B10)',
                      willChange: "transform" 
                    }}
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
                  ? "text-black border-0"
                  : "bg-black/10 border-black/20 text-black/80 hover:bg-black/20 hover:border-black/30 hover:text-black"
              }`}
              style={{ 
                willChange: "transform",
                ...(showCustom ? {
                  background: 'linear-gradient(135deg, #FFE01B, #FFE01B90)',
                } : {})
              }}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Custom Range
            </Button>
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
              className="p-6 bg-gradient-to-r from-black/5 to-black/10 rounded-xl border border-black/10"
              style={{
                willChange: "auto",
                backfaceVisibility: "hidden",
                transform: "translateZ(0)",
              }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-black/80 text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate || dateRange.startDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-black/10 border border-black/20 rounded-lg text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200"
                    style={{ '--tw-ring-color': '#FFE01B80' } as React.CSSProperties}
                  />
                </div>

                <div className="flex-1 space-y-2">
                  <label className="text-black/80 text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={customEndDate || dateRange.endDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-black/10 border border-black/20 rounded-lg text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200"
                    style={{ '--tw-ring-color': '#FFE01B80' } as React.CSSProperties}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCustomDateApply}
                    disabled={!customStartDate || !customEndDate}
                    className="text-black border-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    style={{ background: 'linear-gradient(135deg, #FFE01B, #FFE01B90)' }}
                  >
                    Apply
                  </Button>
                  <Button
                    onClick={() => setShowCustom(false)}
                    variant="outline"
                    className="bg-black/10 border-black/20 text-black/80 hover:bg-black/20 transition-all duration-200"
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

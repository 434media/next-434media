"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Calendar, ChevronDown } from "lucide-react"

export interface TimeRange {
  label: string
  value: string
  since: string
  until: string
}

interface TimeRangeSelectorProps {
  selectedRange: TimeRange
  onRangeChange: (range: TimeRange) => void
  isLoading?: boolean
}

export function TimeRangeSelector({ selectedRange, onRangeChange, isLoading = false }: TimeRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const timeRanges: TimeRange[] = [
    { label: "Last 24 hours", value: "24h", since: "1d", until: "0d" },
    { label: "Last 7 days", value: "7d", since: "7d", until: "0d" },
    { label: "Last 30 days", value: "30d", since: "30d", until: "0d" },
    { label: "Last 90 days", value: "90d", since: "90d", until: "0d" },
  ]

  const handleSelect = (range: TimeRange) => {
    onRangeChange(range)
    setIsOpen(false)
  }

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 relative z-10">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => !isLoading && setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center justify-between w-full md:w-64 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-400" />
          <span>{selectedRange.label}</span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-white/60" />
        </motion.div>
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute mt-2 w-full md:w-64 bg-gray-900/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl overflow-hidden z-20"
        >
          {timeRanges.map((range, index) => (
            <motion.button
              key={range.value}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelect(range)}
              className={`w-full text-left p-3 hover:bg-white/10 transition-colors flex items-center justify-between ${
                selectedRange.value === range.value ? "bg-white/10 text-white" : "text-white/80"
              }`}
            >
              <span>{range.label}</span>
              {selectedRange.value === range.value && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2 h-2 rounded-full bg-blue-500"
                />
              )}
            </motion.button>
          ))}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="p-3 border-t border-white/10"
          >
            <div className="text-xs text-white/60">Custom date ranges coming soon</div>
          </motion.div>
        </motion.div>
      )}

      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </motion.div>
  )
}

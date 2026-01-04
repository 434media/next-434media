"use client"

import { motion } from "framer-motion"
import { Image, Video, Film, Megaphone, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { InstagramReachBreakdown } from "../../types/instagram-insights"

interface InstagramReachBreakdownProps {
  breakdown: InstagramReachBreakdown | null
  isLoading?: boolean
  dateRange: string
}

const mediaTypeConfig: Record<keyof InstagramReachBreakdown, { icon: React.ElementType; label: string; color: string; bgColor: string }> = {
  FEED: { icon: Image, label: "Feed Posts", color: "text-blue-600", bgColor: "bg-blue-100" },
  REELS: { icon: Film, label: "Reels", color: "text-pink-600", bgColor: "bg-pink-100" },
  STORY: { icon: Video, label: "Stories", color: "text-purple-600", bgColor: "bg-purple-100" },
  AD: { icon: Megaphone, label: "Promoted", color: "text-yellow-600", bgColor: "bg-yellow-100" },
}

export function InstagramReachBreakdown({ breakdown, isLoading, dateRange }: InstagramReachBreakdownProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-pink-100 animate-pulse" />
          <div className="h-6 w-48 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!breakdown) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center">
        <Film className="w-12 h-12 text-pink-300 mx-auto mb-3" />
        <p className="text-neutral-500 text-sm">Reach breakdown not available</p>
      </div>
    )
  }

  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0)
  const entries = Object.entries(breakdown) as Array<[keyof InstagramReachBreakdown, number]>
  
  // Sort by value descending
  const sortedEntries = entries.sort((a, b) => b[1] - a[1])
  const topPerformer = sortedEntries[0]

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h3 className="text-neutral-900 font-semibold text-sm">Reach by Content Type</h3>
            <p className="text-neutral-500 text-xs">How different content performs • {dateRange}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-neutral-900 font-bold text-lg">{total.toLocaleString()}</div>
          <div className="text-neutral-500 text-xs">Total Reach</div>
        </div>
      </div>

      {/* Content Type Cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {sortedEntries.map(([type, value], index) => {
          const config = mediaTypeConfig[type]
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : "0"
          const isTopPerformer = type === topPerformer[0] && value > 0

          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-4 rounded-lg border transition-colors ${
                isTopPerformer
                  ? "bg-pink-50 border-pink-200"
                  : "bg-neutral-50 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              {isTopPerformer && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-pink-500 rounded-full text-[10px] font-bold text-white">
                  TOP
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                  <config.icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <span className="text-neutral-700 text-sm font-medium">{config.label}</span>
              </div>

              <div className={`text-2xl font-bold ${config.color} mb-1`}>
                {value.toLocaleString()}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-xs">{percentage}% of total</span>
                {value > 0 ? (
                  <div className="flex items-center gap-1">
                    {index === 0 && <TrendingUp className="w-3 h-3 text-emerald-600" />}
                  </div>
                ) : (
                  <Minus className="w-3 h-3 text-neutral-300" />
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1 bg-neutral-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
                  className={`h-full rounded-full ${config.bgColor.replace("/20", "").replace("100", "400")}`}
                />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Insights */}
      {topPerformer[1] > 0 && (
        <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200">
          <p className="text-neutral-600 text-xs text-center">
            💡 <span className="text-pink-600 font-medium">{mediaTypeConfig[topPerformer[0]].label}</span> is your best performing content type
          </p>
        </div>
      )}
    </div>
  )
}

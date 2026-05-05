"use client"

import { motion } from "motion/react"
import { Image, Video, Film, Megaphone, TrendingUp, Minus } from "lucide-react"
import type { InstagramReachBreakdown } from "../../types/instagram-insights"

interface InstagramReachBreakdownProps {
  breakdown: InstagramReachBreakdown | null
  isLoading?: boolean
  dateRange: string
}

// Each content type carries its own dot color (signal), but renders inside
// neutral chrome (mono pill, mono icon tile).
const mediaTypeConfig: Record<keyof InstagramReachBreakdown, { icon: React.ElementType; label: string; dot: string }> = {
  FEED: { icon: Image, label: "Feed Posts", dot: "bg-blue-500" },
  REELS: { icon: Film, label: "Reels", dot: "bg-pink-500" },
  STORY: { icon: Video, label: "Stories", dot: "bg-sky-500" },
  AD: { icon: Megaphone, label: "Promoted", dot: "bg-amber-500" },
}

export function InstagramReachBreakdown({ breakdown, isLoading, dateRange }: InstagramReachBreakdownProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-md bg-neutral-100 animate-pulse" />
          <div className="h-5 w-48 bg-neutral-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-neutral-100 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!breakdown) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6 text-center">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
          <Film className="w-5 h-5" />
        </div>
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
    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-neutral-900 font-medium text-sm">Reach by content type</h3>
            <p className="text-neutral-500 text-xs">{dateRange}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-neutral-900 font-semibold tabular-nums text-lg">{total.toLocaleString()}</div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Total Reach</div>
        </div>
      </div>

      {/* Content Type Cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {sortedEntries.map(([type, value], index) => {
          const config = mediaTypeConfig[type]
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : "0"
          const isTopPerformer = type === topPerformer[0] && value > 0
          const Icon = config.icon

          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`relative p-4 rounded-md ring-1 transition-colors ${
                isTopPerformer
                  ? "bg-white ring-neutral-300"
                  : "bg-white ring-neutral-200/70 hover:ring-neutral-300"
              }`}
            >
              {isTopPerformer && (
                <div className="absolute -top-2 -right-2 inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-900 rounded-full text-[10px] font-medium tabular-nums uppercase tracking-[0.16em] text-white">
                  Top
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
                  {config.label}
                </span>
              </div>

              <div className="text-2xl font-semibold tabular-nums text-neutral-900 mb-1">
                {value.toLocaleString()}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-500 text-xs tabular-nums">{percentage}% of total</span>
                {value === 0 && <Minus className="w-3 h-3 text-neutral-300" />}
              </div>

              {/* Progress bar — neutral fill (top performer dark, others lighter) */}
              <div className="mt-2 h-1 bg-neutral-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
                  className={`h-full rounded-full ${isTopPerformer ? "bg-neutral-900" : "bg-neutral-400"}`}
                />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Insights */}
      {topPerformer[1] > 0 && (
        <div className="px-4 py-3 border-t border-neutral-100">
          <p className="inline-flex items-center gap-1.5 text-neutral-700 text-xs">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${mediaTypeConfig[topPerformer[0]].dot}`} aria-hidden="true" />
            <span className="font-medium">{mediaTypeConfig[topPerformer[0]].label}</span>
            <span className="text-neutral-500">is your best-performing content type</span>
          </p>
        </div>
      )}
    </div>
  )
}

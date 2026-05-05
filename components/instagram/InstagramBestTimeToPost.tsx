"use client"

import { motion } from "motion/react"
import { Clock, TrendingUp } from "lucide-react"
import type { InstagramOnlineFollowers } from "../../types/instagram-insights"

interface InstagramBestTimeToPostProps {
  onlineFollowers: InstagramOnlineFollowers | null
  isLoading?: boolean
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour === 12) return "12 PM"
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return "Morning"
  if (hour >= 12 && hour < 17) return "Afternoon"
  if (hour >= 17 && hour < 21) return "Evening"
  return "Night"
}

export function InstagramBestTimeToPost({ onlineFollowers, isLoading }: InstagramBestTimeToPostProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-md bg-neutral-100 animate-pulse" />
          <div className="h-5 w-48 bg-neutral-100 rounded animate-pulse" />
        </div>
        <div className="h-32 bg-neutral-100 rounded-md animate-pulse" />
      </div>
    )
  }

  if (!onlineFollowers || onlineFollowers.hourly.length === 0) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6 text-center">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
          <Clock className="w-5 h-5" />
        </div>
        <p className="text-neutral-500 text-sm">Online followers data not available</p>
        <p className="text-neutral-400 text-xs mt-1">Requires 100+ followers</p>
      </div>
    )
  }

  const { hourly, best_times } = onlineFollowers
  const maxCount = Math.max(...hourly.map((h) => h.count), 1)
  const totalFollowers = hourly.reduce((sum, h) => sum + h.count, 0)
  const avgFollowers = Math.round(totalFollowers / hourly.length)

  return (
    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-neutral-900 font-medium text-sm">Best time to post</h3>
            <p className="text-neutral-500 text-xs">When your followers are most active</p>
          </div>
        </div>
      </div>

      {/* Best Times Highlight — mono chrome with pink dot for IG identity */}
      <div className="px-4 py-4 border-b border-neutral-100">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
          <span className="inline-block h-1 w-1 rounded-full bg-pink-500" aria-hidden="true" />
          Optimal posting times
        </p>
        <div className="flex flex-wrap gap-2">
          {best_times.map((hour, index) => (
            <motion.div
              key={hour}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md ring-1 ring-neutral-200 bg-white"
            >
              <span className="text-neutral-900 font-semibold tabular-nums text-sm">{formatHour(hour)}</span>
              <span className="text-neutral-500 text-xs">{getTimeOfDay(hour)}</span>
              {index === 0 && <TrendingUp className="w-3 h-3 text-emerald-600" />}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Hourly Chart */}
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-neutral-500 text-xs">Followers online by hour (UTC)</span>
          <span className="text-neutral-500 text-xs tabular-nums">Avg: {avgFollowers.toLocaleString()}</span>
        </div>

        <div className="flex items-end gap-1 h-24">
          {hourly.map((data, index) => {
            const height = (data.count / maxCount) * 100
            const isBestTime = best_times.includes(data.hour)

            return (
              <motion.div
                key={data.hour}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(height, 4)}%` }}
                transition={{ delay: index * 0.02, duration: 0.3 }}
                className="relative flex-1 group cursor-pointer"
              >
                <div
                  className={`w-full h-full rounded-t transition-colors ${
                    isBestTime
                      ? "bg-neutral-900 hover:bg-neutral-800"
                      : "bg-neutral-200 hover:bg-neutral-300"
                  }`}
                />

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white ring-1 ring-neutral-200 rounded-md text-xs text-neutral-900 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
                  <div className="font-semibold tabular-nums">{formatHour(data.hour)}</div>
                  <div className="text-neutral-500 tabular-nums">{data.count.toLocaleString()} online</div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Hour labels */}
        <div className="flex justify-between mt-2 text-neutral-400 text-[10px] tabular-nums">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>11 PM</span>
        </div>
      </div>

      {/* Footer tip */}
      <div className="px-4 py-3 border-t border-neutral-100">
        <p className="text-neutral-500 text-xs text-center">
          Post 30–60 minutes before peak times for best engagement
        </p>
      </div>
    </div>
  )
}

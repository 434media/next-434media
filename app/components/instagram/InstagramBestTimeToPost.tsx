"use client"

import { motion } from "framer-motion"
import { Clock, TrendingUp, Sparkles } from "lucide-react"
import type { InstagramOnlineFollowers } from "../../types/instagram-insights"

interface InstagramBestTimeToPostProps {
  onlineFollowers: InstagramOnlineFollowers | null
  isLoading?: boolean
}

// Format hour to 12-hour format
function formatHour(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour === 12) return "12 PM"
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

// Get hour range label
function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return "Morning"
  if (hour >= 12 && hour < 17) return "Afternoon"
  if (hour >= 17 && hour < 21) return "Evening"
  return "Night"
}

export function InstagramBestTimeToPost({ onlineFollowers, isLoading }: InstagramBestTimeToPostProps) {
  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-pink-500/20 animate-pulse" />
          <div className="h-6 w-48 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="h-32 bg-white/5 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!onlineFollowers || onlineFollowers.hourly.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 text-center">
        <Clock className="w-12 h-12 text-pink-400/50 mx-auto mb-3" />
        <p className="text-white/60 text-sm">Online followers data not available</p>
        <p className="text-white/40 text-xs mt-1">Requires 100+ followers</p>
      </div>
    )
  }

  const { hourly, best_times } = onlineFollowers
  const maxCount = Math.max(...hourly.map((h) => h.count), 1)
  const totalFollowers = hourly.reduce((sum, h) => sum + h.count, 0)
  const avgFollowers = Math.round(totalFollowers / hourly.length)

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/20 rounded-lg">
            <Clock className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Best Time to Post</h3>
            <p className="text-white/40 text-xs">When your followers are most active</p>
          </div>
        </div>
      </div>

      {/* Best Times Highlight */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-pink-500/10 to-transparent">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-pink-400" />
          <span className="text-pink-400 text-xs font-semibold uppercase tracking-wide">Optimal Posting Times</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {best_times.map((hour, index) => (
            <motion.div
              key={hour}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2 px-3 py-2 bg-pink-500/20 rounded-lg border border-pink-500/30"
            >
              <span className="text-white font-bold">{formatHour(hour)}</span>
              <span className="text-white/60 text-xs">{getTimeOfDay(hour)}</span>
              {index === 0 && <TrendingUp className="w-3 h-3 text-green-400" />}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Hourly Chart */}
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-white/40 text-xs">Followers online by hour (UTC)</span>
          <span className="text-white/40 text-xs">Avg: {avgFollowers.toLocaleString()}</span>
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
                      ? "bg-pink-500 hover:bg-pink-400"
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                />
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-white/20 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="font-bold">{formatHour(data.hour)}</div>
                  <div className="text-white/60">{data.count.toLocaleString()} online</div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Hour labels */}
        <div className="flex justify-between mt-2 text-white/30 text-[10px]">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>11 PM</span>
        </div>
      </div>

      {/* Footer tip */}
      <div className="px-4 py-3 bg-white/5 border-t border-white/10">
        <p className="text-white/40 text-xs text-center">
          💡 Post 30-60 minutes before peak times for best engagement
        </p>
      </div>
    </div>
  )
}

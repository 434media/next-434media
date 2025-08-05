"use client"

import type { InstagramTimeRange } from "../../types/instagram-insights"

interface InstagramEngagementChartProps {
  insights: {
    impressions: number
    reach: number
    profile_views: number
    website_clicks: number
  }
  dateRange: InstagramTimeRange
  connectionStatus?: {
    success: boolean
    message?: string
  } | null
}

export function InstagramEngagementChart({ insights, dateRange, connectionStatus }: InstagramEngagementChartProps) {
  // Calculate engagement rate
  const engagementRate = insights.reach > 0 ? (insights.impressions / insights.reach) * 100 : 0

  return (
    <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-600 p-6">
      <h2 className="text-xl font-semibold text-white mb-6">Engagement Overview</h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Engagement Rate</span>
          <span className="text-white font-semibold">
            {connectionStatus?.success ? `${engagementRate.toFixed(1)}%` : "--"}
          </span>
        </div>

        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
            style={{ width: connectionStatus?.success ? `${Math.min(engagementRate, 100)}%` : "0%" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="text-center">
            <div className="text-lg font-semibold text-white">
              {connectionStatus?.success
                ? `${((insights.impressions / Math.max(insights.reach, 1)) * 100).toFixed(1)}%`
                : "--"}
            </div>
            <div className="text-sm text-slate-400">Impression Rate</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-white">
              {connectionStatus?.success
                ? `${((insights.profile_views / Math.max(insights.reach, 1)) * 100).toFixed(1)}%`
                : "--"}
            </div>
            <div className="text-sm text-slate-400">Profile View Rate</div>
          </div>
        </div>
      </div>

      {/* Not Connected Overlay */}
      {!connectionStatus?.success && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-400 text-lg font-semibold mb-2">Not Connected</div>
            <div className="text-slate-300 text-sm">
              {connectionStatus?.message || "Instagram API connection required"}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

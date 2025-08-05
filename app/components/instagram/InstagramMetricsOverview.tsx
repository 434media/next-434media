"use client"

import { formatNumber } from "../../lib/instagram-utils"
import type { InstagramTimeRange } from "../../types/instagram-insights"

interface InstagramMetricsOverviewProps {
  insights: {
    impressions: number
    reach: number
    profile_views: number
    website_clicks: number
    followers_count: number
    follows_count: number
    media_count: number
  }
  dateRange: InstagramTimeRange
  connectionStatus?: {
    success: boolean
    message?: string
  } | null
}

export function InstagramMetricsOverview({ insights, dateRange, connectionStatus }: InstagramMetricsOverviewProps) {
  const getRangeLabel = (range: InstagramTimeRange): string => {
    switch (range) {
      case "1d":
        return "Last 24 hours"
      case "7d":
        return "Last 7 days"
      case "30d":
        return "Last 30 days"
      case "90d":
        return "Last 90 days"
      default:
        return "Selected period"
    }
  }

  const metrics = [
    {
      title: "Impressions",
      value: insights.impressions,
      description: "Total times your content was displayed",
      color: "text-blue-400",
      bgColor: "bg-blue-900/20",
      borderColor: "border-blue-500/30",
    },
    {
      title: "Reach",
      value: insights.reach,
      description: "Unique accounts that saw your content",
      color: "text-green-400",
      bgColor: "bg-green-900/20",
      borderColor: "border-green-500/30",
    },
    {
      title: "Profile Views",
      value: insights.profile_views,
      description: "Times your profile was viewed",
      color: "text-purple-400",
      bgColor: "bg-purple-900/20",
      borderColor: "border-purple-500/30",
    },
    {
      title: "Website Clicks",
      value: insights.website_clicks,
      description: "Clicks to your website link",
      color: "text-orange-400",
      bgColor: "bg-orange-900/20",
      borderColor: "border-orange-500/30",
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Performance Overview</h2>
        <span className="text-sm text-slate-400">{getRangeLabel(dateRange)}</span>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.title}
              className={`${metric.bgColor} ${metric.borderColor} backdrop-blur-sm rounded-xl border p-6`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-300">{metric.title}</h3>
              </div>
              <div className={`text-2xl font-bold ${metric.color} mb-1`}>
                {connectionStatus?.success ? formatNumber(metric.value) : "--"}
              </div>
              <p className="text-xs text-slate-400">{metric.description}</p>
            </div>
          ))}
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
    </div>
  )
}

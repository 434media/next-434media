"use client"

import { formatNumber } from "../../lib/instagram-utils"
import type { InstagramTimeRange } from "../../types/instagram-insights"

interface InstagramMetricsOverviewProps {
  insights: {
    reach: number
    content_interactions: number
    profile_views: number
    // follower breakdowns (optional)
    reach_followers?: number
    reach_non_followers?: number
    profile_views_followers?: number
    profile_views_non_followers?: number
    content_interactions_followers?: number
    content_interactions_non_followers?: number
    website_clicks: number
    follows: number
    unfollows: number
    net_follower_growth: number
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
      title: "Views",
      value: insights.profile_views ?? 0,
      description: "Times your profile was viewed",
      color: "text-blue-400",
      bgColor: "bg-blue-900/20",
      borderColor: "border-blue-500/30",
      breakdown: {
        followers: insights.profile_views_followers ?? null,
        non_followers: insights.profile_views_non_followers ?? null,
      },
    },
    {
      title: "Reach",
      value: insights.reach ?? 0,
      description: "Unique accounts that saw your content",
      color: "text-green-400",
      bgColor: "bg-green-900/20",
      borderColor: "border-green-500/30",
      breakdown: {
        followers: insights.reach_followers ?? null,
        non_followers: insights.reach_non_followers ?? null,
      },
    },
    {
      title: "Content Interactions",
      value: insights.content_interactions ?? 0,
      description: "Total interactions on your posts",
      color: "text-pink-400",
      bgColor: "bg-pink-900/20",
      borderColor: "border-pink-500/30",
      breakdown: {
        followers: insights.content_interactions_followers ?? null,
        non_followers: insights.content_interactions_non_followers ?? null,
      },
    },
    {
      title: "Website Clicks",
      value: insights.website_clicks ?? 0,
      description: "Clicks to your website link",
      color: "text-orange-400",
      bgColor: "bg-orange-900/20",
      borderColor: "border-orange-500/30",
    },
    {
      title: "Follows",
      value: insights.follows ?? 0,
      description: "New follows during period",
      color: "text-yellow-300",
      bgColor: "bg-yellow-900/20",
      borderColor: "border-yellow-500/30",
    },
    {
      title: "Unfollows",
      value: insights.unfollows ?? 0,
      description: "Accounts that unfollowed",
      color: "text-red-300",
      bgColor: "bg-red-900/20",
      borderColor: "border-red-500/30",
    },
  ]

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.title}
              className={`${metric.bgColor} ${metric.borderColor} backdrop-blur-sm rounded-xl border p-4 sm:p-6 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className="flex items-center justify-between mb-2 sm:mb-3 relative">
                <h3 className="text-sm sm:text-base font-semibold text-slate-200 peer cursor-help">{metric.title}</h3>
                {/* Desktop-only tooltip shown on hover over title */}
                <div className="hidden md:block absolute left-0 top-full mt-1 w-64 rounded-md bg-slate-900/90 border border-slate-700 px-3 py-2 text-xs text-slate-200 opacity-0 transition-opacity duration-150 pointer-events-none peer-hover:opacity-100 z-10">
                  {metric.description}
                </div>
              </div>
              <div className={`text-2xl sm:text-3xl font-bold ${metric.color} mb-1 sm:mb-2`}>
                {connectionStatus?.success ? formatNumber(metric.value) : "--"}
              </div>
              {/* Show description on mobile */}
              <p className="text-xs text-slate-400 sm:hidden">{metric.description}</p>
              {connectionStatus?.success &&
                metric.breakdown &&
                (metric.breakdown.followers != null || metric.breakdown.non_followers != null) && (
                  <div className="hidden sm:grid mt-3 text-xs text-slate-400 grid-cols-1 gap-1">
                    {metric.breakdown.followers != null && (
                      <div>
                        <span className="text-slate-300 font-medium">Followers:</span>
                        <span className="ml-1 font-semibold">{formatNumber(metric.breakdown.followers)}</span>
                      </div>
                    )}
                    {metric.breakdown.non_followers != null && (
                      <div>
                        <span className="text-slate-300 font-medium">Non-followers:</span>
                        <span className="ml-1 font-semibold">{formatNumber(metric.breakdown.non_followers)}</span>
                      </div>
                    )}
                  </div>
                )}
            </div>
          ))}
        </div>

        {/* Not Connected Overlay */}
        {!connectionStatus?.success && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <div className="text-center px-4">
              <div className="text-red-400 text-lg sm:text-xl font-bold mb-2 sm:mb-3">Not Connected</div>
              <div className="text-slate-300 text-sm sm:text-base font-medium">
                {connectionStatus?.message || "Instagram API connection required"}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

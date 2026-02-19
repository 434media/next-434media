"use client"

import { formatNumber } from "../../lib/instagram-utils"
import type { InstagramTimeRange } from "../../types/instagram-insights"

interface InstagramKeyMetricsProps {
  insights: {
    reach: number
    content_interactions: number
    profile_views: number
    reach_followers?: number
    reach_non_followers?: number
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

export function InstagramKeyMetrics({ insights, dateRange, connectionStatus }: InstagramKeyMetricsProps) {
  const isConnected = connectionStatus?.success

  // Calculate derived metrics for sales & marketing
  const engagementRate = insights.followers_count > 0 
    ? ((insights.content_interactions / insights.followers_count) * 100).toFixed(2)
    : "0.00"
  
  const reachRate = insights.followers_count > 0
    ? ((insights.reach / insights.followers_count) * 100).toFixed(1)
    : "0.0"
  
  const followerGrowthRate = insights.followers_count > 0
    ? ((insights.net_follower_growth / insights.followers_count) * 100).toFixed(2)
    : "0.00"

  const conversionToProfile = insights.reach > 0
    ? ((insights.profile_views / insights.reach) * 100).toFixed(2)
    : "0.00"

  const profileToWebsite = insights.profile_views > 0
    ? ((insights.website_clicks / insights.profile_views) * 100).toFixed(2)
    : "0.00"

  const nonFollowerReachPercent = insights.reach > 0 && insights.reach_non_followers
    ? ((insights.reach_non_followers / insights.reach) * 100).toFixed(1)
    : null

  const getRangeLabel = (range: InstagramTimeRange): string => {
    switch (range) {
      case "1d": return "24h"
      case "7d": return "7d"
      case "30d": return "30d"
      case "90d": return "90d"
      default: return range
    }
  }

  // Primary KPIs - what matters most for sales & marketing
  const primaryMetrics = [
    {
      title: "Total Followers",
      value: isConnected ? formatNumber(insights.followers_count) : "--",
      trend: insights.net_follower_growth,
      trendLabel: `${insights.net_follower_growth >= 0 ? "+" : ""}${formatNumber(insights.net_follower_growth)} (${followerGrowthRate}%)`,
      description: "Your current audience size",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      title: "Accounts Reached",
      value: isConnected ? formatNumber(insights.reach) : "--",
      subtitle: nonFollowerReachPercent ? `${nonFollowerReachPercent}% new audiences` : undefined,
      description: `Unique accounts that saw your content (${reachRate}% of followers)`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      title: "Engagement Rate",
      value: isConnected ? `${engagementRate}%` : "--",
      benchmark: parseFloat(engagementRate) >= 3 ? "Above average" : parseFloat(engagementRate) >= 1 ? "Average" : "Below average",
      benchmarkColor: parseFloat(engagementRate) >= 3 ? "text-green-400" : parseFloat(engagementRate) >= 1 ? "text-yellow-400" : "text-red-400",
      description: "Interactions per follower (industry avg: 1-3%)",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      title: "Website Clicks",
      value: isConnected ? formatNumber(insights.website_clicks) : "--",
      subtitle: insights.website_clicks > 0 ? `${profileToWebsite}% conversion from profile` : undefined,
      description: "Link in bio clicks - key conversion metric",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      ),
    },
  ]

  // Secondary metrics - supporting data
  const secondaryMetrics = [
    {
      title: "Profile Views",
      value: isConnected ? formatNumber(insights.profile_views) : "--",
      subtitle: `${conversionToProfile}% of reach`,
      color: "text-blue-400",
    },
    {
      title: "Content Interactions",
      value: isConnected ? formatNumber(insights.content_interactions) : "--",
      subtitle: "Likes, comments, saves, shares",
      color: "text-pink-400",
    },
    {
      title: "New Followers",
      value: isConnected ? formatNumber(insights.follows) : "--",
      subtitle: "Gained this period",
      color: "text-green-400",
    },
    {
      title: "Posts Published",
      value: isConnected ? formatNumber(insights.media_count) : "--",
      subtitle: "Total media count",
      color: "text-purple-400",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Period Badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700 border border-pink-200">
          {getRangeLabel(dateRange)} Performance
        </span>
        {!isConnected && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
            Not Connected
          </span>
        )}
      </div>

      {/* Primary KPIs - Large Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryMetrics.map((metric) => (
          <div
            key={metric.title}
            className="bg-white rounded-xl border border-neutral-200 p-5 hover:border-pink-300 hover:shadow-md transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-pink-100 text-pink-600">
                {metric.icon}
              </div>
              {metric.trend !== undefined && (
                <div className={`text-xs font-medium ${metric.trend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {metric.trendLabel}
                </div>
              )}
              {metric.benchmark && (
                <div className={`text-xs font-medium ${metric.benchmarkColor?.replace('-400', '-600')}`}>
                  {metric.benchmark}
                </div>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-1">
              {metric.value}
            </div>
            <div className="text-sm font-medium text-neutral-700 mb-1">
              {metric.title}
            </div>
            {metric.subtitle && (
              <div className="text-xs text-pink-600 font-medium">
                {metric.subtitle}
              </div>
            )}
            <div className="text-xs text-neutral-500 mt-2">
              {metric.description}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Metrics - Compact Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {secondaryMetrics.map((metric) => (
          <div
            key={metric.title}
            className="bg-neutral-50 rounded-lg border border-neutral-200 p-4 text-center"
          >
            <div className={`text-xl sm:text-2xl font-bold ${metric.color.replace('-400', '-600')} mb-1`}>
              {metric.value}
            </div>
            <div className="text-xs font-medium text-neutral-700">
              {metric.title}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {metric.subtitle}
            </div>
          </div>
        ))}
      </div>

      {/* Funnel Visualization for Sales/Marketing */}
      {isConnected && (
        <div className="bg-gradient-to-r from-pink-50 via-white to-pink-50 rounded-xl border border-neutral-200 p-5">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Marketing Funnel
          </h3>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2">
            {/* Reach */}
            <div className="flex-1 text-center">
              <div className="text-lg sm:text-xl font-bold text-neutral-900">{formatNumber(insights.reach)}</div>
              <div className="text-xs text-neutral-500">Reach</div>
            </div>
            <div className="hidden sm:block text-neutral-300">→</div>
            <div className="block sm:hidden text-neutral-300">↓</div>
            {/* Profile Views */}
            <div className="flex-1 text-center">
              <div className="text-lg sm:text-xl font-bold text-blue-600">{formatNumber(insights.profile_views)}</div>
              <div className="text-xs text-neutral-500">Profile Views</div>
              <div className="text-xs text-neutral-400">{conversionToProfile}%</div>
            </div>
            <div className="hidden sm:block text-neutral-300">→</div>
            <div className="block sm:hidden text-neutral-300">↓</div>
            {/* Website Clicks */}
            <div className="flex-1 text-center">
              <div className="text-lg sm:text-xl font-bold text-pink-600">{formatNumber(insights.website_clicks)}</div>
              <div className="text-xs text-neutral-500">Website Clicks</div>
              <div className="text-xs text-neutral-400">{profileToWebsite}%</div>
            </div>
            <div className="hidden sm:block text-neutral-300">→</div>
            <div className="block sm:hidden text-neutral-300">↓</div>
            {/* New Followers */}
            <div className="flex-1 text-center">
              <div className="text-lg sm:text-xl font-bold text-emerald-600">+{formatNumber(insights.follows)}</div>
              <div className="text-xs text-neutral-500">New Followers</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

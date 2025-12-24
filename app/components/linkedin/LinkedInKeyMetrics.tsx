"use client"

import type { LinkedInOrganizationInsights, LinkedInTimeRange } from "../../types/linkedin-insights"

interface LinkedInKeyMetricsProps {
  insights: LinkedInOrganizationInsights | null
  dateRange: LinkedInTimeRange
  connectionStatus: {
    success: boolean
    message?: string
  } | null
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toLocaleString()
}

function formatPercent(num: number): string {
  return num.toFixed(2) + "%"
}

export function LinkedInKeyMetrics({ insights, dateRange, connectionStatus }: LinkedInKeyMetricsProps) {
  if (!connectionStatus?.success) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-white/60 text-sm">
          Connect to LinkedIn API to view metrics.
        </p>
      </div>
    )
  }

  const engagementRate =
    insights && insights.impressions > 0
      ? ((insights.totalEngagements / insights.impressions) * 100)
      : 0

  const clickRate =
    insights && insights.impressions > 0
      ? ((insights.clicks / insights.impressions) * 100)
      : 0

  const metrics = [
    {
      label: "Total Followers",
      value: formatNumber(insights?.totalFollowers || 0),
      change: insights?.netFollowerChange
        ? `${insights.netFollowerChange >= 0 ? "+" : ""}${formatNumber(insights.netFollowerChange)}`
        : null,
      changePositive: (insights?.netFollowerChange || 0) >= 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      color: "text-[#0077B5]",
      bgColor: "bg-[#0077B5]/10",
    },
    {
      label: "Impressions",
      value: formatNumber(insights?.impressions || 0),
      change: null,
      changePositive: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      ),
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    },
    {
      label: "Engagement Rate",
      value: formatPercent(engagementRate),
      change: engagementRate >= 2 ? "Above avg" : engagementRate >= 1 ? "Average" : "Below avg",
      changePositive: engagementRate >= 1,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
    },
    {
      label: "Clicks",
      value: formatNumber(insights?.clicks || 0),
      change: clickRate > 0 ? formatPercent(clickRate) + " CTR" : null,
      changePositive: clickRate >= 1,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
          />
        </svg>
      ),
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
  ]

  const secondaryMetrics = [
    { label: "Page Views", value: formatNumber(insights?.pageViews || 0) },
    { label: "Unique Visitors", value: formatNumber(insights?.uniquePageViews || 0) },
    { label: "Reactions", value: formatNumber(insights?.reactions || 0) },
    { label: "Comments", value: formatNumber(insights?.comments || 0) },
    { label: "Shares", value: formatNumber(insights?.shares || 0) },
    { label: "New Followers", value: formatNumber(insights?.followerGains || 0) },
  ]

  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`p-2 rounded-lg ${metric.bgColor} ${metric.color}`}>
                {metric.icon}
              </span>
            </div>
            <p className="text-xs uppercase tracking-wider text-white/40 mb-1">
              {metric.label}
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-white mb-1">{metric.value}</p>
            {metric.change && (
              <p
                className={`text-xs ${
                  metric.changePositive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {metric.change}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {secondaryMetrics.map((metric) => (
          <div
            key={metric.label}
            className="p-3 rounded-lg bg-white/5 border border-white/5 text-center"
          >
            <p className="text-lg sm:text-xl font-semibold text-white">{metric.value}</p>
            <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

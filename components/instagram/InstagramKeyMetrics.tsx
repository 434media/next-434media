"use client"

import { formatNumber } from "../../lib/instagram-utils"
import type { InstagramTimeRange } from "../../types/instagram-insights"

interface InstagramInsightsShape {
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

interface InstagramKeyMetricsProps {
  insights: InstagramInsightsShape
  /**
   * Same-shape data for the immediately-preceding period of equal length.
   * Powers period-over-period delta chips on every KPI. Optional —
   * deltas are gracefully hidden when missing.
   */
  previousInsights?: InstagramInsightsShape | null
  dateRange: InstagramTimeRange
  connectionStatus?: {
    success: boolean
    message?: string
  } | null
}

// =====================================================================
// Delta computation + rendering helpers
// =====================================================================

interface DeltaResult {
  hasDelta: boolean
  diff: number
  pctChange: number | null // null when previous is 0 (avoid divide-by-zero noise)
  isPositive: boolean
  isZero: boolean
}

function computeDelta(current: number, previous: number | undefined | null): DeltaResult {
  if (previous === undefined || previous === null) {
    return { hasDelta: false, diff: 0, pctChange: null, isPositive: true, isZero: true }
  }
  const diff = current - previous
  const pctChange = previous === 0 ? null : (diff / previous) * 100
  return {
    hasDelta: true,
    diff,
    pctChange,
    isPositive: diff >= 0,
    isZero: diff === 0,
  }
}

function formatDeltaNumber(diff: number): string {
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : ""
  return `${sign}${formatNumber(Math.abs(diff))}`
}

function formatDeltaPct(pct: number): string {
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : ""
  return `${sign}${Math.abs(pct).toFixed(1)}%`
}

/**
 * Period-over-period delta chip. Mono pill + colored arrow.
 * Style stays consistent across all KPI cards so deltas are scannable.
 */
function Delta({
  result,
  unit = "absolute",
}: {
  result: DeltaResult
  // "absolute" → render diff as a number (followers, reach)
  // "percentPoints" → render diff as percentage points (engagement rate already a %)
  // "percentOnly" → render only % change (no underlying absolute), e.g., for ratios
  unit?: "absolute" | "percentPoints" | "percentOnly"
}) {
  if (!result.hasDelta) return null

  const { diff, pctChange, isPositive, isZero } = result
  const tone = isZero
    ? "text-neutral-500"
    : isPositive
    ? "text-emerald-700"
    : "text-red-600"
  const arrow = isZero ? "·" : isPositive ? "↑" : "↓"

  let primary = ""
  let secondary = ""

  if (unit === "absolute") {
    primary = formatDeltaNumber(diff)
    if (pctChange !== null) secondary = ` (${formatDeltaPct(pctChange)})`
  } else if (unit === "percentPoints") {
    const sign = diff > 0 ? "+" : diff < 0 ? "−" : ""
    primary = `${sign}${Math.abs(diff).toFixed(2)} pts`
  } else {
    primary = pctChange === null ? formatDeltaNumber(diff) : formatDeltaPct(pctChange)
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${tone}`}
      title="vs previous period"
    >
      <span aria-hidden="true">{arrow}</span>
      <span>
        {primary}
        {secondary}
      </span>
    </span>
  )
}

// =====================================================================
// Main component
// =====================================================================

export function InstagramKeyMetrics({ insights, previousInsights, dateRange, connectionStatus }: InstagramKeyMetricsProps) {
  const isConnected = connectionStatus?.success

  // Calculate derived metrics for sales & marketing
  const engagementRate = insights.followers_count > 0
    ? (insights.content_interactions / insights.followers_count) * 100
    : 0
  const engagementRateLabel = engagementRate.toFixed(2)

  const reachRate = insights.followers_count > 0
    ? ((insights.reach / insights.followers_count) * 100).toFixed(1)
    : "0.0"

  const conversionToProfile = insights.reach > 0
    ? ((insights.profile_views / insights.reach) * 100).toFixed(2)
    : "0.00"

  const profileToWebsite = insights.profile_views > 0
    ? ((insights.website_clicks / insights.profile_views) * 100).toFixed(2)
    : "0.00"

  const nonFollowerReachPercent = insights.reach > 0 && insights.reach_non_followers
    ? ((insights.reach_non_followers / insights.reach) * 100).toFixed(1)
    : null

  // Previous-period engagement rate for the points-delta on the engagement card
  const previousEngagementRate =
    previousInsights && previousInsights.followers_count > 0
      ? (previousInsights.content_interactions / previousInsights.followers_count) * 100
      : null

  // Pre-compute deltas for every metric we'll render
  const deltas = {
    followers: computeDelta(insights.followers_count, previousInsights?.followers_count),
    reach: computeDelta(insights.reach, previousInsights?.reach),
    engagementRate:
      previousEngagementRate !== null
        ? computeDelta(engagementRate, previousEngagementRate)
        : { hasDelta: false, diff: 0, pctChange: null, isPositive: true, isZero: true },
    websiteClicks: computeDelta(insights.website_clicks, previousInsights?.website_clicks),
    profileViews: computeDelta(insights.profile_views, previousInsights?.profile_views),
    contentInteractions: computeDelta(insights.content_interactions, previousInsights?.content_interactions),
    follows: computeDelta(insights.follows, previousInsights?.follows),
    mediaCount: computeDelta(insights.media_count, previousInsights?.media_count),
  }

  const getRangeLabel = (range: InstagramTimeRange): string => {
    switch (range) {
      case "1d": return "24h"
      case "7d": return "7d"
      case "30d": return "30d"
      case "90d": return "90d"
      default: return range
    }
  }

  const getPreviousRangeLabel = (range: InstagramTimeRange): string => {
    switch (range) {
      case "1d": return "previous 24h"
      case "7d": return "previous 7 days"
      case "30d": return "previous 30 days"
      case "90d": return "previous 90 days"
      default: return "previous period"
    }
  }

  const hasPrevious = !!previousInsights

  // Primary KPIs - what matters most for sales & marketing
  const primaryMetrics = [
    {
      title: "Total Followers",
      value: isConnected ? formatNumber(insights.followers_count) : "--",
      delta: deltas.followers,
      deltaUnit: "absolute" as const,
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
      delta: deltas.reach,
      deltaUnit: "absolute" as const,
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
      value: isConnected ? `${engagementRateLabel}%` : "--",
      delta: deltas.engagementRate,
      deltaUnit: "percentPoints" as const,
      benchmark: engagementRate >= 3 ? "Above industry" : engagementRate >= 1 ? "On par with industry" : "Below industry",
      benchmarkColor: engagementRate >= 3 ? "text-emerald-600" : engagementRate >= 1 ? "text-amber-600" : "text-red-600",
      description: "Interactions per follower (industry avg: 1–3%)",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      title: "Website Clicks",
      value: isConnected ? formatNumber(insights.website_clicks) : "--",
      delta: deltas.websiteClicks,
      deltaUnit: "absolute" as const,
      subtitle: insights.website_clicks > 0 ? `${profileToWebsite}% conversion from profile` : undefined,
      description: "Link in bio clicks — key conversion metric",
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
      delta: deltas.profileViews,
    },
    {
      title: "Content Interactions",
      value: isConnected ? formatNumber(insights.content_interactions) : "--",
      subtitle: "Likes, comments, saves, shares",
      delta: deltas.contentInteractions,
    },
    {
      title: "New Followers",
      value: isConnected ? formatNumber(insights.follows) : "--",
      subtitle: "Gained this period",
      delta: deltas.follows,
    },
    {
      title: "Posts Published",
      value: isConnected ? formatNumber(insights.media_count) : "--",
      subtitle: "Total media count",
      delta: deltas.mediaCount,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Period Badge — mono pill with pink dot prefix carrying brand identity */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
          <span className="inline-block h-1 w-1 rounded-full bg-pink-500" aria-hidden="true" />
          {getRangeLabel(dateRange)} Performance
        </span>
        {hasPrevious && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
            <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
            Comparing to {getPreviousRangeLabel(dateRange)}
          </span>
        )}
        {!isConnected && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
            <span className="inline-block h-1 w-1 rounded-full bg-red-500" aria-hidden="true" />
            Not Connected
          </span>
        )}
      </div>

      {/* Primary KPIs - Large Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryMetrics.map((metric) => (
          <div
            key={metric.title}
            className="bg-white rounded-md p-5 ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:-translate-y-0.5 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-[transform,box-shadow,outline-color]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                {metric.icon}
              </div>
              {metric.benchmark && (
                <div className={`text-xs font-medium ${metric.benchmarkColor}`}>
                  {metric.benchmark}
                </div>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-neutral-900 mb-1">
              {metric.value}
            </div>
            {/* PoP delta — consistent placement under every primary value */}
            {isConnected && metric.delta?.hasDelta && (
              <div className="flex items-center gap-1.5 mb-1">
                <Delta result={metric.delta} unit={metric.deltaUnit} />
                <span className="text-[11px] text-neutral-400">
                  vs {getPreviousRangeLabel(dateRange)}
                </span>
              </div>
            )}
            <div className="text-sm font-medium text-neutral-700 mb-1">
              {metric.title}
            </div>
            {metric.subtitle && (
              <div className="text-xs text-neutral-600 font-medium">
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
            className="bg-white rounded-md p-4 ring-1 ring-neutral-200/70"
          >
            <div className="text-xl sm:text-2xl font-semibold tabular-nums text-neutral-900 mb-1">
              {metric.value}
            </div>
            {isConnected && metric.delta?.hasDelta && (
              <div className="mb-1.5">
                <Delta result={metric.delta} unit="absolute" />
              </div>
            )}
            <div className="text-xs font-medium text-neutral-700">
              {metric.title}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {metric.subtitle}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =====================================================================
// Marketing Funnel — extracted to its own component so the page can render
// it as a standalone section with its own `<h2>` heading. Same data shape
// as InstagramKeyMetrics; rendered standalone uses identical chrome to
// the rest of the system (ring-1, mono numbers, neutral palette).
// =====================================================================

interface InstagramMarketingFunnelProps {
  insights: InstagramInsightsShape
  previousInsights?: InstagramInsightsShape | null
  isConnected: boolean
}

export function InstagramMarketingFunnel({ insights, previousInsights, isConnected }: InstagramMarketingFunnelProps) {
  if (!isConnected) return null

  const conversionToProfile = insights.reach > 0
    ? ((insights.profile_views / insights.reach) * 100).toFixed(2)
    : "0.00"

  const profileToWebsite = insights.profile_views > 0
    ? ((insights.website_clicks / insights.profile_views) * 100).toFixed(2)
    : "0.00"

  const reachDelta = computeDelta(insights.reach, previousInsights?.reach)
  const profileViewsDelta = computeDelta(insights.profile_views, previousInsights?.profile_views)
  const websiteClicksDelta = computeDelta(insights.website_clicks, previousInsights?.website_clicks)
  const followsDelta = computeDelta(insights.follows, previousInsights?.follows)

  return (
    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2">
        {/* Reach */}
        <div className="flex-1 text-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-1">Reach</div>
          <div className="text-lg sm:text-xl font-semibold tabular-nums text-neutral-900">{formatNumber(insights.reach)}</div>
          {reachDelta.hasDelta && (
            <div className="mt-0.5">
              <Delta result={reachDelta} unit="absolute" />
            </div>
          )}
        </div>
        <div className="hidden sm:block text-neutral-300" aria-hidden="true">→</div>
        <div className="block sm:hidden text-neutral-300" aria-hidden="true">↓</div>
        {/* Profile Views */}
        <div className="flex-1 text-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-1">Profile Views</div>
          <div className="text-lg sm:text-xl font-semibold tabular-nums text-neutral-900">{formatNumber(insights.profile_views)}</div>
          <div className="text-[11px] text-neutral-400 tabular-nums">{conversionToProfile}%</div>
          {profileViewsDelta.hasDelta && (
            <div className="mt-0.5">
              <Delta result={profileViewsDelta} unit="absolute" />
            </div>
          )}
        </div>
        <div className="hidden sm:block text-neutral-300" aria-hidden="true">→</div>
        <div className="block sm:hidden text-neutral-300" aria-hidden="true">↓</div>
        {/* Website Clicks */}
        <div className="flex-1 text-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-1">Website Clicks</div>
          <div className="text-lg sm:text-xl font-semibold tabular-nums text-neutral-900">{formatNumber(insights.website_clicks)}</div>
          <div className="text-[11px] text-neutral-400 tabular-nums">{profileToWebsite}%</div>
          {websiteClicksDelta.hasDelta && (
            <div className="mt-0.5">
              <Delta result={websiteClicksDelta} unit="absolute" />
            </div>
          )}
        </div>
        <div className="hidden sm:block text-neutral-300" aria-hidden="true">→</div>
        <div className="block sm:hidden text-neutral-300" aria-hidden="true">↓</div>
        {/* New Followers */}
        <div className="flex-1 text-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-1">New Followers</div>
          <div className="text-lg sm:text-xl font-semibold tabular-nums text-neutral-900">+{formatNumber(insights.follows)}</div>
          {followsDelta.hasDelta && (
            <div className="mt-0.5">
              <Delta result={followsDelta} unit="absolute" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

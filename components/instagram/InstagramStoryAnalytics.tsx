"use client"

import { formatNumber } from "../../lib/instagram-utils"

// =====================================================================
// Types — local to this component (not added to types/instagram-insights
// to avoid coupling the dashboard surface to the route's response shape)
// =====================================================================

export interface StoryInsightItem {
  views: number
  reach: number
  replies: number
  taps_forward: number
  taps_back: number
  exits: number
  shares: number
  profile_visits: number
  total_interactions: number
  completion_rate: number
  exit_rate: number
  tap_forward_rate: number
  reply_rate: number
}

export interface StoryItem {
  id: string
  media_type?: string
  media_url?: string
  permalink?: string
  thumbnail_url?: string
  timestamp?: string
  insights: StoryInsightItem | null
}

export interface StoryAggregates {
  stories_count: number
  views: number
  reach: number
  replies: number
  taps_forward: number
  taps_back: number
  exits: number
  shares: number
  profile_visits: number
  total_interactions: number
  avg_completion_rate: number
  avg_exit_rate: number
  reply_rate: number
  tap_forward_rate: number
}

export interface StoryAnalyticsData {
  stories: StoryItem[]
  aggregates: StoryAggregates | null
}

interface InstagramStoryAnalyticsProps {
  data: StoryAnalyticsData | null
  isConnected: boolean
}

// =====================================================================

function formatDuration(timestamp: string): string {
  if (!timestamp) return ""
  const posted = new Date(timestamp)
  if (isNaN(posted.getTime())) return ""
  const now = new Date()
  const diffMs = now.getTime() - posted.getTime()
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (diffHrs >= 1) return `${diffHrs}h ago`
  if (diffMin >= 1) return `${diffMin}m ago`
  return "just now"
}

export function InstagramStoryAnalytics({ data, isConnected }: InstagramStoryAnalyticsProps) {
  // Empty / not-connected states share the same chrome
  if (!isConnected || !data || !data.aggregates || data.stories.length === 0) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 2" />
          </svg>
        </div>
        <h4 className="text-base font-medium text-neutral-900 mb-1">No active stories</h4>
        <p className="text-sm text-neutral-500 max-w-md mx-auto">
          Stories disappear from Instagram&apos;s API after 24 hours. Post a story to see live performance metrics here.
        </p>
        <p className="text-[11px] text-neutral-400 mt-3">
          Historical aggregation across multiple days is captured by the daily snapshot job.
        </p>
      </div>
    )
  }

  const { stories, aggregates } = data
  const validStories = stories.filter((s) => s.insights)

  // Primary KPI cards
  const kpis = [
    {
      label: "Active Stories",
      value: formatNumber(aggregates.stories_count),
      hint: "Live in the last 24 hours",
    },
    {
      label: "Total Reach",
      value: formatNumber(aggregates.reach),
      hint: `${formatNumber(aggregates.views)} views across all stories`,
    },
    {
      label: "Avg Completion Rate",
      value: `${aggregates.avg_completion_rate.toFixed(1)}%`,
      hint: "Estimate: (views − exits) / views",
      // Completion-rate intent color: emerald above 70%, amber 50–70%, red below
      tone:
        aggregates.avg_completion_rate >= 70
          ? "emerald"
          : aggregates.avg_completion_rate >= 50
          ? "amber"
          : "red",
    },
    {
      label: "Reply Rate",
      value: `${aggregates.reply_rate.toFixed(2)}%`,
      hint: `${formatNumber(aggregates.replies)} replies — high-intent signal`,
    },
  ] as const

  // Secondary metrics
  const secondary = [
    { label: "Tap-forward rate", value: `${aggregates.tap_forward_rate.toFixed(1)}%`, hint: "Faster swipes = lower hold" },
    { label: "Total exits", value: formatNumber(aggregates.exits), hint: "Drop-offs across all stories" },
    { label: "Profile visits", value: formatNumber(aggregates.profile_visits), hint: "Story → profile pivots" },
    { label: "Shares", value: formatNumber(aggregates.shares), hint: "Forwarded to friends" },
  ]

  const dotForTone = (tone?: "emerald" | "amber" | "red") =>
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
      ? "bg-amber-500"
      : tone === "red"
      ? "bg-red-500"
      : "bg-neutral-400"

  return (
    <div className="space-y-6">
      {/* Section banner — sets expectations about story data being live-only */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
          <span className="inline-block h-1 w-1 rounded-full bg-pink-500" aria-hidden="true" />
          Live · 24 hours
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
          <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
          {formatNumber(aggregates.stories_count)} active {aggregates.stories_count === 1 ? "story" : "stories"}
        </span>
      </div>

      {/* Primary KPI grid — 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-md ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:-translate-y-0.5 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-[transform,box-shadow,outline-color] p-5"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              <span className={`inline-block h-1 w-1 rounded-full ${dotForTone((kpi as { tone?: "emerald" | "amber" | "red" }).tone)}`} aria-hidden="true" />
              {kpi.label}
            </p>
            <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-neutral-900 mb-1">{kpi.value}</p>
            <p className="text-xs text-neutral-500">{kpi.hint}</p>
          </div>
        ))}
      </div>

      {/* Secondary metrics — compact tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {secondary.map((m) => (
          <div key={m.label} className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
            <div className="text-xl sm:text-2xl font-semibold tabular-nums text-neutral-900 mb-1">{m.value}</div>
            <div className="text-xs font-medium text-neutral-700">{m.label}</div>
            <div className="text-xs text-neutral-500 mt-1">{m.hint}</div>
          </div>
        ))}
      </div>

      {/* Per-story breakdown — grid card per active story */}
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Per-story performance</h3>
            <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
              {validStories.length} of {stories.length} {stories.length === 1 ? "story" : "stories"} reporting
            </p>
          </div>
        </div>

        {validStories.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            Insights for these stories aren&apos;t available yet — data typically lags 5–15 minutes after posting.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {validStories.map((story, idx) => {
              const ins = story.insights!
              const completionTone =
                ins.completion_rate >= 70 ? "text-emerald-700" : ins.completion_rate >= 50 ? "text-amber-700" : "text-red-600"
              const thumbnail = story.thumbnail_url || story.media_url
              return (
                <div key={story.id} className="px-5 py-4 flex flex-col sm:flex-row gap-4">
                  {/* Thumbnail */}
                  <div className="shrink-0 relative">
                    <span className="absolute -top-1.5 -left-1.5 z-10 inline-flex items-center justify-center h-5 w-5 rounded-full bg-neutral-900 text-white text-[10px] font-medium tabular-nums">
                      {idx + 1}
                    </span>
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnail}
                        alt={`Story ${idx + 1}`}
                        className="h-32 w-20 sm:h-36 sm:w-24 object-cover rounded-md ring-1 ring-neutral-200 bg-neutral-100"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-32 w-20 sm:h-36 sm:w-24 rounded-md bg-neutral-100 ring-1 ring-neutral-200 grid place-items-center">
                        <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                          <circle cx="9" cy="9" r="2" strokeWidth={2} />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700">
                        <span className="inline-block h-1 w-1 rounded-full bg-pink-500" aria-hidden="true" />
                        {story.media_type || "STORY"}
                      </span>
                      {story.timestamp && (
                        <span className="text-[11px] text-neutral-500 tabular-nums">{formatDuration(story.timestamp)}</span>
                      )}
                      {story.permalink && (
                        <a
                          href={story.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-[11px] font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
                        >
                          View on Instagram →
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Views</div>
                        <div className="text-base font-semibold tabular-nums text-neutral-900">{formatNumber(ins.views)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Reach</div>
                        <div className="text-base font-semibold tabular-nums text-neutral-900">{formatNumber(ins.reach)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Completion</div>
                        <div className={`text-base font-semibold tabular-nums ${completionTone}`}>
                          {ins.completion_rate.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Replies</div>
                        <div className="text-base font-semibold tabular-nums text-neutral-900">{formatNumber(ins.replies)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-neutral-100">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Taps fwd</div>
                        <div className="text-sm font-medium tabular-nums text-neutral-700">
                          {formatNumber(ins.taps_forward)}
                          <span className="ml-1 text-[11px] text-neutral-500">({ins.tap_forward_rate.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Taps back</div>
                        <div className="text-sm font-medium tabular-nums text-neutral-700">{formatNumber(ins.taps_back)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Exits</div>
                        <div className="text-sm font-medium tabular-nums text-neutral-700">
                          {formatNumber(ins.exits)}
                          <span className="ml-1 text-[11px] text-neutral-500">({ins.exit_rate.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Profile visits</div>
                        <div className="text-sm font-medium tabular-nums text-neutral-700">{formatNumber(ins.profile_visits)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { motion } from "motion/react"
import { Film, Play, Clock, Repeat, Eye, ExternalLink } from "lucide-react"
import { formatNumber, formatInstagramDate } from "../../lib/instagram-utils"
import type { InstagramMedia, InstagramMediaInsights } from "../../types/instagram-insights"

type ReelMedia = InstagramMedia & {
  insights: InstagramMediaInsights
  engagement_rate: number
}

interface InstagramReelsAnalyticsProps {
  media: ReelMedia[]
  isConnected: boolean
}

function formatMs(ms: number | undefined): string {
  if (!ms || ms <= 0) return "—"
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export function InstagramReelsAnalytics({ media, isConnected }: InstagramReelsAnalyticsProps) {
  if (!isConnected) return null

  // Reels are surfaced from the existing media list. media_type === "VIDEO"
  // covers Reels in v22+ (Instagram doesn't expose a distinct REEL type via
  // the Graph API for this account flavor).
  const reels = media.filter((m) => m.media_type === "VIDEO")

  if (reels.length === 0) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6 text-center">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
          <Film className="w-5 h-5" />
        </div>
        <p className="text-neutral-500 text-sm">No Reels in this period</p>
        <p className="text-neutral-400 text-xs mt-1">Reels-specific metrics appear once you publish video content</p>
      </div>
    )
  }

  // Sort by plays (fall back to reach if plays unavailable)
  const sorted = [...reels].sort((a, b) => {
    const aPlays = a.insights?.reels_plays ?? a.insights?.reach ?? 0
    const bPlays = b.insights?.reels_plays ?? b.insights?.reach ?? 0
    return bPlays - aPlays
  })

  const top = sorted.slice(0, 6)

  // Aggregates across all Reels in the period
  const totalPlays = reels.reduce((sum, r) => sum + (r.insights?.reels_plays ?? 0), 0)
  const totalReplays = reels.reduce((sum, r) => sum + (r.insights?.reels_replays ?? 0), 0)
  const totalWatchMs = reels.reduce((sum, r) => sum + (r.insights?.reels_total_watch_time_ms ?? 0), 0)
  const watchTimes = reels
    .map((r) => r.insights?.reels_avg_watch_time_ms)
    .filter((v): v is number => typeof v === "number" && v > 0)
  const avgWatchMs = watchTimes.length > 0 ? watchTimes.reduce((s, v) => s + v, 0) / watchTimes.length : 0

  return (
    <div className="space-y-4">
      {/* Aggregates */}
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <Film className="w-4 h-4" />
          </div>
          <h3 className="text-neutral-900 font-medium text-sm">Reels performance</h3>
          <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 tabular-nums">
            <span className="inline-block h-1 w-1 rounded-full bg-pink-500" aria-hidden="true" />
            {reels.length} {reels.length === 1 ? "reel" : "reels"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Play, label: "Plays", value: totalPlays > 0 ? formatNumber(totalPlays) : "—", hint: "All-time aggregated" },
            { icon: Clock, label: "Avg watch", value: formatMs(avgWatchMs), hint: "Per-reel average" },
            { icon: Eye, label: "Total watch time", value: formatMs(totalWatchMs), hint: "Sum across reels" },
            { icon: Repeat, label: "Replays", value: totalReplays > 0 ? formatNumber(totalReplays) : "—", hint: "Loop completions" },
          ].map(({ icon: Icon, label, value, hint }) => (
            <div key={label} className="rounded-md ring-1 ring-neutral-200/70 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-1">
                <Icon className="w-3 h-3 text-neutral-400" />
                {label}
              </p>
              <div className="text-neutral-900 font-semibold tabular-nums text-lg">{value}</div>
              <div className="text-neutral-500 text-[11px]">{hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Reels list */}
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100">
          <h3 className="text-neutral-900 font-medium text-sm">Top Reels by plays</h3>
          <p className="text-neutral-500 text-xs tabular-nums">{top.length} of {reels.length}</p>
        </div>
        <div className="divide-y divide-neutral-100">
          {top.map((r, i) => {
            const plays = r.insights?.reels_plays ?? 0
            const avgWatch = r.insights?.reels_avg_watch_time_ms
            const replays = r.insights?.reels_replays ?? 0
            const reach = r.insights?.reach ?? 0

            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="px-4 py-3 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
              >
                <div className="relative w-16 h-16 rounded-md overflow-hidden bg-neutral-100 shrink-0 ring-1 ring-neutral-200/70">
                  <img
                    src={r.thumbnail_url || r.media_url}
                    alt="Reel thumbnail"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement
                      if (!img.src.endsWith("/placeholder.svg")) img.src = "/placeholder.svg"
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {r.caption ? r.caption.substring(0, 80) + (r.caption.length > 80 ? "…" : "") : "Untitled Reel"}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
                    {formatInstagramDate(r.timestamp)}
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-5 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Plays</div>
                    <div className="text-neutral-900 font-semibold tabular-nums text-sm">
                      {plays > 0 ? formatNumber(plays) : formatNumber(reach)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Avg watch</div>
                    <div className="text-neutral-900 font-semibold tabular-nums text-sm">{formatMs(avgWatch)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Replays</div>
                    <div className="text-neutral-900 font-semibold tabular-nums text-sm">
                      {replays > 0 ? formatNumber(replays) : "—"}
                    </div>
                  </div>
                </div>

                <a
                  href={r.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors shrink-0"
                  aria-label="Open Reel on Instagram"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </a>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

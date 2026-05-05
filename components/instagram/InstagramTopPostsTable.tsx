"use client"

import { useState, useMemo } from "react"
import { motion } from "motion/react"
import {
  Heart,
  MessageCircle,
  Share2,
  Eye,
  ExternalLink,
  Target,
  Zap,
  BarChart3,
  ChevronDown,
} from "lucide-react"
import {
  formatNumber,
  formatInstagramDate,
  getMediaTypeDisplayName,
  calculateMediaEngagementRate,
} from "../../lib/instagram-utils"
import type { InstagramMedia, InstagramMediaInsights } from "../../types/instagram-insights"

type MediaTypeFilter = "all" | "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM"
type SortKey = "engagement" | "reach" | "saves" | "shares"

const FILTER_OPTIONS: Array<{ id: MediaTypeFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "IMAGE", label: "Feed" },
  { id: "VIDEO", label: "Reels" },
  { id: "CAROUSEL_ALBUM", label: "Carousel" },
]

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: "engagement", label: "Engagement" },
  { id: "reach", label: "Reach" },
  { id: "saves", label: "Saves" },
  { id: "shares", label: "Shares" },
]

interface InstagramTopPostsTableProps {
  media: Array<
    InstagramMedia & {
      insights: InstagramMediaInsights
      engagement_rate: number
      hashtags: string[]
    }
  >
  followerCount: number
  connectionStatus?: {
    success: boolean
    message?: string
  } | null
}

export function InstagramTopPostsTable({ media, followerCount, connectionStatus }: InstagramTopPostsTableProps) {
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>("all")
  const [sortKey, setSortKey] = useState<SortKey>("engagement")
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  // Filter then sort. Limit to top 6 for the grid; counts in the filter chips
  // reflect the unfiltered population so the user can see the available pool.
  const sortedMedia = useMemo(() => {
    const filtered =
      typeFilter === "all" ? media : media.filter((p) => p.media_type === typeFilter)

    const compare = (a: typeof media[number], b: typeof media[number]) => {
      switch (sortKey) {
        case "reach":
          return (b.insights?.reach || 0) - (a.insights?.reach || 0)
        case "saves":
          return (b.insights?.saves || 0) - (a.insights?.saves || 0)
        case "shares":
          return (b.insights?.shares || 0) - (a.insights?.shares || 0)
        case "engagement":
        default:
          return (
            (b.like_count || 0) + (b.comments_count || 0) -
            ((a.like_count || 0) + (a.comments_count || 0))
          )
      }
    }

    return [...filtered].sort(compare).slice(0, 6)
  }, [media, typeFilter, sortKey])

  // Counts per filter (unfiltered population, for chip badges)
  const counts = useMemo(() => {
    return {
      all: media.length,
      IMAGE: media.filter((p) => p.media_type === "IMAGE").length,
      VIDEO: media.filter((p) => p.media_type === "VIDEO").length,
      CAROUSEL_ALBUM: media.filter((p) => p.media_type === "CAROUSEL_ALBUM").length,
    } as Record<MediaTypeFilter, number>
  }, [media])

  // Calculate aggregate metrics for summary (over filtered+sorted top 6)
  const totalReach = sortedMedia.reduce((sum, p) => sum + (p.insights?.reach || 0), 0)
  const totalEngagement = sortedMedia.reduce((sum, p) => sum + (p.like_count || 0) + (p.comments_count || 0), 0)
  const totalShares = sortedMedia.reduce((sum, p) => sum + (p.insights?.shares || 0), 0)
  const avgEngagementRate = sortedMedia.length > 0
    ? sortedMedia.reduce((sum, p) => sum + calculateMediaEngagementRate(p, followerCount), 0) / sortedMedia.length
    : 0

  const truncateCaption = (caption: string, maxLength = 100): string => {
    if (!caption) return ""
    return caption.length > maxLength ? caption.substring(0, maxLength) + "..." : caption
  }

  if (!connectionStatus?.success) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-md overflow-hidden bg-white ring-1 ring-neutral-200/70">
              <div className="w-full aspect-video bg-neutral-100 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-2/3 bg-neutral-100 rounded animate-pulse" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-8 bg-neutral-100 rounded animate-pulse" />
                  <div className="h-8 bg-neutral-100 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // No media at all — surface a single empty card.
  if (media.length === 0) {
    return (
      <div className="w-full rounded-md bg-white ring-1 ring-neutral-200/70 p-6 sm:p-8 text-center text-neutral-500">
        No posts found
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Performance Summary */}
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h3 className="text-neutral-900 font-medium text-sm">Top content performance summary</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Eye, label: "Total Reach", value: formatNumber(totalReach), hint: "potential customers" },
            { icon: Zap, label: "Engagements", value: formatNumber(totalEngagement), hint: "interested leads" },
            { icon: Share2, label: "Shares", value: formatNumber(totalShares), hint: "organic referrals" },
            { icon: Target, label: "Avg rate", value: `${avgEngagementRate.toFixed(2)}%`, hint: `${avgEngagementRate >= 3 ? "above" : "below"} industry avg` },
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

      {/* Filter + sort controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex h-9 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
          {FILTER_OPTIONS.map((opt) => {
            const isActive = typeFilter === opt.id
            const count = counts[opt.id]
            return (
              <button
                key={opt.id}
                onClick={() => setTypeFilter(opt.id)}
                className={`inline-flex items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {opt.label}
                <span
                  className={`text-[10px] tabular-nums ${
                    isActive ? "text-white/70" : "text-neutral-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setSortMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setSortMenuOpen(false), 120)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            aria-haspopup="listbox"
            aria-expanded={sortMenuOpen}
          >
            <span className="text-neutral-500">Sort:</span>
            {SORT_OPTIONS.find((o) => o.id === sortKey)?.label}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sortMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {sortMenuOpen && (
            <div
              role="listbox"
              className="absolute right-0 top-full mt-1 z-10 min-w-36 rounded-md ring-1 ring-neutral-200 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] py-1"
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  role="option"
                  aria-selected={sortKey === opt.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setSortKey(opt.id)
                    setSortMenuOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                    sortKey === opt.id ? "bg-neutral-100 text-neutral-900" : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {opt.label}
                  {sortKey === opt.id && (
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-900" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Post Cards (or empty filtered state) */}
      {sortedMedia.length === 0 ? (
        <div className="rounded-md bg-white ring-1 ring-neutral-200/70 p-6 text-center text-sm text-neutral-500">
          No {FILTER_OPTIONS.find((o) => o.id === typeFilter)?.label.toLowerCase()} posts in this period
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedMedia.map((post, index) => {
          const engagementRate = calculateMediaEngagementRate(post, followerCount)
          const shares = post.insights?.shares || 0
          const reach = post.insights?.reach || 0
          const saves = post.insights?.saves || 0
          const totalEngagement = (post.like_count || 0) + (post.comments_count || 0)

          // Fallback logic: if reach is 0, show engagement (likes + comments) which is always available
          const primaryMetricValue = reach > 0 ? reach : totalEngagement
          const primaryMetricLabel = reach > 0 ? "Reach" : "Engagement"

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-md overflow-hidden bg-white ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:-translate-y-0.5 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-[transform,box-shadow,outline-color]"
            >
              {/* Media with media-type badge */}
              <div className="relative w-full aspect-video bg-neutral-100">
                <img
                  src={post.thumbnail_url || post.media_url}
                  alt={getMediaTypeDisplayName(post.media_type)}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    if (!img.src.endsWith("/placeholder.svg")) img.src = "/placeholder.svg"
                  }}
                />

                {/* Mono media-type badge with brand-color dot */}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/90 ring-1 ring-neutral-200 text-neutral-700 text-[10px] font-medium uppercase tracking-[0.16em]">
                    <span className="inline-block h-1 w-1 rounded-full bg-pink-500" aria-hidden="true" />
                    {getMediaTypeDisplayName(post.media_type)}
                  </span>
                </div>

                {/* Quick Stats Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {formatNumber(post.like_count || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {formatNumber(post.comments_count || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        {formatNumber(shares)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-3 sm:p-4">
                {/* Caption & Date */}
                <div className="min-w-0 mb-3">
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-neutral-900 hover:text-neutral-950 transition-colors line-clamp-2 wrap-break-word"
                  >
                    {truncateCaption(post.caption, 80) || "View on Instagram"}
                  </a>
                  <div className="mt-1 text-neutral-500 text-xs tabular-nums">
                    {formatInstagramDate(post.timestamp)}
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-md ring-1 ring-neutral-200/70 p-2 text-center">
                    <div className="text-neutral-500 text-[10px] uppercase tracking-[0.16em]">{primaryMetricLabel}</div>
                    <div className="text-neutral-900 font-semibold tabular-nums text-sm">{formatNumber(primaryMetricValue)}</div>
                  </div>
                  <div className="rounded-md ring-1 ring-neutral-200/70 p-2 text-center">
                    <div className="text-neutral-500 text-[10px] uppercase tracking-[0.16em]">{saves > 0 ? "Saves" : "Likes"}</div>
                    <div className="text-neutral-900 font-semibold tabular-nums text-sm">{formatNumber(saves > 0 ? saves : post.like_count || 0)}</div>
                  </div>
                  <div className="rounded-md ring-1 ring-neutral-200/70 p-2 text-center">
                    <div className="text-neutral-500 text-[10px] uppercase tracking-[0.16em]">Eng Rate</div>
                    <div className="text-neutral-900 font-semibold tabular-nums text-sm">{engagementRate.toFixed(1)}%</div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex justify-end pt-2 border-t border-neutral-100">
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View
                  </a>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
      )}
    </div>
  )
}

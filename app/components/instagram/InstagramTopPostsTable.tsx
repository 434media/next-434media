"use client"

import {
  formatNumber,
  formatInstagramDate,
  getMediaTypeDisplayName,
  calculateMediaEngagementRate,
} from "../../lib/instagram-utils"
import type { InstagramMedia, InstagramMediaInsights } from "../../types/instagram-insights"

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
  // Sort by engagement (likes + comments)
  const sortedMedia = [...media]
    .sort((a, b) => {
      const aEngagement = (a.like_count || 0) + (a.comments_count || 0)
      const bEngagement = (b.like_count || 0) + (b.comments_count || 0)
      return bEngagement - aEngagement
    })
    .slice(0, 6) // Top 6 posts for grid

  const truncateCaption = (caption: string, maxLength = 100): string => {
    if (!caption) return ""
    return caption.length > maxLength ? caption.substring(0, maxLength) + "..." : caption
  }

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-400 font-medium">{label}</span>
      <span className="text-sm sm:text-base font-bold text-white tabular-nums leading-tight">{value}</span>
    </div>
  )

  if (!connectionStatus?.success) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-slate-900/60 border border-slate-700">
              <div className="w-full aspect-video bg-slate-800 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-2/3 bg-slate-800 rounded animate-pulse" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-8 bg-slate-800 rounded animate-pulse" />
                  <div className="h-8 bg-slate-800 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (sortedMedia.length === 0) {
    return (
      <div className="w-full rounded-xl bg-slate-900/60 border border-slate-700 p-6 sm:p-8 text-center text-slate-400">
        No posts found
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedMedia.map((post) => {
          const engagementRate = calculateMediaEngagementRate(post, followerCount)
          const shares = post.insights?.shares || 0
          const interactions = post.insights?.engagement || 0

          return (
            <div
              key={post.id}
              className="rounded-xl overflow-hidden bg-slate-900/60 border border-pink-500/20 hover:border-pink-500/40 transition-colors"
            >
              {/* Media */}
              <div className="relative w-full aspect-video bg-slate-800">
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
                <div className="absolute top-2 left-2 inline-flex items-center px-2 py-1 rounded bg-pink-500/90 text-white text-xs font-semibold uppercase tracking-wide border border-white/10">
                  {getMediaTypeDisplayName(post.media_type)}
                </div>
              </div>

              {/* Content */}
              <div className="p-3 sm:p-4">
                <div className="min-w-0 mb-3">
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm sm:text-base font-bold text-white hover:text-pink-300 transition-colors line-clamp-2 break-words"
                  >
                    {truncateCaption(post.caption, 80) || "View on Instagram"}
                  </a>
                  <div className="mt-1 text-slate-400 text-xs font-medium">
                    {formatInstagramDate(post.timestamp)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Stat label="Likes" value={formatNumber(post.like_count || 0)} />
                  <Stat label="Comments" value={formatNumber(post.comments_count || 0)} />
                  <Stat label="Shares" value={formatNumber(shares)} />
                  <Stat label="Interactions" value={formatNumber(interactions)} />
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="text-slate-300 text-xs">
                    <span className="font-medium">Engagement: </span>
                    <span className="font-bold text-pink-400">{engagementRate.toFixed(2)}%</span>
                  </div>
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-2 py-1 rounded-md bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-colors"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

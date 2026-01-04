"use client"

import { motion } from "framer-motion"
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Eye, 
  ExternalLink,
  Trophy,
  Target,
  Zap,
  BarChart3
} from "lucide-react"
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

  // Calculate aggregate metrics for summary
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
            <div key={i} className="rounded-xl overflow-hidden bg-neutral-50 border border-neutral-200">
              <div className="w-full aspect-video bg-neutral-200 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-2/3 bg-neutral-200 rounded animate-pulse" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-8 bg-neutral-200 rounded animate-pulse" />
                  <div className="h-8 bg-neutral-200 rounded animate-pulse" />
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
      <div className="w-full rounded-xl bg-neutral-50 border border-neutral-200 p-6 sm:p-8 text-center text-neutral-500">
        No posts found
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Performance Summary for Sales/Marketing */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-pink-600" />
          <h3 className="text-neutral-900 font-semibold text-sm">Top Content Performance Summary</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Eye className="w-3 h-3 text-blue-600" />
              <span className="text-neutral-500 text-xs">Total Reach</span>
            </div>
            <div className="text-neutral-900 font-bold text-lg">{formatNumber(totalReach)}</div>
            <div className="text-neutral-400 text-xs">potential customers</div>
          </div>
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="w-3 h-3 text-yellow-600" />
              <span className="text-neutral-500 text-xs">Engagements</span>
            </div>
            <div className="text-neutral-900 font-bold text-lg">{formatNumber(totalEngagement)}</div>
            <div className="text-neutral-400 text-xs">interested leads</div>
          </div>
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Share2 className="w-3 h-3 text-emerald-600" />
              <span className="text-neutral-500 text-xs">Shares</span>
            </div>
            <div className="text-neutral-900 font-bold text-lg">{formatNumber(totalShares)}</div>
            <div className="text-neutral-400 text-xs">organic referrals</div>
          </div>
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="w-3 h-3 text-pink-600" />
              <span className="text-neutral-500 text-xs">Avg Rate</span>
            </div>
            <div className="text-neutral-900 font-bold text-lg">{avgEngagementRate.toFixed(2)}%</div>
            <div className="text-neutral-400 text-xs">{avgEngagementRate >= 3 ? "above" : "below"} industry avg</div>
          </div>
        </div>
      </div>

      {/* Post Cards */}
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
              className="rounded-xl overflow-hidden bg-white border border-neutral-200 hover:border-pink-300 transition-all hover:shadow-lg"
            >
              {/* Media with Rank Badge */}
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
                
                {/* Media Type & Performance Tier */}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="inline-flex items-center px-2 py-1 rounded bg-pink-500 text-white text-xs font-semibold uppercase tracking-wide">
                    {getMediaTypeDisplayName(post.media_type)}
                  </span>
                </div>

                {/* Quick Stats Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <div className="flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-3">
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
                    className="text-sm font-semibold text-neutral-900 hover:text-pink-600 transition-colors line-clamp-2 break-words"
                  >
                    {truncateCaption(post.caption, 80) || "View on Instagram"}
                  </a>
                  <div className="mt-1 text-neutral-500 text-xs">
                    {formatInstagramDate(post.timestamp)}
                  </div>
                </div>

                {/* Marketing Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 bg-neutral-50 rounded-lg">
                    <div className="text-neutral-500 text-[10px] uppercase">{primaryMetricLabel}</div>
                    <div className="text-neutral-900 font-bold text-sm">{formatNumber(primaryMetricValue)}</div>
                  </div>
                  <div className="text-center p-2 bg-neutral-50 rounded-lg">
                    <div className="text-neutral-500 text-[10px] uppercase">{saves > 0 ? "Saves" : "Likes"}</div>
                    <div className="text-neutral-900 font-bold text-sm">{formatNumber(saves > 0 ? saves : post.like_count || 0)}</div>
                  </div>
                  <div className="text-center p-2 bg-neutral-50 rounded-lg">
                    <div className="text-neutral-500 text-[10px] uppercase">Eng Rate</div>
                    <div className="text-pink-600 font-bold text-sm">{engagementRate.toFixed(1)}%</div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex justify-end pt-2 border-t border-neutral-100">
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-colors"
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
    </div>
  )
}

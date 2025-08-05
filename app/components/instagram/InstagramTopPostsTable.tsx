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
    .slice(0, 10) // Top 10 posts

  const truncateCaption = (caption: string, maxLength = 100): string => {
    if (!caption) return ""
    return caption.length > maxLength ? caption.substring(0, maxLength) + "..." : caption
  }

  return (
    <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-600 p-6">
      <h2 className="text-xl font-semibold text-white mb-6">Top Performing Posts</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="text-left py-3 px-2 text-sm font-medium text-slate-300">Post</th>
              <th className="text-left py-3 px-2 text-sm font-medium text-slate-300">Type</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-slate-300">Likes</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-slate-300">Comments</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-slate-300">Impressions</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-slate-300">Reach</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-slate-300">Engagement Rate</th>
              <th className="text-left py-3 px-2 text-sm font-medium text-slate-300">Date</th>
            </tr>
          </thead>
          <tbody>
            {connectionStatus?.success ? (
              sortedMedia.length > 0 ? (
                sortedMedia.map((post) => {
                  const engagementRate = calculateMediaEngagementRate(post, followerCount)

                  return (
                    <tr key={post.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-2">
                        <div className="flex items-center space-x-3">
                          <img
                            src={post.thumbnail_url || post.media_url}
                            alt="Post thumbnail"
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{truncateCaption(post.caption, 50)}</p>
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-purple-400 hover:text-purple-300"
                            >
                              View on Instagram
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm text-slate-300">{getMediaTypeDisplayName(post.media_type)}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm text-white">{formatNumber(post.like_count || 0)}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm text-white">{formatNumber(post.comments_count || 0)}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm text-white">{formatNumber(post.insights?.impressions || 0)}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm text-white">{formatNumber(post.insights?.reach || 0)}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm text-white">{engagementRate.toFixed(2)}%</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm text-slate-300">{formatInstagramDate(post.timestamp)}</span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <p className="text-slate-400">No posts found</p>
                  </td>
                </tr>
              )
            ) : (
              // Show placeholder rows when not connected
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="border-b border-slate-700/50">
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-lg bg-slate-700"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-700 rounded mb-1"></div>
                        <div className="h-3 bg-slate-700 rounded w-24"></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="h-4 bg-slate-700 rounded w-16"></div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="h-4 bg-slate-700 rounded w-12 ml-auto"></div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="h-4 bg-slate-700 rounded w-12 ml-auto"></div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="h-4 bg-slate-700 rounded w-12 ml-auto"></div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="h-4 bg-slate-700 rounded w-12 ml-auto"></div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="h-4 bg-slate-700 rounded w-12 ml-auto"></div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="h-4 bg-slate-700 rounded w-20"></div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
  )
}

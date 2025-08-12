"use client"

import {
  formatNumber,
  formatInstagramDate,
  getMediaTypeDisplayName,
  calculateMediaEngagementRate,
} from "../../lib/instagram-utils"
import type { InstagramMedia, InstagramMediaInsights } from "../../types/instagram-insights"
import { useHorizontalScroll } from "../../hooks/use-horizontal-scroll"
import { ChevronLeft, ChevronRight } from "lucide-react"

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
  const { scrollRef, canScrollLeft, canScrollRight, scroll } = useHorizontalScroll()

  // Sort by engagement (likes + comments)
  const sortedMedia = [...media]
    .sort((a, b) => {
      const aEngagement = (a.like_count || 0) + (a.comments_count || 0)
      const bEngagement = (b.like_count || 0) + (b.comments_count || 0)
      return bEngagement - aEngagement
    })
    .slice(0, 10) // Top 10 posts

  const truncateCaption = (caption: string, maxLength = 140): string => {
    if (!caption) return ""
    return caption.length > maxLength ? caption.substring(0, maxLength) + "..." : caption
  }

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col min-w-0">
      <span className="text-xs md:text-sm uppercase tracking-wide text-slate-300 font-semibold">{label}</span>
      <span className="text-lg md:text-xl font-black text-white tabular-nums whitespace-nowrap leading-tight">{value}</span>
    </div>
  )

  return (
    <div className="relative bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <h2 className="text-2xl md:text-3xl font-black text-white">Top Performing Posts</h2>
      </div>

      {/* Carousel */}
      <div className="relative">
    {/* Overlay controls (mobile + desktop) */}
    <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="pointer-events-auto h-8 w-8 md:h-12 md:w-12 rounded-full bg-black/50 text-white grid place-items-center backdrop-blur-sm border border-white/20 hover:bg-black/70 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft className="h-4 w-4 md:h-6 md:w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="pointer-events-auto h-8 w-8 md:h-12 md:w-12 rounded-full bg-black/50 text-white grid place-items-center backdrop-blur-sm border border-white/20 hover:bg-black/70 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronRight className="h-4 w-4 md:h-6 md:w-6" aria-hidden="true" />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
          style={{ scrollSnapType: "x mandatory" }}
        >
          <div className="flex gap-4">
            {connectionStatus?.success ? (
              sortedMedia.length > 0 ? (
                sortedMedia.map((post) => {
                  const engagementRate = calculateMediaEngagementRate(post, followerCount)
                  const shares = post.insights?.shares || 0
                  const interactions = post.insights?.engagement || 0

                  return (
                    <div
                      key={post.id}
                      className="snap-start shrink-0 basis-full md:basis-1/2 lg:basis-1/3 rounded-xl overflow-hidden bg-slate-900/60 border border-slate-700"
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
                        <div className="absolute top-3 left-3 inline-flex items-center px-2 py-1 rounded bg-black/60 text-white text-xs font-semibold uppercase tracking-wide border border-white/10">
                          {getMediaTypeDisplayName(post.media_type)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 md:p-6">
                        <div className="flex flex-col gap-4">
                          <div className="min-w-0">
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-lg md:text-xl font-extrabold text-white hover:text-purple-300 transition-colors line-clamp-2 break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 rounded-sm"
                            >
                              {truncateCaption(post.caption, 100) || "View on Instagram"}
                            </a>
                            <div className="mt-1 text-slate-300 text-sm font-semibold">
                              {formatInstagramDate(post.timestamp)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 md:gap-4 justify-items-start">
                            <Stat label="Likes" value={formatNumber(post.like_count || 0)} />
                            <Stat label="Comments" value={formatNumber(post.comments_count || 0)} />
                            <Stat label="Shares" value={formatNumber(shares)} />
                            <Stat label="Interactions" value={formatNumber(interactions)} />
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-slate-300 text-sm">
                            <span className="font-semibold">Engagement Rate: </span>
                            <span className="font-black text-white">{engagementRate.toFixed(2)}%</span>
                          </div>
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold"
                          >
                            Open Post
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="snap-center shrink-0 w-full rounded-xl bg-slate-900/60 border border-slate-700 p-8 text-center text-slate-400">
                  No posts found
                </div>
              )
            ) : (
              // Placeholder cards when not connected
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="snap-center shrink-0 w-full rounded-xl overflow-hidden bg-slate-900/60 border border-slate-700">
                  <div className="w-full aspect-video bg-slate-800 animate-pulse" />
                  <div className="p-6 space-y-4">
                    <div className="h-6 w-2/3 bg-slate-800 rounded animate-pulse" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="h-10 bg-slate-800 rounded animate-pulse" />
                      <div className="h-10 bg-slate-800 rounded animate-pulse" />
                      <div className="h-10 bg-slate-800 rounded animate-pulse" />
                      <div className="h-10 bg-slate-800 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Not Connected Overlay (kept subtle) */}
      {!connectionStatus?.success && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-red-500/30 pointer-events-none" />
      )}
    </div>
  )
}

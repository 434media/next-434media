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
      <span className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-400 font-medium">{label}</span>
      <span className="text-base sm:text-lg font-bold text-white tabular-nums whitespace-nowrap leading-tight">{value}</span>
    </div>
  )

  return (
    <div className="relative overflow-hidden w-full max-w-full">
      {/* Carousel */}
      <div className="relative">
    {/* Overlay controls (mobile + desktop) */}
    <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1 z-10">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="pointer-events-auto h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-pink-500/80 text-white grid place-items-center backdrop-blur-sm border border-pink-400/30 hover:bg-pink-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="pointer-events-auto h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-pink-500/80 text-white grid place-items-center backdrop-blur-sm border border-pink-400/30 hover:bg-pink-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 transition-colors"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-1"
          style={{ scrollSnapType: "x mandatory" }}
        >
          <div className="flex gap-3 sm:gap-4">
            {connectionStatus?.success ? (
              sortedMedia.length > 0 ? (
                sortedMedia.map((post) => {
                  const engagementRate = calculateMediaEngagementRate(post, followerCount)
                  const shares = post.insights?.shares || 0
                  const interactions = post.insights?.engagement || 0

                  return (
                    <div
                      key={post.id}
                      className="snap-start shrink-0 basis-[85%] sm:basis-[70%] md:basis-1/2 lg:basis-1/3 rounded-xl overflow-hidden bg-slate-900/60 border border-pink-500/20 hover:border-pink-500/40 transition-colors"
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
                        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 inline-flex items-center px-2 py-1 rounded bg-pink-500/90 text-white text-xs font-semibold uppercase tracking-wide border border-white/10">
                          {getMediaTypeDisplayName(post.media_type)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-3 sm:p-4 md:p-5">
                        <div className="flex flex-col gap-3 sm:gap-4">
                          <div className="min-w-0">
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-base sm:text-lg font-extrabold text-white hover:text-pink-300 transition-colors line-clamp-2 break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/70 rounded-sm"
                            >
                              {truncateCaption(post.caption, 100) || "View on Instagram"}
                            </a>
                            <div className="mt-1 text-slate-400 text-xs sm:text-sm font-medium">
                              {formatInstagramDate(post.timestamp)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:gap-3 justify-items-start">
                            <Stat label="Likes" value={formatNumber(post.like_count || 0)} />
                            <Stat label="Comments" value={formatNumber(post.comments_count || 0)} />
                            <Stat label="Shares" value={formatNumber(shares)} />
                            <Stat label="Interactions" value={formatNumber(interactions)} />
                          </div>
                        </div>

                        <div className="mt-3 sm:mt-4 flex items-center justify-between gap-2">
                          <div className="text-slate-300 text-xs sm:text-sm">
                            <span className="font-medium">Engagement: </span>
                            <span className="font-bold text-pink-400">{engagementRate.toFixed(2)}%</span>
                          </div>
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md bg-pink-500 hover:bg-pink-600 text-white text-xs sm:text-sm font-bold transition-colors shrink-0"
                          >
                            Open
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="snap-center shrink-0 w-full rounded-xl bg-slate-900/60 border border-slate-700 p-6 sm:p-8 text-center text-slate-400">
                  No posts found
                </div>
              )
            ) : (
              // Placeholder cards when not connected
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="snap-center shrink-0 basis-[85%] sm:basis-[70%] md:basis-1/2 lg:basis-1/3 rounded-xl overflow-hidden bg-slate-900/60 border border-slate-700">
                  <div className="w-full aspect-video bg-slate-800 animate-pulse" />
                  <div className="p-4 sm:p-6 space-y-4">
                    <div className="h-5 sm:h-6 w-2/3 bg-slate-800 rounded animate-pulse" />
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="h-8 sm:h-10 bg-slate-800 rounded animate-pulse" />
                      <div className="h-8 sm:h-10 bg-slate-800 rounded animate-pulse" />
                      <div className="h-8 sm:h-10 bg-slate-800 rounded animate-pulse" />
                      <div className="h-8 sm:h-10 bg-slate-800 rounded animate-pulse" />
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

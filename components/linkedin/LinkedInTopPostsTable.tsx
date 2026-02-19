"use client"

import { useState } from "react"
import type { LinkedInPostWithInsights } from "../../types/linkedin-insights"

interface LinkedInTopPostsTableProps {
  posts: LinkedInPostWithInsights[]
  connectionStatus: {
    success: boolean
    message?: string
  } | null
}

const INITIAL_POSTS_COUNT = 5

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toLocaleString()
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}

export function LinkedInTopPostsTable({ posts, connectionStatus }: LinkedInTopPostsTableProps) {
  const [showAll, setShowAll] = useState(false)

  if (!connectionStatus?.success) {
    return (
      <div className="p-4 rounded-xl bg-white border border-neutral-200">
        <p className="text-neutral-500 text-sm">Connect to LinkedIn API to view posts.</p>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="p-8 rounded-xl bg-white border border-neutral-200 text-center">
        <svg
          className="w-12 h-12 mx-auto text-neutral-300 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
        <p className="text-neutral-500 text-sm">No posts found for this period.</p>
      </div>
    )
  }

  // Sort posts by engagement (or impressions as fallback)
  const sortedPosts = [...posts].sort(
    (a, b) => (b.insights?.impressions || 0) - (a.insights?.impressions || 0)
  )

  // Show limited posts unless "Show All" is clicked
  const displayedPosts = showAll ? sortedPosts : sortedPosts.slice(0, INITIAL_POSTS_COUNT)
  const hasMorePosts = sortedPosts.length > INITIAL_POSTS_COUNT

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50">
              <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                Post
              </th>
              <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                Impressions
              </th>
              <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                Reactions
              </th>
              <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                Comments
              </th>
              <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                Shares
              </th>
              <th className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                Clicks
              </th>
              <th className="text-right text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                Eng. Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {displayedPosts.map((post, index) => (
              <tr
                key={post.id}
                className="hover:bg-neutral-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3 max-w-md">
                    <span className="text-xs text-neutral-400 font-medium mt-1">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900 line-clamp-2">
                        {post.commentary || "No text content"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-500">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                        {post.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#0077B5] hover:underline"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-neutral-900">
                    {formatNumber(post.insights?.impressions || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-[#0077B5]">
                    {formatNumber(post.insights?.likes || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-neutral-700">
                    {formatNumber(post.insights?.comments || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-neutral-700">
                    {formatNumber(post.insights?.shares || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-emerald-600">
                    {formatNumber(post.insights?.clicks || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`text-sm font-medium ${
                      (post.insights?.engagementRate || 0) >= 2
                        ? "text-emerald-600"
                        : (post.insights?.engagementRate || 0) >= 1
                        ? "text-yellow-600"
                        : "text-neutral-500"
                    }`}
                  >
                    {(post.insights?.engagementRate || 0).toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-neutral-100">
        {displayedPosts.map((post, index) => (
          <div key={post.id} className="p-4 hover:bg-neutral-50 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-xs text-neutral-400 font-medium">#{index + 1}</span>
              <div className="flex-1">
                <p className="text-sm text-neutral-900 line-clamp-3 mb-1">
                  {post.commentary || "No text content"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#0077B5] hover:underline"
                    >
                      View post
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-neutral-50">
                <p className="text-xs text-neutral-500">Impressions</p>
                <p className="text-sm font-medium text-neutral-900">
                  {formatNumber(post.insights?.impressions || 0)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-neutral-50">
                <p className="text-xs text-neutral-500">Reactions</p>
                <p className="text-sm font-medium text-[#0077B5]">
                  {formatNumber(post.insights?.likes || 0)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-neutral-50">
                <p className="text-xs text-neutral-500">Eng. Rate</p>
                <p
                  className={`text-sm font-medium ${
                    (post.insights?.engagementRate || 0) >= 2
                      ? "text-emerald-600"
                      : (post.insights?.engagementRate || 0) >= 1
                      ? "text-yellow-600"
                      : "text-neutral-500"
                  }`}
                >
                  {(post.insights?.engagementRate || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show More/Less Button */}
      {hasMorePosts && (
        <div className="p-4 border-t border-neutral-100">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full py-2 px-4 text-sm font-medium text-[#0077B5] hover:text-[#00a0dc] transition-colors flex items-center justify-center gap-2"
          >
            {showAll ? (
              <>
                Show Less
                <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            ) : (
              <>
                Show More ({sortedPosts.length - INITIAL_POSTS_COUNT} more posts)
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

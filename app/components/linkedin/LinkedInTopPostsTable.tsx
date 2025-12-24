"use client"

import type { LinkedInPostWithInsights } from "../../types/linkedin-insights"

interface LinkedInTopPostsTableProps {
  posts: LinkedInPostWithInsights[]
  connectionStatus: {
    success: boolean
    message?: string
  } | null
}

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
  if (!connectionStatus?.success) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-white/60 text-sm">Connect to LinkedIn API to view posts.</p>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center">
        <svg
          className="w-12 h-12 mx-auto text-white/20 mb-3"
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
        <p className="text-white/60 text-sm">No posts found for this period.</p>
      </div>
    )
  }

  // Sort posts by engagement
  const sortedPosts = [...posts].sort(
    (a, b) => (b.insights?.engagement || 0) - (a.insights?.engagement || 0)
  )

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5">
              <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">
                Post
              </th>
              <th className="text-center text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">
                Impressions
              </th>
              <th className="text-center text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">
                Reactions
              </th>
              <th className="text-center text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">
                Comments
              </th>
              <th className="text-center text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">
                Shares
              </th>
              <th className="text-center text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">
                Clicks
              </th>
              <th className="text-right text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">
                Eng. Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedPosts.map((post, index) => (
              <tr
                key={post.id}
                className="hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3 max-w-md">
                    <span className="text-xs text-white/30 font-medium mt-1">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white line-clamp-2">
                        {post.commentary || "No text content"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-white/40">
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
                  <span className="text-sm font-medium text-white">
                    {formatNumber(post.insights?.impressions || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-[#0077B5]">
                    {formatNumber(post.insights?.likes || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-white/80">
                    {formatNumber(post.insights?.comments || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-white/80">
                    {formatNumber(post.insights?.shares || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-emerald-400">
                    {formatNumber(post.insights?.clicks || 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`text-sm font-medium ${
                      (post.insights?.engagementRate || 0) >= 2
                        ? "text-emerald-400"
                        : (post.insights?.engagementRate || 0) >= 1
                        ? "text-yellow-400"
                        : "text-white/60"
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
      <div className="md:hidden divide-y divide-white/5">
        {sortedPosts.map((post, index) => (
          <div key={post.id} className="p-4 hover:bg-white/5 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-xs text-white/30 font-medium">#{index + 1}</span>
              <div className="flex-1">
                <p className="text-sm text-white line-clamp-3 mb-1">
                  {post.commentary || "No text content"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">
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
              <div className="p-2 rounded-lg bg-white/5">
                <p className="text-xs text-white/40">Impressions</p>
                <p className="text-sm font-medium text-white">
                  {formatNumber(post.insights?.impressions || 0)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-white/5">
                <p className="text-xs text-white/40">Reactions</p>
                <p className="text-sm font-medium text-[#0077B5]">
                  {formatNumber(post.insights?.likes || 0)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-white/5">
                <p className="text-xs text-white/40">Eng. Rate</p>
                <p
                  className={`text-sm font-medium ${
                    (post.insights?.engagementRate || 0) >= 2
                      ? "text-emerald-400"
                      : (post.insights?.engagementRate || 0) >= 1
                      ? "text-yellow-400"
                      : "text-white/60"
                  }`}
                >
                  {(post.insights?.engagementRate || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

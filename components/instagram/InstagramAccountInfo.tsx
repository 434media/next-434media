"use client"

import { formatNumber } from "../../lib/instagram-utils"

interface InstagramAccountInfoProps {
  account: {
    id: string
    username: string
    name: string
    biography?: string
    profile_picture_url: string
    website?: string
    followers_count: number
    follows_count: number
    media_count: number
  }
}

export function InstagramAccountInfo({ account }: InstagramAccountInfoProps) {
  return (
    <div className="rounded-md ring-1 ring-neutral-200/70 bg-white p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Profile — pink reserved for the avatar ring (brand identity) */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-0.5 ring-2 ring-pink-500 rounded-full shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-neutral-100">
              <img
                src={account.profile_picture_url || "/placeholder.svg"}
                alt={`${account.username} profile`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-neutral-900 text-sm sm:text-base font-medium truncate">
              {account.name || account.biography}
            </h3>
            <a
              href={`https://www.instagram.com/${account.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 text-xs sm:text-sm font-medium hover:text-neutral-900 transition-colors"
            >
              @{account.username}
            </a>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex justify-between sm:justify-end gap-6 sm:gap-8">
          <div className="text-center sm:text-right">
            <div className="text-lg sm:text-2xl font-semibold tabular-nums text-neutral-900">
              {formatNumber(account.followers_count)}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              Followers
            </div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-lg sm:text-2xl font-semibold tabular-nums text-neutral-900">
              {formatNumber(account.follows_count)}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              Following
            </div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-lg sm:text-2xl font-semibold tabular-nums text-neutral-900">
              {formatNumber(account.media_count)}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              Posts
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

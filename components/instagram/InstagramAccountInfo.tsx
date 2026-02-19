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
    <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-sm">
      {/* Pink gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-400 to-pink-600 opacity-80" />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Profile */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-0.5 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-white">
              <img
                src={account.profile_picture_url || "/placeholder.svg"}
                alt={`${account.username} profile`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-neutral-900 text-sm sm:text-base font-bold truncate">{account.name || account.biography}</h3>
            <a 
              href={`https://www.instagram.com/${account.username}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-pink-600 text-xs sm:text-sm font-medium hover:underline"
            >
              @{account.username}
            </a>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex justify-between sm:justify-end gap-4 sm:gap-8">
          <div className="text-center sm:text-right">
            <div className="text-lg sm:text-2xl font-bold text-neutral-900">{formatNumber(account.followers_count)}</div>
            <div className="text-[10px] sm:text-xs text-neutral-500 font-medium">Followers</div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-lg sm:text-2xl font-bold text-neutral-900">{formatNumber(account.follows_count)}</div>
            <div className="text-[10px] sm:text-xs text-neutral-500 font-medium">Following</div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-lg sm:text-2xl font-bold text-neutral-900">{formatNumber(account.media_count)}</div>
            <div className="text-[10px] sm:text-xs text-neutral-500 font-medium">Posts</div>
          </div>
        </div>
      </div>
    </div>
  )
}

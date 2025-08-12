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
    <div
      className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6 bg-gradient-to-r from-white/10 to-white/5 rounded-xl border border-white/10 shadow-xl"
      style={{
        willChange: "auto",
        backfaceVisibility: "hidden",
        transform: "translateZ(0)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-xl shadow-lg transition-transform duration-200 hover:scale-105"
          style={{ willChange: "transform" }}
        >
          <div className="w-12 h-12 rounded-lg overflow-hidden">
            <img
              src={account.profile_picture_url || "/placeholder.svg"}
              alt={`${account.username} profile`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div>
          <h3 className="text-white text-xl font-bold mb-1">{account.biography}</h3>
          <a href={`https://www.instagram.com/${account.username}`} target="_blank" rel="noopener noreferrer" className="text-white/60 text-sm font-medium hover:underline">
            <p>
              @{account.username}
            </p>
          </a>
        </div>
      </div>

      <div className="flex justify-between gap-0 lg:gap-8">
        <div className="text-center">
          <div className="text-2xl lg:text-3xl font-bold text-white mb-1">{formatNumber(account.followers_count)}</div>
          <div className="text-sm text-slate-300 font-medium">Followers</div>
        </div>
        <div className="text-center">
          <div className="text-2xl lg:text-3xl font-bold text-white mb-1">{formatNumber(account.follows_count)}</div>
          <div className="text-sm text-slate-300 font-medium">Following</div>
        </div>
        <div className="text-center">
          <div className="text-2xl lg:text-3xl font-bold text-white mb-1">{formatNumber(account.media_count)}</div>
          <div className="text-sm text-slate-300 font-medium">Posts</div>
        </div>
      </div>
    </div>
  )
}

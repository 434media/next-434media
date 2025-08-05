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
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-600 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Account Information</h2>

      <div className="flex items-start space-x-6">
        <img
          src={account.profile_picture_url || "/placeholder.svg"}
          alt={`${account.username} profile`}
          className="w-20 h-20 rounded-full border-2 border-purple-400"
        />

        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{formatNumber(account.followers_count)}</div>
              <div className="text-sm text-slate-400">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{formatNumber(account.follows_count)}</div>
              <div className="text-sm text-slate-400">Following</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{formatNumber(account.media_count)}</div>
              <div className="text-sm text-slate-400">Posts</div>
            </div>
          </div>

          {account.biography && (
            <div className="mb-3">
              <p className="text-slate-300 text-sm">{account.biography}</p>
            </div>
          )}

          {account.website && (
            <div>
              <a
                href={account.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 text-sm underline"
              >
                {account.website}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

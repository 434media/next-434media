"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Instagram, ExternalLink, Heart, MessageCircle } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { InstagramPortfolioSummary } from "@/lib/instagram-portfolio"

type Brand = InstagramPortfolioSummary["brands"][number]

interface MediaItem {
  id: string
  caption?: string
  media_type?: string
  media_url?: string
  permalink?: string
  thumbnail_url?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
}

interface BrandPeekDrawerInstagramProps {
  open: boolean
  onClose: () => void
  brand: Brand | null
}

export function BrandPeekDrawerInstagram({
  open,
  onClose,
  brand,
}: BrandPeekDrawerInstagramProps) {
  const [media, setMedia] = useState<MediaItem[] | null>(null)
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)

  // Lazy-fetch recent posts whenever the drawer opens for a new account.
  useEffect(() => {
    if (!open || !brand) return
    let cancelled = false
    setIsLoadingMedia(true)
    setMedia(null)

    fetch(
      `/api/instagram/snapshot?account=${encodeURIComponent(brand.account)}&endpoint=media`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((payload: { data?: MediaItem[] }) => {
        if (!cancelled) setMedia(payload.data?.slice(0, 6) ?? [])
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[BrandPeekDrawerInstagram]", err)
          setMedia([])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMedia(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, brand?.account])

  const fullDashboardUrl = brand
    ? `/admin/analytics?tab=instagram&account=${encodeURIComponent(brand.account)}`
    : "#"

  const hasBaseline = !!brand?.priorSnapshotDate

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-2">
          <Instagram className="w-4 h-4 text-pink-500 shrink-0" />
          <span className="truncate">{brand?.name ?? "Account"}</span>
        </span>
      }
      subtitle={brand?.username ? `@${brand.username}` : undefined}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] font-medium text-neutral-600 hover:text-neutral-900"
          >
            Close
          </button>
          <Link
            href={fullDashboardUrl}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
          >
            Open full dashboard
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      }
    >
      {brand && (
        <div className="p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Followers" value={brand.followersCount.toLocaleString()} />
            <StatTile
              label="Net growth"
              value={hasBaseline ? formatSignedNumber(brand.netFollowerGrowth) : "—"}
              tone={
                !hasBaseline
                  ? "neutral"
                  : brand.netFollowerGrowth > 0
                  ? "positive"
                  : brand.netFollowerGrowth < 0
                  ? "negative"
                  : "neutral"
              }
            />
            <StatTile
              label="Growth %"
              value={hasBaseline ? `${brand.followerGrowthChange.toFixed(1)}%` : "—"}
              tone={
                !hasBaseline
                  ? "neutral"
                  : brand.followerGrowthChange > 0
                  ? "positive"
                  : brand.followerGrowthChange < 0
                  ? "negative"
                  : "neutral"
              }
            />
            <StatTile label="Posts" value={brand.mediaCount.toLocaleString()} />
          </div>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Recent posts
            </h3>
            {isLoadingMedia ? (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-md bg-neutral-100 animate-pulse"
                  />
                ))}
              </div>
            ) : media && media.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {media.map((post) => (
                  <a
                    key={post.id}
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/post relative aspect-square rounded-md overflow-hidden bg-neutral-100 block"
                    title={post.caption?.slice(0, 100)}
                  >
                    {post.thumbnail_url || post.media_url ? (
                      // External Instagram CDN — Next/Image needs a domain config we don't own.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.thumbnail_url ?? post.media_url}
                        alt={post.caption?.slice(0, 60) ?? "Instagram post"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-neutral-300 text-[10px]">
                        No image
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover/post:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover/post:opacity-100">
                      <div className="flex items-center gap-3 text-white text-[11px] font-semibold">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 fill-current" />
                          {post.like_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 fill-current" />
                          {post.comments_count ?? 0}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">No recent media available.</p>
            )}
          </section>

          {brand.snapshotDate && (
            <p className="text-[11px] text-neutral-400">
              Snapshot from {brand.snapshotDate}
              {hasBaseline ? ` · baseline ${brand.priorSnapshotDate}` : " · no baseline yet"}
            </p>
          )}
        </div>
      )}
    </DetailDrawer>
  )
}

interface StatTileProps {
  label: string
  value: string
  tone?: "positive" | "negative" | "neutral"
}

function StatTile({ label, value, tone = "neutral" }: StatTileProps) {
  const valueColor =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
      ? "text-red-700"
      : "text-neutral-900"
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`text-xl font-bold tabular-nums mt-1 truncate ${valueColor}`}>
        {value}
      </div>
    </div>
  )
}

function formatSignedNumber(n: number): string {
  if (n > 0) return `+${n.toLocaleString()}`
  return n.toLocaleString()
}

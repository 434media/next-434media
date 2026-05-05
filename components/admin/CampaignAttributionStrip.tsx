"use client"

import { useEffect, useState } from "react"
import { Send, MailOpen, MousePointerClick, TrendingUp } from "lucide-react"

interface LastCampaign {
  audienceId: string
  audienceName: string
  campaignId: string
  title: string
  subjectLine?: string
  sendTime: string
  emailsSent: number
  opens: number
  uniqueOpens: number
  clicks: number
  uniqueClicks: number
  openRate: number
  clickRate: number
}

interface CampaignAttributionStripProps {
  /** Signups visible in the current view — used to count "new since campaign sent." */
  signupTimestamps: string[]
}

let cached: { campaign: LastCampaign | null; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 min

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const diffMs = Date.now() - t
  const min = Math.round(diffMs / 60000)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  if (d < 14) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function CampaignAttributionStrip({ signupTimestamps }: CampaignAttributionStripProps) {
  const [campaign, setCampaign] = useState<LastCampaign | null>(cached?.campaign ?? null)
  const [isLoading, setIsLoading] = useState(!cached)

  useEffect(() => {
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setCampaign(cached.campaign)
      setIsLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/mailchimp/last-campaign", { cache: "no-store" })
        if (!res.ok) {
          cached = { campaign: null, ts: Date.now() }
          if (!cancelled) {
            setCampaign(null)
            setIsLoading(false)
          }
          return
        }
        const json = await res.json()
        const c = (json.data as LastCampaign) ?? null
        cached = { campaign: c, ts: Date.now() }
        if (!cancelled) {
          setCampaign(c)
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-3">
        <div className="h-9 bg-neutral-100 rounded animate-pulse" />
      </div>
    )
  }

  if (!campaign) return null

  // Count signups whose created_at is AFTER the campaign send_time
  const sendTs = new Date(campaign.sendTime).getTime()
  const newSinceSend = signupTimestamps.filter((iso) => {
    const t = new Date(iso).getTime()
    return Number.isFinite(t) && t > sendTs
  }).length

  const openPct = campaign.openRate * 100
  const clickPct = campaign.clickRate * 100

  return (
    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 px-4 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 shrink-0">
          <Send className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-0.5">
            <span className="inline-block h-1 w-1 rounded-full bg-pink-500" aria-hidden="true" />
            Last campaign
          </p>
          <p className="text-sm font-medium text-neutral-900 truncate">
            {campaign.title}
            <span className="text-neutral-400 font-normal"> · {campaign.audienceName}</span>
          </p>
          <p className="text-[11px] text-neutral-500 tabular-nums">
            Sent {relativeTime(campaign.sendTime)} · to {campaign.emailsSent.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-5 tabular-nums shrink-0">
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            <MailOpen className="w-3 h-3" />
            Opens
          </p>
          <p className="text-sm font-semibold text-neutral-900">
            {campaign.uniqueOpens.toLocaleString()}
            <span className="ml-1 text-[11px] font-normal text-neutral-500">
              {openPct.toFixed(1)}%
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            <MousePointerClick className="w-3 h-3" />
            Clicks
          </p>
          <p className="text-sm font-semibold text-neutral-900">
            {campaign.uniqueClicks.toLocaleString()}
            <span className="ml-1 text-[11px] font-normal text-neutral-500">
              {clickPct.toFixed(1)}%
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            <TrendingUp className="w-3 h-3" />
            Signups since
          </p>
          <p className="text-sm font-semibold text-neutral-900">
            {newSinceSend.toLocaleString()}
            <span className="ml-1 text-[11px] font-normal text-neutral-500">in view</span>
          </p>
        </div>
      </div>
    </div>
  )
}

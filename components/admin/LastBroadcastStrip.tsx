"use client"

import { useEffect, useState } from "react"
import { Megaphone, Users, TrendingUp } from "lucide-react"

interface Broadcast {
  id: string
  label: string | null
  subject: string
  from: string
  attempted: number
  sent: number
  failed: number
  sentAt: string
}

interface LastBroadcastStripProps {
  /** Signups visible in the current view — used to count "new since broadcast sent." */
  signupTimestamps: string[]
}

let cached: { broadcast: Broadcast | null; ts: number } | null = null
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

/**
 * Surfaces the most recent Resend broadcast (the occasional branded sends),
 * replacing the old "last Mailchimp campaign" strip — the marketing flow no
 * longer runs regular Mailchimp campaigns. Hidden entirely when none exist, so
 * it never shows stale activity. Opens/clicks live in the Resend dashboard.
 */
export function LastBroadcastStrip({ signupTimestamps }: LastBroadcastStripProps) {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(cached?.broadcast ?? null)
  const [isLoading, setIsLoading] = useState(!cached)

  useEffect(() => {
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setBroadcast(cached.broadcast)
      setIsLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/broadcasts/last", { cache: "no-store" })
        const json = res.ok ? await res.json() : null
        const b = (json?.broadcast as Broadcast) ?? null
        cached = { broadcast: b, ts: Date.now() }
        if (!cancelled) {
          setBroadcast(b)
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

  if (!broadcast) return null

  const sendTs = new Date(broadcast.sentAt).getTime()
  const newSinceSend = signupTimestamps.filter((iso) => {
    const t = new Date(iso).getTime()
    return Number.isFinite(t) && t > sendTs
  }).length

  const title = broadcast.subject || broadcast.label || "Broadcast"

  return (
    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 px-4 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 shrink-0">
          <Megaphone className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-0.5">
            <span className="inline-block h-1 w-1 rounded-full bg-pink-500" aria-hidden="true" />
            Last broadcast
          </p>
          <p className="text-sm font-medium text-neutral-900 truncate">{title}</p>
          <p className="text-[11px] text-neutral-500 tabular-nums">
            Sent {relativeTime(broadcast.sentAt)} · to {broadcast.sent.toLocaleString()}
            {broadcast.failed > 0 ? ` · ${broadcast.failed.toLocaleString()} failed` : ""} · opens/clicks in Resend
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-5 tabular-nums shrink-0">
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            <Users className="w-3 h-3" />
            Recipients
          </p>
          <p className="text-sm font-semibold text-neutral-900">{broadcast.sent.toLocaleString()}</p>
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

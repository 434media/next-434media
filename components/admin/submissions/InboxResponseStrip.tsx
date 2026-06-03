"use client"

import { useEffect, useState } from "react"
import { Loader2, Clock, MessageCircle, CheckCircle2, Timer } from "lucide-react"

// Stage 5 — response-queue identity for /admin/inbox.
//
// Four tiles answering the four operational questions a sales rep walks in
// asking: "How many do I owe a reply to?" / "How old is my oldest unreplied
// inquiry?" / "How am I doing today?" / "How responsive are we on average?"
//
// Awaiting reply = state in {new, triaged}. Oldest waiting is the earliest
// created_at in that bucket — surfaces "we have a 4-day-old inquiry sitting
// untouched" the moment the rep lands on the page.
//
// Stage 5b will add a "Reply via Resend" bulk action; this strip is the
// passive-monitoring layer that complements it.

interface InboxStats {
  awaitingReply: number
  oldestAwaitingIso: string | null
  repliedToday: number
  avgResponseTimeMs: number | null
  totalSubmissions: number
}

interface InboxResponseStripProps {
  /** Increment to force a re-fetch — bumped by the page after a mutation
   *  (delete / reply / triage / acknowledge) so the SLA numbers stay live. */
  refreshSignal?: number
}

export function InboxResponseStrip({ refreshSignal = 0 }: InboxResponseStripProps) {
  const [stats, setStats] = useState<InboxStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Keep prior numbers visible on a refresh-triggered refetch (don't flash
    // skeletons); only show the loading state on the initial load.
    setHasError(false)
    fetch(`/api/admin/contact-forms/inbox-stats?_t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.success && data.stats) {
          setStats(data.stats as InboxStats)
        } else {
          setHasError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setHasError(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshSignal])

  // Silently hide on error — the strip is supplemental; keeping the inbox
  // list visible matters more than showing an error banner for a stats fetch.
  if (hasError) return null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <AwaitingReplyTile loading={isLoading} count={stats?.awaitingReply ?? 0} />
      <OldestWaitingTile loading={isLoading} iso={stats?.oldestAwaitingIso ?? null} />
      <RepliedTodayTile loading={isLoading} count={stats?.repliedToday ?? 0} />
      <AvgResponseTile loading={isLoading} ms={stats?.avgResponseTimeMs ?? null} />
    </div>
  )
}

// ─────────── tiles ───────────

interface BaseTileProps {
  label: string
  icon: React.ComponentType<{ className?: string }>
  loading: boolean
  /** Hue applied to the tile when its primary metric warrants attention */
  tone?: "neutral" | "amber" | "red" | "green"
  children: React.ReactNode
}

const TONE_CLASSES: Record<NonNullable<BaseTileProps["tone"]>, { bg: string; border: string; iconColor: string }> = {
  neutral: {
    bg: "bg-white",
    border: "border-neutral-200",
    iconColor: "text-neutral-400",
  },
  amber: {
    bg: "bg-amber-50/60",
    border: "border-amber-200/70",
    iconColor: "text-amber-500",
  },
  red: {
    bg: "bg-red-50/60",
    border: "border-red-200/70",
    iconColor: "text-red-500",
  },
  green: {
    bg: "bg-emerald-50/60",
    border: "border-emerald-200/70",
    iconColor: "text-emerald-500",
  },
}

function BaseTile({ label, icon: Icon, loading, tone = "neutral", children }: BaseTileProps) {
  const cls = TONE_CLASSES[tone]
  return (
    <div className={`p-4 rounded-xl border transition-colors ${cls.bg} ${cls.border}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${cls.iconColor}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-neutral-400 h-8">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading…
        </div>
      ) : (
        children
      )}
    </div>
  )
}

function AwaitingReplyTile({ loading, count }: { loading: boolean; count: number }) {
  // Amber when there's anything to do; neutral when zero. The tone choice is
  // load-bearing — reps should feel a gentle nudge, not an alarm.
  const tone: BaseTileProps["tone"] = count === 0 ? "neutral" : "amber"
  return (
    <BaseTile label="Awaiting reply" icon={MessageCircle} loading={loading} tone={tone}>
      <div className="text-2xl font-bold leading-tight tabular-nums text-neutral-900">
        {count.toLocaleString()}
      </div>
      <div className="text-[11px] text-neutral-500 mt-1">
        {count === 0 ? "All caught up" : count === 1 ? "inquiry waiting" : "inquiries waiting"}
      </div>
    </BaseTile>
  )
}

function OldestWaitingTile({ loading, iso }: { loading: boolean; iso: string | null }) {
  if (!loading && !iso) {
    return (
      <BaseTile label="Oldest waiting" icon={Clock} loading={false} tone="neutral">
        <div className="text-2xl font-bold leading-tight text-neutral-300">—</div>
        <div className="text-[11px] text-neutral-400 mt-1">Inbox is empty</div>
      </BaseTile>
    )
  }
  const ageMs = iso ? Date.now() - new Date(iso).getTime() : 0
  const ageDays = ageMs / (24 * 60 * 60 * 1000)
  // Red flag when oldest waiting > 24h — at that point a rep is probably
  // missing an inquiry, not actively triaging. Below 24h stays amber for
  // gentle nudge; below 1h stays neutral (very fresh).
  const tone: BaseTileProps["tone"] =
    ageDays >= 1 ? "red" : ageMs >= 60 * 60 * 1000 ? "amber" : "neutral"
  return (
    <BaseTile label="Oldest waiting" icon={Clock} loading={loading} tone={tone}>
      <div className="text-2xl font-bold leading-tight tabular-nums text-neutral-900">
        {iso ? formatAge(ageMs) : "—"}
      </div>
      <div className="text-[11px] text-neutral-500 mt-1">
        {iso ? formatDateLong(iso) : "—"}
      </div>
    </BaseTile>
  )
}

function RepliedTodayTile({ loading, count }: { loading: boolean; count: number }) {
  const tone: BaseTileProps["tone"] = count > 0 ? "green" : "neutral"
  return (
    <BaseTile label="Replied today" icon={CheckCircle2} loading={loading} tone={tone}>
      <div className="text-2xl font-bold leading-tight tabular-nums text-neutral-900">
        {count.toLocaleString()}
      </div>
      <div className="text-[11px] text-neutral-500 mt-1">
        {count === 0 ? "No replies yet today" : count === 1 ? "reply sent today" : "replies sent today"}
      </div>
    </BaseTile>
  )
}

function AvgResponseTile({ loading, ms }: { loading: boolean; ms: number | null }) {
  if (!loading && ms === null) {
    return (
      <BaseTile label="Avg response" icon={Timer} loading={false} tone="neutral">
        <div className="text-2xl font-bold leading-tight text-neutral-300">—</div>
        <div className="text-[11px] text-neutral-400 mt-1">No replies in last 30d</div>
      </BaseTile>
    )
  }
  return (
    <BaseTile label="Avg response" icon={Timer} loading={loading} tone="neutral">
      <div className="text-2xl font-bold leading-tight tabular-nums text-neutral-900">
        {ms !== null ? formatDuration(ms) : "—"}
      </div>
      <div className="text-[11px] text-neutral-500 mt-1">last 30 days</div>
    </BaseTile>
  )
}

// ─────────── format helpers ───────────

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 1) return "<1m"
  if (minutes < 60) return `${minutes}m`
  if (hours < 48) return `${hours}h`
  return `${days}d`
}

function formatAge(ms: number): string {
  return formatDuration(ms) + " ago"
}

function formatDateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

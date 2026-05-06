"use client"

import { useEffect, useState } from "react"
import { Mail, Ticket, Users2, ArrowRight, Loader2 } from "lucide-react"
import { useMailchimpSubscribers } from "@/components/admin/MailchimpSubscribedPill"
import type { Lead } from "@/types/crm-types"

// Stage 4 — Audiences-level rollup strip. Renders three per-source tiles
// (Newsletter / Events / Lists) at the top of /admin/audiences with three
// numbers each:
//   - Total (count of contacts in that source)
//   - +N in 7d (recent intake; quick "is this source still alive?" check)
//   - % in Mailchimp (campaign reachability today)
//
// The strip is also a navigation surface — clicking a tile switches the
// active sub-tab. Duplicates the sub-tab nav at the top of the page, but
// the duplication is intentional: a marketing operator scanning numbers can
// click straight from the data they're looking at instead of jumping back
// up to the nav. Active tile mirrors the dark filled state of the nav.

type SubTab = "newsletter" | "events" | "lists"

interface SourceStats {
  total: number
  last7Days: number
  inMailchimp: number
}

interface AudiencesHeaderStripProps {
  activeSub: SubTab
  onSelectSub: (sub: SubTab) => void
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

function countRecent(timestamps: string[], windowMs: number): number {
  const now = Date.now()
  let count = 0
  for (const t of timestamps) {
    if (!t) continue
    const ts = new Date(t).getTime()
    if (Number.isFinite(ts) && now - ts <= windowMs) count++
  }
  return count
}

interface RowSig {
  email: string
  created_at: string
}

function statsFromRows(rows: RowSig[], subscriberMap: Map<string, unknown>): SourceStats {
  const timestamps = rows.map((r) => r.created_at).filter(Boolean)
  let inMc = 0
  for (const r of rows) {
    if (!r.email) continue
    if (subscriberMap.has(r.email.toLowerCase())) inMc++
  }
  return {
    total: rows.length,
    last7Days: countRecent(timestamps, ONE_WEEK_MS),
    inMailchimp: inMc,
  }
}

export function AudiencesHeaderStrip({ activeSub, onSelectSub }: AudiencesHeaderStripProps) {
  const subscriberMap = useMailchimpSubscribers()
  const [newsletter, setNewsletter] = useState<SourceStats | null>(null)
  const [events, setEvents] = useState<SourceStats | null>(null)
  const [lists, setLists] = useState<SourceStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    Promise.allSettled([
      fetch(`/api/admin/email-lists-firestore?_t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/event-registrations?_t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/leads?_t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([nlRes, evRes, ldRes]) => {
      if (cancelled) return

      if (nlRes.status === "fulfilled" && nlRes.value?.success) {
        const rows = (nlRes.value.signups || []) as Array<{ email: string; created_at: string }>
        setNewsletter(statsFromRows(rows, subscriberMap))
      } else {
        setNewsletter({ total: 0, last7Days: 0, inMailchimp: 0 })
      }

      if (evRes.status === "fulfilled" && evRes.value?.success) {
        const rows = (evRes.value.registrations || []) as Array<{ email: string; registeredAt: string }>
        // Events use `registeredAt`; normalize to the shared `created_at` key.
        const normalized: RowSig[] = rows.map((r) => ({ email: r.email, created_at: r.registeredAt }))
        setEvents(statsFromRows(normalized, subscriberMap))
      } else {
        setEvents({ total: 0, last7Days: 0, inMailchimp: 0 })
      }

      if (ldRes.status === "fulfilled" && ldRes.value?.success) {
        // Filter to partner-source leads only — Lists tab does the same join.
        const partner = (ldRes.value.leads as Lead[]).filter((l) => l.source === "partner")
        const normalized: RowSig[] = partner.map((l) => ({ email: l.email, created_at: l.created_at }))
        setLists(statsFromRows(normalized, subscriberMap))
      } else {
        setLists({ total: 0, last7Days: 0, inMailchimp: 0 })
      }

      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriberMap])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <SourceTile
        label="Newsletter"
        icon={Mail}
        active={activeSub === "newsletter"}
        stats={newsletter}
        loading={isLoading}
        onClick={() => onSelectSub("newsletter")}
      />
      <SourceTile
        label="Events"
        icon={Ticket}
        active={activeSub === "events"}
        stats={events}
        loading={isLoading}
        onClick={() => onSelectSub("events")}
      />
      <SourceTile
        label="Lists"
        icon={Users2}
        active={activeSub === "lists"}
        stats={lists}
        loading={isLoading}
        onClick={() => onSelectSub("lists")}
      />
    </div>
  )
}

interface SourceTileProps {
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  stats: SourceStats | null
  loading: boolean
  onClick: () => void
}

function SourceTile({ label, icon: Icon, active, stats, loading, onClick }: SourceTileProps) {
  const mcPct =
    stats && stats.total > 0 ? Math.round((stats.inMailchimp / stats.total) * 100) : 0

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={`Switch to ${label} sub-tab`}
      className={`group p-4 rounded-xl border transition-all text-left ${
        active
          ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
          : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 opacity-70" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            {label}
          </span>
        </div>
        <ArrowRight
          className={`w-3.5 h-3.5 transition-opacity ${
            active ? "opacity-50" : "opacity-30 group-hover:opacity-70"
          }`}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] opacity-60 h-12">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading…
        </div>
      ) : stats ? (
        <>
          <div className="text-2xl font-bold leading-tight tabular-nums mb-1">
            {stats.total.toLocaleString()}
          </div>
          <div
            className={`text-[11px] flex items-center gap-3 ${
              active ? "opacity-80" : "text-neutral-500"
            }`}
          >
            <span className="tabular-nums">
              <strong className="font-semibold">+{stats.last7Days.toLocaleString()}</strong> in 7d
            </span>
            <span className={active ? "opacity-40" : "text-neutral-300"}>·</span>
            <span className="tabular-nums">
              <strong className="font-semibold">{mcPct}%</strong> in Mailchimp
            </span>
          </div>
        </>
      ) : (
        <div className="text-[12px] opacity-60 h-12">No data</div>
      )}
    </button>
  )
}

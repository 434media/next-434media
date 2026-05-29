"use client"

import { useEffect, useState } from "react"
import { Mail, Ticket, Users2, Loader2 } from "lucide-react"
import { useMailchimpSubscribers } from "@/components/admin/MailchimpSubscribedPill"
import type { Lead } from "@/types/crm-types"

// Stage 4 — Audiences source nav + KPIs, fused into one control.
//
// This is the page's ONLY source switcher (it replaced the separate text
// sub-tab row that used to sit in the sticky header — that was a second,
// redundant three-way nav for the same Newsletter / Events / Lists). Each
// segment carries its source's total so all three counts stay visible at a
// glance, and the secondary stats for the *active* source render just below:
//   - +N this week (recent intake; "is this source still alive?")
//   - % in Mailchimp (campaign reachability today)
//
// Per-source detail sits next to the data you're viewing instead of stacking
// all three sources' KPIs above the table.

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
  }, [subscriberMap])

  const sources = [
    { id: "newsletter" as const, label: "Newsletter", icon: Mail, stats: newsletter },
    { id: "events" as const, label: "Events", icon: Ticket, stats: events },
    { id: "lists" as const, label: "Lists", icon: Users2, stats: lists },
  ]
  const active = sources.find((s) => s.id === activeSub) ?? sources[0]
  const activeStats = active.stats
  const mcPct =
    activeStats && activeStats.total > 0
      ? Math.round((activeStats.inMailchimp / activeStats.total) * 100)
      : 0

  return (
    <div className="mb-4">
      {/* Segmented control — the single source switcher, with each source's
          total baked in so all three counts stay visible while you navigate. */}
      <div
        role="tablist"
        aria-label="Audience sources"
        className="grid grid-cols-3 gap-1 rounded-xl border border-neutral-200 bg-white p-1"
      >
        {sources.map((s) => {
          const Icon = s.icon
          const isActive = s.id === activeSub
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectSub(s.id)}
              className={`flex flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                <Icon className="w-3.5 h-3.5 opacity-70" />
                {s.label}
              </span>
              {isLoading ? (
                <span
                  className={`h-6 w-12 rounded animate-pulse ${
                    isActive ? "bg-white/20" : "bg-neutral-100"
                  }`}
                />
              ) : (
                <span className="text-xl sm:text-2xl font-bold leading-none tabular-nums">
                  {(s.stats?.total ?? 0).toLocaleString()}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Secondary KPIs for the active source only. */}
      <div className="mt-2 flex items-center gap-3 px-1 text-[12px] text-neutral-500">
        {isLoading ? (
          <span className="flex items-center gap-2 opacity-60">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading…
          </span>
        ) : activeStats ? (
          <>
            <span className="font-medium text-neutral-700">{active.label}</span>
            <span className="text-neutral-300">·</span>
            <span className="tabular-nums">
              <strong className="font-semibold text-neutral-700">
                +{activeStats.last7Days.toLocaleString()}
              </strong>{" "}
              this week
            </span>
            <span className="text-neutral-300">·</span>
            <span className="tabular-nums">
              <strong className="font-semibold text-neutral-700">{mcPct}%</strong> in Mailchimp
            </span>
          </>
        ) : (
          <span className="opacity-60">No data</span>
        )}
      </div>
    </div>
  )
}

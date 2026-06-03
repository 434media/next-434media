"use client"

import { useEffect, useState } from "react"
import { Mail, Ticket, Users2, Loader2 } from "lucide-react"
import { useMailchimpSubscribers, isMarketable, type SubscriberMap } from "@/components/admin/MailchimpSubscribedPill"

// Stage 4 — Audiences source nav + KPIs, fused into one control.
//
// This is the page's ONLY source switcher (it replaced the separate text
// sub-tab row that used to sit in the sticky header — that was a second,
// redundant three-way nav for the same Newsletter / Events / Lists). Each
// segment carries its source's total so all three counts stay visible at a
// glance, and the secondary stats for the *active* source render just below:
//   - +N this week (recent intake; "is this source still alive?")
//   - N subscribed (marketable today) + the to-push and not-subscribed gaps,
//     split by Mailchimp consent status rather than mere presence
//
// Per-source detail sits next to the data you're viewing instead of stacking
// all three sources' KPIs above the table.

type SubTab = "newsletter" | "events" | "lists"

interface SourceStats {
  total: number
  last7Days: number
  /** Email exists in Mailchimp in any status. */
  present: number
  /** Email is `subscribed` in Mailchimp — i.e. actually emailable today. */
  subscribed: number
  /** Lists only — cohort members already promoted into the leads pipeline.
   *  Consent/reachability is N/A for cold partner lists, so promotion is the
   *  metric that matters here. */
  promoted?: number
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

function statsFromRows(rows: RowSig[], subscriberMap: SubscriberMap): SourceStats {
  const timestamps = rows.map((r) => r.created_at).filter(Boolean)
  let present = 0
  let subscribed = 0
  for (const r of rows) {
    if (!r.email) continue
    const entry = subscriberMap.get(r.email.toLowerCase())
    if (!entry) continue
    present++
    if (isMarketable(entry)) subscribed++
  }
  return {
    total: rows.length,
    last7Days: countRecent(timestamps, ONE_WEEK_MS),
    present,
    subscribed,
  }
}

interface MemberSig {
  importedAt?: string
  promotedLeadId?: string
}

/**
 * Lists stats from partner_list_members — the SAME collection the Lists tab
 * reads, so the segment total matches the tab (the old code counted partner
 * *leads*, i.e. only the promoted ones, which disagreed with the tab). Consent
 * is N/A for cold lists; we surface promotion progress instead.
 */
function statsFromMembers(members: MemberSig[]): SourceStats {
  const timestamps = members.map((m) => m.importedAt ?? "").filter(Boolean)
  let promoted = 0
  for (const m of members) if (m.promotedLeadId) promoted++
  return {
    total: members.length,
    last7Days: countRecent(timestamps, ONE_WEEK_MS),
    present: 0,
    subscribed: 0,
    promoted,
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
      fetch(`/api/admin/audiences/partner-list-members?_t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([nlRes, evRes, ldRes]) => {
      if (cancelled) return

      if (nlRes.status === "fulfilled" && nlRes.value?.success) {
        const rows = (nlRes.value.signups || []) as Array<{ email: string; created_at: string }>
        setNewsletter(statsFromRows(rows, subscriberMap))
      } else {
        setNewsletter({ total: 0, last7Days: 0, present: 0, subscribed: 0 })
      }

      if (evRes.status === "fulfilled" && evRes.value?.success) {
        const rows = (evRes.value.registrations || []) as Array<{ email: string; registeredAt: string }>
        // Events use `registeredAt`; normalize to the shared `created_at` key.
        const normalized: RowSig[] = rows.map((r) => ({ email: r.email, created_at: r.registeredAt }))
        setEvents(statsFromRows(normalized, subscriberMap))
      } else {
        setEvents({ total: 0, last7Days: 0, present: 0, subscribed: 0 })
      }

      if (ldRes.status === "fulfilled" && ldRes.value?.success) {
        const members = (ldRes.value.members ?? []) as MemberSig[]
        setLists(statsFromMembers(members))
      } else {
        setLists({ total: 0, last7Days: 0, present: 0, subscribed: 0, promoted: 0 })
      }

      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [subscriberMap])

  const sources = [
    { id: "newsletter" as const, label: "Newsletter", icon: Mail, stats: newsletter, blurb: "People who signed up for email updates." },
    { id: "events" as const, label: "Events", icon: Ticket, stats: events, blurb: "People who registered for an event." },
    { id: "lists" as const, label: "Lists", icon: Users2, stats: lists, blurb: "Cold partner contacts — promote to work as leads." },
  ]
  const active = sources.find((s) => s.id === activeSub) ?? sources[0]
  const activeStats = active.stats
  // Lists are cold (no opt-in), so consent/reachability is N/A — the metric
  // that matters is promotion into the leads pipeline. Other sources use the
  // consent breakdown.
  const isLists = active.id === "lists"
  // Reachability by consent (Mailchimp status is the source of truth):
  //   subscribedPct — share of this source that's actually emailable today
  //   notReachable  — everyone not subscribed (no marketing consent yet). This
  //                   is NOT a task: the hourly sync only adds opted-in
  //                   contacts, and non-consented contacts are never pushed —
  //                   so "to push" would overstate actionable work ~50x.
  const subscribedPct =
    activeStats && activeStats.total > 0
      ? Math.round((activeStats.subscribed / activeStats.total) * 100)
      : 0
  const notReachable = activeStats ? Math.max(0, activeStats.total - activeStats.subscribed) : 0
  const promoted = activeStats?.promoted ?? 0
  const notPromoted = activeStats ? Math.max(0, activeStats.total - promoted) : 0

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
            <span className="text-neutral-500">{active.blurb}</span>
            <span className="text-neutral-300">·</span>
            <span className="tabular-nums">
              <strong className="font-semibold text-neutral-700">
                +{activeStats.last7Days.toLocaleString()}
              </strong>{" "}
              this week
            </span>
            <span className="text-neutral-300">·</span>
            {isLists ? (
              <>
                {/* Promotion progress — the Lists metric. Consent/reachability
                    is N/A for cold partner contacts. */}
                <span className="tabular-nums">
                  <strong className="font-semibold text-emerald-600">{promoted.toLocaleString()}</strong>{" "}
                  promoted to leads
                </span>
                {notPromoted > 0 && (
                  <>
                    <span className="text-neutral-300 hidden sm:inline">·</span>
                    <span
                      className="tabular-nums hidden sm:inline text-neutral-400"
                      title="Cohort members not yet worked into the leads pipeline."
                    >
                      {notPromoted.toLocaleString()} not yet promoted
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Reachable = subscribed in Mailchimp (emailable today). */}
                <span className="tabular-nums">
                  <strong className="font-semibold text-emerald-600">
                    {(activeStats.subscribed ?? 0).toLocaleString()}
                  </strong>{" "}
                  subscribed{activeStats.total > 0 ? ` · ${subscribedPct}% reachable` : ""}
                </span>
                {/* Not opted in — informational consent gap, not a task. The hourly
                    sync only adds opted-in contacts; the rest stay out of Mailchimp
                    until they consent. */}
                {notReachable > 0 && (
                  <>
                    <span className="text-neutral-300 hidden sm:inline">·</span>
                    <span
                      className="tabular-nums hidden sm:inline text-neutral-400"
                      title="No marketing consent — these stay out of Mailchimp until they opt in. The hourly sync only adds opted-in contacts."
                    >
                      {notReachable.toLocaleString()} not opted in
                    </span>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <span className="opacity-60">No data</span>
        )}
      </div>
    </div>
  )
}

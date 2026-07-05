"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Flag, Target, Mail, ArrowUpRight } from "lucide-react"

interface FollowupItem {
  type: "lead" | "opportunity" | "sequence"
  id: string
  name: string
  company?: string
  date: string
  bucket: "overdue" | "today" | "upcoming"
  detail: string
  href: string
}

const TYPE_META = {
  lead: { icon: Flag },
  opportunity: { icon: Target },
  sequence: { icon: Mail },
} as const

const BUCKET_META = {
  overdue: { label: "Overdue", cls: "bg-red-50 text-red-700 border-red-100" },
  today: { label: "Today", cls: "bg-amber-50 text-amber-700 border-amber-100" },
  upcoming: { label: "Upcoming", cls: "bg-neutral-50 text-neutral-500 border-neutral-200" },
} as const

// Unified follow-up queue — leads' + opportunities' due follow-ups (and running
// sequences' next auto-send) in one list. Collapses the three separate follow-up
// mechanisms into a single "what's due" surface.
export function FollowupsQueue() {
  const [items, setItems] = useState<FollowupItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/followups", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.items) setItems(d.items)
        else if (!cancelled) setItems([])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const actionable = items?.filter((i) => i.bucket !== "upcoming").length ?? 0

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-medium text-neutral-900">Due today &amp; follow-ups</h3>
          {items && actionable > 0 && (
            <span className="text-[11px] font-medium text-amber-700 tabular-nums">{actionable} due</span>
          )}
        </div>
        <span className="text-[10px] text-neutral-400">leads + opportunities</span>
      </div>

      {items === null ? (
        <p className="px-4 py-6 text-center text-xs text-neutral-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-neutral-400">Nothing due in the next 7 days.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
          {items.map((it, i) => {
            const Icon = TYPE_META[it.type].icon
            const b = BUCKET_META[it.bucket]
            return (
              <li key={`${it.type}-${it.id}-${i}`}>
                <Link href={it.href} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-neutral-900 truncate">
                      {it.name}
                      {it.company ? <span className="font-normal text-neutral-400"> · {it.company}</span> : null}
                    </span>
                    <span className="block text-[11px] text-neutral-500 truncate">{it.detail}</span>
                  </span>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}>
                    {b.label}
                  </span>
                  <span className="shrink-0 w-12 text-right text-[11px] text-neutral-400 tabular-nums">
                    {it.date.slice(5)}
                  </span>
                  <ArrowUpRight className="w-3 h-3 shrink-0 text-neutral-300 group-hover:text-neutral-500" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

"use client"

// Today: the front door's daily brief, slice 1 (build sequence V1 item 4; founder, 2026-11-17: "approve slice 1"). One
// founder-only card at the top of To do: queues past their limit, what needs a check, and model cost, each line linking
// to where the work lives. Computed when the page opens (lib/agent/today.ts, through the founder-only
// GET /api/admin/review); nothing is stored. Display Standard §3.14 (Provisional).

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Today, TodayTone } from "@/lib/agent/today"

const DOT: Record<TodayTone, string> = { late: "bg-amber-500", check: "bg-red-600", info: "bg-neutral-400" }

function asOf(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function TodayCard() {
  // null while reading; "hidden" when not the founder or the read failed (the Agents page shows the same figures).
  const [today, setToday] = useState<Today | null | "hidden">(null)
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const res = await fetch("/api/admin/review", { cache: "no-store" })
        const body = (await res.json().catch(() => ({}))) as { today?: Today }
        if (live) setToday(res.ok && body.today ? body.today : "hidden")
      } catch {
        if (live) setToday("hidden")
      }
    })()
    return () => {
      live = false
    }
  }, [])
  if (today === "hidden") return null

  return (
    <section aria-labelledby="today-title" className="mb-5 rounded-xl border border-neutral-200 bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="today-title" className="text-sm font-semibold text-neutral-900">Today</h2>
        {today && <span className="text-xs text-neutral-500">as of {asOf(today.at)}</span>}
      </div>
      {today === null ? (
        <p className="mt-3 text-xs text-neutral-500">Reading…</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-100">
          {today.allClear && (
            <li className="flex items-center gap-3 py-2.5">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-green-600" />
              <span className="text-sm font-medium text-neutral-900">All clear</span>
              <span className="text-xs text-neutral-600">Nothing past its limit, nothing failed.</span>
            </li>
          )}
          {today.lines.map((l) => (
            <li key={l.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[l.tone]}`} />
              <span className="text-sm font-medium text-neutral-900">{l.title}</span>
              <span className="min-w-0 flex-[1_1_16rem] text-xs text-neutral-600 tabular-nums">{l.detail}</span>
              <Link href={l.href} className="text-xs font-medium text-neutral-800 underline underline-offset-2">{l.linkLabel}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

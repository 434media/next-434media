"use client"

// "Waiting on you", the People page's first tab (one work area, founder 2026-11-16; Display Standard §3.14,
// Provisional): a view over the approval records, never a store of its own. Waiting first, oldest first; the Decided
// history is one tap away. Each row opens the same draft drawer the inbox row does.

import { useState } from "react"
import { AlertTriangle, Clock } from "lucide-react"
import { OUTCOME_LABEL, Pill, STATUS_LABEL, when, type DraftItem } from "@/components/admin/review/DraftDrawer"

function duration(ms: number | null): string {
  if (ms === null) return "—"
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m} min`
  const h = Math.round(m / 6) / 10
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`
}

export function WaitingOnYou({ items, loading, onOpen }: { items: DraftItem[]; loading: boolean; onOpen: (i: DraftItem) => void }) {
  const [view, setView] = useState<"waiting" | "decided">("waiting")
  const waiting = items.filter((i) => i.status === "pending")
  const decided = items.filter((i) => i.status !== "pending")
  const shown = view === "waiting" ? waiting : decided
  const late = waiting.filter((i) => i.late).length
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Show" className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-0.5">
          {(["waiting", "decided"] as const).map((v) => (
            <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === v ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
              {v === "waiting" ? `Waiting ${waiting.length}` : `Decided ${decided.length}`}
            </button>
          ))}
        </div>
        {late > 0 && view === "waiting" && (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
            {late} draft{late === 1 ? " has" : "s have"} waited more than 24 hours.
          </span>
        )}
      </div>
      {loading || shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-neutral-500">
          {loading ? "Loading…" : view === "waiting" ? "Nothing waiting on you." : "No decisions yet."}
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {shown.map((i) => (
            <li key={i.id}>
              <button onClick={() => onOpen(i)} className="w-full flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-4 py-3 text-left hover:bg-neutral-50">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">{i.arrival?.name || i.to.join(", ")}</span>
                    {i.arrival?.company && <span className="text-xs text-neutral-500">{i.arrival.company}</span>}
                    <Pill>Reply draft</Pill>
                    {i.outcome && <Pill tone={i.outcome === "flag" ? "amber" : "neutral"}>{OUTCOME_LABEL[i.outcome] ?? i.outcome}</Pill>}
                    {i.flag && <Pill tone="amber" title={i.flag}><AlertTriangle className="w-2.5 h-2.5" /> Flag</Pill>}
                    {i.edits > 0 && <Pill>Edited</Pill>}
                    {i.taskCancelled && <Pill tone="red">Cancelled</Pill>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{i.reviewReason}</p>
                </div>
                <div className="flex items-center gap-2 md:w-48 md:justify-end text-xs text-neutral-500">
                  {i.status === "pending" ? (
                    <span className={`inline-flex items-center gap-1 ${i.late ? "text-amber-700 font-medium" : ""}`}>
                      <Clock className="w-3.5 h-3.5" /> {duration(i.waitingMs)}
                    </span>
                  ) : (
                    <Pill tone={i.status === "sent" ? "green" : i.status === "needs_reconciliation" || i.status === "stopped" ? "red" : "neutral"}>{STATUS_LABEL[i.status] ?? i.status}</Pill>
                  )}
                  <span>{when(i.createdAt)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

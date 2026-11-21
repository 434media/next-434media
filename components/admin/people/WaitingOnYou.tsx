"use client"

// To do (/admin/todo), formerly "Waiting on you", the People page's first tab (one work area, founder 2026-11-16; Display Standard §3.14,
// Provisional): the signed-in person's one list, a view over the approval records and the Inbox's untriaged
// arrivals, never a store of its own (lib/core-model/waiting.ts). Drafts first, oldest first, then arrivals, newest
// first; an arrival with a draft is one row. The Decided history is one tap away. A draft row opens the draft drawer;
// an arrival row carries the Inbox's own triage actions and opens the arrival drawer.

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ClipboardList, Clock, FileText } from "lucide-react"
import { OUTCOME_LABEL, Pill, STATUS_LABEL, when, type DraftItem } from "@/components/admin/review/DraftDrawer"
import { waitingRows } from "@/lib/core-model/waiting"
import type { InboxItem } from "@/types/core-model"

function duration(ms: number | null): string {
  if (ms === null) return "—"
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m} min`
  const h = Math.round(m / 6) / 10
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`
}

/** An arrival the solicitation pre-check held with no draft (lib/agent/review-server.ts HeldArrival). */
export interface HeldArrival {
  activityId: string
  why: string
  summary: string
  at: string
}

/** A founder-owned task Polí's rule pass raised (lib/agent/review-server.ts PoliRow; V1 item 4, Polí slice 1). */
export interface PoliRow {
  id: string
  ref?: string
  title: string
  detail: string
  path: string
  recordRef?: string
  createdAt: string | null
}

export function WaitingOnYou({
  drafts,
  inbox,
  loading,
  onOpen,
  onOpenArrival,
  actions,
  sourceLabel,
  holds,
  onDismissSolicitation,
  dismissing,
  confirmingDismiss,
  poli = [],
}: {
  drafts: DraftItem[]
  inbox: InboxItem[]
  loading: boolean
  onOpen: (i: DraftItem) => void
  onOpenArrival: (i: InboxItem) => void
  /** The Inbox's own triage buttons for an arrival row (Lead / Save / Dismiss, or the phone arrival's four). */
  actions: (i: InboxItem) => React.ReactNode
  sourceLabel: (i: InboxItem) => string
  /** The pre-check's holds, by the arrival's Activity id. Founder only. */
  holds?: Map<string, HeldArrival>
  /** Dismiss: spam or solicitation, for a website-form arrival with no draft. Founder only. */
  onDismissSolicitation?: (i: InboxItem) => void
  dismissing?: string | null
  /** The arrival whose Dismiss is waiting for its confirming second click. */
  confirmingDismiss?: string | null
  /** Polí's open tasks for the founder. They sit after the drafts and before the arrivals, oldest first. */
  poli?: PoliRow[]
}) {
  const [view, setView] = useState<"waiting" | "decided">("waiting")
  const rows = useMemo(() => {
    const all = waitingRows(drafts, inbox)
    const cut = all.findIndex((r) => r.kind !== "draft")
    const at = cut === -1 ? all.length : cut
    const poliRows = poli.map((p) => ({ kind: "poli" as const, key: `poli:${p.id}`, poli: p }))
    return [...all.slice(0, at), ...poliRows, ...all.slice(at)]
  }, [drafts, inbox, poli])
  const decided = drafts.filter((i) => i.status !== "pending")
  const late = drafts.filter((i) => i.status === "pending" && i.late).length
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Show" className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-0.5">
          {(["waiting", "decided"] as const).map((v) => (
            <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === v ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
              {v === "waiting" ? `Waiting ${rows.length}` : `Decided ${decided.length}`}
            </button>
          ))}
        </div>
        {late > 0 && view === "waiting" && (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
            {late} draft{late === 1 ? " has" : "s have"} waited more than 24 hours.
          </span>
        )}
      </div>
      {view === "waiting" ? (
        loading || rows.length === 0 ? (
          <Empty text={loading ? "Loading…" : "Nothing waiting on you."} />
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {rows.map((r) =>
              r.kind === "draft" ? (
                <DraftRow key={r.key} item={r.draft} arrival={r.item} onOpen={onOpen} />
              ) : r.kind === "poli" ? (
                <PoliTaskRow key={r.key} row={r.poli} />
              ) : (
                <li key={r.key} className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
                  <button onClick={() => onOpenArrival(r.item)} className="flex-1 min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">{r.item.person?.name || r.item.activity.contact.name || r.item.activity.contact.email || "Unknown"}</span>
                      {r.item.activity.contact.company && <span className="text-xs text-neutral-500">{r.item.activity.contact.company}</span>}
                      <Pill>To triage</Pill>
                      {holds?.get(r.item.activity.id) && <Pill tone="amber"><AlertTriangle className="w-2.5 h-2.5" /> Likely solicitation</Pill>}
                      <Pill>{sourceLabel(r.item)}</Pill>
                    </div>
                    {holds?.get(r.item.activity.id) ? (
                      <p className="mt-0.5 truncate text-xs text-amber-800">{holds.get(r.item.activity.id)!.summary} No draft was made.</p>
                    ) : (
                      <p className="mt-0.5 truncate text-xs text-neutral-500">{r.item.activity.summary}</p>
                    )}
                  </button>
                  <span className="text-xs text-neutral-500 md:w-28">{when(r.item.activity.occurred_at)}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {onDismissSolicitation && r.item.activity.id.startsWith("contact_forms:") && (
                      <button
                        disabled={dismissing === r.item.activity.id}
                        title="Sends nothing. Closes the arrival and skips drafts for this sender from now on."
                        onClick={() => onDismissSolicitation(r.item)}
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${holds?.get(r.item.activity.id) ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}
                      >
                        {confirmingDismiss === r.item.activity.id ? "Confirm dismiss" : "Dismiss: spam or solicitation"}
                      </button>
                    )}
                    {actions(r.item)}
                  </div>
                </li>
              ),
            )}
          </ul>
        )
      ) : decided.length === 0 ? (
        <Empty text="No decisions yet." />
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {decided.map((d) => (
            <DraftRow key={d.id} item={d} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** One Polí task: what to decide, the finding in one line, and its age. It opens the task on the Tasks page. */
function PoliTaskRow({ row }: { row: PoliRow }) {
  return (
    <li>
      <Link href={`/admin/tasks?openTask=${encodeURIComponent(row.id)}`} className="w-full flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-4 py-3 text-left hover:bg-neutral-50">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-900">{row.title}</span>
            <Pill tone="dark"><ClipboardList className="w-2.5 h-2.5" /> Polí</Pill>
            {row.ref && <Pill>{row.ref}</Pill>}
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{row.detail}</p>
        </div>
        <div className="flex items-center gap-2 md:w-48 md:justify-end text-xs text-neutral-500">
          <span>{row.createdAt ? when(row.createdAt) : "—"}</span>
        </div>
      </Link>
    </li>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-neutral-500">{text}</div>
}

function DraftRow({ item: i, arrival, onOpen }: { item: DraftItem; arrival?: InboxItem; onOpen: (i: DraftItem) => void }) {
  const name = arrival?.person?.name || i.arrival?.name || i.to.join(", ")
  const company = arrival?.activity.contact.company || i.arrival?.company
  return (
    <li>
      <button onClick={() => onOpen(i)} className="w-full flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-4 py-3 text-left hover:bg-neutral-50">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-900">{name}</span>
            {company && <span className="text-xs text-neutral-500">{company}</span>}
            {i.status === "pending" ? (
              <Pill tone="dark"><FileText className="w-2.5 h-2.5" /> Draft ready</Pill>
            ) : (
              <Pill>Reply draft</Pill>
            )}
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
  )
}

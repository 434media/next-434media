"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Check, ChevronDown, X, Inbox, Eye, MessageSquare, Archive, Ban, MoreHorizontal } from "lucide-react"
import type { DotColor } from "./StatusDot"

export type SubmissionSource = "email_signups" | "contact_forms" | "event_registrations"
// The union keeps "archived"/"spam" for backward-compat: legacy rows may still
// carry them and the bulk-state endpoint still validates against the full set.
// They're no longer *selectable* in the UI — see SELECTABLE_STATES.
export type SubmissionState = "new" | "triaged" | "replied" | "archived" | "spam"

// The triage workflow we actually offer. Archived/Spam were dropped — Delete is
// the single "go away" action now (see the tabs' bulk bars). STATE_META still
// carries all five so any legacy archived/spam row renders a sensible badge.
const SELECTABLE_STATES: SubmissionState[] = ["new", "triaged", "replied"]

const STATE_META: Record<SubmissionState, { label: string; dot: DotColor; icon: React.ComponentType<{ className?: string }> }> = {
  new: { label: "New", dot: "blue", icon: Inbox },
  triaged: { label: "Triaged", dot: "amber", icon: Eye },
  replied: { label: "Replied", dot: "emerald", icon: MessageSquare },
  archived: { label: "Archived", dot: "neutral", icon: Archive },
  spam: { label: "Spam", dot: "rose", icon: Ban },
}

const DOT_BG: Record<DotColor, string> = {
  blue: "bg-blue-500",
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  green: "bg-green-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  indigo: "bg-indigo-500",
  neutral: "bg-neutral-400",
}

// =====================================================================
// Hook — fetch states for a list of submission ids in one batch.
// Re-fetches whenever the visible id set changes meaningfully.
// =====================================================================

interface UseSubmissionStatesArgs {
  source: SubmissionSource
  ids: string[]
}

export function useSubmissionStates({ source }: UseSubmissionStatesArgs) {
  const [states, setStates] = useState<Map<string, SubmissionState>>(new Map())

  // Fetch ALL set states for the source in ONE request. The sidecar is sparse
  // (a missing record means "new"), so this returns only the handful of records
  // that actually exist — no per-id chunking, no reads that scale with the
  // number of submissions loaded. (`ids` is no longer needed for fetching; it's
  // kept on the args for call-site compatibility.)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/submissions/states?source=${source}&all=1`)
      if (!res.ok) return
      const data = (await res.json()) as { states?: Record<string, SubmissionState> }
      const next = new Map<string, SubmissionState>()
      if (data?.states) {
        for (const [id, state] of Object.entries(data.states)) next.set(id, state)
      }
      setStates(next)
    } catch {
      /* silent — non-critical */
    }
  }, [source])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Optimistic local update — caller invokes after a successful state write
  const setLocal = useCallback((id: string, state: SubmissionState) => {
    setStates((prev) => {
      const next = new Map(prev)
      if (state === "new") next.delete(id)
      else next.set(id, state)
      return next
    })
  }, [])

  const setLocalBulk = useCallback((updates: Array<{ id: string; state: SubmissionState }>) => {
    setStates((prev) => {
      const next = new Map(prev)
      for (const u of updates) {
        if (u.state === "new") next.delete(u.id)
        else next.set(u.id, u.state)
      }
      return next
    })
  }, [])

  return { states, refresh, setLocal, setLocalBulk }
}

/** Treat a missing entry as "new" — sidecar collection stays sparse. */
export function getStateOrNew(states: Map<string, SubmissionState>, id: string): SubmissionState {
  return states.get(id) ?? "new"
}

// =====================================================================
// State badge — shown per-row. Click to open inline state dropdown.
// =====================================================================

interface StateBadgeProps {
  source: SubmissionSource
  id: string
  state: SubmissionState
  onChange: (state: SubmissionState) => void
}

export function StateBadge({ source, id, state, onChange }: StateBadgeProps) {
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const meta = STATE_META[state]

  const handlePick = async (next: SubmissionState) => {
    if (next === state) {
      setOpen(false)
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch("/api/admin/submissions/states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, id, state: next }),
      })
      if (res.ok) onChange(next)
    } catch {
      /* silent */
    } finally {
      setIsSaving(false)
      setOpen(false)
    }
  }

  return (
    <span className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        disabled={isSaving}
        className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
        title="Change state"
      >
        {isSaving ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin text-neutral-400" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full ${DOT_BG[meta.dot]}`} aria-hidden="true" />
        )}
        {meta.label}
        <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
      </button>
      {open && (
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 min-w-[120px] bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
            {SELECTABLE_STATES.map((s) => {
              const m = STATE_META[s]
              const SIcon = m.icon
              const isCurrent = s === state
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handlePick(s)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-neutral-50 ${
                    isCurrent ? "bg-neutral-50 font-semibold text-neutral-900" : "text-neutral-700"
                  }`}
                >
                  <SIcon className="w-3 h-3 text-neutral-500" />
                  {m.label}
                  {isCurrent && <Check className="w-3 h-3 text-emerald-600 ml-auto" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </span>
  )
}

// =====================================================================
// State filter chips — above each tab's table.
// =====================================================================

interface StateFilterChipsProps {
  /** "all" hides the filter; everything else applies. */
  active: "all" | SubmissionState
  onChange: (next: "all" | SubmissionState) => void
  /** Counts per state in the currently-loaded result set. */
  counts?: Partial<Record<"all" | SubmissionState, number>>
}

export function StateFilterChips({ active, onChange, counts }: StateFilterChipsProps) {
  const chips: Array<{ key: "all" | SubmissionState; label: string }> = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "triaged", label: "Triaged" },
    { key: "replied", label: "Replied" },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1">
      {chips.map((chip) => {
        const isActive = active === chip.key
        const count = counts?.[chip.key]
        const meta = chip.key === "all" ? null : STATE_META[chip.key]
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-[12px] font-medium transition-colors ${
              isActive
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {meta && (
              <span className={`w-1.5 h-1.5 rounded-full ${DOT_BG[meta.dot]}`} aria-hidden="true" />
            )}
            {chip.label}
            {typeof count === "number" && (
              <span
                className={`text-[11px] tabular-nums ${
                  isActive ? "text-neutral-300" : "text-neutral-400"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// =====================================================================
// Bulk action bar — sticky bottom. Appears when count > 0.
// =====================================================================

export interface BulkAction {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  /** Visible inline when "primary"; otherwise tucked into the "More" overflow. */
  group?: "primary"
  /** Style hint — destructive ones get red treatment and a separated slot. */
  destructive?: boolean
  /** Async handler. Should resolve when the bulk op completes. */
  run: () => Promise<void> | void
}

interface BulkActionBarProps {
  count: number
  actions: BulkAction[]
  onClear: () => void
}

// Focused, Vercel-style layout: the high-frequency handoffs sit inline (primary),
// the rest live behind a "More" overflow, and the destructive Delete is pulled
// out, reddened, and separated so it's never a careless click next to benign ones.
export function BulkActionBar({ count, actions, onClear }: BulkActionBarProps) {
  const [isWorking, setIsWorking] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  if (count === 0) return null

  const primary = actions.filter((a) => a.group === "primary" && !a.destructive)
  const overflow = actions.filter((a) => a.group !== "primary" && !a.destructive)
  const destructive = actions.filter((a) => a.destructive)

  const handleAction = async (action: BulkAction) => {
    setMoreOpen(false)
    setIsWorking(action.key)
    try {
      await action.run()
    } finally {
      setIsWorking(null)
    }
  }

  const actionButton = (action: BulkAction) => {
    const ActionIcon = action.icon
    const isThisOneWorking = isWorking === action.key
    return (
      <button
        key={action.key}
        type="button"
        onClick={() => handleAction(action)}
        disabled={!!isWorking}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors disabled:opacity-50 ${
          action.destructive
            ? "text-red-300 hover:text-white hover:bg-red-600"
            : "text-neutral-100 hover:text-white hover:bg-neutral-700"
        }`}
      >
        {isThisOneWorking ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          ActionIcon && <ActionIcon className="w-3.5 h-3.5" />
        )}
        {action.label}
      </button>
    )
  }

  return (
    <div className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white rounded-xl shadow-2xl px-3 py-2 flex items-center gap-2 max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-2rem)] flex-wrap">
      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-[11px] font-semibold rounded-full bg-white text-neutral-900 tabular-nums">
        {count}
      </span>
      <span className="text-[12px] font-medium text-neutral-200 mr-1">
        selected
      </span>
      <div className="h-4 w-px bg-neutral-700 mx-0.5" />

      {primary.map(actionButton)}

      {overflow.length > 0 && (
        <span className="relative inline-block">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            disabled={!!isWorking}
            aria-expanded={moreOpen}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-neutral-100 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            More
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>
          {moreOpen && (
            <>
              {/* Click-outside catcher */}
              <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
              <div className="absolute right-0 bottom-full mb-1 z-50 min-w-[180px] bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1">
                {overflow.map((action) => {
                  const ActionIcon = action.icon
                  const isThisOneWorking = isWorking === action.key
                  return (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => handleAction(action)}
                      disabled={!!isWorking}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-neutral-100 hover:bg-neutral-700 disabled:opacity-50"
                    >
                      {isThisOneWorking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        ActionIcon && <ActionIcon className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                      {action.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </span>
      )}

      {destructive.length > 0 && (
        <>
          <div className="h-4 w-px bg-neutral-700 mx-0.5" />
          {destructive.map(actionButton)}
        </>
      )}

      <div className="h-4 w-px bg-neutral-700 mx-0.5" />
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[12px] font-medium text-neutral-400 hover:text-white"
        aria-label="Clear selection"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// =====================================================================
// Selection helper — manage a Set per tab cleanly.
// =====================================================================

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const set = useCallback((ids: string[]) => {
    setSelected(new Set(ids))
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  return { selected, toggle, set, clear }
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Check, ChevronDown, X, Inbox, Eye, MessageSquare, Archive, Ban } from "lucide-react"

export type SubmissionSource = "email_signups" | "contact_forms" | "event_registrations"
export type SubmissionState = "new" | "triaged" | "replied" | "archived" | "spam"

const ALL_STATES: SubmissionState[] = ["new", "triaged", "replied", "archived", "spam"]

const STATE_META: Record<SubmissionState, { label: string; pill: string; icon: React.ComponentType<{ className?: string }> }> = {
  new: {
    label: "New",
    pill: "bg-blue-50 text-blue-700 border-blue-100",
    icon: Inbox,
  },
  triaged: {
    label: "Triaged",
    pill: "bg-amber-50 text-amber-700 border-amber-100",
    icon: Eye,
  },
  replied: {
    label: "Replied",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: MessageSquare,
  },
  archived: {
    label: "Archived",
    pill: "bg-neutral-100 text-neutral-500 border-neutral-200",
    icon: Archive,
  },
  spam: {
    label: "Spam",
    pill: "bg-rose-50 text-rose-700 border-rose-100",
    icon: Ban,
  },
}

// =====================================================================
// Hook — fetch states for a list of submission ids in one batch.
// Re-fetches whenever the visible id set changes meaningfully.
// =====================================================================

interface UseSubmissionStatesArgs {
  source: SubmissionSource
  ids: string[]
}

export function useSubmissionStates({ source, ids }: UseSubmissionStatesArgs) {
  // Stringified id key — only re-fetch when the set actually changes
  const idsKey = useMemo(() => [...ids].sort().join(","), [ids])
  const [states, setStates] = useState<Map<string, SubmissionState>>(new Map())

  const refresh = useCallback(async () => {
    if (ids.length === 0) {
      setStates(new Map())
      return
    }
    try {
      const res = await fetch(
        `/api/admin/submissions/states?source=${source}&ids=${encodeURIComponent(ids.join(","))}`,
      )
      if (!res.ok) return
      const data = (await res.json()) as { states?: Record<string, SubmissionState> }
      const next = new Map<string, SubmissionState>()
      for (const [id, state] of Object.entries(data.states ?? {})) {
        next.set(id, state)
      }
      setStates(next)
    } catch {
      /* silent — non-critical */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, idsKey])

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
  const Icon = meta.icon

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
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${meta.pill} hover:brightness-95`}
        title="Change state"
      >
        {isSaving ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : (
          <Icon className="w-2.5 h-2.5" />
        )}
        {meta.label}
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>
      {open && (
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 min-w-[120px] bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
            {ALL_STATES.map((s) => {
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
  const chips: Array<{ key: "all" | SubmissionState; label: string; pill?: string }> = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "triaged", label: "Triaged" },
    { key: "replied", label: "Replied" },
    { key: "archived", label: "Archived" },
    { key: "spam", label: "Spam" },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => {
        const isActive = active === chip.key
        const count = counts?.[chip.key]
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
              isActive
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
            }`}
          >
            {chip.label}
            {typeof count === "number" && (
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-semibold rounded-full ${
                  isActive ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500"
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
  /** Style hint — destructive ones get red treatment. */
  destructive?: boolean
  /** Async handler. Should resolve when the bulk op completes. */
  run: () => Promise<void> | void
}

interface BulkActionBarProps {
  count: number
  actions: BulkAction[]
  onClear: () => void
}

export function BulkActionBar({ count, actions, onClear }: BulkActionBarProps) {
  const [isWorking, setIsWorking] = useState<string | null>(null)
  if (count === 0) return null

  const handleAction = async (action: BulkAction) => {
    setIsWorking(action.key)
    try {
      await action.run()
    } finally {
      setIsWorking(null)
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white rounded-xl shadow-2xl px-3 py-2 flex items-center gap-2 max-w-[calc(100vw-2rem)] flex-wrap">
      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-[11px] font-semibold rounded-full bg-white text-neutral-900 tabular-nums">
        {count}
      </span>
      <span className="text-[12px] font-medium text-neutral-200 mr-1">
        selected
      </span>
      <div className="h-4 w-px bg-neutral-700 mx-0.5" />
      {actions.map((action) => {
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
      })}
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

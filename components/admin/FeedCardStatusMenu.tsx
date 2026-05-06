"use client"

import { useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"

type FeedStatus = "draft" | "scheduled" | "published" | "archived"

const STATUS_OPTIONS: Array<{ value: FeedStatus; label: string; dot: string }> = [
  { value: "draft", label: "Draft", dot: "bg-amber-500" },
  { value: "scheduled", label: "Scheduled", dot: "bg-blue-500" },
  { value: "published", label: "Published", dot: "bg-emerald-500" },
  { value: "archived", label: "Archived", dot: "bg-neutral-400" },
]

interface FeedCardStatusMenuProps {
  status: FeedStatus
  /** Called when the user picks a different status. Awaitable so the pill can
   *  show a brief loading state and the parent can do an optimistic update. */
  onChange: (next: FeedStatus) => Promise<void>
  size?: "sm" | "md"
}

/**
 * Inline status pill on each list card. Click to open a 3-option menu —
 * draft / published / archived. Saves a full edit-mode round-trip for the
 * most common state change.
 */
export function FeedCardStatusMenu({ status, onChange, size = "sm" }: FeedCardStatusMenuProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<FeedStatus | null>(null)

  const current = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]

  const pick = async (next: FeedStatus) => {
    if (next === status) {
      setOpen(false)
      return
    }
    setPending(next)
    try {
      await onChange(next)
    } finally {
      setPending(null)
      setOpen(false)
    }
  }

  const sizeClasses =
    size === "md"
      ? "h-7 px-2 text-[11px]"
      : "h-6 px-1.5 text-[10px]"

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={pending !== null}
        className={`inline-flex items-center gap-1 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60 ${sizeClasses}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change status"
        title="Change status"
      >
        {pending ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        ) : (
          <span className={`inline-block h-1 w-1 rounded-full ${current.dot}`} aria-hidden="true" />
        )}
        <span className="font-medium">{(pending ?? status).charAt(0).toUpperCase() + (pending ?? status).slice(1)}</span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 z-20 min-w-32 rounded-md ring-1 ring-neutral-200 bg-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)] py-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={status === opt.value}
              onClick={() => pick(opt.value)}
              disabled={pending !== null}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors disabled:opacity-60 ${
                status === opt.value ? "bg-neutral-100 text-neutral-900" : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span className={`inline-block h-1 w-1 rounded-full ${opt.dot}`} aria-hidden="true" />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * "Updated 2h ago" / "Updated yesterday" / "Updated Mar 5" — short, relative
 * formatting suitable for inline-on-card use. Returns empty string if no input.
 */
export function formatRelative(iso: string | undefined): string {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ""
  const diffMs = Date.now() - t
  if (diffMs < 0) return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return "just now"
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  if (d === 1) return "yesterday"
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * "in 2h" / "in 3d" / "tomorrow" / "Mar 5 at 6:00 AM" — short forward-looking
 * formatting for scheduled items. Returns empty string if no input.
 */
export function formatScheduledIn(iso: string | undefined): string {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ""
  const diffMs = t - Date.now()
  if (diffMs < 0) return "overdue"
  const min = Math.round(diffMs / 60000)
  if (min < 1) return "now"
  if (min < 60) return `in ${min}m`
  const hr = Math.round(min / 60)
  if (hr < 24) return `in ${hr}h`
  const d = Math.round(hr / 24)
  if (d === 1) return "tomorrow"
  if (d < 7) return `in ${d}d`
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

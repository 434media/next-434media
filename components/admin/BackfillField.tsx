"use client"

import { useEffect, useRef, useState } from "react"
import { Lock, Pencil, Loader2, Check, X } from "lucide-react"

interface Props {
  // Current value of the field (after any optimistic local update).
  value: string | null | undefined
  // Friendly placeholder shown when the field is empty and not yet editing.
  emptyLabel: string
  // Called with the trimmed new value when the user commits an edit. Should
  // resolve `false` to revert (e.g. server rejected the write).
  onSave: (next: string) => Promise<boolean>
  // Disabled-tooltip text. When the field has a value, it locks — this string
  // explains why ("Backfill only — already populated").
  lockedReason?: string
  // Visual size knob.
  className?: string
}

/**
 * Inline edit-in-place control for a backfill-only field on EventRegistration.
 *
 * Two states:
 *  - Empty (no value): shows a muted placeholder + Pencil icon. Click to edit.
 *  - Populated: shows the value as plain text + a Lock icon with a tooltip
 *    explaining why it can't be re-edited from this surface.
 *
 * Save commits on Enter or blur. Escape reverts. The save callback returns
 * a boolean so the parent can roll back optimistic state if the server
 * rejects the write (e.g. another admin already filled the field in).
 */
export function BackfillField({
  value,
  emptyLabel,
  onSave,
  lockedReason = "Already populated — captured at signup",
  className = "",
}: Props) {
  const hasValue = !!(value && String(value).trim())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  // Locked — render value with a Lock affordance.
  if (hasValue) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="text-neutral-800">{value}</span>
        <span title={lockedReason} aria-label={lockedReason}>
          <Lock className="w-3 h-3 text-neutral-300" />
        </span>
      </span>
    )
  }

  // Empty + not editing — render a placeholder button.
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft("")
          setError(null)
          setEditing(true)
        }}
        className={`inline-flex items-center gap-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 px-1.5 py-0.5 rounded transition-colors ${className}`}
        title="Click to add"
      >
        <Pencil className="w-3 h-3" />
        <span className="text-[12px] italic">{emptyLabel}</span>
      </button>
    )
  }

  // Editing — input + save/cancel.
  const commit = async () => {
    const next = draft.trim()
    if (!next) {
      // Empty submission cancels rather than saving an empty string (which
      // would just lock the field with a meaningless value).
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const ok = await onSave(next)
      if (ok) {
        setEditing(false)
      } else {
        setError("Save failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          // Defer so a click on save/cancel buttons isn't lost to the blur.
          setTimeout(() => {
            if (editing && !saving) commit()
          }, 100)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          } else if (e.key === "Escape") {
            e.preventDefault()
            setEditing(false)
            setError(null)
          }
        }}
        disabled={saving}
        placeholder={emptyLabel}
        className="px-2 py-0.5 text-[13px] text-neutral-800 bg-white border border-neutral-300 rounded focus:outline-none focus:border-neutral-500 placeholder:text-neutral-400 disabled:opacity-60 min-w-40"
      />
      {saving ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
      ) : (
        <>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            className="p-0.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
            title="Save (Enter)"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setEditing(false)
              setError(null)
            }}
            className="p-0.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {error && (
        <span className="text-[11px] text-rose-600">{error}</span>
      )}
    </span>
  )
}

"use client"

import { useMemo, useRef, useState } from "react"
import { X } from "lucide-react"

interface TaxonomyChipInputProps {
  /** Currently selected values. */
  values: string[]
  onChange: (next: string[]) => void
  /** Existing values across all feed items (deduped). Used as the autocomplete
   *  source. Empty array is fine — the input still works as plain chip-add. */
  suggestions: string[]
  placeholder?: string
  /** Maximum suggestions shown in the dropdown. */
  maxSuggestions?: number
  ariaLabel?: string
}

/**
 * Chip input with autocomplete. Type to filter existing values from the
 * suggestions list; press Enter or comma to add the current input as a chip;
 * click a suggestion to add it. Backspace on empty input removes the last
 * chip. Replaces the legacy comma-separated text input that produced data
 * drift like "DC Team" vs "Digital Canvas Team."
 */
export function TaxonomyChipInput({
  values,
  onChange,
  suggestions,
  placeholder,
  maxSuggestions = 8,
  ariaLabel,
}: TaxonomyChipInputProps) {
  const [draft, setDraft] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const valuesLower = useMemo(() => new Set(values.map((v) => v.toLowerCase())), [values])

  const filteredSuggestions = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return suggestions
      .filter((s) => !valuesLower.has(s.toLowerCase()))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, maxSuggestions)
  }, [draft, suggestions, valuesLower, maxSuggestions])

  const addChip = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (valuesLower.has(trimmed.toLowerCase())) {
      setDraft("")
      return
    }
    onChange([...values, trimmed])
    setDraft("")
    setActiveIdx(0)
  }

  const removeChip = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (open && filteredSuggestions.length > 0 && activeIdx < filteredSuggestions.length) {
        addChip(filteredSuggestions[activeIdx])
      } else if (draft.trim()) {
        addChip(draft)
      }
      return
    }
    if (e.key === "," || e.key === "Tab") {
      if (draft.trim()) {
        e.preventDefault()
        addChip(draft)
      }
      return
    }
    if (e.key === "Backspace" && !draft && values.length > 0) {
      removeChip(values.length - 1)
      return
    }
    if (e.key === "ArrowDown" && open) {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filteredSuggestions.length - 1))
      return
    }
    if (e.key === "ArrowUp" && open) {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === "Escape") {
      setOpen(false)
      return
    }
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-10 px-2 py-1.5 ring-1 ring-neutral-200 rounded-md bg-white focus-within:ring-2 focus-within:ring-neutral-900"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((val, idx) => (
          <span
            key={`${val}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-xs"
          >
            {val}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeChip(idx)
              }}
              className="ml-0.5 p-0.5 -mr-0.5 rounded text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200 transition-colors"
              aria-label={`Remove ${val}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
            setActiveIdx(0)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={values.length === 0 ? placeholder : ""}
          aria-label={ariaLabel}
          className="flex-1 min-w-32 outline-none bg-transparent text-sm py-1 placeholder:text-neutral-400"
        />
      </div>

      {open && filteredSuggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md ring-1 ring-neutral-200 bg-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)] py-1 max-h-56 overflow-y-auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filteredSuggestions.map((s, i) => (
            <button
              key={s}
              role="option"
              aria-selected={activeIdx === i}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => addChip(s)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                activeIdx === i ? "bg-neutral-100 text-neutral-900" : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {s}
            </button>
          ))}
          {draft.trim() && !filteredSuggestions.some((s) => s.toLowerCase() === draft.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => addChip(draft)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 border-t border-neutral-100"
            >
              <span className="text-neutral-400">+ Add new:</span>
              <span className="font-medium">"{draft.trim()}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ChevronDown, Check, Search, Plus } from "lucide-react"

export interface ComboboxOption {
  value: string
  label: string
  /** Muted secondary text shown after the label (e.g. an email). */
  sublabel?: string
  /** Small tag on the right of the row (e.g. "Opp"). */
  badge?: string
  /** Leading icon for the row. */
  icon?: React.ReactNode
}

/**
 * Shared full-width, form-field dropdown — the in-form counterpart to the
 * compact toolbar `Dropdown`. Optional typeahead, custom option rows
 * (icon / sublabel / badge), an optional "create new" action, click-away, and
 * the neutral border idiom. Single-select; `onChange` returns the value AND the
 * full option so callers can branch on extra option data.
 */
export function Combobox({
  value,
  onChange,
  options,
  searchable = false,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  disabled = false,
  ariaLabel,
  onCreateNew,
  createNewLabel,
  triggerLabel,
  className = "",
}: {
  value: string
  onChange: (value: string, option: ComboboxOption | null) => void
  options: ComboboxOption[]
  searchable?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  ariaLabel?: string
  /** When set, a "create new" row appears for a non-empty query with no exact match. */
  onCreateNew?: (query: string) => void
  createNewLabel?: (query: string) => string
  /** Override the trigger text — for pickers whose selection isn't a plain option
   *  (e.g. a free-text value or a freshly "created" entry). */
  triggerLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = options.find((o) => o.value === value) ?? null
  const display = triggerLabel ?? selected?.label ?? ""
  const q = query.trim().toLowerCase()
  const filtered =
    searchable && q
      ? options.filter(
          (o) => o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false),
        )
      : options
  const showCreate =
    !!onCreateNew && query.trim() !== "" && !options.some((o) => o.label.trim().toLowerCase() === q)

  const close = () => {
    setOpen(false)
    setQuery("")
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${display ? "text-neutral-900" : "text-neutral-400"}`}>
          {display || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="listbox"
            className="absolute z-30 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden"
          >
            {searchable && (
              <div className="p-2 border-b border-neutral-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={searchPlaceholder}
                    autoFocus
                    className="w-full pl-8 pr-3 py-2 text-sm bg-neutral-50 border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"
                  />
                </div>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && !showCreate ? (
                <div className="px-3 py-4 text-center text-sm text-neutral-400">{emptyText}</div>
              ) : (
                filtered.slice(0, 50).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => {
                      onChange(o.value, o)
                      close()
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {o.icon}
                      <span className="truncate text-neutral-900">{o.label}</span>
                      {o.sublabel && <span className="truncate text-xs text-neutral-400">{o.sublabel}</span>}
                      {o.badge && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 text-[10px] font-medium uppercase tracking-wide">
                          {o.badge}
                        </span>
                      )}
                    </span>
                    {o.value === value && <Check className="w-4 h-4 text-neutral-900 shrink-0" />}
                  </button>
                ))
              )}

              {showCreate && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateNew!(query.trim())
                    close()
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 border-t border-neutral-100"
                >
                  <Plus className="w-4 h-4 text-neutral-400 shrink-0" />
                  {createNewLabel ? createNewLabel(query.trim()) : `Create "${query.trim()}"`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {open && <div className="fixed inset-0 z-20" onClick={close} />}
    </div>
  )
}

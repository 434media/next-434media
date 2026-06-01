"use client"

import { useEffect, useRef, useState } from "react"
import { Info } from "lucide-react"

// Shared "ⓘ Legend" button + popover. Maps the colored status dots used across a
// surface (Calendar cards, Leads rows, Inbox states) to their plain-language
// labels. Self-contained: owns its open state + outside-click/Escape close.

export interface LegendItem {
  /** Tailwind background class for the dot, e.g. "bg-amber-500". */
  dotClass: string
  label: string
}

interface LegendPopoverProps {
  items: LegendItem[]
  title?: string
  /** Button label; defaults to "Legend". */
  buttonLabel?: string
  className?: string
}

export function LegendPopover({ items, title = "Status legend", buttonLabel = "Legend", className = "" }: LegendPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
      >
        <Info className="w-4 h-4" />
        {buttonLabel}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-md bg-white ring-1 ring-neutral-200 shadow-lg">
          <div className="px-3 py-2.5 border-b border-neutral-100">
            <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
          </div>
          <div className="p-3 grid grid-cols-1 gap-1.5">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${item.dotClass}`} aria-hidden="true" />
                <span className="text-xs text-neutral-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

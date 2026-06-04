"use client"

import { useState } from "react"
import { ChevronDown, Check } from "lucide-react"

// Custom dropdown matching the app's idiom (Date ▾ / ExportMenu) — replaces
// native <select>s. Click-away closes via an invisible full-screen backdrop.
export function Dropdown({
  value,
  options,
  onChange,
  label,
  icon,
  ariaLabel,
  className = "",
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  label?: string
  icon?: React.ReactNode
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12px] font-medium text-neutral-600 bg-white border border-neutral-200/70 rounded-md hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
      >
        {icon}
        {label && <span className="text-neutral-400">{label}:</span>}
        {current?.label}
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-20 min-w-40 max-h-72 overflow-y-auto py-1 rounded-md border border-neutral-200 bg-white shadow-md"
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[12px] text-left hover:bg-neutral-50 transition-colors ${
                  o.value === value ? "text-neutral-900 font-medium" : "text-neutral-600"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="w-3.5 h-3.5 shrink-0 text-neutral-900" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

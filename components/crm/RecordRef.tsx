"use client"

import { useState } from "react"

/**
 * A record's short reference (TSK-142, OPP-1045; lib/record-refs.ts), shown as a chip people can read at a glance: the
 * visual system's Metadata role (`.t-metadata`: Geist Mono 500, 14 px, line height 1.35) in full-contrast
 * `neutral-900`, on the same pill as the kanban card's DOC pill (`neutral-100`, fully rounded). Clicking copies it, so
 * it can be pasted into Ask or a message ("respond to TSK-142"), without opening or closing the record. Renders nothing
 * for a record without one (older records wait on the backfill). Display Standard 3.20 (Provisional).
 */
export function RecordRef({ value, from, className = "" }: { value?: string; from?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }, () => {})
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={copy}
        onPointerDown={(e) => e.stopPropagation()}
        title={copied ? "Copied" : `Copy ${value}`}
        aria-label={copied ? `${value} copied` : `Copy reference ${value}`}
        className="t-metadata inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-900 tabular-nums whitespace-nowrap hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        data-record-ref={value}
      >
        {copied ? "Copied" : value}
      </button>
      {from && <span className="text-[12px] text-neutral-500 whitespace-nowrap">from {from}</span>}
    </span>
  )
}

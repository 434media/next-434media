"use client"

import { useState } from "react"

/**
 * A record's short reference (TSK-142, OPP-1045; lib/record-refs.ts), as cards and drawers show it: Geist Mono, small,
 * neutral. Clicking copies it, so it can be pasted into Ask or a message ("respond to TSK-142"). Renders nothing for a
 * record without one (older records wait on the backfill). Display Standard 3.20 (Provisional).
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
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] leading-none text-neutral-500 ${className}`}>
      <button
        type="button"
        onClick={copy}
        onPointerDown={(e) => e.stopPropagation()}
        title={copied ? "Copied" : `Copy ${value}`}
        aria-label={copied ? `${value} copied` : `Copy reference ${value}`}
        className="rounded px-0.5 -mx-0.5 hover:text-neutral-900 hover:bg-neutral-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 tabular-nums"
        data-record-ref={value}
      >
        {copied ? "Copied" : value}
      </button>
      {from && <span className="text-neutral-400">from {from}</span>}
    </span>
  )
}

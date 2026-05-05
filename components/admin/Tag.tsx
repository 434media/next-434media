"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { parseTag, getTagStyle } from "@/lib/tag-taxonomy"

interface TagProps {
  raw: string
  /** When set, renders an X button that calls this on click. */
  onRemove?: () => void
  size?: "sm" | "md"
}

/**
 * Linear-style tag chip. Reads `{namespace}:{value}` and applies the
 * namespace's color treatment. Falls back to a neutral chip for legacy
 * (un-namespaced) tags so the page never breaks while old data is in flight.
 */
export function Tag({ raw, onRemove, size = "sm" }: TagProps) {
  const parsed = parseTag(raw)
  const { className, label } = getTagStyle(parsed)
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm font-medium ${padding} ${className}`}
      title={raw}
    >
      {parsed.namespace && (
        <span className="opacity-60 tabular-nums">{parsed.namespace}</span>
      )}
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 hover:opacity-100"
          aria-label={`Remove ${raw}`}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  )
}

interface TagListProps {
  tags: string[] | undefined | null
  /** Limit visible tags; remainder shown as "+N". */
  max?: number
  size?: "sm" | "md"
  onRemove?: (raw: string) => void
}

export function TagList({ tags, max, size = "sm", onRemove }: TagListProps) {
  // Click +N to expand the rest inline; click again to collapse. Inline
  // expansion (rather than a hover popover) avoids positioning headaches
  // inside virtualized rows where parent stacking contexts are unstable.
  const [expanded, setExpanded] = useState(false)
  if (!tags || tags.length === 0) return null
  const showAll = expanded || typeof max !== "number"
  const visible = showAll ? tags : tags.slice(0, max!)
  const overflow = typeof max === "number" ? Math.max(0, tags.length - max) : 0

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {visible.map((t) => (
        <Tag
          key={t}
          raw={t}
          size={size}
          onRemove={onRemove ? () => onRemove(t) : undefined}
        />
      ))}
      {overflow > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className="text-[10px] text-neutral-500 font-medium tabular-nums px-1 py-0.5 rounded hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          title={expanded ? "Show fewer" : `Show ${overflow} more tag${overflow === 1 ? "" : "s"}`}
        >
          {expanded ? "−" : "+"}{overflow}
        </button>
      )}
    </div>
  )
}

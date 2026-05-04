"use client"

/**
 * Linear-style status indicator: a 6px colored circle prefixed to a neutral
 * text label. Replaces the colored-pill pattern (`bg-blue-50 text-blue-700
 * border-blue-100 rounded-full`) used across the admin.
 *
 * Color is conveyed by the dot only; text stays neutral so multiple states
 * stop competing for attention in dense rows.
 */

export type DotColor =
  | "blue"
  | "sky"
  | "amber"
  | "emerald"
  | "green"
  | "rose"
  | "violet"
  | "indigo"
  | "neutral"

const DOT_BG: Record<DotColor, string> = {
  blue: "bg-blue-500",
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  green: "bg-green-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  indigo: "bg-indigo-500",
  neutral: "bg-neutral-400",
}

interface StatusDotProps {
  color: DotColor
  label: string
  /** Slightly larger dot + text for surfaces where the indicator is the focus. */
  size?: "sm" | "md"
  className?: string
}

export function StatusDot({ color, label, size = "sm", className = "" }: StatusDotProps) {
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"
  const textSize = size === "sm" ? "text-[11px]" : "text-[12px]"
  return (
    <span className={`inline-flex items-center gap-1.5 ${textSize} ${className}`}>
      <span className={`shrink-0 rounded-full ${dotSize} ${DOT_BG[color]}`} aria-hidden="true" />
      <span className="font-medium text-neutral-700">{label}</span>
    </span>
  )
}

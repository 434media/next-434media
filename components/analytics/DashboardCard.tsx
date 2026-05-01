import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

interface DashboardCardProps {
  /** Section label, rendered uppercase + tracked. */
  title: string
  /** Optional small label icon. */
  icon?: LucideIcon
  /** Optional subtitle below the title (e.g. "12 sources · 24K sessions"). */
  subtitle?: ReactNode
  /** Content rendered to the right of the title (filters, links, etc.). */
  rightSlot?: ReactNode
  /** Optional footer (e.g. "Generated at …"). */
  footer?: ReactNode
  /** When true, removes inner padding so a table can render flush to edges. */
  flush?: boolean
  children: ReactNode
}

/**
 * Standard panel shell for the analytics dashboard. Matches the visual
 * language of the top-of-page panels (Goals, Insights, Hero, EventsConv,
 * Search, CrUX, Cohort) so the bottom-of-page panels can stop reinventing
 * their own headers.
 *
 * Visual rules:
 * - White background, single 1px neutral-200 border, soft `rounded-xl`.
 * - No drop shadows, no gradient overlays — quiet by design.
 * - Section title is a small uppercase label (matches the rest of the system),
 *   not a big bold CardTitle.
 */
export function DashboardCard({
  title,
  icon: Icon,
  subtitle,
  rightSlot,
  footer,
  flush,
  children,
}: DashboardCardProps) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100">
        {Icon && <Icon className="w-4 h-4 text-neutral-400 shrink-0" />}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 shrink-0">
          {title}
        </span>
        {subtitle && (
          <span className="text-[10px] text-neutral-400 truncate">{subtitle}</span>
        )}
        {rightSlot && <div className="ml-auto shrink-0">{rightSlot}</div>}
      </div>
      <div className={flush ? "" : "p-4"}>{children}</div>
      {footer && (
        <div className="px-4 py-2 border-t border-neutral-100 bg-neutral-50 text-[11px] text-neutral-400">
          {footer}
        </div>
      )}
    </div>
  )
}

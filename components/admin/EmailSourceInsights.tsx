"use client"

import { useMemo, type ReactNode } from "react"
import { RefreshCw } from "lucide-react"
import { useLeadsByEmail } from "@/components/admin/LeadCrossLink"
import { useMailchimpSubscribers, isMarketable, isOptedOut } from "@/components/admin/MailchimpSubscribedPill"

// ── Types ──

export type EmailAudienceFilter = "all" | "in-crm" | "in-mailchimp" | "untapped" | "opted-out"

export interface SignupRowMinimal {
  // Just enough shape for the rollup. The parent passes the full signups[]
  // and we read what we need.
  email: string
  source: string
}

interface SourceRollup {
  source: string
  total: number
  inCrm: number
  inMailchimp: number
  optedOut: number
  conversionRate: number
}

interface Props {
  // Source counts from /api/admin/email-lists-firestore?action=counts. Keys
  // are source names ("AIM", "Digital Canvas", ...), values are total counts.
  // Used as the canonical total — we don't trust client-side rollups to be
  // exhaustive in case a source has zero matching signups in the loaded set.
  sourceCounts: Record<string, number>
  // ALL signups currently in memory (not filtered by source). Drives
  // per-source CRM / Mailchimp rollups via the email join.
  allSignups: SignupRowMinimal[]
  selectedSource: string
  onSelectSource: (source: string) => void
  audienceFilter: EmailAudienceFilter
  onAudienceFilterChange: (f: EmailAudienceFilter) => void
  onRefresh: () => void
  isLoading?: boolean
  // Right-aligned actions for the pill row (e.g. the Export menu). Lets the
  // tab retire its own header bar — the pill row is the section's only chrome.
  actions?: ReactNode
}

/**
 * Insights panel for the Email Lists tab. A single compact source selector —
 * a horizontal row of pills ("All" + one per source, each with its count) —
 * keeps the chrome quiet and the table high on the page.
 *
 * Selecting a source reveals a drilldown below the pills: a light row of
 * stat chips (In CRM / In Mailchimp / Untapped / Opted out) that toggle the
 * audience filter on the table. Lead conversion lives in the table's
 * select → Promote-to-leads flow, not here.
 */
export function EmailSourceInsights({
  sourceCounts,
  allSignups,
  selectedSource,
  onSelectSource,
  audienceFilter,
  onAudienceFilterChange,
  onRefresh,
  isLoading,
  actions,
}: Props) {
  const leadsByEmail = useLeadsByEmail()
  const subscriberMap = useMailchimpSubscribers()

  // Build per-source rollups joining signups against CRM + Mailchimp.
  // Rollups are derived from `allSignups` rather than `sourceCounts` so the
  // CRM / MC slices reflect what's actually in the loaded set; `total` falls
  // back to `sourceCounts[source]` so the headline is always the canonical
  // server count even if a source has zero loaded rows.
  const rollups: SourceRollup[] = useMemo(() => {
    type Bucket = {
      uniqueEmails: Set<string>
      inCrm: Set<string>
      inMc: Set<string>
      optedOut: Set<string>
    }
    const buckets = new Map<string, Bucket>()

    for (const s of allSignups) {
      const src = s.source || "Unknown"
      let b = buckets.get(src)
      if (!b) {
        b = { uniqueEmails: new Set(), inCrm: new Set(), inMc: new Set(), optedOut: new Set() }
        buckets.set(src, b)
      }
      const e = (s.email || "").toLowerCase()
      if (!e) continue
      b.uniqueEmails.add(e)
      if (leadsByEmail.has(e)) b.inCrm.add(e)
      // Subscribed (marketable) only — matches the "subscribed" tile label and
      // the consent-aware header strip, not mere presence.
      if (isMarketable(subscriberMap.get(e))) b.inMc.add(e)
      if (isOptedOut(subscriberMap.get(e))) b.optedOut.add(e)
    }

    // Make sure every source from the canonical counts has a row, even if
    // it has zero loaded signups. Otherwise the user sees a mismatched grid.
    const sourceNames = new Set<string>([
      ...Object.keys(sourceCounts),
      ...buckets.keys(),
    ])

    const out: SourceRollup[] = []
    for (const src of sourceNames) {
      const b = buckets.get(src)
      const unique = b?.uniqueEmails.size ?? 0
      const inCrm = b?.inCrm.size ?? 0
      const inMc = b?.inMc.size ?? 0
      const total = sourceCounts[src] ?? unique
      out.push({
        source: src,
        total,
        inCrm,
        inMailchimp: inMc,
        optedOut: b?.optedOut.size ?? 0,
        conversionRate: unique > 0 ? inCrm / unique : 0,
      })
    }
    return out
  }, [allSignups, sourceCounts, leadsByEmail, subscriberMap])

  // Pills read top-to-bottom by volume — the busiest sources first.
  const sortedRollups = useMemo(
    () => [...rollups].sort((a, b) => b.total - a.total),
    [rollups],
  )

  const totals = useMemo(() => {
    let registrations = 0
    for (const r of rollups) registrations += r.total
    return { sources: rollups.length, registrations }
  }, [rollups])

  const mcAvailable = subscriberMap.size > 0
  const current = rollups.find((r) => r.source === selectedSource)

  const untapped = current ? Math.max(0, current.total - current.inCrm) : 0

  return (
    <div className="mb-4">
      {/* Compact source selector — one quiet pill row. "All" + every source,
          each with its count; the active pill fills in. Replaces the old
          search + all-sources card + grid of source cards. */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <SourcePill
          label="All"
          count={totals.registrations}
          active={!selectedSource}
          onClick={() => onSelectSource("")}
        />
        {sortedRollups.map((r) => (
          <SourcePill
            key={r.source}
            label={r.source}
            count={r.total}
            active={selectedSource === r.source}
            onClick={() => onSelectSource(r.source)}
          />
        ))}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {actions}
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
            title="Refresh"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Drilldown — only when a source is selected. The lit pill above already
          names it, so the panel leads straight with the stat-chip filters; lead
          conversion lives in the table's select → Promote flow, not here. */}
      {selectedSource && (
        <div className="mt-3 bg-white rounded-md border border-neutral-200/70 p-3">
          {/* Stats — a light inline row of toggle filters (the lit source pill
              above already shows the total, so there's no separate Total card).
              Clicking an active chip toggles back to all rows. */}
          {current ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatChip
                label="In CRM"
                value={current.inCrm.toLocaleString()}
                dot="bg-emerald-500"
                active={audienceFilter === "in-crm"}
                onClick={() => onAudienceFilterChange(audienceFilter === "in-crm" ? "all" : "in-crm")}
              />
              <StatChip
                label="In Mailchimp"
                value={mcAvailable ? current.inMailchimp.toLocaleString() : "—"}
                dot="bg-neutral-400"
                active={audienceFilter === "in-mailchimp"}
                onClick={
                  mcAvailable
                    ? () => onAudienceFilterChange(audienceFilter === "in-mailchimp" ? "all" : "in-mailchimp")
                    : undefined
                }
                disabled={!mcAvailable}
              />
              <StatChip
                label="Untapped"
                value={untapped.toLocaleString()}
                dot={untapped > 0 ? "bg-amber-500" : "bg-neutral-300"}
                active={audienceFilter === "untapped"}
                onClick={() => onAudienceFilterChange(audienceFilter === "untapped" ? "all" : "untapped")}
              />
              <StatChip
                label="Opted out"
                value={current.optedOut.toLocaleString()}
                dot={current.optedOut > 0 ? "bg-rose-500" : "bg-neutral-300"}
                active={audienceFilter === "opted-out"}
                onClick={() => onAudienceFilterChange(audienceFilter === "opted-out" ? "all" : "opted-out")}
              />
            </div>
          ) : (
            <p className="text-[12px] text-neutral-400">No data loaded for this source.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Source pill (selector) ──

function SourcePill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900"
      }`}
    >
      <span className="truncate max-w-56">{label}</span>
      <span className={`tabular-nums ${active ? "text-white/60" : "text-neutral-400"}`}>
        {count.toLocaleString()}
      </span>
    </button>
  )
}

// ── Stat chip (drilldown filter) ──
// Light, toggle-style filter that matches the source pills and toolbar chips:
// a status dot, the count, and a label. Replaces the chunky bordered cards so
// the drilldown reads at the same visual weight as the rest of the page.

function StatChip({
  label,
  value,
  dot,
  active,
  onClick,
  disabled,
}: {
  label: string
  value: string
  dot: string
  active?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] transition-colors ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-600 border border-neutral-200/70 hover:bg-neutral-50 hover:text-neutral-900"
      } ${disabled ? "opacity-50 cursor-default" : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white/70" : dot}`} aria-hidden="true" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className={active ? "text-white/80" : "text-neutral-500"}>{label}</span>
    </button>
  )
}

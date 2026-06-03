"use client"

import { useMemo, useState, useEffect } from "react"
import {
  Globe,
  ArrowLeft,
  CheckCircle2,
  Mail,
  TrendingUp,
  ChevronDown,
  UserPlus,
  RefreshCw,
  BellOff,
} from "lucide-react"
import { useLeadsByEmail } from "@/components/admin/LeadCrossLink"
import { useMailchimpSubscribers, isMarketable, isOptedOut } from "@/components/admin/MailchimpSubscribedPill"
import { RegistrationSparkline } from "@/components/admin/RegistrationSparkline"

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

type SortKey = "volume" | "conversion" | "untapped" | "name"

const SORT_LABELS: Record<SortKey, string> = {
  volume: "Volume",
  conversion: "Conversion %",
  untapped: "Untapped",
  name: "Name",
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
  // Header actions for the drilldown (CRM convert-all, MC push). Wired by
  // the parent so this component doesn't need to know how those work.
  onConvertAll?: () => void
  onPushToMailchimp?: () => void
  convertAllDisabled?: boolean
  pushToMailchimpDisabled?: boolean
  // ISO timestamps from the unfiltered set of signups for the selected
  // source. Drives the per-day sparkline above the drilldown table.
  drilldownTimestamps?: string[]
}

/**
 * Two-mode insights panel for the Email Lists tab — mirrors EventInsights so
 * the two surfaces feel like siblings.
 *
 * Overview: all-sources pill + grouped grid of clickable source cards with
 * sort dropdown and a search input at >6 sources. Each card promotes the
 * total count as the headline + a thin conversion bar at the bottom edge.
 *
 * Drilldown (when a source is selected): four clickable stat tiles
 * (Total / In CRM / In Mailchimp / Untapped) that toggle the audience
 * filter on the table below; breadcrumb-style back link; right-aligned
 * Convert-all / Push-to-MC actions.
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
  onConvertAll,
  onPushToMailchimp,
  convertAllDisabled,
  pushToMailchimpDisabled,
  drilldownTimestamps,
}: Props) {
  const leadsByEmail = useLeadsByEmail()
  const subscriberMap = useMailchimpSubscribers()
  const [sortKey, setSortKey] = useState<SortKey>("volume")
  const [overviewQuery, setOverviewQuery] = useState("")
  // Collapse the source grid to bring the table up. Default expanded so a
  // first-time admin sees the sources; remembered per browser once toggled.
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    setCollapsed(localStorage.getItem("emailSourcesCollapsed") === "1")
  }, [])
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem("emailSourcesCollapsed", next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })

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

  const filteredRollups = useMemo(() => {
    const q = overviewQuery.trim().toLowerCase()
    return q ? rollups.filter((r) => r.source.toLowerCase().includes(q)) : rollups
  }, [rollups, overviewQuery])

  const sortedRollups = useMemo(() => {
    const arr = [...filteredRollups]
    arr.sort((a, b) => {
      switch (sortKey) {
        case "conversion":
          return b.conversionRate - a.conversionRate
        case "untapped":
          return b.total - b.inCrm - (a.total - a.inCrm)
        case "name":
          return a.source.localeCompare(b.source)
        case "volume":
        default:
          return b.total - a.total
      }
    })
    return arr
  }, [filteredRollups, sortKey])

  const totals = useMemo(() => {
    let registrations = 0
    for (const r of rollups) registrations += r.total
    return { sources: rollups.length, registrations }
  }, [rollups])

  const showSearch = rollups.length > 6
  const mcAvailable = subscriberMap.size > 0
  const current = rollups.find((r) => r.source === selectedSource)

  // ── Drilldown mode ──
  if (selectedSource) {
    const untapped = current ? Math.max(0, current.total - current.inCrm) : 0
    return (
      <div className="bg-white rounded-md border border-neutral-200/70 p-4 sm:p-5 mb-4">
        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] min-w-0">
            <button
              type="button"
              onClick={() => onSelectSource("")}
              className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Sources
            </button>
            <span className="text-neutral-300" aria-hidden>/</span>
            <span className="text-neutral-700 font-medium truncate" aria-current="page">
              {selectedSource}
            </span>
          </nav>
          <div className="flex items-center gap-1.5">
            {onPushToMailchimp && (
              <button
                type="button"
                onClick={onPushToMailchimp}
                disabled={pushToMailchimpDisabled}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 bg-white border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Push these signups to Mailchimp"
              >
                <Mail className="w-3.5 h-3.5" />
                Push to Mailchimp
              </button>
            )}
            {onConvertAll && (
              <button
                type="button"
                onClick={onConvertAll}
                disabled={convertAllDisabled}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-white bg-neutral-900 rounded hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Create a CRM lead for every visible signup"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Convert all to leads
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
              title="Refresh"
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-neutral-900 leading-tight tracking-tight truncate">
            {selectedSource}
          </h3>
        </div>

        {/* Stats — clickable filters */}
        {current ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <FilterTile
              icon={Globe}
              label="Total"
              value={current.total.toLocaleString()}
              hint="signups"
              active={audienceFilter === "all"}
              onClick={() => onAudienceFilterChange("all")}
            />
            <FilterTile
              icon={CheckCircle2}
              label="In CRM"
              value={current.inCrm.toLocaleString()}
              hint={Math.round(current.conversionRate * 100) + "% conversion"}
              valueClass="text-emerald-700"
              active={audienceFilter === "in-crm"}
              onClick={() => onAudienceFilterChange("in-crm")}
            />
            <FilterTile
              icon={Mail}
              label="In Mailchimp"
              value={mcAvailable ? current.inMailchimp.toLocaleString() : "—"}
              hint={mcAvailable ? "subscribed" : "Mailchimp offline"}
              active={audienceFilter === "in-mailchimp"}
              onClick={mcAvailable ? () => onAudienceFilterChange("in-mailchimp") : undefined}
              disabled={!mcAvailable}
            />
            <FilterTile
              icon={TrendingUp}
              label="Untapped"
              value={untapped.toLocaleString()}
              hint="not yet leads"
              valueClass={untapped > 0 ? "text-amber-700" : "text-neutral-400"}
              active={audienceFilter === "untapped"}
              onClick={() => onAudienceFilterChange("untapped")}
            />
            <FilterTile
              icon={BellOff}
              label="Opted out"
              value={current.optedOut.toLocaleString()}
              hint="unsubscribed"
              valueClass={current.optedOut > 0 ? "text-rose-700" : "text-neutral-400"}
              active={audienceFilter === "opted-out"}
              onClick={() => onAudienceFilterChange("opted-out")}
            />
          </div>
        ) : (
          <p className="text-[12px] text-neutral-400">No data loaded for this source.</p>
        )}

        {/* Per-day sparkline — only renders when the parent supplies enough
            timestamps. No event-day anchor here (signups don't have one);
            the sparkline tells the user where the spikes fell so they can
            attribute traffic to a campaign or post. */}
        {drilldownTimestamps && drilldownTimestamps.length >= 3 && (
          <div className="mt-4 pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Signups over time
              </span>
            </div>
            <RegistrationSparkline timestamps={drilldownTimestamps} />
          </div>
        )}
      </div>
    )
  }

  // ── Overview mode ──
  return (
    <div className="mb-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 min-w-0 text-left"
          title={collapsed ? "Show sources" : "Hide sources"}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500">
            Sources
          </h3>
          <span className="text-[11px] text-neutral-400 truncate">
            {totals.sources} {totals.sources === 1 ? "source" : "sources"} ·{" "}
            {totals.registrations.toLocaleString()} signups
          </span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <SortDropdown value={sortKey} onChange={setSortKey} />
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

      {!collapsed && (
        <>
      {/* Search — progressive */}
      {showSearch && (
        <div className="relative mb-3">
          <input
            type="text"
            value={overviewQuery}
            onChange={(e) => setOverviewQuery(e.target.value)}
            placeholder={`Search ${rollups.length} sources...`}
            className="w-full pl-3 pr-8 py-1.5 text-[12px] font-normal text-neutral-700 bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400 placeholder:text-neutral-400"
          />
          {overviewQuery && (
            <button
              type="button"
              onClick={() => setOverviewQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 hover:text-neutral-700 px-1 rounded"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* "All sources" pill */}
      <button
        type="button"
        onClick={() => onSelectSource("")}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 mb-3 rounded-md border border-neutral-200/70 bg-white hover:bg-neutral-50 transition-colors text-left group"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          All sources
        </span>
        <span className="text-[14px] font-semibold tabular-nums text-neutral-900 group-hover:text-black">
          {totals.registrations.toLocaleString()}
        </span>
      </button>

      {/* Empty search state */}
      {sortedRollups.length === 0 && rollups.length > 0 && (
        <div className="py-8 text-center text-[12px] text-neutral-400">
          No sources match{" "}
          <span className="text-neutral-700 font-medium">&ldquo;{overviewQuery}&rdquo;</span>
          <button
            type="button"
            onClick={() => setOverviewQuery("")}
            className="ml-2 text-neutral-500 hover:text-neutral-900 underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Source grid */}
      {sortedRollups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {sortedRollups.map((r) => (
            <SourceCard
              key={r.source}
              rollup={r}
              mailchimpAvailable={mcAvailable}
              onClick={onSelectSource}
            />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}

// ── Sort dropdown (matches EventInsights) ──

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-neutral-600 bg-white border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
      >
        <span className="text-neutral-400">Sort:</span>
        {SORT_LABELS[value]}
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-35 py-1 rounded-md border border-neutral-200 bg-white shadow-md">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(k)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-neutral-50 transition-colors ${
                k === value ? "text-neutral-900 font-medium" : "text-neutral-600"
              }`}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Source card (overview) ──

function SourceCard({
  rollup,
  mailchimpAvailable,
  onClick,
}: {
  rollup: SourceRollup
  mailchimpAvailable: boolean
  onClick: (name: string) => void
}) {
  const untapped = Math.max(0, rollup.total - rollup.inCrm)
  const conversionPct = Math.round(rollup.conversionRate * 100)
  return (
    <button
      type="button"
      onClick={() => onClick(rollup.source)}
      className="group relative p-3 pb-4 rounded-md border bg-white text-neutral-900 border-neutral-200/70 hover:border-neutral-300 hover:bg-neutral-50/50 transition-all text-left overflow-hidden"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[12px] font-semibold text-neutral-900 leading-snug truncate min-w-0">
          {rollup.source}
        </span>
      </div>
      {/* Headline metric */}
      <div className="text-2xl font-semibold leading-none tabular-nums tracking-tight">
        {rollup.total.toLocaleString()}
      </div>
      <div className="text-[11px] text-neutral-500 font-normal mt-0.5">signups</div>
      {/* Secondary line */}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500 tabular-nums">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
          {rollup.inCrm} CRM
        </span>
        {mailchimpAvailable && (
          <>
            <span className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1">
              <Mail className="w-2.5 h-2.5 text-neutral-400" />
              {rollup.inMailchimp} MC
            </span>
          </>
        )}
        {untapped > 0 && (
          <>
            <span className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              {untapped} untapped
            </span>
          </>
        )}
      </div>
      {/* Conversion bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-100"
        aria-hidden
      >
        <div
          className={`h-full transition-all ${
            conversionPct >= 50
              ? "bg-emerald-500"
              : conversionPct >= 20
                ? "bg-amber-500"
                : "bg-neutral-300"
          }`}
          style={{ width: `${Math.max(2, Math.min(100, conversionPct))}%` }}
        />
      </div>
    </button>
  )
}

// ── Filter tile (drilldown) ──

function FilterTile({
  icon: Icon,
  label,
  value,
  hint,
  valueClass = "text-neutral-900",
  active,
  onClick,
  disabled,
}: {
  icon: typeof Globe
  label: string
  value: string
  hint: string
  valueClass?: string
  active?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  const interactive = !!onClick && !disabled
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-3 rounded-md border text-left transition-all ${
        active
          ? "border-neutral-900 bg-neutral-900/3"
          : "border-neutral-200/70 bg-white hover:bg-neutral-50"
      } ${interactive ? "cursor-pointer" : "cursor-default"} ${disabled ? "opacity-50" : ""}`}
      aria-pressed={active}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${active ? "text-neutral-900" : "text-neutral-400"}`} />
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            active ? "text-neutral-900" : "text-neutral-500"
          }`}
        >
          {label}
        </span>
      </div>
      <div className={`text-lg font-semibold tabular-nums leading-tight ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-neutral-400 font-normal leading-snug mt-0.5">{hint}</div>
    </button>
  )
}

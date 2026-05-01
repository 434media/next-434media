"use client"

import { useEffect, useState } from "react"
import { Gauge, Loader2, Smartphone, Monitor, Tablet, Activity, ExternalLink } from "lucide-react"
import { buildAnalyticsUrl } from "../../lib/analytics-url"

interface CoreWebVitalsPanelProps {
  propertyId: string
  setError?: (e: string | null) => void
}

type Rating = "good" | "needs-improvement" | "poor" | "unknown"

interface CruxMetric {
  p75: number
  rating: Rating
  goodDensity: number
  needsImprovementDensity: number
  poorDensity: number
}

interface CruxPayload {
  available: boolean
  reason?: string
  origin?: string
  formFactor?: string
  collectionPeriod?: { from: string; to: string }
  metrics?: {
    LCP?: CruxMetric
    INP?: CruxMetric
    CLS?: CruxMetric
    TTFB?: CruxMetric
    FCP?: CruxMetric
  }
}

type FormFactor = "ALL_FORM_FACTORS" | "PHONE" | "DESKTOP" | "TABLET"

const FORM_FACTORS: Array<{ value: FormFactor; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "ALL_FORM_FACTORS", label: "All", icon: Activity },
  { value: "PHONE", label: "Mobile", icon: Smartphone },
  { value: "DESKTOP", label: "Desktop", icon: Monitor },
  { value: "TABLET", label: "Tablet", icon: Tablet },
]

const RATING_CLASSES: Record<Rating, { bg: string; text: string; border: string; label: string }> = {
  good: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Good" },
  "needs-improvement": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Needs improvement" },
  poor: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Poor" },
  unknown: { bg: "bg-neutral-100", text: "text-neutral-500", border: "border-neutral-200", label: "—" },
}

function formatMetricValue(name: string, p75: number): string {
  if (name === "CLS") return p75.toFixed(3)
  // ms metrics
  if (p75 >= 1000) return `${(p75 / 1000).toFixed(2)}s`
  return `${Math.round(p75)}ms`
}

const METRIC_LABELS: Record<string, { full: string; short: string }> = {
  LCP: { full: "Largest Contentful Paint", short: "Loading" },
  INP: { full: "Interaction to Next Paint", short: "Responsiveness" },
  CLS: { full: "Cumulative Layout Shift", short: "Visual stability" },
  TTFB: { full: "Time to First Byte", short: "Server response" },
  FCP: { full: "First Contentful Paint", short: "First paint" },
}

export function CoreWebVitalsPanel({ propertyId, setError }: CoreWebVitalsPanelProps) {
  const [payload, setPayload] = useState<CruxPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [formFactor, setFormFactor] = useState<FormFactor>("ALL_FORM_FACTORS")

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        // CrUX ignores date range — always returns the latest 28-day window.
        // Pass a placeholder dateRange to satisfy buildAnalyticsUrl.
        const url = buildAnalyticsUrl({
          endpoint: "core-web-vitals",
          dateRange: { startDate: "today", endDate: "today" },
          propertyId,
        })
        // Append formFactor manually (buildAnalyticsUrl doesn't model it)
        const qs = formFactor === "ALL_FORM_FACTORS" ? "" : `&formFactor=${formFactor}`
        const res = await fetch(`${url}${qs}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as CruxPayload
        if (!cancelled) setPayload(data)
      } catch (err) {
        if (setError) setError(err instanceof Error ? err.message : "CrUX fetch failed")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [propertyId, formFactor, setError])

  if (isLoading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (!payload?.available) {
    const isMissingKey = payload?.reason?.includes("CRUX_API_KEY")
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
        <Gauge className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-neutral-700">
          {isMissingKey ? "CrUX API not connected" : "No Core Web Vitals data"}
        </p>
        <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
          {isMissingKey
            ? "Enable Chrome UX Report API in GCP Console, create an API key, and set CRUX_API_KEY in env."
            : payload?.reason || "CrUX needs ~100+ daily Chrome samples to surface a site."}
        </p>
      </div>
    )
  }

  const metrics = payload.metrics ?? {}
  const orderedKeys: Array<keyof typeof metrics> = ["LCP", "INP", "CLS", "TTFB", "FCP"]
  const presentMetrics = orderedKeys.filter((k) => metrics[k]).map((k) => ({ key: k, m: metrics[k]! }))

  return (
    <div className="space-y-4">
      {/* Form-factor selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mr-1">
          Form factor
        </span>
        {FORM_FACTORS.map((ff) => {
          const Icon = ff.icon
          const active = formFactor === ff.value
          return (
            <button
              key={ff.value}
              type="button"
              onClick={() => setFormFactor(ff.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors border ${
                active
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <Icon className="w-3 h-3" />
              {ff.label}
            </button>
          )
        })}
        {payload.collectionPeriod && (
          <span className="ml-auto text-[10px] text-neutral-400">
            CrUX 28-day window · {payload.collectionPeriod.from} → {payload.collectionPeriod.to}
          </span>
        )}
      </div>

      {/* Metric cards. The 3 Core Web Vitals (LCP, INP, CLS) get the
          spotlight grid — TTFB and FCP are secondary, smaller. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(["LCP", "INP", "CLS"] as const).map((key) => {
          const m = metrics[key]
          if (!m) return <EmptyMetricCard key={key} name={key} />
          return <MetricCard key={key} name={key} metric={m} />
        })}
      </div>

      {(metrics.TTFB || metrics.FCP) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {metrics.TTFB && <MetricCard name="TTFB" metric={metrics.TTFB} compact />}
          {metrics.FCP && <MetricCard name="FCP" metric={metrics.FCP} compact />}
        </div>
      )}

      {/* Footer with link to PageSpeed Insights for deeper drill-down */}
      {payload.origin && (
        <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
          <span>{payload.origin} · {presentMetrics.length} of 5 metrics with data</span>
          <a
            href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(payload.origin)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-neutral-700"
          >
            Open in PageSpeed Insights
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  name,
  metric,
  compact = false,
}: {
  name: keyof typeof METRIC_LABELS
  metric: CruxMetric
  compact?: boolean
}) {
  const r = RATING_CLASSES[metric.rating]
  const label = METRIC_LABELS[name]

  return (
    <div className={`bg-white rounded-xl border ${r.border} overflow-hidden`}>
      <div className={`${r.bg} px-4 py-2 border-b ${r.border}`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${r.text}`}>
            {name}
          </span>
          <span className={`text-[10px] font-semibold ${r.text}`}>{r.label}</span>
        </div>
      </div>
      <div className={compact ? "p-3" : "p-4"}>
        <div className={`font-bold text-neutral-900 tabular-nums leading-none ${compact ? "text-2xl" : "text-3xl"}`}>
          {formatMetricValue(name, metric.p75)}
        </div>
        <p className="text-[11px] text-neutral-500 mt-1">{label.short} · 75th percentile</p>

        {/* Distribution bar — Good (green) / Needs improvement (amber) / Poor (red) */}
        <div className="mt-3 flex h-1.5 rounded-full overflow-hidden bg-neutral-100">
          <div
            className="bg-emerald-500"
            style={{ width: `${(metric.goodDensity * 100).toFixed(1)}%` }}
            title={`Good: ${(metric.goodDensity * 100).toFixed(1)}%`}
          />
          <div
            className="bg-amber-500"
            style={{ width: `${(metric.needsImprovementDensity * 100).toFixed(1)}%` }}
            title={`Needs improvement: ${(metric.needsImprovementDensity * 100).toFixed(1)}%`}
          />
          <div
            className="bg-red-500"
            style={{ width: `${(metric.poorDensity * 100).toFixed(1)}%` }}
            title={`Poor: ${(metric.poorDensity * 100).toFixed(1)}%`}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400 tabular-nums">
          <span>{(metric.goodDensity * 100).toFixed(0)}% good</span>
          <span>{(metric.needsImprovementDensity * 100).toFixed(0)}% NI</span>
          <span>{(metric.poorDensity * 100).toFixed(0)}% poor</span>
        </div>
      </div>
    </div>
  )
}

function EmptyMetricCard({ name }: { name: keyof typeof METRIC_LABELS }) {
  const label = METRIC_LABELS[name]
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 opacity-60">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {name}
      </div>
      <div className="text-2xl font-bold text-neutral-300 mt-2">—</div>
      <p className="text-[11px] text-neutral-400 mt-1">{label.short} · no data</p>
    </div>
  )
}

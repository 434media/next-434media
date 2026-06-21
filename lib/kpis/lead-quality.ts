import type { Lead, LeadSource, LeadDisqualifiedReason } from "@/types/crm-types"
import { LEAD_DISQUALIFIED_REASON_LABELS } from "@/types/crm-types"

// Lead-quality KPIs for the Funnel KPI surface. Answers the founder's two
// questions: "what's the score value" and "were leads kept or removed" — plus
// the WHY behind removals and how score correlates with conversion. Pure
// aggregation over the leads collection; no new data capture beyond the
// disqualified_reason field set at archive time.

export interface ScoreBand {
  label: string
  min: number
  max: number
  count: number
  /** How many leads in this band ultimately converted — score→outcome signal. */
  converted: number
}

export interface RemovedReasonStat {
  reason: LeadDisqualifiedReason | "unspecified"
  label: string
  count: number
}

export interface SourceStat {
  source: LeadSource
  total: number
  kept: number
  removed: number
  converted: number
  avgScore: number
}

export interface LeadQualityKpis {
  generatedAt: string
  total: number
  /** Active funnel + converted — everything not archived. */
  kept: number
  /** status === "archived". */
  removed: number
  converted: number
  /** kept / total, 0–1. */
  keptRate: number
  /** converted / total, 0–1. */
  conversionRate: number
  avgScore: number
  scoreDistribution: ScoreBand[]
  removedReasons: RemovedReasonStat[]
  bySource: SourceStat[]
}

// 0–100 lead score (lib/score-lead.ts), bucketed into five readable bands.
const BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: "0–20", min: 0, max: 20 },
  { label: "21–40", min: 21, max: 40 },
  { label: "41–60", min: 41, max: 60 },
  { label: "61–80", min: 61, max: 80 },
  { label: "81–100", min: 81, max: 100 },
]

const ALL_SOURCES: LeadSource[] = [
  "event",
  "web",
  "manual",
  "newsletter",
  "referral",
  "partner",
  "social",
  "prospected",
]

function round(n: number, places = 1): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export function computeLeadQualityKpis(leads: Lead[], generatedAt: string): LeadQualityKpis {
  const total = leads.length
  const removed = leads.filter((l) => l.status === "archived").length
  const converted = leads.filter((l) => l.status === "converted").length
  const kept = total - removed

  const scoreSum = leads.reduce((sum, l) => sum + (typeof l.score === "number" ? l.score : 0), 0)
  const avgScore = total > 0 ? round(scoreSum / total) : 0

  const scoreDistribution: ScoreBand[] = BANDS.map((band) => {
    const inBand = leads.filter((l) => {
      const s = typeof l.score === "number" ? l.score : 0
      return s >= band.min && s <= band.max
    })
    return {
      label: band.label,
      min: band.min,
      max: band.max,
      count: inBand.length,
      converted: inBand.filter((l) => l.status === "converted").length,
    }
  })

  // Removal-reason breakdown over archived leads only. Archived without a stated
  // reason (legacy rows or a quick archive) fall into "unspecified".
  const reasonCounts = new Map<LeadDisqualifiedReason | "unspecified", number>()
  for (const l of leads) {
    if (l.status !== "archived") continue
    const key = l.disqualified_reason ?? "unspecified"
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1)
  }
  const removedReasons: RemovedReasonStat[] = [...reasonCounts.entries()]
    .map(([reason, count]) => ({
      reason,
      label: reason === "unspecified" ? "Unspecified" : LEAD_DISQUALIFIED_REASON_LABELS[reason],
      count,
    }))
    .sort((a, b) => b.count - a.count)

  const bySource: SourceStat[] = ALL_SOURCES.map((source) => {
    const rows = leads.filter((l) => l.source === source)
    const sSum = rows.reduce((sum, l) => sum + (typeof l.score === "number" ? l.score : 0), 0)
    return {
      source,
      total: rows.length,
      kept: rows.filter((l) => l.status !== "archived").length,
      removed: rows.filter((l) => l.status === "archived").length,
      converted: rows.filter((l) => l.status === "converted").length,
      avgScore: rows.length > 0 ? round(sSum / rows.length) : 0,
    }
  }).filter((s) => s.total > 0)

  return {
    generatedAt,
    total,
    kept,
    removed,
    converted,
    keptRate: total > 0 ? round(kept / total, 3) : 0,
    conversionRate: total > 0 ? round(converted / total, 3) : 0,
    avgScore,
    scoreDistribution,
    removedReasons,
    bySource,
  }
}

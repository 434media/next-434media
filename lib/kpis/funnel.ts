import type {
  Lead,
  LeadStatus,
  LeadActivityType,
  LeadSource,
  ClientRecord,
} from "@/types/crm-types"

// Funnel-conversion & velocity KPIs for the Funnel KPI surface. Answers the
// strategy doc's two unmeasured questions: "where in the funnel do leads drop
// off" (stage-to-stage conversion) and "how fast do they move" (velocity).
//
// The funnel is DERIVED, never stored — there is no new stage field. A lead's
// position comes from its status (Lead/MQL/SQL) and, once converted, from the
// linked crm_clients opportunity's disposition (Discovery/Proposal/Closed-Won).
// Furthest-reached position is reconstructed from the append-only activity log
// so that archiving — which overwrites `status` — doesn't erase where a dead
// lead actually died. See docs/funnel-kpi-step1.md.

export type FunnelStage = "lead" | "mql" | "sql" | "discovery" | "proposal" | "closed_won"

const STAGE_ORDER: FunnelStage[] = ["lead", "mql", "sql", "discovery", "proposal", "closed_won"]
const idx = (s: FunnelStage) => STAGE_ORDER.indexOf(s)

export const STAGE_LABELS: Record<FunnelStage, string> = {
  lead: "Lead",
  mql: "MQL",
  sql: "SQL",
  discovery: "Discovery",
  proposal: "Proposal",
  closed_won: "Closed-Won",
}

// % of leads whose canonical ICP fit clears the bar. 70 = grade B (the Canva
// rubric's "solid fit"); leads below are C/D. Reads `icp_fit_score` (the
// unified 0–100 fit from lib/icp/rubric.ts), falling back to the legacy `score`
// for leads not yet re-scored. Env-overridable.
const ICP_MATCH_THRESHOLD = Number(process.env.ICP_MATCH_THRESHOLD ?? 70)

// Canonical ICP fit for a lead, with a fallback to the legacy score field for
// leads written before Step 2 (they get re-scored on their next write).
function icpFitOf(lead: Lead): number {
  if (typeof lead.icp_fit_score === "number") return lead.icp_fit_score
  return typeof lead.score === "number" ? lead.score : 0
}

const LEAD_STATUSES: LeadStatus[] = ["new", "ready", "contacted", "engaged", "converted", "archived"]
const isLeadStatus = (s?: string): s is LeadStatus =>
  !!s && (LEAD_STATUSES as string[]).includes(s)

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

// ============================================================
// Output shapes
// ============================================================

export interface FunnelStageStat {
  stage: FunnelStage
  label: string
  /** Journeys that reached this stage or any later one. */
  reached: number
  /** Journeys that exited the funnel (archived / closed-lost) at this stage. */
  exited: number
}

export interface FunnelConversionStat {
  from: FunnelStage
  to: FunnelStage
  fromLabel: string
  toLabel: string
  /** Count that reached `to`. */
  count: number
  /** reached(to) / reached(from), 0–1. */
  rate: number
}

export interface IcpMatchSourceStat {
  source: LeadSource
  total: number
  matched: number
  matchRate: number
}

export interface VelocityStat {
  step: string
  medianDays: number
  p90Days: number
  /** How many journeys had both endpoints timestamped. */
  sampleSize: number
}

export interface FunnelKpis {
  generatedAt: string
  total: number
  threshold: number
  icpMatchRate: number
  stages: FunnelStageStat[]
  conversions: FunnelConversionStat[]
  icpMatchBySource: IcpMatchSourceStat[]
  velocity: VelocityStat[]
}

// ============================================================
// Stage derivation
// ============================================================

// Lead status → funnel stage. "converted" is the bridge: the lead hands off to
// its crm_clients row, which carries it the rest of the way.
function leadStatusToStage(s: LeadStatus): FunnelStage | "exit" {
  switch (s) {
    case "new":
      return "lead"
    case "ready":
    case "contacted":
      return "mql"
    case "engaged":
      return "sql"
    case "converted":
      return "discovery"
    case "archived":
      return "exit"
  }
}

// Opportunity disposition → funnel stage (primary path: crm_clients with
// is_opportunity=true). The richer OpportunityStage enum lives on the secondary
// Opportunity interface and isn't used here.
function clientToStage(c: ClientRecord): FunnelStage | "exit" | null {
  if (!c.is_opportunity) return null
  switch (c.disposition) {
    case "closed_won":
      return "closed_won"
    case "pitched":
      return "proposal"
    case "closed_lost":
      return "exit"
    default:
      return "discovery" // "open" | undefined
  }
}

// Every status a lead ever entered — reconstructed from the activity log so an
// archived lead still counts at the stage it reached. status_changed events
// carry detail "x → y"; the target is the right-hand side.
function visitedStatuses(lead: Lead): Set<LeadStatus> {
  const seen = new Set<LeadStatus>(["new"])
  if (isLeadStatus(lead.status)) seen.add(lead.status)
  for (const e of lead.activity ?? []) {
    if (e.type !== "status_changed" || !e.detail) continue
    const to = e.detail.split("→").pop()?.trim()
    if (isLeadStatus(to)) seen.add(to)
  }
  return seen
}

function furthestLeadStage(lead: Lead): FunnelStage {
  let best: FunnelStage = "lead"
  for (const s of visitedStatuses(lead)) {
    const st = leadStatusToStage(s)
    if (st !== "exit" && idx(st) > idx(best)) best = st
  }
  return best
}

export function furthestStage(lead: Lead, clientById: Map<string, ClientRecord>): FunnelStage {
  let best = furthestLeadStage(lead)
  // A booked discovery call is a definitive Discovery-stage signal, even before
  // formal conversion to an opportunity.
  if (lead.discovery_call_at && idx("discovery") > idx(best)) best = "discovery"
  const client = lead.converted_to_client_id ? clientById.get(lead.converted_to_client_id) : undefined
  const cs = client ? clientToStage(client) : null
  if (cs && cs !== "exit" && idx(cs) > idx(best)) best = cs
  return best
}

// ============================================================
// Velocity timestamps
// ============================================================

function firstActivityAt(lead: Lead, type: LeadActivityType): string | undefined {
  return (lead.activity ?? [])
    .filter((e) => e.type === type)
    .map((e) => e.at)
    .sort()[0]
}

function statusChangedAt(lead: Lead, toStatus: LeadStatus): string | undefined {
  return (lead.activity ?? [])
    .filter((e) => e.type === "status_changed" && e.detail?.split("→").pop()?.trim() === toStatus)
    .map((e) => e.at)
    .sort()[0]
}

function stageTimestamps(lead: Lead, client?: ClientRecord) {
  return {
    lead: lead.created_at,
    contacted: firstActivityAt(lead, "outreach_sent") ?? lead.last_contacted_at,
    sql: statusChangedAt(lead, "engaged"),
    discoveryCall: lead.discovery_call_at, // the real signal (rep-logged)
    // No clean closed_won_at — approximate with archived_at, then updated_at.
    closed_won:
      client?.disposition === "closed_won" ? client.archived_at ?? client.updated_at : undefined,
  }
}

function daysBetween(a?: string, b?: string): number | undefined {
  if (!a || !b) return undefined
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

function round(n: number, places = 1): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

// ============================================================
// Aggregation
// ============================================================

export function computeFunnelKpis(
  leads: Lead[],
  clients: ClientRecord[],
  generatedAt: string,
): FunnelKpis {
  const clientById = new Map(clients.map((c) => [c.id, c]))

  const journeys = leads.map((lead) => {
    const client = lead.converted_to_client_id ? clientById.get(lead.converted_to_client_id) : undefined
    const stage = furthestStage(lead, clientById)
    const isExit = lead.status === "archived" || client?.disposition === "closed_lost"
    return { lead, stage, isExit }
  })

  const reached = (n: number) => journeys.filter((j) => idx(j.stage) >= n).length

  const stages: FunnelStageStat[] = STAGE_ORDER.map((stage, n) => ({
    stage,
    label: STAGE_LABELS[stage],
    reached: reached(n),
    exited: journeys.filter((j) => j.isExit && j.stage === stage).length,
  }))

  const conversions: FunnelConversionStat[] = STAGE_ORDER.slice(0, -1).map((from, n) => {
    const to = STAGE_ORDER[n + 1]
    const denom = reached(n)
    return {
      from,
      to,
      fromLabel: STAGE_LABELS[from],
      toLabel: STAGE_LABELS[to],
      count: reached(n + 1),
      rate: denom > 0 ? round(reached(n + 1) / denom, 3) : 0,
    }
  })

  const total = leads.length
  const matched = leads.filter((l) => icpFitOf(l) >= ICP_MATCH_THRESHOLD)
  const icpMatchRate = total > 0 ? round(matched.length / total, 3) : 0

  const icpMatchBySource: IcpMatchSourceStat[] = ALL_SOURCES.map((source) => {
    const rows = leads.filter((l) => l.source === source)
    const m = rows.filter((l) => icpFitOf(l) >= ICP_MATCH_THRESHOLD).length
    return {
      source,
      total: rows.length,
      matched: m,
      matchRate: rows.length > 0 ? round(m / rows.length, 3) : 0,
    }
  }).filter((s) => s.total > 0)

  // Velocity — median + p90 days between stage entries. Median over mean so a
  // single slow deal doesn't skew the read; p90 surfaces the long tail.
  const deltas: Record<string, number[]> = {
    "Time to first contact": [],
    "Time to SQL": [],
    "Time to Discovery Call": [],
    "Time to Closed-Won": [],
  }
  for (const { lead } of journeys) {
    const client = lead.converted_to_client_id ? clientById.get(lead.converted_to_client_id) : undefined
    const t = stageTimestamps(lead, client)
    const push = (k: string, d?: number) => {
      if (d !== undefined && d >= 0) deltas[k].push(d)
    }
    push("Time to first contact", daysBetween(t.lead, t.contacted))
    push("Time to SQL", daysBetween(t.lead, t.sql))
    push("Time to Discovery Call", daysBetween(t.lead, t.discoveryCall))
    push("Time to Closed-Won", daysBetween(t.lead, t.closed_won))
  }
  const velocity: VelocityStat[] = Object.entries(deltas).map(([step, xs]) => ({
    step,
    medianDays: round(median(xs)),
    p90Days: round(percentile(xs, 90)),
    sampleSize: xs.length,
  }))

  return {
    generatedAt,
    total,
    threshold: ICP_MATCH_THRESHOLD,
    icpMatchRate,
    stages,
    conversions,
    icpMatchBySource,
    velocity,
  }
}

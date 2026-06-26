# Funnel Conversion & Velocity KPIs — Step 1

**Status:** Built (typechecks clean) — 2026-06-26. Not yet visually verified against live data.
**Surface:** `/admin/kpis` (extends the existing Funnel KPI surface)
**Goal:** Make the lead→closed-won funnel *observable* — stage-to-stage conversion, ICP match rate, and velocity — so we can monitor the health of the leads workflow. This is the prerequisite for everything downstream (scorer unification, intent scoring).

This is **Step 1 of 3**. Steps 2 (unify the two scorers) and 3 (intent layer) are out of scope here — see the bottom.

---

## Why this first

Our own strategy doc (`key points data.pdf`) names three health signals:

1. **Lead quality / ICP Match Rate** — "the #1 indicator of success."
2. **Funnel conversion** — stage-by-stage drop-off — "the clearest picture."
3. **Velocity** — Time to Discovery Call, Time to Closed-Won — "critical for GTM and Builders."

Today `/admin/kpis` covers (1) partially (avg score, distribution) and nothing of (2) or (3). All the data needed for (2) and (3) already exists in the `leads` activity log and `crm_clients` — it just isn't aggregated. Step 1 closes that with **no migration and no new stored stage field** (one optional new timestamp; see Open Decisions).

---

## Where it lives

Mirrors the existing KPI pattern exactly — extend, don't invent a route.

| Layer | Existing | Add |
|---|---|---|
| Page | `app/admin/kpis/page.tsx` (Lead Quality + Email Benchmarks) | **Funnel** panel, placed **above** Lead Quality |
| Compute | `lib/kpis/lead-quality.ts`, `lib/kpis/email-benchmarks.ts` | `lib/kpis/funnel.ts` |
| API | `app/api/admin/kpis/lead-quality/route.ts` | `app/api/admin/kpis/funnel/route.ts` |

Post-Step-1, the page reads top-to-bottom as a funnel: **Funnel (conversion + velocity) → Lead Quality (distribution) → Email Benchmarks.**

**New wiring vs. existing:** `lead-quality.ts` reads only the `leads` collection. The funnel spans `leads` → `crm_clients` (opportunities live there as `is_opportunity=true`), so `funnel.ts` and its route must fetch **both** and stitch via `lead.converted_to_client_id`.

---

## Stage mapping

Canonical ladder, **derived** from existing fields (never stored):

`lead → mql → sql → discovery → proposal → closed_won`

| Funnel stage | Source | Condition |
|---|---|---|
| **Lead** | `leads` | `status = new` |
| **MQL** | `leads` | `status ∈ {ready, contacted}` |
| **SQL** | `leads` | `status = engaged` |
| **Discovery** | bridge / `crm_clients` | lead `status = converted`, or client `is_opportunity` with `disposition ∈ {open, undefined}` |
| **Proposal** | `crm_clients` | `disposition = pitched` |
| **Closed-Won** | `crm_clients` | `disposition = closed_won` |

**Exits (off-ladder drop-off, counted at the stage reached):**
- `leads.status = archived` → reason from `disqualified_reason`
- `crm_clients.disposition = closed_lost`

**The join:** a `converted` lead becomes a `crm_clients` row linked by `lead.converted_to_client_id`. The lead ladder tops out at Discovery (the handoff); the client row carries Proposal / Closed-Won. We read the lead's furthest position **and** its client's disposition, taking the max.

> Note: `disposition` (on `ClientRecord`) is the primary opportunity signal. The richer `OpportunityStage` enum (`lead/qualified/proposal/negotiation/closed_won/lost`) lives on the *secondary* `Opportunity` interface. Step 1 maps off `disposition`; if/when the `Opportunity` collection becomes primary, add a `stage`-based branch.

---

## Two data-honesty caveats (and how the logic handles them)

1. **Archiving erases funnel position.** Archiving overwrites `status` to `archived`, so current status can't tell you *where* a dead lead died. Fix: reconstruct every status a lead ever entered from the append-only `activity[]` log (`status_changed` events carry `detail = "x → y"` with a timestamp). This also supplies velocity timestamps.

2. **No clean `closed_won` timestamp.** `crm_clients` has no `closed_won_at`. Time-to-Closed-Won falls back to `archived_at ?? updated_at` — acceptable but approximate. Flagged in Open Decisions.

3. **Discovery has no dedicated signal.** "Converted lead / open opportunity" stands in for Discovery. The PDF's literal **"Time to Discovery Call"** can't be computed until a discovery timestamp exists — see Open Decisions.

---

## Drafted logic (`lib/kpis/funnel.ts`)

```ts
import type { Lead, LeadStatus, ClientRecord } from "@/types/crm-types"

export type FunnelStage = "lead" | "mql" | "sql" | "discovery" | "proposal" | "closed_won"
const STAGE_ORDER: FunnelStage[] = ["lead","mql","sql","discovery","proposal","closed_won"]
const idx = (s: FunnelStage) => STAGE_ORDER.indexOf(s)

const LEAD_STATUSES: LeadStatus[] = ["new","ready","contacted","engaged","converted","archived"]
const isLeadStatus = (s?: string): s is LeadStatus => !!s && (LEAD_STATUSES as string[]).includes(s)

// --- stage derivation -------------------------------------------------------

function leadStatusToStage(s: LeadStatus): FunnelStage | "exit" {
  switch (s) {
    case "new": return "lead"
    case "ready": case "contacted": return "mql"
    case "engaged": return "sql"
    case "converted": return "discovery"   // bridge to the client ladder
    case "archived": return "exit"
  }
}

function clientToStage(c: ClientRecord): FunnelStage | "exit" | null {
  if (!c.is_opportunity) return null
  switch (c.disposition) {
    case "closed_won": return "closed_won"
    case "pitched":    return "proposal"
    case "closed_lost":return "exit"
    default:           return "discovery"  // "open" | undefined
  }
}

// Every status a lead ever entered — survives archiving (which overwrites status).
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
  const client = lead.converted_to_client_id ? clientById.get(lead.converted_to_client_id) : undefined
  const cs = client ? clientToStage(client) : null
  if (cs && cs !== "exit" && idx(cs) > idx(best)) best = cs
  return best
}

// Did this journey exit (archived lead or lost opp)? Where?
function exitOf(lead: Lead, client?: ClientRecord):
  { atStage: FunnelStage; reason: string } | null {
  if (client?.disposition === "closed_lost")
    return { atStage: "proposal", reason: "closed_lost" }
  if (lead.status === "archived")
    return { atStage: furthestLeadStage(lead), reason: lead.disqualified_reason ?? "unspecified" }
  return null
}

// --- velocity timestamps ----------------------------------------------------

function firstActivityAt(lead: Lead, type: Lead["activity"][number]["type"]): string | undefined {
  return (lead.activity ?? []).filter((e) => e.type === type)
    .map((e) => e.at).sort()[0]
}

function statusChangedAt(lead: Lead, toStatus: LeadStatus): string | undefined {
  return (lead.activity ?? [])
    .filter((e) => e.type === "status_changed" && e.detail?.split("→").pop()?.trim() === toStatus)
    .map((e) => e.at).sort()[0]
}

function stageTimestamps(lead: Lead, client?: ClientRecord) {
  return {
    lead:       lead.created_at,
    contacted:  firstActivityAt(lead, "outreach_sent") ?? lead.last_contacted_at,
    sql:        statusChangedAt(lead, "engaged"),
    discovery:  lead.converted_at,                                  // clean
    closed_won: client?.disposition === "closed_won"
                  ? (client.archived_at ?? client.updated_at)      // ⚠ approximate
                  : undefined,
  }
}

const daysBetween = (a?: string, b?: string) =>
  a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000 : undefined

function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
```

### Output shape + aggregation

```ts
const ICP_MATCH_THRESHOLD = Number(process.env.ICP_MATCH_THRESHOLD ?? 65) // 0–100 lead scale

export interface FunnelKpis {
  generatedAt: string
  stages: { stage: FunnelStage; reached: number; exited: number }[]
  conversions: { from: FunnelStage; to: FunnelStage; count: number; rate: number }[]
  icpMatchRate: number                                  // score >= threshold / total
  icpMatchBySource: { source: string; matchRate: number; total: number }[]
  velocity: { step: string; medianDays: number; p90Days: number; sampleSize: number }[]
}

export function computeFunnelKpis(
  leads: Lead[],
  clients: ClientRecord[],
  generatedAt: string,
): FunnelKpis {
  const clientById = new Map(clients.map((c) => [c.id, c]))

  // furthest stage + exit per journey
  const journeys = leads.map((lead) => {
    const client = lead.converted_to_client_id ? clientById.get(lead.converted_to_client_id) : undefined
    return { lead, client, stage: furthestStage(lead, clientById), exit: exitOf(lead, client) }
  })

  const reached = (n: number) => journeys.filter((j) => idx(j.stage) >= n).length

  const stages = STAGE_ORDER.map((stage, n) => ({
    stage,
    reached: reached(n),
    exited: journeys.filter((j) => j.exit && j.exit.atStage === stage).length,
  }))

  const conversions = STAGE_ORDER.slice(0, -1).map((from, n) => ({
    from, to: STAGE_ORDER[n + 1],
    count: reached(n + 1),
    rate: reached(n) > 0 ? reached(n + 1) / reached(n) : 0,
  }))

  const total = leads.length
  const matched = leads.filter((l) => (l.score ?? 0) >= ICP_MATCH_THRESHOLD).length
  const icpMatchRate = total > 0 ? matched / total : 0

  // velocity
  const deltas: Record<string, number[]> = {
    "Time to first contact": [], "Time to SQL": [], "Time to Opportunity": [], "Time to Closed-Won": [],
  }
  for (const { lead, client } of journeys) {
    const t = stageTimestamps(lead, client)
    const push = (k: string, d?: number) => { if (d !== undefined && d >= 0) deltas[k].push(d) }
    push("Time to first contact", daysBetween(t.lead, t.contacted))
    push("Time to SQL",           daysBetween(t.lead, t.sql))
    push("Time to Opportunity",   daysBetween(t.lead, t.discovery))  // Discovery has no dedicated signal (decision #1)
    push("Time to Closed-Won",    daysBetween(t.lead, t.closed_won))
  }
  const velocity = Object.entries(deltas).map(([step, xs]) => ({
    step, medianDays: median(xs), p90Days: percentile(xs, 90), sampleSize: xs.length,
  }))

  // icpMatchBySource omitted here for brevity — same group-by as lead-quality.ts bySource
  return { generatedAt, stages, conversions, icpMatchRate, icpMatchBySource: [], velocity }
}
```

---

## API route (`app/api/admin/kpis/funnel/route.ts`)

Mirror `lead-quality/route.ts`:

```ts
export async function GET() {
  await requireAdmin()
  const [leads, clients] = await Promise.all([getAllLeads(), getAllClients()])
  return NextResponse.json(computeFunnelKpis(leads, clients, new Date().toISOString()))
}
```

`getAllClients()` should fetch `crm_clients` where `is_opportunity = true` (plus closed-won/lost so exits are counted). Confirm the exact accessor against `lib/firestore-*`.

---

## Page panel (`app/admin/kpis/page.tsx`)

New **Funnel** section above Lead Quality:

- **Funnel bar / step list** — one row per stage: `reached` count + the conversion rate into it; `exited` count as a muted sub-number. The leakiest joint should be visually obvious.
- **ICP Match Rate** — single headline stat (the PDF's #1 indicator), with the per-source breakdown beneath.
- **Velocity** — median + p90 per step, with sample size (so a 2-deal median reads as provisional, not gospel).

No new chart library required — reuse whatever Lead Quality already renders.

---

## Resolved decisions

1. **Discovery-call timestamp — SKIP.** No new field. Discovery ≈ converted lead / open opportunity; the velocity step is labeled **"Time to Opportunity"** (uses `lead.converted_at`). Step 1 stays zero-migration. Revisit `discovery_call_at` later if we want the PDF's literal "Time to Discovery Call."
2. **`ICP_MATCH_THRESHOLD` = 65.** Aligns with the existing "high priority" cutoff in `lib/score-lead.ts`, so "ICP-matched" and "high-priority" are the same thing. Env-overridable.
3. **Closed-Won timestamp — `archived_at ?? updated_at` fallback.** Approximate, acceptable while closed-won volume is low. No schema change. Revisit if deal volume makes the median precise enough to matter.

**Net: zero schema changes, zero migration.** Step 1 is three new/edited files.

---

## Out of scope (later steps)

- **Step 2 — unify the two scorers.** Prospecting fit is 0–80 (`lib/prospecting/scorer.ts`); lead score is 0–100 (`lib/score-lead.ts`). This doc's `ICP_MATCH_THRESHOLD` uses the 0–100 lead score because that's what the KPI aggregates; the divergence is a Step 2 problem.
- **Step 3 — intent layer.** Website/hiring/business signals + golden signals from the spec. Would feed a second axis and sharpen prioritization.
- Multi-email sequences, single-company URL analyzer, nightly discovery automation — all later.

---

## File checklist

- [x] `lib/kpis/funnel.ts` — types + `furthestStage`, `visitedStatuses`, `computeFunnelKpis`
- [x] `app/api/admin/kpis/funnel/route.ts` — `requireAdmin`, fetch both collections (`getLeads` + `getClients`), compute
- [x] `app/admin/kpis/page.tsx` — Funnel panel above Lead Quality (stage conversion, ICP match rate, velocity, ICP-match-by-source)

All three decisions resolved to the zero-migration path — no `types/crm-types.ts` change in Step 1.

**Remaining:** visual verification against live data (run the app, open `/admin/kpis`).

# CRM ↔ Sales Funnel — Alignment Plan

Decisions locked 2026-07-05. Turns the [reconciliation notes](archive/crm-funnel-reconciliation.md)
into a build plan. Grounds in the Three Key Points: **ICP Match Rate** (lead
quality), **stage-by-stage Funnel Conversion** (`Lead → MQL → SQL → Discovery →
Proposal → Closed-Won`), and **Velocity** (Time to Discovery Call, Time to
Closed-Won). Companion to [sales-funnel.md](sales-funnel.md).

## Decisions

1. **One unified pipeline** — the funnel counts leads AND opportunities.
2. **Opportunity = client only** — tasks link, never *are*, opportunities.
3. **Rename stages to the funnel ladder** — the CRM board uses the funnel's names.

## Target model: one funnel, two entities, six stages

```
   LEADS (crm: `leads`)              OPPORTUNITIES (crm_clients.is_opportunity)     CLIENTS
 ┌───────┬───────┬───────┐        ┌───────────┬──────────┬─────────────┐        ┌──────────┐
 │ Lead  │  MQL  │  SQL  │  ───▶  │ Discovery │ Proposal │ Closed-Won  │  ───▶  │  Account │
 │ (new) │ready/ │engaged│ convert│           │          │             │   won  │ (active) │
 │       │contact│       │        │           │          │  Closed-Lost = exit  │          │
 └───────┴───────┴───────┘        └───────────┴──────────┴─────────────┘        └──────────┘
   worked in /admin/leads            worked in /admin/crm → Opportunities         /admin/crm
   (capture · qualify · outreach)    (pitch · advance · close)                    → Clients
```

- Top half = **leads**, derived from status (already correct in `funnel.ts`).
- Bottom half = **opportunities**, one per `ClientRecord` with `is_opportunity`.
- A converted lead **hands off** into an opportunity at **Discovery**.
- A directly-created opportunity **enters at its stage** and IS counted by the funnel.
- **ICP Match Rate stays a lead metric** (Point 1 is about lead quality); conversion + velocity span the full ladder.

### Stage vocabulary migration (Decision 3)

| Old `disposition` | New stage | Notes |
|---|---|---|
| `open` | **discovery** | entry stage for a new opportunity |
| `pitched` | **proposal** | preserves meaning (13 existing rows) |
| `closed_won` | **closed_won** | terminal ✓ |
| `closed_lost` | **closed_lost** | exit ✓ |
| (kanban) `qualified`, `negotiation` | **deleted** | never populated — dead columns |

- Kanban columns become **Discovery · Proposal · Closed-Won · Closed-Lost**.
- **Convert-to-client default** changes `pitched` → **`discovery`** so a freshly converted lead enters at the first opportunity stage (not mid-funnel at Proposal).
- Retire / repoint the orphaned 6-value `OpportunityStage` enum.

## Phased build

**Phase 0 — safe, no-decision (do first)**
- Lead Quality KPI → read `icp_fit_score` with `score` fallback (match `funnel.ts` `icpFitOf`). [`lib/kpis/lead-quality.ts`]
- Delete the dead `qualified` / `negotiation` pipeline columns. [`lib/firestore-crm.ts` `PIPELINE_STAGES`]

**Phase 1 — stage vocabulary (Decision 3)**
- Rename disposition values open→discovery, pitched→proposal across type, UI options, mappers (`clientOpportunityToOpportunity`, `clientToStage`), and every `disposition ===` reference.
- Kanban columns = the four funnel stages; convert default → discovery.
- **Backfill:** `open→discovery`, `pitched→proposal` on existing `crm_clients` (13 pitched, 0 open today) via a one-off script (dry-run first).

**Phase 2 — single source of truth (Decision 2)**
- Remove `is_opportunity` / `disposition` / `doc` authoring from tasks; keep `opportunity_id` (link only).
- Kanban renders **client-opportunities only** (drop `brandTasks` cards). [`OpportunitiesKanbanView.tsx`]
- Tasks surface as **linked work items** in the opportunity drawer, not pipeline cards.
- **Migrate the 3 task-opportunities** → `crm_clients` opportunities (assign the 2 blank-disposition ones to Discovery); re-link their tasks via `opportunity_id`.

**Phase 3 — unified funnel math (Decision 1)**
- `computeFunnelKpis`: build journeys from leads **+ standalone opportunities**. Dedupe: an opportunity already reached via a converted lead (`converted_to_client_id`) is not double-counted; opportunities with no originating lead become their own journey entering at their stage.
- Reconcile the CRM **Dashboard** so its pipeline counts equal the funnel KPI (same population). Re-express or retire the `doc`-probability rollup.

**Phase 4 — first-timer CRM layout (below)**

## CRM layout for a first-time admin

Keep the two work surfaces (leads vs opportunities have different actions), but
make the CRM portal *read as the funnel's second half* and signpost the whole
journey. CRM tabs, re-aimed:

| Tab | Today | Becomes |
|---|---|---|
| **Dashboard** | DOC-probability rollup (tasks+clients) | The **funnel bottom-half scoreboard** — same numbers as `/admin/kpis`: Discovery→Closed-Won counts, conversion, Time to Closed-Won. First thing a first-timer sees = the funnel, not a divergent metric. |
| **Opportunities** | 6-col kanban, empty columns, task+client cards | **4-col funnel-stage kanban** (Discovery · Proposal · Closed-Won · Closed-Lost), client-opportunities only. The "work the deal" surface. |
| **Clients** | won/active accounts | unchanged — the post-close relationship. |
| **Tasks** | task kanban w/ opportunity fields | **work items** list, each linked to a lead or opportunity; no pipeline stages of its own. |

**Signposting for orientation** (the navigation win):
- A persistent **funnel breadcrumb** across Leads + CRM: `Leads (Lead·MQL·SQL) → Opportunities (Discovery·Proposal·Won) → Clients`, highlighting where you are.
- A **`HowItWorks` strip** on the CRM portal (matching the Leads/Audiences pattern) narrating: "This is the second half of the funnel. Leads you convert land here as Discovery-stage opportunities — advance them to Proposal, then Closed-Won."
- The Leads **Convert to client** action already exists; label it as the explicit Lead→Opportunity handoff and land the new opportunity on the CRM Opportunities board at Discovery.

## Phase 4 — detailed layout

### 4a. Funnel rail (persistent orientation, Leads + CRM)

A slim one-line rail in the sticky header of **both** `/admin/leads` and
`/admin/crm`, so a first-timer always sees the whole funnel and where they are:

```
● Leads  Lead › MQL › SQL      ▸      ○ Opportunities  Discovery › Proposal › Won      ▸      ○ Clients
  ▔▔▔▔▔ (dark = current surface)             (muted when elsewhere)
```

- Two work-surface segments (**Leads**, **Opportunities**) + a **Clients** cap.
- The segment for the current route is filled/dark; the others muted and
  **clickable** (jump to that surface). Reuses the `STAGE_LABELS` names so the
  rail, the boards, and the KPIs all say the same six words.

### 4b. CRM **Dashboard** → funnel bottom-half scoreboard

Replace the `doc`-probability rollup (`OpportunityProgressChart` + DOC groups)
with the **same `FunnelKpis` the `/admin/kpis` page reads**, scoped to the bottom
half — so the two dashboards can never disagree:

```
┌ Pipeline (this half) ───────────────────────────────────────────────┐
│  Discovery   Proposal   Closed-Won        Won revenue    Open pipeline│
│     4           6           3               $__            $__         │
├ Conversion ─────────────────────────────────────────────────────────┤
│  Discovery→Proposal 60%    Proposal→Won 45%    Lead→Won 8%           │
├ Velocity ───────────────────────────────────────────────────────────┤
│  Time to Discovery Call   median 3d · p90 9d                         │
│  Time to Closed-Won       median 21d · p90 60d                       │
└─────────────────────────────────────────────────────────────────────┘
```

- Stage counts + conversion + velocity come straight from `FunnelKpis`
  (reuse the Stage-conversion + Velocity panels from `app/admin/kpis/page.tsx`).
- **Won revenue / open pipeline $** stay (genuinely CRM — sum `pitch_value`),
  shown beside the funnel numbers rather than as a separate DOC model.

### 4c. **Opportunities** board → four funnel-stage columns

```
┌ Discovery ┐ ┌ Proposal ┐ ┌ Closed-Won ┐ ┌ Closed-Lost ┐
│  cards    │ │  cards   │ │   cards    │ │   cards     │
└───────────┘ └──────────┘ └────────────┘ └─────────────┘
```

Client-opportunities only; drag = change stage (disposition). No task cards.

### 4d. **Tasks** → RETIRED (decided 2026-07-05)

Data settled it: the Tasks board is a **pre-funnel general-ops board that's no
longer used** — 453 tasks, 100% `completed`, 96% unlinked, 0 lead links. The
funnel already has its execution layer in **Leads** (top half) and
**Opportunities** (bottom half): you work a deal by advancing its stage and using
its drawer. A task board would duplicate that and re-fragment follow-ups.

- **Remove the Tasks tab** from the CRM nav → `Dashboard · Opportunities · Clients`.
  Historically-linked tasks still show in the opportunity drawer's Linked panel.
- **Add a thin "Due today / Follow-ups" queue** (the one thing tasks half-did,
  done right): a rollup reading `lead.next_followup_date` +
  `opportunity.next_followup_date` (+ sequence sends) into one list — finally
  unifying the three follow-up mechanisms into a single work queue.

### 4e. CRM `HowItWorks` strip (first-run orientation)

1. **You're in the second half** — leads you convert land here as *Discovery*-stage opportunities.
2. **Advance the deal** — drag *Discovery → Proposal → Closed-Won* as it progresses.
3. **Won becomes a client** — a *Closed-Won* opportunity graduates to a Client account.

### 4f. Header copy fix

The CRM brand-row tagline "clients & won revenue — the pipeline's final stage"
becomes "**opportunities → clients — the second half of the funnel**" (it's not
just the final stage; it owns Discovery→Won).

## Risks / gotchas

- Renaming disposition touches many `disposition ===` sites — grep-complete before shipping; backfill must run in the same release or the UI shows blank stages.
- `is_opportunity`/`disposition`/`doc` on tasks are **load-bearing today** — Phase 2 must migrate the 3 rows before removing the fields, or those deals vanish from the board.
- Do Phase 3 last: the funnel math change is only correct once opportunities are single-sourced (Phase 2) and stage-named (Phase 1).
- All backfills: dry-run + count first (the read-only probe pattern already used).

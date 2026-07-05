# CRM Portal ↔ Sales Funnel — Reconciliation Notes

Review of whether the CRM portal (clients / opportunities / tasks / dashboards)
is in sync with the funnel model in [`lib/kpis/funnel.ts`](../lib/kpis/funnel.ts).
**Feedback / plan only — no code changed.** Companion to
[`sales-funnel.md`](sales-funnel.md).

## Verified snapshot (production Firestore, 2026-07-05)

| Fact | Value |
|---|---|
| Task migration (`crm_meta/task_migration`) | **completed: true** (2026-04-30, 726 copied, 0 conflicts) |
| Legacy per-owner task collections (8) + `crm_master_list` | **all 0 docs** — fully retired |
| Unified `crm_tasks` | 453 docs |
| Opportunities as **clients** (`crm_clients.is_opportunity`) | **18** — 13 pitched, 3 closed_won, 2 closed_lost |
| Opportunities as **tasks** (`crm_tasks.is_opportunity`) | **3** — 1 pitched, **2 blank disposition** |
| Leads by status (23 total) | engaged 9, converted 6, contacted 5, ready 1, archived 2, new 0 |

**Settles one open question:** the legacy task collections are **dead** (0 docs, migration done). The dual `isTaskMigrationCompleted()` code path always takes the migrated branch — not an active problem. Discard the "legacy collections may be authoritative" concern.

---

## The gaps that are real

### Gap 1 — Funnel KPIs count lead-journeys only; the CRM pipeline counts every opportunity  ⬅ biggest

`computeFunnelKpis(leads, clients)` builds journeys from **`leads.map(...)`**
([funnel.ts:249](../lib/kpis/funnel.ts)); `clients` is only a lookup for the
client a lead *converted into*. **An opportunity created directly in the CRM —
no originating lead — is invisible to the funnel** (stages, conversion, velocity).

- CRM pipeline shows **21 opportunities** (18 client + 3 task).
- Funnel can only see the **6 converted leads'** journeys.
- → The two dashboards measure **different populations**, so their pipeline
  counts will basically never agree. This is the "dashboard metrics seem out of
  sync" symptom — not a cache bug, a **different denominator**.

**This is a product decision, not just a fix.** The funnel is legitimately a
*lead* funnel (how captured leads progress). Directly-created opportunities
(existing relationships, warm inbound) aren't leads. Options:
- **(A) Label it away** — brand the funnel KPI as "lead-sourced pipeline" and the
  CRM dashboard as "total pipeline"; document that they differ by design. Cheapest.
- **(B) Unify** — have the funnel also fold in standalone opportunities (treat a
  no-lead opportunity as entering at its disposition stage). Truer single number,
  more work, blurs "funnel = lead journey."

### Gap 2 — Dual opportunity representation (client vs task)

A deal can live as a `ClientRecord` (`is_opportunity`) **and/or** a `Task`
(`is_opportunity`), each with independent `disposition`/`doc`, both drawn as
separate kanban cards ([`OpportunitiesKanbanView.tsx`](../components/crm/OpportunitiesKanbanView.tsx)
counts `brandClients` + `brandTasks`). Dragging a task changes the *task's*
disposition, not the client's — they can drift.

- Live today: **3 task-opportunities**, 2 with **blank disposition** (unmappable).
- These 3 are **funnel-invisible** (funnel reads clients only) and unclear in the
  kanban (blank stage).
- Note: `is_opportunity`/`disposition`/`doc` on tasks are **load-bearing** in the
  current kanban — this is retrofit history, not dead code. Removing it is a real
  change, not a cleanup.

**Decision:** pick ONE home for "an opportunity." Recommended: the `ClientRecord`
is the opportunity; a Task only *links* to one via `opportunity_id` (many-to-one)
and loses its own `is_opportunity`/`disposition`/`doc`. Migrate the 3 task-opps to
client-opps first.

### Gap 3 — Three stage vocabularies that don't reconcile

| Source | Values | Reality |
|---|---|---|
| Funnel ladder | lead · mql · sql · discovery · proposal · closed_won | canonical |
| Stored `disposition` | open · pitched · closed_won · closed_lost | only pitched/won/lost used in prod |
| Pipeline UI `PIPELINE_STAGES` | lead · **qualified** · proposal · **negotiation** · closed_won · closed_lost | qualified/negotiation **never populate** → dead columns |
| Orphaned `OpportunityStage` enum | 6 values | defined, not the real model |

Concrete issues:
- **Dead kanban columns**: no disposition maps to `qualified`/`negotiation` — confirmed empty in prod.
- **`open` is ambiguous**: pipeline map → "Lead", funnel `clientToStage` → "Discovery" (latent today — no `open` opps exist — but the divergent code stands).
- Opportunities **can't express MQL/SQL** (lead-only stages); a converted lead with `disposition=pitched` lands straight at **Proposal**.

**Fix:** collapse `PIPELINE_STAGES` to what dispositions can produce; make `open`
map consistently in both places; delete or wire up the orphaned enum.

### Gap 4 (minor) — Lead Quality KPI reads the legacy `score`

[`lib/kpis/lead-quality.ts`](../lib/kpis/lead-quality.ts) reads `l.score`
directly (no `icp_fit_score` fallback), unlike the funnel's `icpFitOf()`. Low
impact today (`scoreLead` mirrors `score = icp_fit_score`; only 23 leads), but
it's the wrong field and drifts for any legacy-scored lead. One-line fix.

---

## What's actually in sync (don't touch)

- Admin Overview counts + the funnel Scoreboard strip → canonical.
- `/admin/kpis` Funnel conversion / velocity / ICP-match → canonical (`icp_fit_score` w/ fallback).
- No stale caching (all `no-store` / `force-dynamic`).
- Task migration complete; legacy collections empty.

---

## Recommended order (highest leverage first)

1. **Decide Gap 1's framing** — label the two pipelines as different populations
   (A) or unify (B). Everything else reads cleaner once this is explicit.
2. **Gap 3 vocabulary** — kill dead columns, fix `open` mapping. Low effort, removes visible confusion.
3. **Gap 2 single source** — opportunity = client; task only links. Migrate the 3 task-opps. Higher effort (load-bearing).
4. **Gap 4** — point Lead Quality at `icp_fit_score`. Trivial.

## Decisions needed from Jesse

- **Gap 1:** Is the funnel a *lead* funnel (label + document) or a *total pipeline* (fold in standalone opps)?
- **Gap 2:** OK to retire task-as-opportunity in favor of client-as-opportunity + task links?
- **Gap 3:** Confirm the live stage set is `pitched → proposal`, `open → discovery`, won/lost terminal (drop qualified/negotiation)?

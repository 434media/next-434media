# Funnel IA — Surface the Start, Attach the Scoreboard

**Status:** Plan / not yet built
**Surfaces:** `components/admin/AdminOverview.tsx` (first view) + `components/admin/AdminSidebar.tsx` (nav)
**Goal:** Make it obvious where a first-time admin *starts a sales funnel*, and connect the funnel view to the surface that measures it. No new pages — this is information architecture, re-pointing existing routes.

This is a sibling to `docs/funnel-kpi-step1.md` (which built the KPI surface). That doc made the scoreboard; this doc makes it *findable* and fixes the funnel's missing front door.

---

## The problem, in one line

The proactive starting action — **Prospect** — is the least-visible element on the first view, and the **Funnel KPIs** scoreboard doesn't appear on the first view at all. The Overview narrates an *inbound reception desk* ("contacts arrive…"), not a *sales funnel you start*.

Evidence:
- Prospect on Overview is a dashed, muted footnote under Leads ([AdminOverview.tsx:260-269](../components/admin/AdminOverview.tsx#L260)).
- Prospect in the sidebar isn't top-level — it's the hidden subroute `/admin/leads/prospect`.
- Funnel KPIs is absent from Overview; in the sidebar it sits in "Insights" next to unrelated web/social Analytics.
- First-run = three `0` stages + "contacts arrive" copy + no obvious action.

## The principle

The funnel has **two front doors**, shown as peers:
- **Outbound** — *Prospect* (go find companies) — the active start
- **Inbound** — *Audiences / Inbox* (work what arrived) — the passive start

…both flow into **Leads → CRM**, with **Funnel KPIs** attached as the scoreboard. Today only the inbound door is legible and the scoreboard is detached.

---

# Part A — Overview (the first view) · highest priority

This is what a new admin sees first, so it matters most.

### A1 · Promote Prospect from footnote to a real entry node

Today stage **01 · Entry points** holds two `StageNode`s (Audiences, Inbox); Prospect is a dashed link down in stage 02 ([:260-269](../components/admin/AdminOverview.tsx#L260)).

Reframe stage 01 as **"Two ways in"**:
- **Prospect** — a prominent action card ("Find companies → score → approve as leads"). It's an *action*, not a queue, so it doesn't need a big count; if we want a number, show "prospected this week" (leads where `source === "prospected"` within 7d, already derivable from the leads fetch). Otherwise a clear "Start prospecting" CTA.
- **Audiences** + **Inbox** — keep as-is (the inbound capture nodes).

Remove the dashed "Also fed by outbound Prospecting" footnote from stage 02 — it's now a first-class node above.

Illustrative shape (stage 01 becomes a small two-motion cluster):

```
01 · Start the funnel
┌─ Outbound ──────────────┐   ┌─ Inbound ───────────────┐
│ ▸ Prospect  (find)      │   │ Audiences   N contacts  │
│   "Go find companies"   │   │ Inbox       N awaiting  │
└─────────────────────────┘   └─────────────────────────┘
            └──────────── promote ───────────→  02 · Leads
```

### A2 · Rewrite the header copy

Current ([:201](../components/admin/AdminOverview.tsx#L201)):
> "Contacts arrive through Audiences and the Inbox, get qualified as Leads, then convert into Clients."

Replace with a copy that names both motions and leads with the active one:
> "Start the funnel two ways — go find companies with **Prospect**, or work the contacts that arrive through **Audiences** and **Inbox**. Both become **Leads**, then convert to **Clients**. Track it all in **Funnel KPIs**."

### A3 · First-run / empty state

When the funnel is empty (`leadsActive === 0 && clientsTotal === 0`), don't show three zeros under a passive caption. Show a **"Start here"** banner that points at the active door: a primary CTA to **Prospect** and a secondary "or import an audience." This converts a dead cold-start into a clear next action.

### A4 · Attach the scoreboard

Funnel KPIs is missing from Overview. Add it as a **slim full-width scoreboard strip below the funnel row** (not a 4th funnel stage — measurement isn't a stage leads move *into*). Show 2–3 headline numbers pulled from `/api/admin/kpis/funnel`, each linking to `/admin/kpis`:
- **ICP match rate** · **Lead → Closed-Won %** · **Time to Closed-Won (median)**

Reuses the endpoint built in `funnel-kpi-step1.md`; one extra fetch on the Overview.

---

# Part B — Sidebar

Mirror the Overview funnel so the nav reads start → qualify → win → measure.

### B1 · Add Prospect as a top-level Pipeline item

New entry before/with the entry-point surfaces ([AdminSidebar.tsx:123-163](../components/admin/AdminSidebar.tsx#L123)):

```ts
{
  id: "prospect",
  label: "Prospect",
  icon: Target,
  href: "/admin/leads/prospect",
  matchPrefix: "/admin/leads/prospect",
  description: "Find companies to proactively contact — score & approve as leads",
  roles: [...],
}
```

**Gotcha — prefix collision.** Leads uses `matchPrefix: "/admin/leads"`, which also matches `/admin/leads/prospect`, so both would highlight on the Prospect page. Fix: give **Leads** `exact: true` (or a prefix that excludes the subroute), exactly like Calendar already does to avoid lighting up on its sibling ([:216](../components/admin/AdminSidebar.tsx#L216)). Prospect's own `matchPrefix` is the more specific path, so it highlights correctly.

### B2 · Move Funnel KPIs into Pipeline (end)

Move the `funnel-kpis` entry out of "Insights" ([:179-189](../components/admin/AdminSidebar.tsx#L179)) to the bottom of "Pipeline." Resulting order:

**Pipeline:** Prospect → Audiences → Inbox → Leads → CRM → Funnel KPIs

(Operate top-to-bottom, then measure. Matches the Overview's 01→02→03→scoreboard reading.)

### B3 · Collapse "Insights"

With Funnel KPIs gone, Insights holds only web/social **Analytics** ([:168-178](../components/admin/AdminSidebar.tsx#L168)) — a one-item section titled "Insights" is redundant. Two options (decision below):
- **(a)** Rename the section **"Analytics"** and keep the single item.
- **(b)** Move web/social Analytics adjacent to **Content** (it measures content/social output), removing the Insights section entirely.

### B4 · Update the section comment + order narrative

The comment at [:120-122](../components/admin/AdminSidebar.tsx#L120) describes the old order ("Audiences → Inbox → Leads → CRM"). Update to the new funnel order including Prospect (start) and Funnel KPIs (measure).

---

## Resolved decisions

1. **Prospect's position in Pipeline — FIRST**, before Audiences/Inbox. Signals "this is where you start a sales funnel."
2. **Overview scoreboard — SLIM STRIP** below the funnel row (ICP match · Lead→Won % · Time to Won), linking to `/admin/kpis`. Not a 4th funnel stage.
3. **Insights cleanup — RENAME to "Analytics"** (B3a); keep the single GA4/Instagram item.
4. **Prospect node — ACTION CARD + "prospected this week" count**, derived from the existing leads fetch by `source === "prospected"` within 7d.

## Non-goals / out of scope

- No new pages or routes — Prospect, Leads, CRM, Funnel KPIs all already exist.
- Not touching role-gating logic (the question was framed around a fresh admin, not intern scope). Existing `roles` arrays carry over; promoting Prospect just makes an existing route visible at top level.
- Not a redesign of the Overview funnel visual — it's the right pattern; we're adding the missing front door + scoreboard, not rebuilding.

## File checklist

- [x] `components/admin/AdminOverview.tsx` — Prospect promoted to a stage-01 node (A1, both full-admin + crm_only layouts), header copy (A2), empty-state banner (A3), scoreboard strip (A4) + vertical-density pass to fit the funnel + scoreboard + workspace above the fold. Typechecks clean 2026-06-26.
- [x] `components/admin/AdminSidebar.tsx` — Prospect added top-level (first in Pipeline) + Leads set `exact` (B1), Funnel KPIs moved to end of Pipeline (B2), Insights renamed → Analytics (B3), funnel-order comment updated (B4). Typechecks clean 2026-06-26.

**Both parts built.** Remaining: visual verification against the running app (Overview density + funnel layout with the extra node; sidebar active-state on `/admin/leads` vs `/admin/leads/prospect`).

No backend, no schema, no new endpoints (A4 reuses `/api/admin/kpis/funnel`).

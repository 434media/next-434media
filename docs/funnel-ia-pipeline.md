# Pipeline = the Sales Funnel, Start to Finish (Part C)

**Status:** Plan / not yet built
**Surfaces:** `components/admin/AdminSidebar.tsx` + `components/admin/AdminOverview.tsx`
**Follows:** `docs/funnel-ia-plan.md` (Parts A/B, built). This refines the Pipeline section so it reads as one clean sales funnel for a first-time viewer.

---

## The principle

A first-time viewer reads "Pipeline" as a sales funnel only when **every item is a stage a single lead moves *through*** on its way to becoming a customer. Mixing in **pools** (contact lists), **triage tools**, or **post-sale homes** breaks the single thread.

Test per item: *is this a step a lead travels through, or a place/pool that feeds or surrounds the funnel?*

Applying it to today's Pipeline (`Prospect → Audiences → Inbox → Leads → CRM → Funnel KPIs`):

| Item | What it is | Verdict |
|---|---|---|
| Prospect | Action — go find companies | ✅ Funnel **start** (outbound door) |
| **Audiences** | A *pool* of contacts / marketing lists (opt-ins → Mailchimp) | ⚠️ **Not a stage** — a source you promote *from*. Move out. |
| Inbox | Inbound inquiries → become Leads | ✅ Funnel **capture** (inbound door) |
| Leads | Qualification engine | ✅ **Qualify** |
| CRM | Opportunities close here | ✅ **Close/win** (the finish, not the middle) |
| Funnel KPIs | Scoreboard | ✅ **Measure** (end) |

**CRM stays** — deals close there; that's the finish line, it only looks "middle" because measurement correctly follows it. **Inbox stays** — it's the inbound door, belongs near the top. **Audiences is the one that doesn't fit** — it's a marketing reservoir, not a stage, and "Audiences" reads as "email lists" right where the funnel thread should be clearest.

---

## Target end-state

**Pipeline → Prospect → Inbox → Leads → CRM → Funnel KPIs**

Reads as: **find (outbound) / capture (inbound) → qualify → close → measure.** Two entry doors at the top, one linear path after, scoreboard at the end. That's the full sales funnel, start to finish.

---

## C1 · Sidebar: remove Audiences from Pipeline

In `SIDEBAR_SECTIONS` ([AdminSidebar.tsx](../components/admin/AdminSidebar.tsx)), pull the `audiences` entry out of the `pipeline` section. Resulting `pipeline.items`: `prospect, inbox, leads, crm, funnel-kpis`. No matchPrefix/active-state changes — Audiences keeps `/admin/audiences`.

Degrades cleanly by role: Inbox + CRM are operator-scoped, so an intern's Pipeline reads `Prospect → Leads → Funnel KPIs`; an operator sees the full five. Either way it's a clean single thread.

## C2 · Sidebar: give Audiences a real home (supersedes Part B's "rename to Analytics")

Part B left a one-item "Analytics" section. Instead of two thin orphan sections (Analytics + a new Audiences), **merge them into one "Marketing" section**:

```
MARKETING
  Audiences        (/admin/audiences)   — lists, opt-ins, Mailchimp sync
  Analytics        (/admin/analytics)   — web (GA4) · social (IG) · portfolio
```

Both are full_admin marketing surfaces, so the grouping is coherent and the role-gating is uniform. This solves the "Audiences is an orphan" problem *and* the "lonely Analytics section" problem in one move. (Section id `marketing`; keep the two item ids `audiences` / `analytics`.)

> Why Audiences was an orphan in the first place: there's no Marketing/email section, and the Resend broadcast is a script, not a nav item. Creating "Marketing" gives the audience/email world a home and room to grow (email campaigns later).

## C3 · Overview: keep the funnel viz consistent

Part A's "01 · Start the funnel" zone shows **three** entry nodes — Prospect + Audiences + Inbox. With Audiences reframed as a source (not a stage), realign the Overview so both surfaces tell the same story:

- **Full-admin layout:** start zone shows **Prospect (outbound) + Inbox (inbound)** as the two peer doors. **Audiences gets demoted** from a peer `StageNode` to a subordinate "source" line beneath them — e.g. a slim chip: *"N contacts in Audiences feed your inbound"* linking to `/admin/audiences` — mirroring how Prospect used to be the dashed footnote. The audience count stays visible without reading as a funnel stage.
- **crm_only layout:** already clean (`Prospect → Leads → Client`, no Audiences/Inbox) — no change.

---

## Resolved decisions

1. **Audiences on the Overview — DEMOTE** to a subordinate dashed "source" line under the Prospect + Inbox doors ("N contacts in Audiences feed your inbound" → `/admin/audiences`). Count stays in context; it no longer reads as a stage.
2. **Section name — "Marketing."**
3. **Order within Marketing — Audiences, then Analytics** (asset → measure).

## Counter-argument to weigh

Audiences *is* a legitimate lead source (you promote contacts from it), so pulling it from Pipeline hides a source from the funnel view. The trade is deliberate: Prospect already represents "sourcing" as the active start, and a newcomer's clarity outweighs co-locating every source. If you instead think of Audiences as a true top-of-funnel *stage*, the alternative is to keep it in Pipeline but visibly group the entry doors (Prospect, Inbox, Audiences) as "ways in" above the linear path — more UI, fuzzier start.

## Non-goals

- No new pages/routes — only moving existing entries between sidebar sections and adjusting the Overview's entry zone.
- No role-gating changes — Audiences stays full_admin; moving sections preserves access.
- Not touching Leads/CRM/Funnel KPIs behavior — this is taxonomy + the Overview entry zone only.

## File checklist

- [x] `components/admin/AdminSidebar.tsx` — Audiences removed from `pipeline` (C1); "Marketing" section added = Audiences + Analytics, replacing the lone "Analytics" section (C2). Typechecks clean 2026-06-26.
- [x] `components/admin/AdminOverview.tsx` — start zone = Prospect + Inbox doors; Audiences demoted to a subordinate dashed source line (C3). Typechecks clean 2026-06-26.

**Part C built.** Remaining: visual verification (sidebar now has a Marketing section; Overview start zone shows two cards + the Audiences source line).

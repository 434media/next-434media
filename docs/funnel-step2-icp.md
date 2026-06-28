# Step 2 — Unify ICP Scoring to the Canonical Rubric

**Status:** Plan / not yet built
**Serves:** Key Point 1 (ICP Match Rate is the #1 indicator). **Effort:** M.
**Unblocked by:** the Canva ICP template (now in hand — see "The canonical rubric" below).
**Context:** Step 1 (funnel KPIs) shipped; `docs/funnel-roadmap.md` sequences this as the foundational fix. Today's ICP match rate runs on an unvalidated scale; this step makes the #1 indicator trustworthy.

---

## The problem

There are **three** ICP-ish scorers that don't share a scale or dimensions, so "ICP fit" means something different at each hop:

| Scorer | Scale | Dimensions | Level |
|---|---|---|---|
| Canva rubric (canonical) | **0–100** | Industry 25 · Growth 20 · Funding 15 · Event 15 · Size 15 · Location 10 | Company (fit only) |
| [scorer.ts](../lib/prospecting/scorer.ts) (prospecting fit) | 0–80 | Geography 25 · Industry 25 · Title 20 · Size 10 | Company **+ person** |
| [score-lead.ts](../lib/score-lead.ts) (lead score) | 0–100 | Geo 25 · Industry 25 · Title 20 · Event(source) 15 · Engagement 10 · Sponsor 5 | Mixed (fit **+ intent**) |

A prospect's fit (0–80) is **discarded** when the lead is re-scored to 0–100 on different dimensions, and the funnel's `ICP_MATCH_THRESHOLD = 65` ([funnel.ts](../lib/kpis/funnel.ts)) sits on the 0–100 lead scale — which matches *neither* the canonical rubric nor the prospecting fit.

---

## The canonical rubric (from the Canva CSV)

A **company-level FIT score, 0–100**, six dimensions:

| Dimension | Max | Worked example (The Lab Cafe) |
|---|---|---|
| Industry | 25 | 25 — healthtech, top tier |
| Growth Stage | 20 | 12 — expanded to 6 states, pursuing national |
| Funding Stage | 15 | 9 — bootstrapped / seeking $1M |
| Event Activity | 15 | 10 — active site/social, low following |
| Company Size | 15 | 0 — undisclosed/unverifiable |
| Location | 10 | 7 — Houston (~200mi from SA) |
| **Total** | **100** | **63 → grade C** |

**Grade bands** (consistent with the example and the original 434 spec): **A+ 90–100 · A 80–89 · B 70–79 · C 60–69 · D <60.**

Two things the rubric makes explicit:
1. **It is FIT only.** No title, no engagement, no sponsor-intent. Those are *not* ICP fit.
2. **Unknowns score 0, not benefit-of-the-doubt** (Company Size 0/15 when headcount unverifiable).

The CSV also carries the qualitative **ICP profile template** (Firmographics, Technographics, Business model, Demographics, Geographic/regulatory, Psychographic, Pain Points). That's the narrative profile a rep fills in — out of scope for the *score*, but worth storing alongside (see Non-goals).

---

## Target architecture: three axes, not one blended number

The reconciliation insight: our two code scorers blend **fit + person + intent** into one number. The canonical rubric is **fit only**. So split them:

- **ICP Fit** (0–100, canonical 6-dim, company-level) — the single source of truth. Travels prospect → lead → opportunity **unchanged**.
- **Contact qualifier** (title/seniority) — person-level; used in prospecting to pick the right contact, surfaced on the lead. *Not* part of fit.
- **Intent** (engagement, sponsor, business signals) — the second axis; relocated here intact (full build is Step 6, but Step 2 must **not lose** these signals).

Final priority can later combine them (the original spec's `Final = Fit×0.6 + Intent×0.4`), but Step 2's job is to establish a clean, comparable **Fit** score and relocate the rest — not to delete anything.

---

## Reconciled rubric to implement

Canonical maxes are authoritative. Sub-criteria below are **proposed** — reconciled from the worked example, the original 434 spec tables, and the rich 434-specific logic already in `scorer.ts`. They need sign-off (Decision 1).

| Dim (max) | Data source | Today | Proposed sub-criteria |
|---|---|---|---|
| **Industry (25)** | Apollo `organization.industry` / lead `industry` | Both have industry@25 but **different lists** | Merge `scorer.ts` `INDUSTRY_SIGNALS` (434's real verticals — health, capital/VC, sports/Latino, media/broadcast, CPG-Hispanic, tech/SaaS, edu, nonprofit, civic) with the spec's defense/cyber/biotech tiers into one map. |
| **Growth Stage (20)** | **NEW — needs source** | Not scored | News/expansion signals (new markets, offices, product launches). Apollo doesn't give this directly → see Decision 3. |
| **Funding Stage (15)** | **NEW — needs source** | Not scored | Series B+ / A / seed / govt-funded / bootstrapped tiers (per spec). Apollo funding fields if available, else enrichment → Decision 3. |
| **Event Activity (15)** | Web/research | `score-lead` "event" = lead **provenance**, a different thing | Redefine to the canonical meaning: does the **company** host conferences/meetups/webinars / build community. (Don't reuse the provenance signal.) |
| **Company Size (15)** | Apollo `estimated_num_employees` | `scorer.ts` size@10 | Rescale 10→15; align ranges to ICP (10–50 best); **unknown = 0** per the rubric. |
| **Location (10)** | Apollo city/state/country / lead `location` | Both geo@**25** | Rescale 25→10 — **but this de-emphasizes geography, which 434 weights heavily** → Decision 2. |

**Hard exclusion stays:** `EXCLUDED_COUNTRIES` (EU/UK/EEA/CH/CA) remains a pre-score gate returning the excluded sentinel, independent of the rubric ([scorer.ts:75](../lib/prospecting/scorer.ts#L75), `isExcludedJurisdiction`). Compliance is not a scored dimension.

---

## Implementation work

### 1 · New canonical module — `lib/icp/rubric.ts`
Single source of truth for the Fit score:
- The 6 dimensions, their maxes, and sub-criteria lookups (industry map, size ranges, location tiers, growth/funding tiers, event-activity signals).
- `scoreIcpFit(company): { fit: number (0–100), grade: "A+"|"A"|"B"|"C"|"D", breakdown: Record<dim, number> }`.
- `icpGrade(fit)` and the grade bands.
- Takes a normalized company shape so both prospecting and lead paths feed it the same way.

### 2 · Refactor `lib/prospecting/scorer.ts`
- `scoreCandidate` computes **Fit** via `scoreIcpFit` (company fields only).
- Keep **title** scoring but emit it as a separate `contactQualifier`, not folded into fit.
- Keep `EXCLUDED_COUNTRIES` / `isExcludedJurisdiction` exactly as-is (pre-score gate).
- Retire the 0–80 scale → Fit is 0–100. Update `DEFAULT_FIT_THRESHOLD` to the 0–100 grade basis (Decision 4).
- `ScoredPerson.breakdown` → the canonical 6 dims; add `contactQualifier`.

### 3 · Refactor `lib/score-lead.ts`
- `scoreLead` computes **Fit** via `scoreIcpFit` (so a lead's fit == its prospect's fit, recomputed identically — no drift).
- **Relocate** engagement (+10) and sponsor (+5) out of fit into an `intent_score` field; keep title as `contactQualifier`. Nothing deleted.
- `priority` derives from Fit grade (+ intent later), not the old blended 0–100.

### 4 · Lead model — `types/crm-types.ts`
- Add `icp_fit_score` (0–100), `icp_grade`, `icp_breakdown` (6 dims). Keep the legacy `score`/`score_breakdown` during transition, then deprecate.
- Add `intent_score` (+ breakdown) so relocated signals have a home.
- Prospecting **approve** stores `icp_fit_score` and the lead path **does not overwrite** it (recompute yields the same number).

### 5 · Funnel KPI — `lib/kpis/funnel.ts`
- `ICP_MATCH_THRESHOLD` → grade-based on the unified Fit (Decision 4); read `icp_fit_score`.
- Step-1's ICP-match KPI now reflects the team's real definition.

### 6 · Backfill — re-score existing leads
- One-off script to compute `icp_fit_score`/`icp_grade` for existing leads from their company fields (Decision 5: backfill vs read-time). Where company fields are thin (legacy leads), grade honestly (unknowns = 0).

### 7 · Docs — `lib/prospecting/icp.md`
- Replace the ad-hoc weights with the canonical 6-dim rubric + grade bands; record the sign-off.

---

## Open decisions

1. **Sub-criteria sign-off.** The dimension maxes are canonical; the within-dimension point tables (above) are proposed. Confirm them, or supply the Canva's exact tables if they exist beyond the CSV.
2. **Location weight — the big one.** Canva caps Location at 10/100, but 434's strategy (`icp.md`) prioritizes South Texas heavily. Adopt Canva's 10 (de-emphasize geo) or override the canonical rubric to keep geo weightier? This changes who scores as "ICP-matched."
3. **Growth + Funding data source.** These two new dimensions (35 pts combined) need data we don't capture today. Options: pull from Apollo funding fields if present, add an enrichment step, or score them only when a rep/research fills them in (and treat missing as 0, per the rubric). Decide before they can be scored — until then Fit effectively tops out at ~65/100.
4. **Match threshold / grade.** What counts as "ICP-matched" on the funnel KPI — grade B+ (≥70), or C+ (≥60)? And what's the prospecting *approve* bar (icp.md currently says 50–60)? Approve and match can differ (approve ≥60, quality-match ≥70).
5. **Backfill vs read-time.** Re-score existing leads with a one-off script (snapshots fit at a point in time), or compute Fit at read time (always fresh, more compute). Recommend backfill + recompute-on-write, mirroring today's inline scoring.
6. **Retire the 0–80 scale?** Recommend yes — everything moves to 0–100 so prospect/lead/opportunity are directly comparable.

## Non-goals

- **Not building the full intent layer** — Step 2 *relocates* engagement/sponsor into `intent_score` so nothing is lost, but the website/hiring/business-signal intent model is Step 6.
- **Not building Growth/Funding enrichment pipelines** — Decision 3 scopes how to source them; the rubric supports scoring them, sourcing is separate.
- **Not capturing the qualitative ICP profile** (Firmographics/Psychographic/Pain Points) as structured fields yet — optional future: store the Canva profile columns on the company/lead for rep context.

## File checklist

**Step 2a phase 1 (lead + KPI side) — BUILT, typechecks clean 2026-06-26:**
- [x] `lib/icp/rubric.ts` — canonical Fit scorer, **normalized over active dims** (Industry 25 · Location **20** · Size 15 = 60 denominator), grade bands. Growth/Funding/Event declared but inactive (Step 2b).
- [x] `lib/score-lead.ts` — Fit via rubric; engagement/sponsor/event-source **relocated** to `intent_score` (nothing lost); priority = grade + intent bump.
- [x] `types/crm-types.ts` — `icp_fit_score` / `icp_grade` / `icp_breakdown` / `intent_score` / `intent_breakdown` / `employee_count`; computed fields omitted from create/update inputs.
- [x] `lib/firestore-leads.ts` — all three write paths (create/update/incrementEngagement) store the new fields; `captureLeadFromProspecting` + `ProspectingCapture` carry `employeeCount`.
- [x] `app/api/admin/prospecting/approve/route.ts` — passes Apollo `estimated_num_employees` so prospected leads score Company Size.
- [x] `lib/kpis/funnel.ts` — `ICP_MATCH_THRESHOLD = 70` (grade B); reads `icp_fit_score` with legacy-`score` fallback.
- [x] `lib/prospecting/scorer.ts` — exported the shared geo/industry constants (rubric reuses them; no behavior change).

**Step 2a phase 2 — REMAINING:**
- [ ] `lib/prospecting/scorer.ts` — migrate the prospecting path + prospect UI off the 0–80 scale onto the rubric (today it still shows 0–80; the *lead* it creates already gets canonical Fit).
- [ ] backfill script — re-score existing leads onto `icp_fit_score` (until then they fall back to legacy `score`; any edit re-scores them).
- [ ] `lib/prospecting/icp.md` — document the canonical rubric + sign-off.

**Step 2b — REMAINING (deferred):** activate Growth + Funding + Event dimensions once a data source is decided (Decision 3).

## Behavior changes shipped in 2a phase 1

- **Scores re-base.** `score` now mirrors the canonical Fit (3 dims normalized to 100), so numbers differ from the old blended score. The Lab Cafe example lands ~70 (B) on the 3 active dims vs. Canva's 63 (C) on the full six — they converge in 2b.
- **Priority shifts.** Now grade-driven (A/A+ → high) with an intent bump (engaged/event-sourced → high), instead of the old blended ≥65. The lead-quality KPI bands and Overview "priority to work" counts will move.
- **ICP match rate** now means "fit ≥ 70 (grade B+)" on the unified scale — the trustworthy #1 indicator the research asks for.

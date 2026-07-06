# Apollo Prospecting — Basic-plan alignment roadmap

**Context.** 434media moved from the Apollo Free plan to **Basic** ($49/seat/mo,
30,000 credits/seat/year ≈ 2,500/mo). This roadmap covers the second wave of
prospecting work: bringing the feature in line with Apollo's own prospecting +
ICP methodology (WHO/WHEN framework) now that we can actually pay for reveal,
advanced filters, and intent.

**Primary use:** outbound sales leads → push through the sales funnel.

References:
- Apollo "How to Prospect": https://knowledge.apollo.io/hc/en-us/articles/27155177775885
- Apollo "Identify Your ICP": https://knowledge.apollo.io/hc/en-us/articles/4416471135245
- ICP source of truth: `lib/prospecting/icp.md`

---

## Wave 1 — the original 7-stage pipeline (COMPLETE)

The end-to-end prospecting pipeline is built and functional:

| Stage | Scope | File(s) |
|---|---|---|
| 0 | Per-prompt result caps | `search`/`approve` route constants |
| 1 | Apollo API wrapper | `lib/prospecting/apollo.ts` |
| 2 | LLM prompt translator | `lib/prospecting/translator.ts` |
| 3 | ICP scorer (canonical rubric) | `lib/prospecting/scorer.ts`, `lib/icp/rubric.ts` |
| 4 | Prospect page + search orchestrator | `app/admin/leads/prospect/page.tsx`, `.../prospecting/search` |
| 5 | Approve → Leads | `app/api/admin/prospecting/approve/route.ts` |
| 6 | Persistent credit log | `lib/prospecting/credit-log.ts` |
| 7 | Budget governance | `lib/prospecting/budget.ts`, `.../prospecting/budget` |

---

## Wave 2 — Basic-plan alignment

### Done (this pass)

- **8. Budget caps → Basic sizing** — defaults 200/day, 2,000/mo (env-overridable). `budget.ts`
- **9. ICP persona-tier restructure** — archetypes rewritten in Apollo WHO/WHEN
  format with Tier 1/2/3 personas. `icp.md`
- **10. Translator: Champion targeting + email-status** — targets Tier-2 Champion
  for outbound; emits `contact_email_status` (defaults verified + likely-to-engage). `translator.ts`
- **11. Email reveal at approve** — `enrichPersonById()` reveals work email by
  Apollo id at approve time; UI makes any non-excluded candidate selectable. `apollo.ts`, `approve/route.ts`, `page.tsx`
- **12. Industry tag-ID enum scaffold** — `ICP_INDUSTRIES` + `INDUSTRY_MAP` +
  `resolveIndustries()`; translator emits `icp_industries`. Inert (keyword
  fallback) until tag IDs are pasted in. `industry-tags.ts`, `translator.ts`

### Remaining steps

**13. Verify email reveal against the Basic key** _(blocker: live test)_
Run one real search → approve 1–2 candidates → confirm `/people/match` by id
returns the work email and the credit counter ticks. If Apollo needs a
different reveal shape, it's a one-line change in `enrichPersonById`.
- Acceptance: an approved prospect lands in `/admin/leads` with a populated email.

**14. Populate industry tag IDs** _(blocker: pull IDs from Apollo)_
Fill the `tagIds` arrays in `INDUSTRY_MAP` from Apollo (People Search → Industry
filter → read `organizationIndustryTagIds[]` from the URL, or `GET /industry_tags`).
Activates precise server-side industry filtering automatically; no code change.
- Then: render `industry_tag_ids` as readable category chips in `FilterChips` (currently would show raw ObjectIds).
- Acceptance: a search with an industry sets `industry_tag_ids` and results skew on-industry vs. keyword-only.

**15. Buying-intent topics** _(BLOCKED — not available via API)_
CONFIRMED against docs.apollo.io/reference/people-api-search: the `api_search`
endpoint exposes **no intent parameter**. Apollo's buying intent (Bombora, 15k
topics, 0–100 score) is a **UI-only filter** — it cannot be applied through the
REST People Search API on any plan. Not buildable server-side. Real intent
filtering stays a manual Apollo-app workflow; the closest API-available proxy is
the hiring signal in step 16.

**16. Signals — the WHEN axis** _(new — the buildable timing lever)_
The `api_search` endpoint DOES expose these signal params:
- **Job-posting / hiring** ✅ — `q_organization_job_titles[]`,
  `organization_num_jobs_range[min/max]`, `organization_job_posted_at_range[min/max]`.
  The best available "buying moment" filter: companies hiring now / hiring a
  specific role in a recent window. Maps to icp.md WHEN blocks.
- **Technographics** ✅ — `currently_using_any_of_technology_uids[]` (+ all_of /
  not_using variants). Lower priority for an audience-access business.
- **Funding / new-in-role / headcount growth** ❌ — NOT in the search API; would
  need a per-candidate enrichment/research step.

**DONE (hiring signal)** — translator emits `hiring_job_titles` /
`min_active_job_postings` / `hiring_posted_within_days` (relative window →
absolute "posted since" date computed server-side); `apollo.ts` maps to
`q_organization_job_titles` / `organization_num_jobs_range` /
`organization_job_posted_at_range`; surfaced in "Filters used" chips + a new
example prompt. Prompt rule 13 gates it so it only fires when the rep asks for
timing/expansion/hiring.
- Verify against Basic key: confirm the date-range param accepts yyyy-mm-dd
  (vs. full ISO) and returns hiring-filtered results.

**Still open (part of 16):** technographics (`currently_using_*_technology_uids`
— low priority for audience-access) and funding / new-in-role / headcount-growth
(NOT in search API — need a per-candidate enrichment/research step).

**17. Saved archetype presets** _(new — UX)_
Turn the four ICP archetypes into click-to-load preset chips on the prospect
page (pre-fill titles/seniority/industry per archetype × tier). Makes prospecting
repeatable and consistent instead of re-deriving from a blank textarea.
- Acceptance: one click loads a sponsor-buyer / event-partner / amplifier search.

**18. Editable filters before search** _(new — UX / cost control)_
Let the rep review + edit the LLM-derived filter chips *before* the
credit-burning Apollo call (Apollo's own iterate-then-commit model).
- Acceptance: rep can correct a misread interpretation without wasting a pull.

**19. Cleanups** _(housekeeping, anytime)_
- Delete `app/api/admin/prospecting/test/route.ts` (dev endpoint, marked for removal).
- Refresh stale "Stage 6 will make this persistent" comments in `apollo.ts`
  (persistence is already wired via `credit-log.ts`).

---

## Suggested sequence

1. **13 + 14** — validate reveal, activate industry filtering (needs you: live test + IDs).
2. **15 (intent) + 16 (signals)** — the net-new "WHEN" capability; the biggest quality lever left.
3. **17 + 18** — UX polish for repeatability and cost control.
4. **19** — cleanups, fold in whenever.

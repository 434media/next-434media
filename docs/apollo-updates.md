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

**15. Buying-intent topics** _(new — highest value)_
Wire Apollo intent (6 topics on Basic) into the translator schema + `apollo.ts`
search body. Let a rep's prompt ("companies showing intent on sponsorship")
select intent topics + intent level. This is the highest-signal outbound filter
Apollo offers.
- Acceptance: intent-scoped searches return warmer candidates; intent surfaces in the "Filters used" chips.

**16. Signals — the WHEN axis** _(new)_
Add buying-signal filters: recent funding, new-in-role hires (new CMO / Head of
Partnerships), headcount growth, job postings. Maps directly to each archetype's
"WHEN — signals" block in `icp.md`. May need a research/enrichment step for
signal data Apollo search doesn't return inline.
- Acceptance: a rep can prospect "just-funded" or "newly-hired-CMO" moments.

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

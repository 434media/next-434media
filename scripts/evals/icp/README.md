# ICP evals — next-434media#63

These evals measured what changed when prospecting moved from
`lib/prospecting/icp.md` to the outbound cohorts (`icp_cohorts`). The cohorts
are now the only targeting source, and `icp.md` is gone. The bar for #63 was:
- every exclusion decision identical;
- every flip in the approve decision listed for the founder.

**What stays out of this repository.** It is public. Cohort rows, lead
snapshots and eval reports are internal, so they stay out:
- The scripts take those files by path.
- Keep the inputs and outputs in 434-context, or in a local scratch directory.
- Never commit them here.

## E1 — the translator, with its noise floor

```
tsx scripts/evals/icp/e1-translator.ts --runs 3 --out <dir>/e1.json
tsx scripts/evals/icp/e1-compare.ts --a <dir>/e1-before.json --b <dir>/e1.json
```

**Where the cohorts come from.** Without `--cohorts`, the translator reads
`icp_cohorts` through the production reader (`lib/firestore-icp-cohorts.ts`),
so the run needs `GOOGLE_SERVICE_ACCOUNT_KEY` for Firestore. `--cohorts
<cohorts.json>` substitutes a fixture.

**The revenue check.** A cohort's revenue floor is never a search filter. The
run exits 1 if any run sets `revenue_range` on a prompt that states no revenue
figure. The prompt `revenue-stated` is the control: it states one, so its
filter should stay.

**The other checks.** The run also exits 1 on any location outside the United
States (cold outbound is US-only, master 5.3; `mexico-trap` is the case), and,
for a prompt marked `"expect": { "no_keyword_with_tags": true }`, on a niche
`q_keywords` term sent on top of industry tags (translator rule 11;
`c-keyword-over-tags` is the case).

**What a run does.** Each prompt in `e1-prompts.json` is translated `--runs`
times.

**The noise floor.** Translation is a model call, so two runs of the same
prompt can differ. The noise floor is the agreement between runs within one
report.

**How a difference is judged.** A difference between two reports counts only
where their agreement falls below that floor. It is compared field by field,
using Jaccard similarity on the set-valued filters.

**What a run needs.** It calls the model through the AI Gateway, so it needs
Gateway credentials: `AI_GATEWAY_API_KEY`, or a current `VERCEL_OIDC_TOKEN`.

## E2 — the scoring outcome on a frozen snapshot

```
tsx scripts/evals/icp/e2-scoring.ts --snapshot <leads.json> [--cohorts <cohorts.json>] [--filters <e1.json>] --out <dir>/e2.json
tsx scripts/evals/icp/e2-compare.ts --before <dir>/e2-baseline.json --after <dir>/e2-after.json
```

**What it scores.** Every frozen lead, plus the synthetic jurisdiction and
agency cases in `e2-synthetic.json`.

**Which filter sets.** Each case is scored against:
- no filters;
- the Texas default;
- each filter set from an E1 report.

Filters matter to scoring because the rubric falls back to the search's
keywords and locations when a field is missing.

**What it records:**
- fit and grade;
- exclusion;
- the approve decision (`PROSPECTING_FIT_THRESHOLD`, default 60);
- ICP match (`ICP_MATCH_THRESHOLD`, default 70);
- the cohort match, once that module exists.

**What the compare does.** It fails if any exclusion decision differs, and it
lists every approve flip.

The lead snapshot carries scoring fields only: company, industry, location,
size, revenue, title, source and status. It holds no names, emails or notes.

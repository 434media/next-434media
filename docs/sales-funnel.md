# Sales Funnel — README

The 434 Media admin is organized as one continuous **sales funnel**: capture a
contact, score its fit, work it through outreach, and convert it to a client —
with KPIs measuring conversion, velocity, and lead quality along the way.

This document is the canonical overview. Deeper design notes live alongside it:
[funnel-ia-plan](funnel-ia-plan.md) · [funnel-ia-pipeline](funnel-ia-pipeline.md) ·
[funnel-step2-icp](funnel-step2-icp.md) · [funnel-kpi-step1](funnel-kpi-step1.md) ·
[outreach-sequence](outreach-sequence.md) · [funnel-roadmap](funnel-roadmap.md).

---

## 1. Where it lives

The admin **Pipeline** section is the funnel, left to right:

| Surface | Route | Role in the funnel |
|---|---|---|
| **Prospect** | `/admin/prospect` | Outbound: NL prompt → Apollo + LLM → ICP-scored candidates → approve into Leads |
| **Inbox** | `/admin/inbox` | Inbound contact-form inquiries with a response-time queue |
| **Audiences** | `/admin/audiences` | Newsletter / Events / Lists cohorts → Mailchimp sync → promote to Leads |
| **Leads** | `/admin/leads` | The scored working queue — the funnel's center of gravity |
| **CRM** | `/admin/crm` | Clients, opportunities, tasks (post-conversion) |
| **Funnel KPIs** | `/admin/kpis` | Conversion, velocity, and ICP-match scoreboard |

A lead reaches the queue three ways: **inbound** (contact form / audience
promotion) or **outbound** (prospecting approval). From there it's the same
motion for everyone: **qualify → outreach → convert.**

---

## 2. The funnel stages (derived, never stored)

There is **no stage field**. A lead's funnel stage is *computed* from its status,
a booked discovery call, and any converted opportunity — see
[`lib/kpis/funnel.ts`](../lib/kpis/funnel.ts). The ladder:

`Lead → MQL → SQL → Discovery → Proposal → Closed-Won`

Lead **status** maps onto it like this:

| Lead status | Funnel stage |
|---|---|
| `new` | Lead |
| `ready`, `contacted` | MQL |
| `engaged` | SQL |
| `converted` | Discovery (hands off to CRM opportunity) |
| `archived` | Exit (counts at the furthest stage it reached) |

A booked **discovery call** (`discovery_call_at`) forces the Discovery stage even
before formal conversion. Once converted, the linked CRM client/opportunity
disposition drives Proposal / Closed-Won.

---

## 3. Lead scoring — how it's captured & what drives it

Scoring runs **inline on every lead write** (create, update, prospect-approval)
via `scoreLead()` in [`lib/score-lead.ts`](../lib/score-lead.ts), and **re-scores
on engagement** when Resend open/click webhooks fire
([`app/api/webhooks/resend`](../app/api/webhooks/resend/route.ts)). No cron, no
Cloud Function — the score is always fresh at read time.

### Two axes, not one

| Axis | Field(s) | Answers |
|---|---|---|
| **ICP fit (0–100)** | `score` / `icp_fit_score` + `icp_grade` | "Are they a good match?" — company-level, canonical |
| **Intent** | `intent_score` | "Are they warm right now?" — bumps priority, **not** fit |

### Fit rubric — the metric drivers

Fit is six weighted dimensions ([`lib/icp/rubric.ts`](../lib/icp/rubric.ts)),
scored via **normalization** over the dimensions we actually have data for:

> `fit = round( raw ÷ activeDenominator × 100 )`

| Dimension | Max | Counted | Source |
|---|---|---|---|
| **Industry** | 25 | always (core) | vertical pattern-match |
| **Location** | 20 | always (core) | geography match |
| **Company Size** | 15 | always (core) | headcount / institution |
| Funding Stage | 15 | if present | Apollo annual revenue — **live** |
| Growth Stage | 20 | if present | research — *dormant* |
| Event Activity | 15 | if present | research — *dormant* |

Core dims (denominator **60**) are always counted; extended dims join raw **and**
denominator only when their data exists — so a lead with just industry/location/
size can still grade A instead of being capped at C for missing deferred dims.

What moves each core driver (taxonomy in [`lib/icp/taxonomy.ts`](../lib/icp/taxonomy.ts)):

- **Industry (25)** — regex match against 434's real verticals. Top tier (**25**):
  Healthcare/life-sci, Capital/VC/accelerators, Latino sports/fight, bilingual
  Media/broadcast, CPG. Secondary (**22**): Tech/SaaS, Education/workforce,
  Nonprofit, Civic-tech.
- **Location (20)** — South Texas (SA, RGV, Laredo, Corpus…) = **20**; Mexico
  border = 18; TX metro = 17; elsewhere TX = 15; Hispanic-targeted metros
  (Miami, LA, Chicago…) = 13; any other US signal = **4**. Weighted heavier than
  the Canva baseline (20 vs 10) — South-Texas / Hispanic-market focus is 434's
  positioning, not a generic firmographic.
- **Company Size (15)** — sweet spot **10–500 employees = 15**; institutions
  (university / hospital / government / broadcaster / foundation) = 15 regardless
  of headcount; then bands down (5–10 → 10, 500–1k → 10, >1k → 5). Unknown = 0.
- **Funding Stage (15, live)** — revenue proxy: $50M+ → 15, $10M+ → 12,
  $2M+ → 9, $500k+ → 6, else 3.

**Grades:** A+ ≥ 90 · A ≥ 80 · B ≥ 70 · C ≥ 60 · D < 60.

### Intent drivers (priority, not fit)

Three warmth signals in [`lib/score-lead.ts`](../lib/score-lead.ts): email
**engagement** (>2 opens or any click) = 10 · **sponsor tag** = 5 ·
**event-sourced** capture = 15.

**Priority** = `high` if `fit ≥ 80` **or** `intent ≥ 10`; `medium` if `fit ≥ 60`;
else `low`. So an engaged or event-sourced lead rides high even at mediocre fit.

### Two things to know

1. **Unknown = 0, by design.** Missing industry/location/size counts *against*
   fit — not benefit-of-the-doubt. Leads with no firmographics score blind/low
   until enrichment (AI research → apply-country, Apollo revenue) fills them in.
2. **Pre-score jurisdiction gate.** EU/UK/EEA/Switzerland/Canada are excluded
   *before* scoring via `EXCLUDED_COUNTRIES` in
   [`lib/prospecting/scorer.ts`](../lib/prospecting/scorer.ts) (GDPR/CASL) —
   a compliance gate, not a scoring dimension.

---

## 4. Outreach engine

Two motions share the lead drawer's **Outreach** tab
([`components/crm/OutreachSequencePanel.tsx`](../components/crm/OutreachSequencePanel.tsx)):

- **Single email** — one AI-drafted 1:1 send via Resend.
- **3-email sequence** — the core cadence. Rep reviews 3 AI drafts (intro →
  value → final follow-up), enrolls, and the cron auto-sends on a **0 / +4 / +5
  business-day** schedule ([`lib/outreach-sequence.ts`](../lib/outreach-sequence.ts),
  [`app/api/cron/outreach-sequence`](../app/api/cron/outreach-sequence/route.ts)).

**Consent-gated:** every send re-checks Mailchimp opt-out / hard-bounce before
firing. **Auto-stops** on reply, opt-out, or convert.

### Reply capture & auto-stop

Sequence sends use a per-lead reply-to: `reply+<leadId>@<SEQUENCE_INBOUND_DOMAIN>`.
When the lead replies, Resend's receiving domain POSTs an `email.received` event
to [`app/api/webhooks/resend-inbound`](../app/api/webhooks/resend-inbound/route.ts),
which:

1. Matches the lead from the `reply+<leadId>@` plus-address.
2. **Stops** the sequence and flips the lead to `engaged` (the strongest SQL signal).
3. **Fetches the reply body** — the webhook is *metadata-only*, so the handler
   calls Resend's **Received Emails API** (`GET /emails/receiving/{email_id}`),
   strips the quoted original, and stores it as a `reply_received` activity so the
   message is readable inline in the lead's **Activity → Timeline**.
4. **Forwards** the reply to the rep's inbox so the human conversation continues.

> Only **sequence** replies are captured (single sends reply-to the rep directly),
> and only replies received *after* this went live — there's no backfill handle
> for older "Lead replied" notes.

---

## 5. KPIs — measuring the funnel

`/admin/kpis` reads three families ([`lib/kpis/`](../lib/kpis/)):

- **Conversion** ([`funnel.ts`](../lib/kpis/funnel.ts)) — stage-to-stage
  drop-off across the derived ladder, plus per-stage exits.
- **Velocity** ([`funnel.ts`](../lib/kpis/funnel.ts)) — median & p90 days between
  stages, including **Time to Discovery Call** (from `discovery_call_at`).
- **ICP match rate** — % of leads whose `icp_fit_score` clears
  `ICP_MATCH_THRESHOLD` (default **70** = grade B), broken out by source.
- **Lead quality & email benchmarks** ([`lead-quality.ts`](../lib/kpis/lead-quality.ts),
  [`email-benchmarks.ts`](../lib/kpis/email-benchmarks.ts)) — score distribution,
  kept-vs-removed with reasons, and Mailchimp/Resend send performance.

---

## 6. Activity timeline (the audit trail)

Every meaningful step appends a `LeadActivityEvent` via
[`appendLeadActivity`](../lib/firestore-leads.ts) — `created`, `status_changed`,
`draft_generated`, `outreach_sent`, `followup_set`, `discovery_scheduled`,
`researched`, `email_opened`, `email_clicked`, `reply_received`, `note`. The lead
drawer's **Activity** tab renders it newest-first, with the captured reply body
shown under `reply_received` events.

---

## 7. Ops notes

**Relevant env vars** (see the root README's Environment Variables block):
`RESEND_API_KEY`, `SEQUENCE_INBOUND_DOMAIN`, `RESEND_INBOUND_WEBHOOK_SECRET`,
`ICP_MATCH_THRESHOLD`, `SEQUENCE_STEP_GAP_MINUTES` (test cadence override),
`APOLLO_*` caps.

**Deploys:** pushing to `main` auto-deploys to production via the Vercel↔GitHub
integration — no manual `vercel --prod`.

**Compliance:** 434media does **not** cold-outreach EU/UK/EEA/Switzerland/Canada
(GDPR/CASL). Single source of truth: `EXCLUDED_COUNTRIES` in
[`lib/prospecting/scorer.ts`](../lib/prospecting/scorer.ts).

**QA period toggles to revert when testing ends:** remove `intern` from
`SEND_CAPABLE_ROLES` ([`lib/auth.ts`](../lib/auth.ts)), drop
`SEQUENCE_STEP_GAP_MINUTES`, and restore the `vercel.json` outreach cron from the
every-minute test schedule back to the weekday schedule.

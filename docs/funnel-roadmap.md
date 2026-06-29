# Pipeline Alignment Roadmap — Steps 2–6

**Status:** Plan / sequencing only (no step built yet beyond Step 1)
**Context:** Step 1 (funnel conversion + velocity + ICP-match KPIs) is built and shipped — see `docs/funnel-kpi-step1.md`. This roadmap sequences the remaining gaps between our pipeline and the research in `key points data.pdf`.

## Where we stand vs. the research

The PDF's three key points and our current coverage:

| PDF key point | Coverage | Gap this roadmap closes |
|---|---|---|
| 1 · Lead Quality / **ICP Match Rate** (#1 indicator) | 🟢 Measured | ICP scale isn't unified or validated against the canonical rubric → **Step 2** |
| 2 · **Funnel Conversion** (Lead→MQL→SQL→Discovery→Proposal→Closed-Won) | 🟢 Structure built / 🟡 proxy signals | Discovery isn't a real signal; MQL/SQL is thin → **Step 3, Step 6** |
| 3 · **Velocity** (Time to Discovery Call, Time to Closed-Won) | 🟡 Partial | "Time to Discovery Call" doesn't exist → **Step 3** |
| (supporting) **ICP template + scoring** (Canva) | 🟡 Two scorers | Reconcile to one rubric → **Step 2** |
| (supporting) **3-email sequence** (intro/value/follow-up) | 🔴 Single-send only | Cadence engine → **Step 4** |
| (supporting) **Vertical-tailored messaging** | 🔴 Brand context only | Per-vertical templates → **Step 5** |

**Sequencing principle:** make the measurements *true* before scaling the motion. Fix the #1 indicator's integrity (Step 2), then the one missing named metric (Step 3), then build the motion that actually moves leads (Step 4–5), then refine fidelity (Step 6). Cheap-and-foundational first; large-orchestration later.

---

## Step 2 · Unify ICP scoring to one validated rubric

**Serves:** Key Point 1 (ICP Match Rate integrity). **Effort:** M. **Depends on:** the team's Canva ICP template (external — needed before weights can be validated).

Today there are two scorers that don't share a scale:
- Prospecting **fit** — 0–80, geo/industry/title/size ([lib/prospecting/scorer.ts](../lib/prospecting/scorer.ts))
- Lead **score** — 0–100, different dimensions ([lib/score-lead.ts](../lib/score-lead.ts))

A prospect's carefully-computed fit score is discarded when the lead is re-scored downstream, and the funnel's ICP match rate (`ICP_MATCH_THRESHOLD = 65`, [funnel.ts](../lib/kpis/funnel.ts)) runs on the 0–100 scale — which may not match how the team *defines* ICP fit.

**Work:**
1. Get the canonical ICP rubric (Canva) and reconcile dimensions + weights against both scorers and `lib/prospecting/icp.md`.
2. Pick one scale (recommend 0–100) and one source of truth; define how prospecting fit composes into the lead score rather than being overwritten.
3. Re-validate `ICP_MATCH_THRESHOLD` against the unified scale.

**Done when:** one ICP score travels from prospect → lead → opportunity unchanged, "ICP-matched" means the same thing everywhere, and the threshold reflects the team's actual definition. The Step-1 ICP-match KPI becomes trustworthy, not just present.

---

## Step 3 · Make Discovery a real signal

**Serves:** Key Point 2 (Discovery stage fidelity) + Key Point 3 ("Time to Discovery Call"). **Effort:** S. **Depends on:** nothing.

This is the cheapest high-fidelity win and the one *named* metric we're missing. Today Discovery ≈ "became an opportunity," and the velocity step is the proxy "Time to Opportunity."

**Work:**
1. Add `discovery_call_at` (timestamp) — on the lead or its `crm_clients` opportunity — plus a `discovery_scheduled` activity event.
2. Capture it where a discovery call gets booked/logged (CRM opportunity surface).
3. In [funnel.ts](../lib/kpis/funnel.ts): map the Discovery stage to "discovery call booked" and relabel the velocity step back to **"Time to Discovery Call."**

**Done when:** the Discovery stage reflects an actual booked call, and the PDF's "Time to Discovery Call" velocity metric exists for real. (Reverses the deferred decision #1 in `funnel-kpi-step1.md`.)

---

## Step 4 · Outreach cadence (the 3-email sequence)

**Serves:** the supporting motion behind *all three* key points — cadence is what actually moves leads through MQL→SQL→Discovery, producing the conversion + velocity the dashboard reports. **Effort:** L. **Depends on:** Step 2 (so sequence targeting respects unified ICP).

Today: single draft→send per lead ([generate-draft](../app/api/admin/leads/[id]/generate-draft/route.ts) + [send-outreach](../app/api/admin/leads/[id]/send-outreach/route.ts)). No cadence. The PDF specifies a three-touch sequence:
- **Email 1** — intro + relevant challenge + invite to discuss
- **Email 2** — value prop + specific benefits/results
- **Email 3** — polite final follow-up, leaves the door open

**Work:**
1. Sequence state on the lead: current step, next-send date, status (active/paused/completed/stopped).
2. A cron to send the next step on schedule (build on the existing `lead-followup-digest` cron + `next_followup_date`).
3. Stop conditions: reply / engagement (Resend webhook opens-clicks) / unsubscribe / manual pause — all already partially wired.
4. Per-step draft generation (extend `lib/lead-prompt.ts`) so each email plays its role.
5. Consent + suppression gates reused from `send-outreach` on every step.

**Done when:** approving a lead can enroll it in a 3-touch cadence that sends on schedule, stops on reply/engagement, and respects consent — and the funnel velocity metrics start reflecting a motion we actually run.

---

## Step 5 · Vertical-tailored templates

**Serves:** lead quality / conversion (right message per industry). **Effort:** M. **Depends on:** Step 4 (templates plug into the cadence).

The PDF: "Each vertical will have customized messaging… created health/thelabcafe templates." Today drafting uses brand context but no per-vertical library; the team is building these outside the app.

**Work:**
1. A template library keyed by vertical (the ICP industries: cyber/defense, health tech, bioscience, AI/SaaS, etc.).
2. Pick the template from the lead's `industry` and feed it into the Step-4 cadence's per-step generation.
3. Bring the existing health/thelabcafe templates in as the first entries.

**Done when:** a lead's vertical drives which messaging it gets, end-to-end through the cadence.

---

## Step 6 · Stage-signal fidelity + intent layer

**Serves:** Key Point 2 (MQL/SQL distinction) + Key Point 3 ("fast = high intent"). **Effort:** M. **Depends on:** Steps 2–4 (richer signals to draw from).

Cleanup once the motion exists:
1. **First-class MQL/SQL events** — make the marketing-qualified vs sales-accepted handoff explicit (an activity event / status), instead of inferring MQL=`ready/contacted`, SQL=`engaged`. Sharpens the conversion math in [funnel.ts](../lib/kpis/funnel.ts).
2. **Intent layer** — the originally-deferred "Step 3" from the first review: website/hiring/business signals + engagement recency as a second axis beside fit. Feeds prioritization and explains velocity (the PDF's "fast-moving = high intent").

**Done when:** conversion rates rest on explicit qualification events, and prioritization reflects intent, not just fit.

---

## Sequenced summary

| Step | Title | PDF point | Effort | Blocker |
|---|---|---|---|---|
| ✅ 1 | Funnel conversion + velocity + ICP-match KPIs | 1·2·3 | — | done |
| 2 | Unify ICP scoring to one rubric | 1 | M | ✅ unblocked (Canva rubric in hand) → spec'd in `funnel-step2-icp.md` |
| ✅ 3 | Make Discovery a real signal | 2·3 | S | done — `discovery_call_at` + "Time to Discovery Call" velocity |
| 4 | Outreach cadence (3-email sequence) | motion | L | Step 2 |
| 5 | Vertical-tailored templates | quality | M | Step 4 |
| 6 | Stage-signal fidelity + intent layer | 2·3 | M | Steps 2–4 |

**Recommended start:** **Step 3** if you want a fast, dependency-free fidelity win this week (it makes Discovery + Time-to-Discovery-Call real and reverses the one shortcut we took in Step 1). **Step 2** if you can get the Canva ICP rubric in hand now — it's foundational and the longest pole for trustworthy lead-quality numbers. Steps 4–5 are the larger build (the motion) and should follow the scoring fix so the cadence targets a validated ICP.

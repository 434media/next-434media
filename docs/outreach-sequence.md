# Outreach Sequence — the 3-Email Cadence

**Status:** Plan / Phase 1 building
**Serves:** the research's named-but-unbuilt motion (Email 1/2/3) — the thing that actually moves leads through MQL→SQL→Discovery, producing the conversion + velocity the Funnel KPIs measure. Also the surface a first-time user *works inside* (write → send → follow up).

## Model — hybrid: rep confirms, cron sends

The rep sets up a sequence once (reviews/edits the three AI-drafted emails and approves them), enrolls the lead, then a cron **auto-sends** each step on schedule. Human control over *content*, automation over *delivery*.

The three steps (from the PDF):
- **Email 1 — intro:** introduce 434, name a relevant business challenge, invite to discuss.
- **Email 2 — value:** reinforce the value prop with specific benefits/results, encourage conversation.
- **Email 3 — final follow-up:** polite, acknowledge other priorities, leave the door open.

## Decisions (resolved)

- **Send mode:** hybrid — rep confirms all 3 drafts upfront, cron auto-sends.
- **Cadence:** Day 0 (Email 1) → +4 business days (Email 2) → +5 business days (Email 3).
- **Reply detection:** possible via Resend Inbound (`email.received`) — **Phase 2** (changes reply-to routing; see below).

## Reuses what already exists

- **Consent gates** ([send-outreach](../app/api/admin/leads/[id]/send-outreach/route.ts)) — Mailchimp hard-bounce/opt-out + suppression. Re-checked before EVERY auto-send.
- **Resend send** + reply-to = rep, status→contacted, engagement tracking (opens/clicks webhook).
- **Drafting** ([lead-prompt.ts](../lib/lead-prompt.ts)) — extended to be step-aware.
- **The scheduling backbone** — the cron pattern + `next_followup_date` discipline from [lead-followup-digest](../app/api/cron/lead-followup-digest/route.ts).

## Data model — `outreach_sequence` on the Lead

One active sequence per lead (Phase 1). Stored on the lead doc, like `outreach_draft`.

```ts
interface OutreachSequenceStep {
  n: 1 | 2 | 3
  subject: string
  body: string
  sent_at?: string
  resend_email_id?: string
}
interface OutreachSequence {
  status: "active" | "paused" | "completed" | "stopped"
  steps: OutreachSequenceStep[]      // all 3, rep-approved at enroll
  next_step: 1 | 2 | 3 | null        // next to send (null when done)
  next_send_at?: string              // ISO date the cron acts on
  enrolled_at: string
  enrolled_by: string
  stopped_reason?: "replied" | "engaged" | "converted" | "archived" | "opted_out" | "manual" | "completed"
}
```

## Stop conditions (checked before every auto-send)

A sequence ends (status → stopped/completed) when:
- lead status becomes `engaged` / `converted` / `archived` (rep-driven — also how a reply registers in Phase 1)
- consent gate trips (opt-out / hard bounce) — reuses send-outreach logic
- rep pauses/stops manually
- all 3 steps sent → `completed`
- **(Phase 2)** an inbound reply is detected → `replied`

## The cron — `/api/cron/outreach-sequence`

Runs on business days. For each lead with `outreach_sequence.status === "active"` and `next_send_at ≤ today`:
1. Re-check stop conditions (status, consent). If tripped → stop, skip.
2. Send `steps[next_step-1]` via the shared send path (consent gate + Resend).
3. Stamp `sent_at` + `resend_email_id`; advance `next_step`; set `next_send_at` (+4 or +5 biz days) or mark `completed`.
4. Log a `outreach_sent` activity event.

## Phasing

- **Phase 1 (building):** data model + step-aware drafting + enroll/confirm API + setup UI + the cron + stop conditions + manual stop. Reply-to stays the rep.
- **Phase 2:** Resend Inbound — receiving domain, `reply+<leadId>@…` reply-to, `email.received` webhook → auto-stop (`replied`) + forward the reply to the rep.
- **Later:** vertical-tailored templates (the PDF's health/thelabcafe) plug into the step drafting; autopilot is then fully safe.

## File checklist

**Phase 1 — COMPLETE (typechecks clean, engine verified with a live test send) 2026-06-28:**
- [x] `types/crm-types.ts` — `OutreachSequence` / `OutreachSequenceStep` + `outreach_sequence?` on Lead
- [x] `lib/lead-prompt.ts` — step-aware drafting (intro / value / final)
- [x] `app/api/admin/leads/[id]/sequence/route.ts` — draft the 3 steps + enroll (rep-confirmed) + pause/resume/stop
- [x] `lib/outreach-sequence.ts` — `runSequenceStep` (consent gate + Resend + stamp), business-day math, stop-condition check
- [x] `app/api/cron/outreach-sequence/route.ts` + `vercel.json` cron entry
- [x] Lead drawer UI — `components/crm/OutreachSequencePanel.tsx` (set up → review/edit 3 drafts → enroll → status + pause/resume/stop), wired via `useLeadHandlers.sequenceAction`

**Drawer/main-page UX (from the placement discussion) — COMPLETE:**
- [x] Drawer: Outreach tab unified under one section with a segmented toggle (Single email | 3-email sequence) so the two motions don't compete.
- [x] Leads page: "In sequence" filter/tab (with count) + a `Seq n/3` row badge (next-send date on hover). Division of labor — drawer *authors* a lead's sequence, the leads page *monitors* the fleet. No new route.

**Phase 2 — REMAINING:**
- [ ] Resend receiving domain + `app/api/webhooks/resend-inbound/route.ts` → auto-stop (`replied`) + forward-to-rep

**Not yet done:** visual verification in the running app (the engine is verified; the UI typechecks but hasn't been clicked through).

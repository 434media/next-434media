# Audiences ↔ Mailchimp Alignment Plan

> Status: **Steps 1–4 done.** Taxonomy file built, ghost audience collapsed, live list
> backfilled (2026-06-02: 18 canonical segments, ~75 legacy/empty tags deleted, ~1,544 members
> retagged, verified). Step 4a: the 4 public signup routes write canonical tags via a shared
> `lib/newsletter-subscribe.ts`; the push-members route normalizes at the write boundary.
> Step 4b: the push modal is now a canonical multiselect (free-form input removed) and
> `tag-taxonomy.ts` bridges internal CRM tags → canonical Mailchimp tags via the **lean**
> mapping (`mailchimpTagsFromInternal`). New signups + admin pushes can no longer reintroduce
> drift. Step 5 done: the Audiences header strip + subscriber pill now distinguish
> **subscribed (marketable)** from present-but-not-subscribed (using Mailchimp status, not
> mere presence), and the `digitalcanvas` named DB (434 Media project, `event-registrations`
> collection — the "Lead with Ops" workshop) is wired into the Events aggregation with `dcw:`
> id-prefix write routing → bridges to `brand:digitalcanvas + source:event + event:lead-with-ops-2026-06-18`.
> **Step 6 done: ALL STEPS COMPLETE.** `GET /api/admin/mailchimp/reconcile` reports the
> consent-status breakdown (verified: subscribed 1480 / transactional 173 / unsubscribed 35
> = 1688 total) and flags any non-canonical tag as drift (currently 0). This is the operational
> enforcement of the sole-writer policy.
> Remaining manual action: delete `MAILCHIMP_AUDIENCE_ID_TXMX` from the Vercel project env.

## Tools left in place

- `scripts/mailchimp-retag.ts` — idempotent backfill (dry-run default, `--apply` to write). Re-run anytime to re-align.
- `scripts/inspect-digitalcanvas.ts` — list collections/sample docs in the digitalcanvas named DB.
- `GET /api/admin/mailchimp/reconcile` — taxonomy drift + status breakdown (run `npx tsx`-style or hit the route as an admin).
- Optional follow-up: wrap reconcile in a weekly cron that alerts (via Resend) when `drift.length > 0`.

---

# Phase 2 — Firestore → Mailchimp auto-sync engine (planned)

> Status: **Phase 1 built (dry-run only).** Decisions locked 2026-06-02: keep inline push +
> engine as safety net; hourly cron; stateless v1. Files: `lib/mailchimp-intent.ts`,
> `lib/mailchimp-autosync.ts` (`runAutoSync({dryRun})`), `app/api/cron/mailchimp-push/route.ts`
> (hardcoded `DRY_RUN = true`). Dry-run verified 2026-06-02: 554 unique contacts would sync
> across 14 canonical tag-groups; 2,387 event regs correctly skipped ("did not opt in") — the
> consent gate works. Cron scheduled hourly in vercel.json (`0 * * * *`) but still DRY_RUN —
> it logs "would sync N…" each hour, writes nothing, until DRY_RUN→false. Activates on next
> Vercel deploy. NOT YET: flip DRY_RUN→false to go live (Phase 2).

**Principle:** one engine, one direction, consent is the only gate. Tags are deterministic, so
the engine decides *inclusion* (is there consent?), never tagging. Non-consented contacts are
NEVER pushed (not even as transactional) so the gray zone can't regrow.

**Consent rules (the intent function):**

| Source | Consent signal | include | status | tags |
|---|---|---|---|---|
| email_signups | presence = opt-in | yes | subscribed | `tagsForSource("email_signups",{brand})` |
| event_registrations | `subscribeToFeed`/`optInForUpdates`===true | yes if opted in | subscribed | `mailchimpTagsFromInternal(reg.tags)` |
| event regs not opted in | none | no (skip) | — | — |
| partner_list_members | cold | no (manual gate) | — | — |
| contact_forms | inquiry | no (skip) | — | — |

**Components:**
1. `lib/mailchimp-intent.ts` — pure `mailchimpIntentFor(record, sourceType)` → `{include, status, tags, firstName, lastName}`. Single home for the consent policy.
2. `lib/mailchimp-autosync.ts` — `runAutoSync({dryRun})`: gather consent-bearing records (getEmailSignups + getEventRegistrations filtered through intent), **dedupe+merge canonical tags by email**, batch-upsert via existing `pushMembersToMailchimp()` (500/req).
3. `app/api/cron/mailchimp-push/route.ts` — `runCronJob()` wrapper; **hourly** in vercel.json. Mirror of the existing daily Mailchimp→Firestore `mailchimp-sync` (opposite direction; both stay).

**Why stateless is safe:** `pushMembersToMailchimp` already uses `update_existing:true` + `status_if_new`, so re-upserting never changes an existing member's status (no resurrection of unsubscribed/cleaned); only new emails get `subscribed`. Tags refresh each run (harmless). ~2,000 contacts = ~4 requests/run.

**Guardrails:** no bare `status` override (only status_if_new); skip means skip (no transactional parking); `EXCLUDED_COUNTRIES` governs cold *outbound* only — inbound opt-ins are consent regardless of country, so don't over-apply it here; deletions don't propagate (unsubscribe must be explicit).

**Removed/demoted:** manual "Push to Mailchimp" for Newsletter + opted-in Events → handled by the engine. Push modal survives only as the cold/partner consent gate (Lists tab). Inline push in the 4 signup routes **kept** (instant welcome timing) with the engine as backfill net.

**Rollout:** Phase 1 dry-run (log what would push, write nothing) → review diff → Phase 2 enable writes (manual push still available) → Phase 3 demote manual push to cold-lists-only.

**UI impact:** the "N to push" KPI re-means "present but not consented / cold"; `/reconcile` is the engine's health check.

## Two tag systems (discovered during Step 4 — important)

There are TWO distinct tag systems and they must stay separate:
1. **Internal CRM tags** — `lib/tag-taxonomy.ts` namespaces (`site:`, `role:`, `intent:`,
   `feed:`, `client:`, `partner:`, `geo:`, `industry:`, `quality:`, `source:`, `event:`).
   Live on **leads + event_registrations in Firestore**, drive the CRM UI. LEAVE AS-IS.
2. **Mailchimp marketing tags** — `lib/mailchimp-tags.ts` (`brand:`, `source:`, `event:`,
   `status:`). What gets pushed to Mailchimp.

Tags reach Mailchimp through only two doors: the public signup routes (fixed in 4a) and the
admin push modal (4b). `lib/tag-taxonomy.ts`'s `tagToMailchimpLabel()` currently bridges
internal tags → *human-readable* labels ("SA Tech Day 2026"); Step 4b will repoint that bridge
to emit *canonical* Mailchimp tags instead.
> Owner: Jesse. Policy decided: **the app is the sole authoritative writer of marketing tags.**

## Why this exists

A live audit of the Mailchimp account (read-only, 2026-06-02) surfaced three structural
problems that make Mailchimp and this app disagree:

1. **A ghost second audience.** `.env.local` configures two audiences
   (`MAILCHIMP_AUDIENCE_ID_434MEDIA` = `7fa6fbcb82`, and
   `MAILCHIMP_AUDIENCE_ID_TXMX` = `79d45ea401`). The TXMX list **returns 404 — it no
   longer exists.** There is exactly **one** live audience: "434 Media" (1480 subscribed
   members). Every "for each configured audience" loop wastes a round-trip on the ghost,
   and the daily cron logs "1/2 audiences synced, 1 failed" on every run.

2. **Tag taxonomy drift.** 75 segments/tags, ~45 of them empty, across at least six
   unreconciled naming schemes (`web-*`, `legacy-*`, `sales-*`, `industry-*`,
   `customer-*`, bare event names). `newsletter-signup` (494) vs `web-newsletter` (1) vs
   `web-434media` (18) all do one job. The app also writes tags in **two conventions** —
   hyphenated (`web-434media`) in the public signup routes and colon-namespaced
   (`source:newsletter`) in parts of the promotion code — and the colon ones don't appear
   in Mailchimp at all.

3. **A transactional gray zone.** Of the "1688 total contacts": 1480 `subscribed`,
   **173 `transactional`** (present but never opted in — unmarketable), 35 `unsubscribed`,
   29 `cleaned`, 299 `archived`. The app's "% in Mailchimp" stat counts *presence*, not
   *consent*, so the 173 + 35 inflate the reachable number. This is where Mailchimp and
   Resend blur.

## Mental model (what every step serves)

- **One Mailchimp audience**, segmented by **tags** — not multiple audiences.
- **Mailchimp = marketing list of record**; status (`subscribed`/`unsubscribed`/`cleaned`)
  is the source of truth for consent. `subscribed` is the only marketable state.
- **Resend = 1:1 / transactional engine.** No audiences, no lists. Recipients are always a
  specific record (a lead, a team member).
- **The app is the sole authoritative writer of marketing tags.** Hand-tagging in the
  Mailchimp UI is off-limits; Step 6 surfaces it as drift.

## The six steps

### Step 1 — Canonical taxonomy (new file, no behavior change)
New `lib/mailchimp-tags.ts`, the single source of truth (same role `EXCLUDED_COUNTRIES`
plays for jurisdiction). Exports the dimensioned vocabulary, the old→new remap table,
`tagsForSource()`, and `isCanonicalTag()`/`assertCanonical()`.

Vocabulary (lowercase-kebab, colon-delimited):

| Dimension | Values |
|---|---|
| `brand:` | `434media`, `txmx`, `vemosvamos`, `digitalcanvas`, `aim`, `sdoh`, `salute`, `ampd` |
| `source:` | `newsletter`, `event`, `partner`, `shopify`, `sales`, `legacy-import` |
| `event:` | `sa-tech-day-2026`, `mxr`, `aim-summit`, `texas-me-summit-2026`, … |
| `status:` | `customer`, `customer-repeat`, `customer-vip`, `prospect` |

Remap (old tag → canonical): see `TAG_REMAP` in `lib/mailchimp-tags.ts` for the
authoritative table. Highlights: `techday`→`source:event`+`event:sa-tech-day`;
`newsletter-signup`→`source:newsletter`; `legacy-import`→`source:legacy-import`;
`web-aimsummit`→`brand:aim`+`source:event`+`event:aim-summit`;
`web-digitalcanvas`→`brand:digitalcanvas`; ~45 zero-count tags → deleted.

### Step 2 — Collapse the ghost audience (config + env)
Remove the `txmx` entry from `MAILCHIMP_PROPERTIES` in `lib/mailchimp-config.ts`; simplify
the default/name/validation helpers to one list; consolidate the duplicate
`MAILCHIMP_AUDIENCE_ID` and `MAILCHIMP_AUDIENCE_ID_434MEDIA` env vars. Delete
`MAILCHIMP_AUDIENCE_ID_TXMX` from `.env.local` + Vercel. The cron loop and push-modal
dropdown self-correct because they read `getAvailableMailchimpProperties()`.

### Step 3 — One-time backfill ⚠️ live, irreversible
New `scripts/mailchimp-retag.ts` (admin-gated, dry-run first). Walks all members, applies
`TAG_REMAP` (add canonical / remove retired via the member tags endpoint), then deletes
the empty + retired segments. Idempotent. **Gate: dry-run diff → explicit approval before
the live pass.**

### Step 4 — Write paths emit only canonical tags (app = sole writer)
Collapse the three near-identical newsletter routes (`/api/newsletter`,
`/api/sdoh-newsletter`, `/api/txmx-newsletter`) into one shared
`lib/newsletter-subscribe.ts(brand)` that calls `tagsForSource()`. Route event/partner
write paths through `tagsForSource()` too. Replace the free-text tag input in
`MailchimpPushModal.tsx` with a canonical multiselect; the push route rejects/remaps
non-canonical tags.

### Step 5 — Read/UI alignment
Expose member `status` through the subscriber-map API + `useMailchimpSubscribers`. In
`AudiencesHeaderStrip.tsx`, count `status === "subscribed"` for the marketable figure and
show "subscribed (marketable)" vs "present, not subscribed." Wire the new `digitalcanvas`
Firestore DB into the audience read-aggregate-dedupe pattern, mapped to
`brand:digitalcanvas`.

### Step 6 — Reconciliation check (enforces sole-writer)
New `/api/admin/mailchimp/reconcile` (optionally weekly cron). Compares canonical-tag
counts Mailchimp vs Firestore; flags any non-canonical tag in Mailchimp as drift (= someone
hand-tagged in the UI). Reports subscribed/transactional/unsubscribed so "1688" is always
explained in-app.

## Sequencing & risk

| Step | Touches | Reversible | Gate |
|---|---|---|---|
| 1 Taxonomy file | new code | yes | review remap table |
| 2 Collapse audience | config + env | yes | confirm env edit |
| 3 Backfill | **live Mailchimp** | **no** | **dry-run → approval** |
| 4 Write paths | code | yes | PR review |
| 5 Read/UI | code | yes | PR review |
| 6 Reconcile | new code | yes | — |

Alignment of existing data happens at Step 3; future-signup compliance at Step 4; the app
*shows* the aligned truth at Step 5. Steps 1–2 are prerequisites; Step 6 prevents drift.

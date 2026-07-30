---
name: outbound-compliance
description: Required checks before any surface sends email or adds contacts to an outbound audience — jurisdiction exclusion, suppression, unsubscribe, consent, and send-ledger dedupe. Use when building a broadcast, sequence, drip, prospecting export, or any new path that emails a person.
---

# Outbound compliance

434 Media does cold outbound in the US only. Every one of these checks already
exists as a module — the failure mode is a new surface that forgets to call one,
not a missing primitive. Wire them all before the first send.

## 1. Jurisdiction

No cold outreach to the EU, UK, EEA, Switzerland, or Canada (GDPR / CASL).

```ts
import { EXCLUDED_COUNTRIES } from "@/lib/prospecting/scorer"
```

`lib/prospecting/scorer.ts` is the single source of truth. Never re-list
countries in a new file. Two places enforce it and both must stay:

- The **prospecting translator** refuses to put excluded regions in Apollo
  filters, so we don't burn credits discovering unusable contacts.
- The **scorer** hard-excludes any that slip through anyway.

A model-suggested country (e.g. from lead research) is review-only. Never
auto-apply it to a lead record — the compliance gate depends on that field
being human-confirmed.

## 2. Suppression

```ts
import { isSuppressed, getSuppressedEmails } from "@/lib/firestore-suppression"
```

Check before sending. For a batch, pull `getSuppressedEmails()` once into a Set
rather than calling `isSuppressed()` per recipient. Bounces and complaints add
to suppression — treat it as permanent.

## 3. Unsubscribe

Every marketing send needs a working unsubscribe link. Tokens are HMAC-signed:

```ts
import { unsubscribeUrl, verifyUnsubscribe } from "@/lib/unsubscribe-token"
```

Generate with `unsubscribeUrl()`, verify with `verifyUnsubscribe()` on the
receiving route. Don't hand-roll a link with a raw email in the query string.

## 4. Ledger dedupe

```ts
import { getSentEmails, recordSent } from "@/lib/broadcast-ledger"
```

Keyed by campaign. Prevents double-sends when a run is retried or resumed —
which will happen, because sends are throttled and long-running. Check the
ledger before sending and record immediately after, per recipient.

## 5. Consent

Only send to contacts whose capture path implied consent. A scraped or
Apollo-sourced contact is not a subscriber: it belongs in the leads pipeline
(1:1 rep outreach), not in a broadcast audience. Don't merge prospecting output
into a Mailchimp audience.

## 6. Tags

Marketing tags come from [lib/mailchimp-tags.ts](../../../lib/mailchimp-tags.ts)
only. The app is the sole authoritative writer; inventing a tag string
elsewhere shows up as drift in reconciliation.

## Before shipping

- [ ] Excluded jurisdictions filtered via `EXCLUDED_COUNTRIES`
- [ ] Suppression checked
- [ ] Unsubscribe link present and verified end-to-end
- [ ] Ledger dedupe on both read and write
- [ ] Consent basis holds for every recipient
- [ ] Throttled — no unbounded parallel send loop
- [ ] Dry-run first; the broadcast script gates real sends behind `--apply`

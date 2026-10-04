---
name: meta-account-governance
description: Provisioning SOP, ownership record schema, and migration runbook for Meta Business Portfolios, Facebook Pages and Instagram profiles. Use when creating a social account for a 434 property, auditing who can reach one, moving assets between portfolios, or removing a departed collaborator.
---

# Meta account governance

Every Meta account for a 434 property is **company infrastructure, not a personal
account that happens to be used for work**. The distinction is the whole point of
this skill. On 2026-10-03 an audit found the flagship Instagram riding a
contributor's shared login, a second brand controlled by a departed employee who
could not be removed by any supported path, and eight stale device sessions on a
live brand — two of them active, one from another country. None of that was a
breach. It was the accumulated cost of accounts created without a provisioning
standard.

Provisioning correctly takes about ten minutes. Recovering from not doing it took
a full day.

## 1. Provisioning SOP — run this at creation, in this order

The order is load-bearing. Steps 1–3 before step 4, always.

1. **Create the Instagram account with a company email.** Never a personal
   address, never a contributor's address. The address must survive staff
   turnover.
2. **Add a recovery phone the founder controls, and confirm it.** An unconfirmed
   number is worthless — Meta labels it `Limited use` and will not accept it for
   recovery. Confirm it immediately.
3. **Add a recovery email the company controls, and confirm it.** Two independent
   routes back in is the minimum. One is a single point of failure.
4. **Set a unique password and store it in LastPass** under the item name
   recorded in the account record (§3). Never reuse a password across brands.
5. **Enable two-factor authentication** on the account.
6. **Do not add the account to a personal Accounts Center.** This is the trap
   that caused the TXMX incident — see §5.
7. **Connect the Instagram to its Facebook Page**, then add both to the
   **434 MEDIA** portfolio (`985756573340640`), not to a per-brand portfolio.
8. **Write the account record** (§3) before announcing the account exists.

## 2. Access grants — the standing rules

- Collaborators get **Partial access**, scoped to the assets they work on. Full
  access is for the founder only.
- Grant **Content** for posting. Withhold **Ads** unless the person is actually
  buying media — Ads carries payment-method reach.
- Grant through the **portfolio**, never directly on the Page. A direct-on-Facebook
  Page grant is invisible to Business Settings and is the hardest thing here to
  find or remove (§5).
- Every grant is recorded in the account record with a reason and a review date.
- When someone leaves, removal is immediate and verified on a second surface (§6).

## 3. The account record

One document per asset, written at provisioning and updated on every change. This
is the dashboard's data source. Store it in a single canonical Firestore
collection, consistent with the project's Firestore-is-the-source-of-truth rule —
see `.claude/skills/firestore-collection/SKILL.md` for collection conventions.

**Never store a secret in this record.** It stores the *location* of a credential,
never the credential. No passwords, no recovery codes, no tax IDs, no full payment
numbers. The repository is public.

```json
{
  "assetId": "17841468134446798",
  "assetType": "instagram_profile",
  "handle": "@txmxboxing",
  "displayName": "TXMX Boxing",
  "property": "TXMX Boxing",
  "portfolioId": "985756573340640",
  "portfolioName": "434 MEDIA",
  "connectedAssetId": "385308644661769",
  "credentialLocation": { "vault": "LastPass", "itemName": "IG — TXMX Boxing" },
  "recovery": {
    "phoneConfirmed": true,
    "emailConfirmed": true,
    "emailAccount": "434mediamgr@gmail.com",
    "twoFactorEnabled": false
  },
  "accountsCenter": { "standalone": true, "sharedWith": [] },
  "people": [
    { "name": "Marcos Resendez", "identity": "facebook", "access": "full",
      "reason": "founder", "grantedAt": "2026-10-03", "reviewBy": "2027-04-03" }
  ],
  "connectedAdAccountIds": ["1193288912580408"],
  "lastAudited": "2026-10-03",
  "auditFindings": []
}
```

Fields the dashboard should surface as alerts, because each one is a real failure
mode observed in the audit:

| Condition | Why it matters |
|---|---|
| `recovery.phoneConfirmed` false | Meta will not accept the number; there is no route back in |
| `recovery.emailConfirmed` false | Single recovery route |
| `twoFactorEnabled` false | Account rests on a password alone |
| `accountsCenter.standalone` false | Someone else's login reaches this account |
| any person with `access: "full"` who is not the founder | Over-grant |
| `reviewBy` in the past | Stale grant, nobody re-confirmed it |
| `lastAudited` older than 6 months | Drift |

## 4. What an agent can and cannot do

This is a **co-pilot runbook**. Permissions do not change the second column —
these are structural.

| Agent does | Human must do |
|---|---|
| Navigate to the exact screen | Enter any password |
| Read every dialog before confirming | Complete Instagram login popups (they open outside the agent's tab group) |
| Remove people, change permissions, rename, assign | Choose files in OS pickers |
| Verify after every change | Accept Meta Commercial Terms |
| Maintain the audit log | Satisfy device-trust gates |

Meta blocks session management and password changes from a device it does not
recognise: *"we noticed you are using a device you don't usually use."* It will
block the founder too. Expect it and use a known device.

## 5. Where the controls actually live

Most of the audit cost was discovery. These are not where you would look.

- **Accounts Center** (`accountscenter.instagram.com`) governs shared login and
  recovery and is **invisible from Business Suite**. An account can look clean in
  Business Settings while someone else's login reaches it. Check
  `/profiles/`, `/personal_info/contact_points/`, `/manage/`.
- **Contact points are per-profile.** Open each one to see which accounts it
  unlocks; the banner "use any of them to access any profiles" overstates it.
- **Disconnecting a Page from an Instagram** is on the **Facebook Page only** —
  switch into the Page, Settings & privacy, search "Instagram", Linked accounts.
  It is not in Business Suite and not in Instagram web.
- **Direct-on-Facebook Page grants** appear only in the portfolio People page's
  suggestion banner → *View all suggested people* → `...` → **Remove access**.
  Business Settings asset tabs do not show them, and neither does the Page's own
  access screen.
- **Instagram re-authentication** ("Login needed") is cleared by the **Log in
  button on the asset panel**, not by signing in at instagram.com.
- **Login activity** is at Accounts Center → Password and security → Where you're
  logged in. Check it during every audit.

## 6. Verification discipline

**Confirm every change on a second surface before recording it as done.**

During the audit a Page access screen rendered an empty section and I reported a
collaborator removed. They were not — a banner elsewhere still showed their
access. An empty-looking section is not evidence of absence.

Also: Business Suite pages cache aggressively. A removal that appears to have
failed has often succeeded. **Reload before retrying**, or you will repeat a
destructive action.

## 7. Migration runbook — moving a brand into 434 MEDIA

An asset belongs to exactly one portfolio. Moving means remove then claim, and a
Page cannot be removed while an Instagram is connected to it.

1. Facebook: switch into the Page → Settings & privacy → Linked accounts →
   **Disconnect account**. Posts are unaffected; ads insights are lost.
2. Source portfolio → Pages → **Remove**.
3. 434 MEDIA → Pages → Add → **Add an existing Facebook Page**. Verify the asset
   ID in the picker before confirming. Human ticks Commercial Terms.
4. Source portfolio → Instagram profiles → **Remove**. Reload to confirm.
5. 434 MEDIA → Instagram profiles → Add → **Add an Instagram profile**. Human
   completes the login popup.
6. 434 MEDIA → **Assign people** → founder → Full access. Re-read the member list
   every time; its row order changes as the portfolio grows.
7. Reconnect the Instagram to the Page from the Page's Linked accounts.
8. Re-grant collaborators — assignments do **not** survive a migration.

**A migration severs connection-derived access.** Anyone whose access rode the
Page↔Instagram connection loses it, including holders Business Suite refuses to
remove directly. That is the supported way past an immutable creator assignment.

## 8. Ordering rules that are not optional

- **Recovery before password.** Rotate a password before confirming recovery
  contacts and a failed login locks you out permanently.
- **Log out sessions, then rotate the password.** Reversed, anyone holding the old
  credential signs back in. A password change often clears sessions globally —
  verify rather than assume.
- **Disconnect before move.** Meta refuses the removal otherwise.
- **Claim immediately after removing.** Do not leave an asset unowned.

## 9. Known traps

- The **creator** of an Instagram profile holds an immutable "full control"
  assignment on the business asset: *"This can't be changed."* It also blocks
  removing them from the connected Page. It does **not** travel with a migrated
  asset — the asset arrives with zero people.
- A **business invite must be accepted with a Facebook login.** An
  Instagram-only identity can never accept one. Confirm the person has a Facebook
  account before inviting.
- **An email on the founder's own Facebook profile is not a separate account.**
  Test with a password-reset lookup in a private window before planning around it.
- **Portfolio names are display only.** Everything binds by ID; renaming breaks
  nothing, including Shopify and pixel connections.
- Brand logos in `public/brand/` are wide format. A profile picture needs a square
  composite — never upload the raw file.

# CRM draft visibility regression checks

Install with the repository's pinned pnpm version (`pnpm install --frozen-lockfile`).
The existing test convention uses `tsx --test` (installed globally in CI, or
available via `pnpm dlx tsx`). These checks do not require production credentials.

## Offline React DOM checks

```sh
pnpm dlx tsx --test lib/__tests__/content-post-navigation.test.ts lib/__tests__/content-post-date.test.ts
```

The tests render the actual hook and page, mocking only the router, visual child
components and HTTP responses. They cover empty/stale lists, direct ID recovery,
archive/not-found responses, newer opens, Close, save, Back/Forward, unmount, and a
transport that ignores abort. The form test renders the actual controlled drawer,
fills the date while an upload is pending, rerenders, finishes the upload, saves,
checks the outgoing saved date and reopens the returned record.

## Real Firestore emulator check

Start a local Firestore emulator with a disposable demo project. One option is
the official standalone emulator (Java 21 or newer):

```sh
curl -fL https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.20.2.jar -o /tmp/crm-firestore-emulator.jar
java -jar /tmp/crm-firestore-emulator.jar --host=127.0.0.1 --port=8787 --project_id=demo-crm-drafts
```

In another terminal:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8787 pnpm dlx tsx --test lib/__tests__/content-posts-emulator.test.ts
```

This test requires a loopback emulator host and hardcodes the `demo-crm-drafts`
project. It clears only that emulator project's content-post fixture collection.
Without `FIRESTORE_EMULATOR_HOST` it is explicitly skipped, not a passing emulator
check. It first demonstrates the old Firestore `orderBy` omitting a document with
no date, then tests the production create/list/direct-read functions, persisted
date, cache invalidation, archive filtering and descending date/ID ordering.

No migration or fabricated date is needed: ordinary drafts can stay undated.
Clearing an existing date is a separate pre-existing omission-semantics issue;
this repair does not change that behavior or the controlled date handler.

These tests are runnable locally; this change does not modify CI or deployment
configuration. The repository's required `verify` check still has its existing
coverage and should not be represented as having run these new checks.

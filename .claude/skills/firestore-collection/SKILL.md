---
name: firestore-collection
description: Conventions for lib/firestore-*.ts data modules — normalization, the 30s list cache, timestamp coercion, and where collection names live. Use when adding a Firestore-backed collection, adding a field to an existing record type, or debugging stale reads in the admin UI.
---

# Firestore data modules

Every collection gets one module at `lib/firestore-<thing>.ts`. Routes and
components never call `getDb()` directly — they go through the module, because
that is where normalization and cache invalidation live.

## Collection names

Declared once in `CRM_COLLECTIONS` ([types/crm-types.ts](../../../types/crm-types.ts)),
never inlined as string literals:

```ts
import { CRM_COLLECTIONS } from "../types/crm-types"
const COLLECTION = CRM_COLLECTIONS.LEADS
```

## Module shape

```ts
const CACHE_TTL = 30 * 1000
let listCache: { data: Thing[]; ts: number } | null = null

function invalidate(): void { listCache = null }

function normalize(id: string, raw: FirebaseFirestore.DocumentData): Thing { ... }
```

Three rules that matter:

**Normalize on read, don't migrate.** Documents written by older code, by hand,
or by a named database carry inconsistent shapes. `normalize()` coerces them at
read time and fills defaults. This is deliberate — the app reads named
databases directly and normalizes rather than backfilling them.

**Coerce timestamps through a helper.** A field may be an ISO string, a `Date`,
a Firestore `Timestamp`, or a `{toDate()}`-shaped object depending on who wrote
it. Use the module's `toIsoString()` pattern; never call `.toDate()` bare.

**Invalidate on every write.** Any create/update/delete calls `invalidate()`
before returning. Skipping it is the usual cause of "I saved it but the table
still shows the old value" — the read is served from the 30s cache.

## Adding a field

1. Add it to the type in `types/crm-types.ts`.
2. Handle it in `normalize()` **with a default** — existing documents won't have
   it, and an undefined leaking into the UI renders as blank or crashes a sort.
3. Add it to the create/update input types so writers can set it.

Firestore rejects `undefined` values. Strip them before writing rather than
passing a partially-populated object through.

## Don't

- Don't add a new top-level collection when an existing record could carry the
  field. The CRM was consolidated *down* to single sources of truth on purpose.
- Don't assume a field is dead because the type looks unused. `is_opportunity`,
  `disposition`, and `doc` on a task are load-bearing in the kanban.

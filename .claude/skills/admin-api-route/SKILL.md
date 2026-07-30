---
name: admin-api-route
description: Conventions for adding or editing a route under app/api/admin/. Use when creating an admin endpoint, adding auth to a route, or wiring an admin action to Firestore. Covers the requireAdmin gate, error/status contract, cache invalidation, and activity logging.
---

# Admin API routes

Every route under `app/api/admin/` is admin-only and follows the same shape.
There is no shared middleware — each route declares its own gate, and 63 routes
currently repeat it verbatim. Match it exactly rather than inventing a variant.

## The gate

```ts
import { getSession, isAuthorizedAdmin } from "@/lib/auth"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}
```

Called at the top of every handler, before reading params or body:

```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params
  // ...
}
```

`ctx.params` is a Promise in this Next version — always `await` it.

## Status contract

| Status | Meaning |
|---|---|
| 401 | No session |
| 403 | Session exists, not an authorized admin |
| 404 | Record genuinely absent |
| 400 | Caller-supplied input is unusable |
| 502 | Upstream (AI Gateway, Apollo, Mailchimp, Resend) failed |
| 500 | Our persistence failed |

Keep the upstream/persistence split — a rep retrying a 502 is meaningful, a 500
is a bug. Log with a `[METHOD /path]` prefix before returning either.

## Runtime

Routes touching Firebase Admin, Node crypto, or the AI Gateway need:

```ts
export const runtime = "nodejs"
export const maxDuration = 60   // only when calling a model or a slow upstream
```

## After a write

Firestore modules keep a 30s in-memory list cache. A write through a
`lib/firestore-*.ts` helper invalidates it for you; a write issued directly
against `getDb()` does not — prefer the helper.

For anything a human would want a trail of, append an activity event and never
let it fail the request:

```ts
await appendLeadActivity(id, {
  type: "draft_generated",
  actor: auth.session.email,
  detail: "Generated outreach draft",
}).catch(() => {})
```

## Public routes are different

Anything reachable without a session (contact forms, signups, public intake)
goes through `requireHumanRequest()` from `@/lib/botid-guard` instead. Don't use
`requireAdmin` there, and don't leave a public write ungated.

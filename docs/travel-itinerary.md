# Travel itinerary surface

The `/travel/` route family is the protected delivery surface for project travel. A route uses:

`/travel/{client-purpose-year}/{traveler}`

For the current project: `/travel/bvc-agm-2026/aj`.

## Source and access

- Airtable is the live operational source for the 2026 Builders VC AGM itinerary.
- `AIRTABLE_TOKEN` is server-only. It must never use a `NEXT_PUBLIC_` prefix.
- 434 staff with a valid admin session can open protected travel routes.
- External viewers authenticate through Firebase email/password and must also have an active `travel_access` Firestore record for the exact project and traveler.
- Travel access does not grant access to `/admin`.

## Provision a viewer

With the Vercel environment pulled locally, run:

```bash
pnpm exec tsx scripts/provision-travel-viewer.ts \
  --email viewer@example.com \
  --name "Viewer Name" \
  --project bvc-agm-2026 \
  --traveler aj
```

The command creates or reuses the Firebase user, writes the scoped Firestore access record, and prints a one-time password setup link. Share that link only with the named viewer.

## Runtime behavior

- The first render is server-side and uncached.
- The client refreshes Airtable data every 60 seconds while open.
- Editor notes write to the Airtable `Editor Notes` table and are linked to the filming-intake record.
- Private itinerary data is not committed to this public repository.

## Project configuration

Non-sensitive route identity, dates, and route-stop labels live in `lib/travel/projects.ts`. Add a project there instead of hand-keying route strings in page components.

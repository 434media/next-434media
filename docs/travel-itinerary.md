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

Pull the production environment first:

```bash
pnpm dlx vercel env pull .env.local --environment=production
```

Then run the script. Three details that are easy to get wrong:

- **`npx`, not `pnpm exec`** — `tsx` is not a project dependency, so `pnpm exec` cannot find it.
- **The service-account key must be unwrapped.** `vercel env pull` writes `GOOGLE_SERVICE_ACCOUNT_KEY="{"type":…}"` — raw JSON inside quotes, inner quotes unescaped — so every dotenv parser stops at the second quote and the key arrives as `{`. Production never sees this, because Vercel injects the value with no file parsing in between.
- **Delete `.env.local` when finished.** It holds a real Firebase service-account key.

```bash
GOOGLE_SERVICE_ACCOUNT_KEY="$(sed -n 's/^GOOGLE_SERVICE_ACCOUNT_KEY=//p' .env.local | sed 's/^"//; s/"$//')" \
  npx --yes tsx scripts/provision-travel-viewer.ts \
  --email viewer@example.com \
  --name "Viewer Name" \
  --project bvc-agm-2026 \
  --traveler aj \
  --firestore-only
```

### Roles

- `--role traveler` — the person the itinerary belongs to, plus anyone at 434 who needs their working notes. Sees and writes editor notes.
- `--role viewer` (default) — the client and anyone else provisioned against the page. Schedule only; editor notes never render and the notes endpoint returns 403.

Anything unset reads as `viewer`, so a mistake fails closed.

### Why `--firestore-only`

Creating a Firebase user and minting a password link requires the **Firebase Authentication Admin** role. The credential that publishes media and writes Firestore does not hold it, and granting it would turn a media key into one that can create identities in the project.

The narrow path instead:

1. Create the user by hand: Firebase Console → Authentication → **Add user**, email only.
2. Run the command above with `--firestore-only`. It writes the scoped access record and nothing else.
3. Send them the page link. They set their own password through **"Forgot password?"** on `/travel/sign-in`.

Nothing that grants account access travels by email.

Without the flag the script creates the user and prints a one-time setup link, which requires the Authentication Admin role and fails with `auth/insufficient-permission` otherwise.

## Runtime behavior

- The first render is server-side and uncached.
- The client refreshes Airtable data every 60 seconds while open.
- Editor notes write to the Airtable `Editor Notes` table and are linked to the filming-intake record.
- Private itinerary data is not committed to this public repository.

## Project configuration

Non-sensitive route identity, dates, and route-stop labels live in `lib/travel/projects.ts`. Add a project there instead of hand-keying route strings in page components.

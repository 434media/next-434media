/**
 * Mark Rise of a Champion (RiseOfAChampion2026) attendees as opted in.
 *
 * The Ride of a Champion / TXMX Boxing team confirmed (2026-06-03) that every
 * attendee opted in to communication from TXMX Boxing and the 434 Media
 * network. Their registrations were captured with subscribeToFeed=false, so the
 * consent engine (mailchimpIntentForEventRegistration) excluded them from both
 * broadcasts and Mailchimp auto-sync. This flips subscribeToFeed=true on those
 * default-DB docs and stamps the consent provenance.
 *
 * DRY-RUN BY DEFAULT (counts only). Pass --apply to write.
 *   npx tsx --env-file=.env.local scripts/optin-rise-of-a-champion.ts
 *   npx tsx --env-file=.env.local scripts/optin-rise-of-a-champion.ts --apply
 */
import { getDb, COLLECTIONS } from "../lib/firebase-admin"

const APPLY = process.argv.includes("--apply")
const EVENT = "RiseOfAChampion2026"
const CONFIRMED_BY = "ride-of-a-champion + txmx team (verbal, 434mediamgr)"
const CONFIRMED_AT = "2026-06-03"

async function main() {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.EVENT_REGISTRATIONS).where("event", "==", EVENT).get()

  const total = snap.size
  const toFlip = snap.docs.filter((d) => d.data().subscribeToFeed !== true)
  const already = total - toFlip.length

  console.log(`\n${APPLY ? "🔴 APPLY" : "🟢 DRY-RUN"} — event "${EVENT}"`)
  console.log(`Registrations: ${total} | already opted in: ${already} | to flip: ${toFlip.length}\n`)

  if (!APPLY) {
    console.log(`🟢 Dry-run — ${toFlip.length} would be set subscribeToFeed=true. Re-run with --apply.\n`)
    return
  }

  let updated = 0
  // Firestore batches cap at 500 writes; chunk to be safe.
  for (let i = 0; i < toFlip.length; i += 400) {
    const batch = db.batch()
    for (const doc of toFlip.slice(i, i + 400)) {
      batch.update(doc.ref, {
        subscribeToFeed: true,
        subscribeToFeedConfirmedBy: CONFIRMED_BY,
        subscribeToFeedConfirmedAt: CONFIRMED_AT,
      })
      updated++
    }
    await batch.commit()
  }
  console.log(`✅ Set subscribeToFeed=true on ${updated} ${EVENT} registrations.\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

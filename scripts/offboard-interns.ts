/**
 * Cohort offboarding: revoke admin-portal access for every `intern` on the
 * roster at the end of a cohort.
 *
 * Two levers, in this order:
 *   1. DELETE their `crm_team_members` doc. This is the real gate —
 *      `authorizeAdminSignIn` (lib/auth.ts) refuses a session to anyone without
 *      an active roster record, so a deleted record means no admin session can
 *      ever be minted for that email again.
 *   2. DISABLE their Firebase Auth user. Belt and braces: the Firebase project
 *      is shared across every 434 web property, so the credential itself should
 *      stop working, not just its admin mapping.
 *
 * Deleting the roster doc orphans the name behind any cohort task, comment or
 * painpoint they authored (those store the email, and the roster is what turned
 * it into a display name). So the script writes a full JSON snapshot of every
 * doc it is about to delete BEFORE deleting — that file is both the name→email
 * mapping and the restore path.
 *
 * SAFETY: dry-run by default; prints the exact plan and writes nothing until
 * you pass --apply. Super admins, full admins and crm_only staff are never
 * touched — only `role === "intern"`.
 *
 *   npx tsx scripts/offboard-interns.ts            # preview
 *   npx tsx scripts/offboard-interns.ts --apply    # delete + disable
 *
 * NOTE: already-signed-in interns keep their session cookie until it expires
 * (24h max). To cut every session immediately, rotate ADMIN_SESSION_SECRET —
 * that logs out staff too.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

// `node --env-file` mis-parses the double-quote-wrapped JSON blob in .env.local
// (it stops at the first inner quote), so load the env by hand.
function loadEnv(path = ".env.local") {
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch {
    console.error(`Could not read ${path} — run this from the repo root.`)
    process.exit(1)
  }
  for (const line of raw.split("\n")) {
    const eq = line.indexOf("=")
    if (eq < 0 || line.trimStart().startsWith("#")) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

const COLLECTION = "crm_team_members"

// Emails carrying role="intern" that are NOT cohort interns and must survive an
// offboarding run. jesseovr@ is an owner test account — disabling its Firebase
// user would break every other 434 property it signs into.
const SKIP_EMAILS = ["jesseovr@gmail.com"].map((e) => e.toLowerCase())

const APPLY = process.argv.includes("--apply")
const BACKUP_PATH = resolve("backups/offboard-interns-snapshot.json")

async function main() {
  const { getDb } = await import("../lib/firebase-admin")
  const admin = (await import("firebase-admin")).default

  const db = getDb()
  const snap = await db.collection(COLLECTION).get()
  if (snap.empty) {
    console.log("No team members found.")
    return
  }

  const allInterns = snap.docs.filter((d) => (d.data() as { role?: string }).role === "intern")
  const skipped = allInterns.filter((d) =>
    SKIP_EMAILS.includes(((d.data() as { email?: string }).email || "").toLowerCase()),
  )
  const interns = allInterns.filter((d) => !skipped.includes(d))
  const kept = snap.docs.length - interns.length

  const w = (s: string, n: number) => s.padEnd(n)
  console.log(`\n${APPLY ? "APPLYING — deleting roster docs + disabling Firebase users" : "DRY-RUN — no writes (pass --apply)"}\n`)

  if (!interns.length) {
    console.log(`No records with role="intern". ${kept} staff record(s) untouched — nothing to do.`)
    return
  }

  console.log(w("EMAIL", 38) + w("SQUAD", 16) + "NAME")
  console.log("-".repeat(80))
  for (const doc of interns) {
    const d = doc.data() as { email?: string; squad?: string; name?: string }
    console.log(w(d.email || "(no email)", 38) + w(d.squad || "-", 16) + (d.name || ""))
  }
  console.log(`\n${interns.length} intern record(s) to remove · ${kept} record(s) untouched`)
  if (skipped.length) {
    console.log("\nSkipped (on SKIP_EMAILS — kept as-is):")
    skipped.forEach((d) => console.log(`   ${(d.data() as { email?: string }).email}`))
  }
  console.log("")

  if (!APPLY) {
    console.log(`Preview only. Re-run with --apply to delete these records,\nsnapshot them to ${BACKUP_PATH}, and disable their Firebase Auth users.`)
    return
  }

  // 1. Snapshot BEFORE deleting — this is the only copy of the name→email
  //    mapping once the roster docs are gone.
  const backup = interns.map((doc) => ({ id: doc.id, data: doc.data() }))
  mkdirSync(dirname(BACKUP_PATH), { recursive: true })
  writeFileSync(BACKUP_PATH, JSON.stringify({ collection: COLLECTION, removedAt: new Date().toISOString(), records: backup }, null, 2))
  console.log(`Snapshot written: ${BACKUP_PATH} (${backup.length} record(s))`)

  // 2. Disable the Firebase Auth user first. If this fails we still have the
  //    roster doc in place to identify who was missed; a stray disabled user
  //    with a live roster doc is the safer half-state than the reverse.
  const auth = admin.auth()
  let disabled = 0
  let notFound = 0
  const authFailures: string[] = []
  for (const doc of interns) {
    const email = (doc.data() as { email?: string }).email
    if (!email) continue
    try {
      const user = await auth.getUserByEmail(email)
      if (user.disabled) {
        console.log(`   already disabled: ${email}`)
      } else {
        await auth.updateUser(user.uid, { disabled: true })
        disabled++
      }
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === "auth/user-not-found") {
        notFound++
      } else {
        authFailures.push(`${email}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // 3. Delete the roster docs.
  const batch = db.batch()
  for (const doc of interns) batch.delete(doc.ref)
  await batch.commit()

  console.log(`\nFirebase Auth: ${disabled} disabled · ${notFound} had no auth user · ${authFailures.length} failed`)
  if (authFailures.length) authFailures.forEach((f) => console.log(`   ⚠ ${f}`))
  console.log(`Firestore: deleted ${interns.length} ${COLLECTION} record(s).`)
  console.log(`\nDone. Signed-in interns keep their session cookie until it expires (24h max);\nno new session can be issued to them.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

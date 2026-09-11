/**
 * Add someone to the admin roster (`crm_team_members`).
 *
 * The roster doc IS the admin gate — `authorizeAdminSignIn` refuses a session
 * to anyone without an ACTIVE record — so this is what grants access.
 *
 * Why this exists alongside the settings UI: POST /api/admin/team-members
 * rejects any address that is not @434media.com, so the UI cannot add an
 * external collaborator. (The cohort interns predate that check; they arrived
 * through the auto-registration path that was later removed.) PATCH has no such
 * restriction, so a record created here is fully editable in the UI afterwards.
 *
 * NOTE this grants AUTHORIZATION only. The person also needs a Firebase Auth
 * account (email/password) to authenticate with — created in the Firebase
 * Console. Without it there is nothing to sign in with.
 *
 * SAFETY: dry-run by default.
 *
 *   npx tsx scripts/add-team-member.ts --email=x@y.com --name="X Y" --role=crm_only
 *   npx tsx scripts/add-team-member.ts ... --apply
 */
import { readFileSync } from "node:fs"

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const eq = line.indexOf("="); if (eq < 0 || line.trimStart().startsWith("#")) continue
  const k = line.slice(0, eq).trim(); let v = line.slice(eq + 1).trim()
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
  if (!process.env[k]) process.env[k] = v
}

const COLLECTION = "crm_team_members"
const VALID_ROLES = ["crm_super_admin", "full_admin", "crm_only", "intern"]
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=")
const APPLY = process.argv.includes("--apply")

async function main() {
  const email = (arg("email") || "").trim().toLowerCase()
  const name = (arg("name") || "").trim()
  const role = (arg("role") || "crm_only").trim()

  if (!email || !name) { console.error("--email and --name are required."); process.exit(1) }
  if (!VALID_ROLES.includes(role)) { console.error(`--role must be one of: ${VALID_ROLES.join(", ")}`); process.exit(1) }

  const { getDb } = await import("../lib/firebase-admin")
  const db = getDb()

  const existing = await db.collection(COLLECTION).where("email", "==", email).limit(1).get()
  if (!existing.empty) {
    console.log(`\nAlready on the roster — nothing to do:\n`, JSON.stringify(existing.docs[0].data(), null, 2))
    return
  }

  const now = new Date().toISOString()
  const record = { name, email, isActive: true, role, created_at: now, updated_at: now }

  console.log(`\n${APPLY ? "APPLYING" : "DRY-RUN — no writes (pass --apply)"}\n`)
  console.log(JSON.stringify(record, null, 2))
  if (!APPLY) { console.log("\nPreview only. Re-run with --apply to write."); return }

  const ref = await db.collection(COLLECTION).add(record)
  console.log(`\nCreated ${COLLECTION}/${ref.id}`)
  console.log("Authorization granted. They still need a Firebase Auth account to sign in with.")
}

main().catch((e) => { console.error(e); process.exit(1) })

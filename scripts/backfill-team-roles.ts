/**
 * One-off (Section 1.0): backfill the `role` field on every crm_team_members
 * record so the upcoming login role-resolution (Section 1.3) can read roles from
 * Firestore. Staff resolve to their explicit role; everyone else — the cohort
 * interns — defaults to `intern`.
 *
 * SAFETY: dry-run by default. It prints the full plan and never writes until you
 * pass --apply. Anyone about to become `intern` is listed prominently so you can
 * spot a staffer you forgot to add to FULL_ADMIN_EMAILS *before* applying.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-team-roles.ts          # preview
 *   npx tsx --env-file=.env.local scripts/backfill-team-roles.ts --apply  # write
 *
 * Run this BEFORE flipping the provider fallback in 1.3 — otherwise a record-less
 * staffer would drop to `intern` on next login.
 */
import { getDb } from "../lib/firebase-admin"

type AdminRole = "crm_super_admin" | "full_admin" | "crm_only" | "intern"
const COLLECTION = "crm_team_members"

// ─── CONFIG — edit before running ────────────────────────────────────────────
// Owners. Matches CRM_SUPER_ADMIN_FALLBACK in lib/auth.ts.
const SUPER_ADMIN_EMAILS = ["marcos@434media.com", "jesse@434media.com"]

// ⚠ LIST EVERY STAFF MEMBER who should keep send/publish/approve power here,
// BEFORE --apply. Anyone not listed (and without an explicit role already) will
// be set to `intern`. The dry-run shows you exactly who that hits.
const FULL_ADMIN_EMAILS: string[] = [
  // "stacy@434media.com",
  // "barb@434media.com",
  // ...add the rest of the full team...
]

// Staff who keep CRM access but NOT send/publish/approve power (crm_only).
const CRM_ONLY_EMAILS: string[] = [
  "guna@434media.com",
]
// ─────────────────────────────────────────────────────────────────────────────

const APPLY = process.argv.includes("--apply")
const lower = (s: string) => s.trim().toLowerCase()
const SUPER = new Set(SUPER_ADMIN_EMAILS.map(lower))
const FULL = new Set(FULL_ADMIN_EMAILS.map(lower))
const CRM_ONLY = new Set(CRM_ONLY_EMAILS.map(lower))
const VALID_ROLES: AdminRole[] = ["crm_super_admin", "full_admin", "crm_only", "intern"]

/**
 * Resolve the role a record SHOULD have:
 *  - config super/full lists win (authoritative for staff)
 *  - an existing valid role is kept (already explicit — leave it alone)
 *  - otherwise → intern (cohort interns, or unlisted staff you still need to add)
 */
function targetRole(email: string, current?: string): AdminRole {
  const e = lower(email)
  if (SUPER.has(e)) return "crm_super_admin"
  if (FULL.has(e)) return "full_admin"
  if (CRM_ONLY.has(e)) return "crm_only"
  if (current && VALID_ROLES.includes(current as AdminRole)) return current as AdminRole
  return "intern"
}

async function main() {
  if (FULL_ADMIN_EMAILS.length === 0) {
    console.log(
      "\n⚠  FULL_ADMIN_EMAILS is empty. Any staff member without an explicit role\n" +
        "   already set will be planned as `intern`. Review the dry-run carefully\n" +
        "   and add real staff to the list before --apply.\n",
    )
  }

  const db = getDb()
  const snap = await db.collection(COLLECTION).get()
  if (snap.empty) {
    console.log("No team members found.")
    return
  }

  type Row = { id: string; email: string; current: string; next: AdminRole; action: "set" | "keep" | "skip" }
  const rows: Row[] = snap.docs.map((doc) => {
    const d = doc.data() as { email?: string; role?: string }
    const email = d.email || ""
    const current = d.role || "(none)"
    if (!email) return { id: doc.id, email: "(no email)", current, next: "intern", action: "skip" }
    const next = targetRole(email, d.role)
    return { id: doc.id, email, current, next, action: next === d.role ? "keep" : "set" }
  })

  const w = (s: string, n: number) => s.padEnd(n)
  console.log(`\n${APPLY ? "APPLYING WRITES" : "DRY-RUN — no writes (pass --apply to write)"}\n`)
  console.log(w("EMAIL", 36) + w("CURRENT", 16) + w("→ TARGET", 16) + "ACTION")
  console.log("-".repeat(82))
  for (const r of [...rows].sort((a, b) => a.action.localeCompare(b.action) || a.email.localeCompare(b.email))) {
    console.log(w(r.email, 36) + w(r.current, 16) + w("→ " + r.next, 16) + r.action.toUpperCase())
  }

  const sets = rows.filter((r) => r.action === "set")
  const toIntern = sets.filter((r) => r.next === "intern")
  const skipped = rows.filter((r) => r.action === "skip")
  console.log(
    `\n${sets.length} to set · ${rows.filter((r) => r.action === "keep").length} already correct · ${skipped.length} skipped (no email)\n`,
  )
  if (toIntern.length) {
    console.log("→ Will be set to INTERN (confirm none of these are staff):")
    toIntern.forEach((r) => console.log(`   ${r.email}`))
    console.log("")
  }

  if (!APPLY) {
    console.log("Preview only. Re-run with --apply to write the SET rows.")
    return
  }

  let written = 0
  for (const r of sets) {
    await db.collection(COLLECTION).doc(r.id).update({ role: r.next, updated_at: new Date().toISOString() })
    written++
  }
  console.log(`✅ Wrote role on ${written} record(s). Skipped ${skipped.length} (no email).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

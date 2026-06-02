/**
 * One-time import: AIM 2026 attendee report (.xlsx) → default-DB
 * event_registrations. Consent confirmed for all attendees, so subscribeToFeed
 * is true — the hourly mailchimp-push cron will then sync them as subscribed
 * under brand:aim.
 *
 * DRY-RUN BY DEFAULT (no writes). Pass --apply to write.
 *   npx tsx --env-file=.env.local scripts/import-aim2026.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/import-aim2026.ts --apply  # live
 *
 * Idempotent: skips any email already present for this event.
 */
import * as XLSX from "xlsx"
import * as fs from "fs"
import { getDb, COLLECTIONS } from "../lib/firebase-admin"

XLSX.set_fs(fs)

const APPLY = process.argv.includes("--apply")
const FILE = "./_aim2026_import.xlsx"
const EVENT = "AIMSummit2026"
const EVENT_NAME = "AIM 2026"
const EVENT_DATE = "2026-05-19"
const SOURCE = "web-aimsummit"

const slug = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

interface RegDoc {
  email: string
  firstName: string
  lastName: string
  fullName: string
  company: string | null
  title: string | null
  location: string | null
  subscribeToFeed: boolean
  event: string
  eventName: string
  eventDate: string
  registeredAt: string
  source: string
  tags: string[]
  enrichmentSource: string
  enrichedAt: string
}

async function main() {
  const wb = XLSX.readFile(FILE)
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
  })

  const byEmail = new Map<string, RegDoc>()
  let noEmail = 0
  const now = new Date().toISOString()

  for (const r of rows) {
    const email = String(r["Email"] ?? "").toLowerCase().trim()
    if (!email || !email.includes("@")) {
      noEmail++
      continue
    }
    const ticket = String(r["Ticket Type (optional)"] ?? "").trim()
    const category = String(r["Attendee Category (optional)"] ?? "").trim()
    const tagSet = new Set(["site:aim", "event:aim-summit-2026", "role:attendee"])
    // Ticket Type is a single label (its name can contain commas, e.g.
    // "Academic, Government & Military Ticket") — slug as one tag. Attendee
    // Category IS a comma/semicolon list — split so a "Speakers, Sponsors"
    // attendee matches both category:speakers and category:sponsors.
    if (ticket) tagSet.add(`ticket:${slug(ticket)}`)
    for (const c of category.split(/[,;]/).map((s) => slug(s)).filter(Boolean)) tagSet.add(`category:${c}`)
    const tags = [...tagSet]

    byEmail.set(email, {
      email,
      firstName: String(r["First Name"] ?? "").trim(),
      lastName: String(r["Last Name"] ?? "").trim(),
      fullName: String(r["Full Name"] ?? "").trim(),
      company: String(r["Company (optional)"] ?? "").trim() || null,
      title: String(r["Position (optional)"] ?? "").trim() || null,
      location: String(r["Location (optional)"] ?? "").trim() || null,
      subscribeToFeed: true,
      event: EVENT,
      eventName: EVENT_NAME,
      eventDate: EVENT_DATE,
      registeredAt: EVENT_DATE,
      source: SOURCE,
      tags,
      enrichmentSource: "csv",
      enrichedAt: now,
    })
  }

  // Existing registrations for this event (idempotency).
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.EVENT_REGISTRATIONS).where("event", "==", EVENT).get()
  const existing = new Set(snap.docs.map((d) => String(d.data().email ?? "").toLowerCase()))

  const toCreate = [...byEmail.values()].filter((d) => !existing.has(d.email))
  const skipExisting = byEmail.size - toCreate.length

  console.log(`\n${APPLY ? "🔴 APPLY" : "🟢 DRY-RUN"} — event ${EVENT} (${EVENT_NAME}, ${EVENT_DATE})\n`)
  console.log(`Sheet rows:            ${rows.length}`)
  console.log(`No / invalid email:    ${noEmail}`)
  console.log(`Unique emails:         ${byEmail.size}`)
  console.log(`Already in DB:         ${existing.size}  (skip ${skipExisting})`)
  console.log(`Would CREATE:          ${toCreate.length}`)
  console.log(`subscribeToFeed:       true (consented) → auto-syncs to Mailchimp as brand:aim`)

  const tagCounts: Record<string, number> = {}
  for (const d of toCreate) for (const t of d.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1
  console.log(`\nTag distribution:`)
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([t, n]) => console.log(`  ${String(n).padStart(4)}  ${t}`))

  const withCompany = toCreate.filter((d) => d.company).length
  const withTitle = toCreate.filter((d) => d.title).length
  const withLocation = toCreate.filter((d) => d.location).length
  console.log(`\nField coverage: company ${withCompany}, title ${withTitle}, location ${withLocation}`)
  if (toCreate[0]) console.log(`\nSample doc:\n${JSON.stringify(toCreate[0], null, 1)}`)

  if (!APPLY) {
    console.log(`\n🟢 Dry-run complete — no writes. Re-run with --apply.\n`)
    return
  }

  let written = 0
  for (let i = 0; i < toCreate.length; i += 400) {
    const batch = db.batch()
    for (const d of toCreate.slice(i, i + 400)) {
      batch.set(db.collection(COLLECTIONS.EVENT_REGISTRATIONS).doc(), d)
    }
    await batch.commit()
    written += Math.min(400, toCreate.length - i)
    console.log(`  …${written}/${toCreate.length}`)
  }
  console.log(`\n✅ APPLY complete — created ${written} AIM 2026 registrations.\n`)
}

main().catch((e) => {
  console.error("Import failed:", e)
  process.exit(1)
})

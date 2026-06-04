/**
 * Backfill `client_id` on opportunity rows (crm_clients, is_opportunity=true).
 *
 * Opportunities are crm_clients rows; their link to the parent CLIENT row (the
 * won/active account) is the `client_id` FK that getOpportunitiesByClient — and
 * therefore Customer 360 + the client drawer's pipeline strip — reads. It was
 * never populated, so the link was dead (the mapper used to set client_id=self).
 * This one-time backfill matches each opportunity to its client by normalized
 * company name and writes the FK. New opportunities get client_id from the
 * company picker (linked_company_id) at create time, so this is history-only.
 *
 * Safety:
 *   - DRY-RUN by default — prints the plan, writes nothing. Pass --apply.
 *   - Only touches opportunities with NO client_id yet that match EXACTLY ONE
 *     non-opportunity client by name. No-match and ambiguous (multi-match) rows
 *     are reported and left untouched for manual review.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-opportunity-client-id.ts
 *   npx tsx --env-file=.env.local scripts/backfill-opportunity-client-id.ts --apply
 */
import { getDb } from "../lib/firebase-admin"

const APPLY = process.argv.includes("--apply")
const norm = (s: unknown) => String(s || "").trim().toLowerCase()

type Row = { id: string; ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }

async function main() {
  const db = getDb()
  const snap = await db.collection("crm_clients").get()
  const rows: Row[] = snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() as Record<string, unknown> }))
  const opps = rows.filter((r) => r.data.is_opportunity === true)
  const clients = rows.filter((r) => r.data.is_opportunity !== true)

  const clientsByName = new Map<string, Row[]>()
  for (const c of clients) {
    const n = norm(c.data.company_name || c.data.name)
    if (!n) continue
    const arr = clientsByName.get(n) ?? []
    arr.push(c)
    clientsByName.set(n, arr)
  }

  console.log(`\n${APPLY ? "🔴 APPLY" : "🟢 DRY-RUN"} — backfill opportunity.client_id\n`)
  console.log(`opportunities: ${opps.length} | non-opp clients: ${clients.length}\n`)

  const toSet: { ref: FirebaseFirestore.DocumentReference; clientId: string }[] = []
  let alreadySet = 0
  let noMatch = 0
  let ambiguous = 0

  for (const o of opps) {
    const co = String(o.data.company_name || o.data.name || "(unnamed)")
    if (o.data.client_id && String(o.data.client_id).trim()) {
      alreadySet++
      continue
    }
    const matches = clientsByName.get(norm(o.data.company_name || o.data.name)) ?? []
    if (matches.length === 0) {
      noMatch++
      console.log(`  ✗ no client match: "${co}"`)
      continue
    }
    if (matches.length > 1) {
      ambiguous++
      console.log(`  ⚠ ambiguous (${matches.length} client rows): "${co}" — skipped`)
      continue
    }
    toSet.push({ ref: o.ref, clientId: matches[0].id })
    console.log(`  ✓ "${co}" → client ${matches[0].id}`)
  }

  console.log(
    `\nWill set: ${toSet.length} | already set: ${alreadySet} | no match: ${noMatch} | ambiguous: ${ambiguous}`,
  )

  if (!APPLY) {
    console.log(`\n🟢 Dry-run — nothing written. Re-run with --apply to set ${toSet.length} client_id values.`)
    return
  }

  let written = 0
  for (let i = 0; i < toSet.length; i += 400) {
    const batch = db.batch()
    for (const { ref, clientId } of toSet.slice(i, i + 400)) {
      batch.update(ref, { client_id: clientId })
      written++
    }
    await batch.commit()
  }
  console.log(`\n✅ Set client_id on ${written} opportunities.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Deduplicate client records in `crm_clients`.
 *
 * Repeated imports left ~146 redundant client rows across 92 companies (same
 * company_name + department). The Clients table hides this via display-time
 * dedup, but the rows exist underneath — and they make the opportunity→client
 * FK ambiguous. This collapses each duplicate group to ONE canonical row.
 *
 * Per group:
 *   - Canonical = the richest row (most contacts, then most populated fields,
 *     then oldest). Survives.
 *   - Contacts from every row are merged onto the canonical, deduped by email
 *     (falling back to full name). Exactly one primary is kept.
 *   - Canonical's BLANK scalar fields are filled from the dupes (never overwrites
 *     a value the canonical already has).
 *   - References to the deleted rows are repointed to the canonical: tasks
 *     (crm_tasks.client_id) and opportunities (crm_clients.client_id).
 *   - The redundant rows are deleted.
 *
 * Only NON-opportunity rows (is_opportunity !== true) are deduped; opportunities
 * are left alone.
 *
 * Safety: DRY-RUN by default — prints the full plan, writes nothing. Pass --apply.
 *
 *   npx tsx --env-file=.env.local scripts/dedupe-clients.ts
 *   npx tsx --env-file=.env.local scripts/dedupe-clients.ts --apply
 */
import { getDb } from "../lib/firebase-admin"

const APPLY = process.argv.includes("--apply")
// --strict also collapses internal whitespace and strips punctuation, so
// "Accenture Federal   Services" / "Accenture Federal Services" and
// "Supergoop" / "Supergoop!" group together (near-duplicates the plain
// trim+lowercase pass misses). Contact dedup still uses the loose key.
const STRICT = process.argv.includes("--strict")
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase()
const strictNorm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
const groupKeyOf = (s: unknown) => (STRICT ? strictNorm(s) : norm(s))

type Row = { id: string; ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }
type Contact = Record<string, unknown>

// Scalar fields worth preserving — canonical inherits these only where blank.
const INHERIT_FIELDS = [
  "email", "phone", "website", "address", "city", "state", "zip_code",
  "status", "assigned_to", "source", "lead_source", "notes",
  "next_followup_date", "last_contact_date", "industry", "brand",
]

function populatedScore(d: Record<string, unknown>): number {
  let n = 0
  for (const k of INHERIT_FIELDS) {
    const v = d[k]
    if (v !== undefined && v !== null && String(v).trim() !== "") n++
  }
  return n
}

function contactKey(c: Contact): string {
  const email = norm(c.email)
  if (email) return `e:${email}`
  const name = norm([c.first_name, c.last_name].filter(Boolean).join(" ") || c.name)
  const phone = norm(c.phone)
  return name || phone ? `n:${name}|${phone}` : ""
}

function mergeContacts(rows: Row[]): { merged: Contact[]; before: number } {
  const all: Contact[] = []
  for (const r of rows) {
    const cs = Array.isArray(r.data.contacts) ? (r.data.contacts as Contact[]) : []
    all.push(...cs)
  }
  const before = all.length
  const seen = new Map<string, Contact>()
  let anonCount = 0
  for (const c of all) {
    const key = contactKey(c) || `anon:${anonCount++}`
    if (!seen.has(key)) seen.set(key, { ...c })
    // else: keep the first; drop the dup
  }
  const merged = [...seen.values()]
  // exactly one primary
  const primaryIdx = merged.findIndex((c) => c.is_primary === true)
  merged.forEach((c, i) => (c.is_primary = i === (primaryIdx >= 0 ? primaryIdx : 0)))
  return { merged, before }
}

// Pick the canonical row: most contacts, then most populated fields, then oldest.
function pickCanonical(rows: Row[]): Row {
  return [...rows].sort((a, b) => {
    const ca = Array.isArray(a.data.contacts) ? (a.data.contacts as unknown[]).length : 0
    const cb = Array.isArray(b.data.contacts) ? (b.data.contacts as unknown[]).length : 0
    if (cb !== ca) return cb - ca
    const pa = populatedScore(a.data)
    const pb = populatedScore(b.data)
    if (pb !== pa) return pb - pa
    return String(a.data.created_at ?? "").localeCompare(String(b.data.created_at ?? ""))
  })[0]
}

async function main() {
  const db = getDb()
  const [clientSnap, taskSnap] = await Promise.all([
    db.collection("crm_clients").get(),
    db.collection("crm_tasks").get(),
  ])
  const rows: Row[] = clientSnap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() as Record<string, unknown> }))
  const clients = rows.filter((r) => r.data.is_opportunity !== true)
  const opps = rows.filter((r) => r.data.is_opportunity === true)

  // Group client rows by company + department
  const groups = new Map<string, Row[]>()
  for (const c of clients) {
    const co = groupKeyOf(c.data.company_name || c.data.name)
    if (!co) continue
    const key = `${co}|${groupKeyOf(c.data.department)}`
    const arr = groups.get(key) ?? []
    arr.push(c)
    groups.set(key, arr)
  }
  const dupeGroups = [...groups.values()].filter((arr) => arr.length > 1).sort((a, b) => b.length - a.length)

  console.log(`\n${APPLY ? "🔴 APPLY" : "🟢 DRY-RUN"} — dedupe crm_clients\n`)
  console.log(`client rows: ${clients.length} | duplicate groups: ${dupeGroups.length}\n`)

  const deletedToCanonical = new Map<string, string>() // deleted id → canonical id
  const canonicalUpdates: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = []
  const toDelete: FirebaseFirestore.DocumentReference[] = []
  let totalDeleted = 0
  let totalContactsDropped = 0

  for (const group of dupeGroups) {
    const canonical = pickCanonical(group)
    const dupes = group.filter((r) => r.id !== canonical.id)
    const { merged, before } = mergeContacts(group)
    const canonicalContacts = Array.isArray(canonical.data.contacts) ? (canonical.data.contacts as unknown[]).length : 0
    const dropped = before - merged.length

    // canonical update: merged contacts + fill blank scalar fields from dupes
    const update: Record<string, unknown> = {}
    if (before !== canonicalContacts || dropped > 0) update.contacts = merged
    else if (merged.length !== canonicalContacts) update.contacts = merged
    for (const f of INHERIT_FIELDS) {
      const cv = canonical.data[f]
      if (cv === undefined || cv === null || String(cv).trim() === "") {
        const donor = dupes.find((d) => {
          const v = d.data[f]
          return v !== undefined && v !== null && String(v).trim() !== ""
        })
        if (donor) update[f] = donor.data[f]
      }
    }
    if (Object.keys(update).length > 0) canonicalUpdates.push({ ref: canonical.ref, data: update })

    for (const d of dupes) {
      deletedToCanonical.set(d.id, canonical.id)
      toDelete.push(d.ref)
    }
    totalDeleted += dupes.length
    totalContactsDropped += dropped

    const name = String(canonical.data.company_name || canonical.data.name)
    const detail = before > 0
      ? ` | contacts ${before}→${merged.length}`
      : ""
    console.log(`  ${group.length}× "${name}" → keep ${canonical.id.slice(0, 8)}…, delete ${dupes.length}${detail}`)
  }

  // Repoint references to deleted rows
  const taskRepoints: { ref: FirebaseFirestore.DocumentReference; clientId: string }[] = []
  for (const t of taskSnap.docs) {
    const cid = t.data().client_id
    if (cid && deletedToCanonical.has(String(cid))) {
      taskRepoints.push({ ref: t.ref, clientId: deletedToCanonical.get(String(cid))! })
    }
  }
  const oppRepoints: { ref: FirebaseFirestore.DocumentReference; clientId: string }[] = []
  for (const o of opps) {
    const cid = o.data.client_id
    if (cid && deletedToCanonical.has(String(cid))) {
      oppRepoints.push({ ref: o.ref, clientId: deletedToCanonical.get(String(cid))! })
    }
  }

  console.log(`\n── Summary ──`)
  console.log(`Groups deduped:        ${dupeGroups.length}`)
  console.log(`Rows to delete:        ${totalDeleted}`)
  console.log(`Canonical rows updated:${canonicalUpdates.length}`)
  console.log(`Duplicate contacts dropped: ${totalContactsDropped}`)
  console.log(`Task client_id repoints:    ${taskRepoints.length}`)
  console.log(`Opportunity client_id repoints: ${oppRepoints.length}`)

  if (!APPLY) {
    console.log(`\n🟢 Dry-run — nothing written. Re-run with --apply to execute.`)
    return
  }

  // Apply: updates + repoints + deletes, batched
  let batch = db.batch()
  let count = 0
  const flush = async () => { if (count > 0) { await batch.commit(); batch = db.batch(); count = 0 } }
  const queue = async (fn: (b: FirebaseFirestore.WriteBatch) => void) => {
    fn(batch); count++
    if (count >= 400) await flush()
  }

  for (const u of canonicalUpdates) await queue((b) => b.update(u.ref, u.data))
  for (const r of taskRepoints) await queue((b) => b.update(r.ref, { client_id: r.clientId }))
  for (const r of oppRepoints) await queue((b) => b.update(r.ref, { client_id: r.clientId }))
  for (const ref of toDelete) await queue((b) => b.delete(ref))
  await flush()

  console.log(`\n✅ Deduped ${dupeGroups.length} groups — deleted ${totalDeleted} rows, updated ${canonicalUpdates.length} canonicals, repointed ${taskRepoints.length + oppRepoints.length} references.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

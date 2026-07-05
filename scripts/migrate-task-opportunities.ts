/**
 * Phase 2 of the CRM↔funnel alignment: make an opportunity a ClientRecord ONLY.
 * A few opportunities were tracked as tasks (crm_tasks.is_opportunity). This
 * promotes each into a real client-opportunity (crm_clients) and demotes the
 * original task to a plain work item LINKED to the new opportunity:
 *   - create crm_clients { is_opportunity:true, disposition, doc, pitch_value, … }
 *   - update the task → is_opportunity:false, opportunity_id:<newId>,
 *     migrated_to_client_id:<newId>, disposition/doc cleared
 *
 * Idempotent: skips tasks already carrying `migrated_to_client_id`.
 * DRY-RUN by default; pass --apply to write.
 *
 *   npx tsx --env-file=.env.local scripts/migrate-task-opportunities.ts
 *   npx tsx --env-file=.env.local scripts/migrate-task-opportunities.ts --apply
 */
import { getDb } from "../lib/firebase-admin"

async function main() {
  const apply = process.argv.includes("--apply")
  console.log(apply ? "APPLY mode — writing changes." : "DRY-RUN — no writes (pass --apply to write).")
  const db = getDb()
  const now = new Date().toISOString()

  const snap = await db.collection("crm_tasks").where("is_opportunity", "==", true).get()
  console.log(`task-opportunities found: ${snap.size}`)

  let migrated = 0
  for (const doc of snap.docs) {
    const t = doc.data()
    if (t.migrated_to_client_id) {
      console.log(`  skip ${doc.id} — already migrated → ${t.migrated_to_client_id}`)
      continue
    }
    // A blank disposition enters the funnel at Discovery.
    const disposition = t.disposition && t.disposition !== "" ? t.disposition : "discovery"
    const newClient = {
      name: t.title || t.company_name || t.name || "Opportunity",
      company_name: t.company_name || undefined,
      title: t.title || undefined,
      brand: t.brand || undefined,
      status: "prospect",
      is_opportunity: true,
      disposition,
      doc: t.doc || undefined,
      pitch_value: t.pitch_value ?? undefined,
      assigned_to: t.assigned_to || undefined,
      notes: t.notes || undefined,
      source: "migrated-from-task",
      created_at: t.created_at || now,
      updated_at: now,
    }
    console.log(
      `  migrate task ${doc.id} "${newClient.name}" → client-opp (disposition=${disposition}, brand=${newClient.brand ?? "—"})`,
    )
    if (apply) {
      const ref = await db.collection("crm_clients").add(newClient)
      await doc.ref.update({
        is_opportunity: false,
        opportunity_id: ref.id,
        migrated_to_client_id: ref.id,
        disposition: null,
        doc: null,
        updated_at: now,
      })
      migrated++
      console.log(`    created client-opp ${ref.id}; task demoted + linked.`)
    }
  }

  console.log(apply ? `\nmigrated: ${migrated}` : `\ndry-run — ${snap.size} task-opportunities would migrate`)
  process.exit(0)
}

main().catch((e) => {
  console.error("FATAL:", e)
  process.exit(1)
})

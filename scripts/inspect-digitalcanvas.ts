/**
 * One-off discovery: list collections + sample docs in the `digitalcanvas`
 * named Firestore database (434 Media project) so we can wire it into the
 * Audiences surface against its real shape. Read-only.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-digitalcanvas.ts
 */
import { getNamedDb } from "../lib/firebase-admin"

async function main() {
  const db = getNamedDb("digitalcanvas")
  const collections = await db.listCollections()
  if (collections.length === 0) {
    console.log("No collections found in the 'digitalcanvas' database.")
    return
  }
  console.log(`Collections in 'digitalcanvas': ${collections.map((c) => c.id).join(", ")}\n`)

  for (const col of collections) {
    const snap = await col.limit(3).get()
    const total = (await col.count().get()).data().count
    console.log(`── ${col.id}  (${total} docs) ──`)
    snap.docs.forEach((d, i) => {
      const data = d.data()
      // Print field names + a short preview of each value.
      const preview: Record<string, string> = {}
      for (const [k, v] of Object.entries(data)) {
        const s = typeof v === "object" ? JSON.stringify(v) : String(v)
        preview[k] = s.length > 60 ? s.slice(0, 60) + "…" : s
      }
      console.log(`  [${i}] id=${d.id}`)
      console.log(`      ${JSON.stringify(preview)}`)
    })
    console.log("")
  }
}

main().catch((err) => {
  console.error("Inspect failed:", err)
  process.exit(1)
})

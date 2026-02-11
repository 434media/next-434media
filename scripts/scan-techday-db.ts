/**
 * Scan the 'techday' database in the groovy Firestore project
 * Run with: npx tsx scripts/scan-techday-db.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

const credPath = resolve(homedir(), "Downloads/groovy-ego.json")
const credentials = JSON.parse(readFileSync(credPath, "utf-8"))

const app = admin.initializeApp(
  { credential: admin.credential.cert(credentials) },
  "techday-db-scan"
)

// Access the 'techday' named database
const db = app.firestore()
db.settings({ databaseId: "techday" })

async function scan() {
  console.log("\n" + "=".repeat(60))
  console.log("  GROOVY - 'techday' Database")
  console.log("=".repeat(60) + "\n")

  // List all collections
  const collections = await db.listCollections()
  console.log(`Collections found: ${collections.length}\n`)

  for (const col of collections) {
    const snap = await col.get()
    console.log(`📁 ${col.id}: ${snap.size} documents`)

    // Show details for registration-like collections
    if (
      col.id.toLowerCase().includes("registr") ||
      col.id.toLowerCase().includes("attendee") ||
      col.id.toLowerCase().includes("signup") ||
      col.id.toLowerCase().includes("ticket") ||
      col.id.toLowerCase().includes("rsvp")
    ) {
      console.log(`\n--- ${col.id} details ---`)
      if (snap.size > 0) {
        // Show sample doc structure
        const first = snap.docs[0]
        console.log(`Sample fields: ${Object.keys(first.data()).join(", ")}`)
        console.log(`Sample: ${JSON.stringify(first.data(), null, 2)}\n`)

        // List all registrants
        console.log(`All ${snap.size} registrants:`)
        snap.docs.forEach((doc, i) => {
          const d = doc.data()
          const name = d.fullName || d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim()
          const email = d.email || "no-email"
          const company = d.company || d.organization || ""
          console.log(`  ${i + 1}. ${name} - ${email}${company ? ` (${company})` : ""}`)
        })
      }
      console.log()
    } else if (snap.size > 0 && snap.size <= 10) {
      // For small collections, show structure
      const first = snap.docs[0]
      console.log(`   Fields: ${Object.keys(first.data()).join(", ")}`)
    }
  }
}

scan()
  .catch(console.error)
  .finally(() => process.exit(0))

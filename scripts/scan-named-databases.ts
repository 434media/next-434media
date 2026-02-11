/**
 * Scan the 'aimsatx' and 'techday' named databases in groovy
 * Run with: npx tsx scripts/scan-named-databases.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

const credPath = resolve(homedir(), "Downloads/groovy-ego.json")
const credentials = JSON.parse(readFileSync(credPath, "utf-8"))

// aimsatx database
const aimsApp = admin.initializeApp(
  { credential: admin.credential.cert(credentials) },
  "aimsatx-scan"
)
const aimsDb = aimsApp.firestore()
aimsDb.settings({ databaseId: "aimsatx" })

// techday database
const tdApp = admin.initializeApp(
  { credential: admin.credential.cert(credentials) },
  "techday-scan2"
)
const tdDb = tdApp.firestore()
tdDb.settings({ databaseId: "techday" })

async function scanDb(db: admin.firestore.Firestore, name: string) {
  console.log("\n" + "=".repeat(60))
  console.log(`  '${name}' Database`)
  console.log("=".repeat(60) + "\n")

  const collections = await db.listCollections()
  console.log(`Collections: ${collections.length}\n`)

  for (const col of collections) {
    const snap = await col.get()
    console.log(`📁 ${col.id}: ${snap.size} documents`)

    if (snap.size > 0) {
      const first = snap.docs[0]
      console.log(`   Fields: ${Object.keys(first.data()).join(", ")}`)

      // Show sample for key collections
      if (
        col.id.includes("contact") ||
        col.id.includes("email") ||
        col.id.includes("signup") ||
        col.id.includes("registr") ||
        col.id.includes("newsletter")
      ) {
        console.log(`   Sample: ${JSON.stringify(first.data(), null, 2).substring(0, 500)}`)
      }
    }
    console.log()
  }
}

async function main() {
  await scanDb(aimsDb, "aimsatx")
  await scanDb(tdDb, "techday")
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))

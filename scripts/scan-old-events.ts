/**
 * Scan event-registrations in the old Firestore to see the data structure
 * Run with: npx tsx scripts/scan-old-events.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

const credPath = resolve(homedir(), "Downloads/media-analytics-proxy.json")
const credentials = JSON.parse(readFileSync(credPath, "utf-8"))

const oldApp = admin.initializeApp(
  { credential: admin.credential.cert(credentials) },
  "old-events-scan"
)
const oldDb = oldApp.firestore()

async function scan() {
  console.log("\n=== event-registrations in OLD Firestore ===\n")

  const snap = await oldDb.collection("event-registrations").get()
  console.log(`Total documents: ${snap.size}\n`)

  if (snap.size > 0) {
    // Show first doc structure
    const first = snap.docs[0]
    console.log("Sample document fields:", Object.keys(first.data()))
    console.log("Sample document:", JSON.stringify(first.data(), null, 2))

    console.log("\n--- All documents ---")
    snap.docs.forEach((doc) => {
      const d = doc.data()
      console.log(`  ID: ${doc.id}`)
      console.log(`    ${JSON.stringify(d)}`)
      console.log()
    })
  }

  console.log("=== Done ===\n")
}

scan()
  .catch(console.error)
  .finally(() => process.exit(0))

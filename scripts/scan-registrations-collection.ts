/**
 * Deep scan of 'registrations' collection in old Firestore for Tech Day data
 * Run with: npx tsx scripts/scan-registrations-collection.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

// --- Old Firestore (media-analytics-proxy) ---
const oldCredPath = resolve(homedir(), "Downloads/media-analytics-proxy.json")
const oldCredentials = JSON.parse(readFileSync(oldCredPath, "utf-8"))

const oldApp = admin.initializeApp(
  { credential: admin.credential.cert(oldCredentials) },
  "old-reg-scan"
)
const oldDb = oldApp.firestore()

async function scan() {
  console.log("\n" + "=".repeat(60))
  console.log("  Scanning 'registrations' collection in OLD Firestore")
  console.log("=".repeat(60) + "\n")

  const snap = await oldDb.collection("registrations").get()
  console.log(`Total documents: ${snap.size}\n`)

  snap.docs.forEach((doc, i) => {
    const d = doc.data()
    console.log(`--- Document ${i + 1} (ID: ${doc.id}) ---`)
    console.log(JSON.stringify(d, null, 2))
    console.log()
  })

  // Also check for subcollections - registrations might be organized differently
  // Check if there are subcollections under individual event documents
  console.log("\n--- Checking 'events' collection for subcollections ---")
  const eventsSnap = await oldDb.collection("events").get()
  console.log(`Total event documents: ${eventsSnap.size}`)

  for (const eventDoc of eventsSnap.docs) {
    const d = eventDoc.data()
    const eventName = d.title || d.name || d.eventName || eventDoc.id
    const str = JSON.stringify(d).toLowerCase()
    
    if (str.includes("tech") || str.includes("sa ") || str.includes("satechday")) {
      console.log(`\n🎯 Found tech-related event: ${eventName} (ID: ${eventDoc.id})`)
      console.log(JSON.stringify(d, null, 2))
      
      // Check for registrations subcollection
      const subCollections = await eventDoc.ref.listCollections()
      console.log(`  Subcollections: ${subCollections.map(c => c.id).join(", ") || "none"}`)
      
      for (const subCol of subCollections) {
        const subSnap = await subCol.get()
        console.log(`  ${subCol.id}: ${subSnap.size} documents`)
        subSnap.docs.forEach((subDoc, j) => {
          console.log(`    ${j + 1}. ${JSON.stringify(subDoc.data())}`)
        })
      }
    }
  }

  // Also check all top-level collections
  console.log("\n--- Listing ALL top-level collections in old DB ---")
  const collections = await oldDb.listCollections()
  for (const col of collections) {
    const s = await col.get()
    console.log(`  ${col.id}: ${s.size} documents`)
  }
}

scan()
  .catch(console.error)
  .finally(() => process.exit(0))

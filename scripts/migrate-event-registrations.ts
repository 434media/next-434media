/**
 * Migrate event-registrations from old Firestore (media-analytics-proxy) to new Firestore
 * Run with: npx tsx scripts/migrate-event-registrations.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

// --- Old Firestore ---
const oldCredPath = resolve(homedir(), "Downloads/media-analytics-proxy.json")
const oldCredentials = JSON.parse(readFileSync(oldCredPath, "utf-8"))

const oldApp = admin.initializeApp(
  { credential: admin.credential.cert(oldCredentials) },
  "old-firestore-events"
)
const oldDb = oldApp.firestore()

// --- New Firestore ---
const envPath = resolve(process.cwd(), ".env.local")
const envContent = readFileSync(envPath, "utf-8")
// Try single-quoted, then double-quoted, then unquoted JSON
const match =
  envContent.match(/GOOGLE_SERVICE_ACCOUNT_KEY\s*=\s*'([\s\S]*?)'/) ||
  envContent.match(/GOOGLE_SERVICE_ACCOUNT_KEY\s*=\s*"(\{[\s\S]*?\})"/) ||
  envContent.match(/GOOGLE_SERVICE_ACCOUNT_KEY\s*=\s*(\{[\s\S]*?\})/)
if (!match) {
  console.error("Could not find GOOGLE_SERVICE_ACCOUNT_KEY in .env.local")
  process.exit(1)
}
const newCredentials = JSON.parse(match[1])

const newApp = admin.initializeApp(
  { credential: admin.credential.cert(newCredentials) },
  "new-firestore-events"
)
const newDb = newApp.firestore()

async function migrate() {
  console.log("\n=== Migrating event-registrations from old → new Firestore ===\n")

  // Read all event-registrations from old DB
  const oldSnap = await oldDb.collection("event-registrations").get()
  console.log(`Found ${oldSnap.size} event registrations in old DB\n`)

  if (oldSnap.empty) {
    console.log("Nothing to migrate.")
    return
  }

  // Check what already exists in new DB
  const newSnap = await newDb.collection("event_registrations").get()
  const existingEmails = new Set(
    newSnap.docs.map((doc) => {
      const d = doc.data()
      return `${d.email}|${d.event}`
    })
  )
  console.log(`Existing registrations in new DB: ${newSnap.size}`)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const doc of oldSnap.docs) {
    const data = doc.data()
    const key = `${data.email}|${data.event}`

    if (existingEmails.has(key)) {
      skipped++
      continue
    }

    try {
      await newDb.collection("event_registrations").add({
        email: data.email,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        fullName: data.fullName || "",
        company: data.company || null,
        subscribeToFeed: data.subscribeToFeed || false,
        event: data.event || "",
        eventName: data.eventName || "",
        eventDate: data.eventDate || "",
        registeredAt: data.registeredAt || "",
        source: data.source || "",
        tags: data.tags || [],
        pageUrl: data.pageUrl || "",
      })
      migrated++
    } catch (err) {
      console.error(`  Error migrating ${data.email}:`, err)
      errors++
    }
  }

  console.log(`\n--- Results ---`)
  console.log(`  Migrated: ${migrated}`)
  console.log(`  Skipped (already existed): ${skipped}`)
  console.log(`  Errors: ${errors}`)
  console.log(`  Total in new DB: ${newSnap.size + migrated}`)
}

migrate()
  .catch(console.error)
  .finally(() => process.exit(0))

/**
 * Migrate SA Tech Day registrations from the 'techday' named database
 * into the main groovy 'event_registrations' collection
 * 
 * Source: groovy-ego / techday database / registrations collection (33 docs)
 * Dest:   groovy-ego / (default) database / event_registrations collection
 * 
 * Run with: npx tsx scripts/migrate-techday-registrations.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

const credPath = resolve(homedir(), "Downloads/groovy-ego.json")
const credentials = JSON.parse(readFileSync(credPath, "utf-8"))

// App for the techday named database (source)
const sourceApp = admin.initializeApp(
  { credential: admin.credential.cert(credentials) },
  "techday-source"
)
const sourceDb = sourceApp.firestore()
sourceDb.settings({ databaseId: "techday" })

// App for the default database (destination)
const destApp = admin.initializeApp(
  { credential: admin.credential.cert(credentials) },
  "groovy-dest"
)
const destDb = destApp.firestore()

async function migrate() {
  console.log("\n" + "=".repeat(60))
  console.log("  Migrating SA Tech Day registrations → event_registrations")
  console.log("=".repeat(60) + "\n")

  // Read all registrations from techday database
  const sourceSnap = await sourceDb.collection("registrations").get()
  console.log(`Found ${sourceSnap.size} registrations in techday database\n`)

  if (sourceSnap.empty) {
    console.log("Nothing to migrate.")
    return
  }

  // Check what already exists in destination
  const destSnap = await destDb.collection("event_registrations").get()
  const existingKeys = new Set(
    destSnap.docs.map((doc) => {
      const d = doc.data()
      return `${d.email}|${d.event}`
    })
  )
  console.log(`Existing registrations in event_registrations: ${destSnap.size}`)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const doc of sourceSnap.docs) {
    const data = doc.data()
    
    // Map techday events to a consistent event slug
    const eventSlug = "SATechDay2026"
    const key = `${data.email}|${eventSlug}`

    if (existingKeys.has(key)) {
      console.log(`  ⏩ Skipping (exists): ${data.email}`)
      skipped++
      continue
    }

    try {
      // Convert techday registration format → event_registrations format
      const registeredAt = data.createdAt?._seconds
        ? new Date(data.createdAt._seconds * 1000).toISOString()
        : new Date().toISOString()

      await destDb.collection("event_registrations").add({
        email: data.email || "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        fullName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
        company: data.company || null,
        subscribeToFeed: false,
        event: eventSlug,
        eventName: "SA Tech Day 2026",
        eventDate: "2026-04-10",
        registeredAt,
        source: "SATechDay",
        tags: ["sa-tech-day", "techday", ...(data.events || [])],
        pageUrl: "https://www.sanantoniotechday.com",
        // Preserve original data
        _migratedFrom: "techday-database",
        _migratedAt: new Date().toISOString(),
        _originalDocId: doc.id,
        _originalTicketId: data.ticketId || "",
        _originalCategory: data.category || "",
        _originalTitle: data.title || "",
        _originalStatus: data.status || "",
      })

      console.log(`  ✅ Migrated: ${data.firstName} ${data.lastName} - ${data.email}`)
      migrated++
      existingKeys.add(key) // Prevent dupes within this run
    } catch (err) {
      console.error(`  ❌ Error migrating ${data.email}:`, err)
      errors++
    }
  }

  console.log(`\n${"─".repeat(40)}`)
  console.log(`  Results:`)
  console.log(`    Migrated:  ${migrated}`)
  console.log(`    Skipped:   ${skipped} (already existed)`)
  console.log(`    Errors:    ${errors}`)
  console.log(`    Total now: ${destSnap.size + migrated}`)
  console.log(`${"─".repeat(40)}\n`)
}

migrate()
  .catch(console.error)
  .finally(() => process.exit(0))

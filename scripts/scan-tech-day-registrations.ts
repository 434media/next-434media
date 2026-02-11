/**
 * Scan BOTH Firestore databases for San Antonio Tech Day registrations
 * Run with: npx tsx scripts/scan-tech-day-registrations.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

// --- Groovy (new) Firestore ---
const groovyCredPath = resolve(homedir(), "Downloads/groovy-ego.json")
const groovyCredentials = JSON.parse(readFileSync(groovyCredPath, "utf-8"))

const groovyApp = admin.initializeApp(
  { credential: admin.credential.cert(groovyCredentials) },
  "groovy-scan"
)
const groovyDb = groovyApp.firestore()

// --- Old Firestore (media-analytics-proxy) ---
const oldCredPath = resolve(homedir(), "Downloads/media-analytics-proxy.json")
const oldCredentials = JSON.parse(readFileSync(oldCredPath, "utf-8"))

const oldApp = admin.initializeApp(
  { credential: admin.credential.cert(oldCredentials) },
  "old-scan"
)
const oldDb = oldApp.firestore()

async function scanGroovy() {
  console.log("\n" + "=".repeat(60))
  console.log("  GROOVY Firestore (event_registrations)")
  console.log("=".repeat(60) + "\n")

  // Check event_registrations collection (underscore)
  const snap = await groovyDb.collection("event_registrations").get()
  console.log(`Total documents in event_registrations: ${snap.size}\n`)

  if (snap.size > 0) {
    // Group by event
    const byEvent: Record<string, any[]> = {}
    snap.docs.forEach((doc) => {
      const d = doc.data()
      const eventName = d.eventName || d.event || "Unknown"
      if (!byEvent[eventName]) byEvent[eventName] = []
      byEvent[eventName].push({ id: doc.id, ...d })
    })

    console.log("Events found:")
    for (const [event, regs] of Object.entries(byEvent)) {
      console.log(`  - ${event}: ${regs.length} registrations`)
    }

    // Check for Tech Day specifically
    const techDayKeys = Object.keys(byEvent).filter(
      (k) => k.toLowerCase().includes("tech") || k.toLowerCase().includes("sa ")
    )
    if (techDayKeys.length > 0) {
      console.log("\n--- Tech Day Registrations Found ---")
      techDayKeys.forEach((key) => {
        console.log(`\nEvent: ${key} (${byEvent[key].length} registrations)`)
        byEvent[key].forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.fullName || r.firstName + " " + r.lastName} - ${r.email}`)
        })
      })
    } else {
      console.log("\n❌ No Tech Day registrations found in groovy event_registrations")
    }
  }

  // Also check if there's a hyphenated collection
  const snapHyphen = await groovyDb.collection("event-registrations").get()
  console.log(`\nDocuments in event-registrations (hyphenated): ${snapHyphen.size}`)
  if (snapHyphen.size > 0) {
    const byEvent: Record<string, number> = {}
    snapHyphen.docs.forEach((doc) => {
      const d = doc.data()
      const eventName = d.eventName || d.event || "Unknown"
      byEvent[eventName] = (byEvent[eventName] || 0) + 1
    })
    console.log("Events in hyphenated collection:")
    for (const [event, count] of Object.entries(byEvent)) {
      console.log(`  - ${event}: ${count} registrations`)
    }
  }
}

async function scanOld() {
  console.log("\n" + "=".repeat(60))
  console.log("  OLD Firestore - media-analytics-proxy (event-registrations)")
  console.log("=".repeat(60) + "\n")

  // Check event-registrations collection (hyphenated - old format)
  const snap = await oldDb.collection("event-registrations").get()
  console.log(`Total documents in event-registrations: ${snap.size}\n`)

  if (snap.size > 0) {
    // Group by event
    const byEvent: Record<string, any[]> = {}
    snap.docs.forEach((doc) => {
      const d = doc.data()
      const eventName = d.eventName || d.event || "Unknown"
      if (!byEvent[eventName]) byEvent[eventName] = []
      byEvent[eventName].push({ id: doc.id, ...d })
    })

    console.log("Events found:")
    for (const [event, regs] of Object.entries(byEvent)) {
      console.log(`  - ${event}: ${regs.length} registrations`)
    }

    // Check for Tech Day specifically
    const techDayKeys = Object.keys(byEvent).filter(
      (k) => k.toLowerCase().includes("tech") || k.toLowerCase().includes("sa ")
    )
    if (techDayKeys.length > 0) {
      console.log("\n--- Tech Day Registrations Found ---")
      techDayKeys.forEach((key) => {
        console.log(`\nEvent: ${key} (${byEvent[key].length} registrations)`)
        byEvent[key].forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.fullName || r.firstName + " " + r.lastName} - ${r.email}`)
        })
      })
    } else {
      console.log("\n❌ No Tech Day registrations found in old event-registrations")
    }
  }

  // Also check event_registrations (underscore) in old DB
  const snapUnderscore = await oldDb.collection("event_registrations").get()
  console.log(`\nDocuments in event_registrations (underscore) in old DB: ${snapUnderscore.size}`)
  if (snapUnderscore.size > 0) {
    const byEvent: Record<string, number> = {}
    snapUnderscore.docs.forEach((doc) => {
      const d = doc.data()
      const eventName = d.eventName || d.event || "Unknown"
      byEvent[eventName] = (byEvent[eventName] || 0) + 1
    })
    console.log("Events in underscore collection (old DB):")
    for (const [event, count] of Object.entries(byEvent)) {
      console.log(`  - ${event}: ${count} registrations`)
    }
  }

  // Check other possible collections that might have registrations
  console.log("\n--- Checking other potential collections in old DB ---")
  const potentialCollections = [
    "registrations",
    "techday",
    "tech-day",
    "tech_day",
    "sa-tech-day",
    "satechday",
    "contact-forms",
    "contact_forms",
  ]
  for (const col of potentialCollections) {
    try {
      const s = await oldDb.collection(col).get()
      if (s.size > 0) {
        console.log(`  ✅ ${col}: ${s.size} documents`)
        // Show first doc
        const first = s.docs[0].data()
        console.log(`     Sample fields: ${Object.keys(first).join(", ")}`)
        // Check if any have tech day references
        const techDayDocs = s.docs.filter((doc) => {
          const d = doc.data()
          const str = JSON.stringify(d).toLowerCase()
          return str.includes("tech") || str.includes("satechday")
        })
        if (techDayDocs.length > 0) {
          console.log(`     🎯 ${techDayDocs.length} docs mention "tech"`)
        }
      }
    } catch {
      // Collection doesn't exist
    }
  }
}

async function main() {
  await scanGroovy()
  await scanOld()
  console.log("\n" + "=".repeat(60))
  console.log("  SCAN COMPLETE")
  console.log("=".repeat(60) + "\n")
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))

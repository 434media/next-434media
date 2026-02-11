/**
 * Deep scan: Check groovy DB for ALL collections and look for Tech Day data
 * Also check contact_forms and email_signups for SATechDay source
 * Run with: npx tsx scripts/scan-groovy-all.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

// --- Groovy Firestore ---
const groovyCredPath = resolve(homedir(), "Downloads/groovy-ego.json")
const groovyCredentials = JSON.parse(readFileSync(groovyCredPath, "utf-8"))

const groovyApp = admin.initializeApp(
  { credential: admin.credential.cert(groovyCredentials) },
  "groovy-all-scan"
)
const groovyDb = groovyApp.firestore()

// --- Old Firestore ---
const oldCredPath = resolve(homedir(), "Downloads/media-analytics-proxy.json")
const oldCredentials = JSON.parse(readFileSync(oldCredPath, "utf-8"))

const oldApp = admin.initializeApp(
  { credential: admin.credential.cert(oldCredentials) },
  "old-all-scan"
)
const oldDb = oldApp.firestore()

async function scan() {
  console.log("\n" + "=".repeat(60))
  console.log("  GROOVY: Listing ALL collections")
  console.log("=".repeat(60) + "\n")

  const groovyCollections = await groovyDb.listCollections()
  for (const col of groovyCollections) {
    const s = await col.get()
    console.log(`  ${col.id}: ${s.size} documents`)
    
    // Check any collection that might have tech day data
    if (s.size > 0 && s.size <= 100) {
      const techDocs = s.docs.filter((doc) => {
        const str = JSON.stringify(doc.data()).toLowerCase()
        return str.includes("tech") || str.includes("satechday") || str.includes("techday") || str.includes("sa tech")
      })
      if (techDocs.length > 0) {
        console.log(`     🎯 ${techDocs.length} docs mention tech/techday`)
        techDocs.forEach((doc) => {
          console.log(`     ID: ${doc.id}`)
          console.log(`     ${JSON.stringify(doc.data()).substring(0, 300)}`)
        })
      }
    }
  }

  // Check registrations collection in groovy
  console.log("\n--- Checking 'registrations' in groovy ---")
  try {
    const regSnap = await groovyDb.collection("registrations").get()
    console.log(`registrations: ${regSnap.size} documents`)
    regSnap.docs.forEach((doc) => {
      console.log(`  ${doc.id}: ${JSON.stringify(doc.data()).substring(0, 200)}`)
    })
  } catch (err) {
    console.log("  No registrations collection")
  }

  // Check contact_forms for SATechDay source
  console.log("\n--- Contact forms with SATechDay source ---")
  try {
    const cfSnap = await groovyDb.collection("contact_forms").get()
    const techDayForms = cfSnap.docs.filter((doc) => {
      const d = doc.data()
      return d.source === "SATechDay" || (JSON.stringify(d).toLowerCase().includes("techday"))
    })
    console.log(`Total contact forms: ${cfSnap.size}`)
    console.log(`SATechDay forms: ${techDayForms.length}`)
    techDayForms.forEach((doc) => {
      const d = doc.data()
      console.log(`  ${d.firstName} ${d.lastName} - ${d.email} (source: ${d.source})`)
    })
  } catch {
    console.log("  No contact_forms collection")
  }

  // Check email_signups for SATechDay source
  console.log("\n--- Email signups with SATechDay source ---")
  try {
    const esSnap = await groovyDb.collection("email_signups").get()
    const techDaySignups = esSnap.docs.filter((doc) => {
      const d = doc.data()
      return d.source === "SATechDay" || (JSON.stringify(d).toLowerCase().includes("techday"))
    })
    console.log(`Total email signups: ${esSnap.size}`)
    console.log(`SATechDay signups: ${techDaySignups.length}`)
    techDaySignups.forEach((doc) => {
      const d = doc.data()
      console.log(`  ${d.email} (source: ${d.source})`)
    })
  } catch {
    console.log("  No email_signups collection")
  }

  // Also check old DB for contact forms and email signups with SATechDay
  console.log("\n" + "=".repeat(60))
  console.log("  OLD DB: Checking for SATechDay data")
  console.log("=".repeat(60) + "\n")

  try {
    const oldCfSnap = await oldDb.collection("contact_forms").get()
    const techDayForms = oldCfSnap.docs.filter((doc) => {
      const d = doc.data()
      return d.source === "SATechDay" || (JSON.stringify(d).toLowerCase().includes("techday"))
    })
    console.log(`Old contact forms total: ${oldCfSnap.size}`)
    console.log(`Old SATechDay forms: ${techDayForms.length}`)
  } catch {
    console.log("  No contact_forms in old DB")
  }

  // Check sponsor-inquiries in old DB
  console.log("\n--- sponsor-inquiries in old DB ---")
  try {
    const siSnap = await oldDb.collection("sponsor-inquiries").get()
    console.log(`Total: ${siSnap.size}`)
    siSnap.docs.forEach((doc) => {
      const d = doc.data()
      console.log(`  ${JSON.stringify(d).substring(0, 200)}`)
    })
  } catch {
    console.log("  None")
  }

  // Check if the registrations doc in old DB has subcollections
  console.log("\n--- Checking subcollections of registrations doc in old DB ---")
  try {
    const regSnap = await oldDb.collection("registrations").get()
    for (const doc of regSnap.docs) {
      const subCols = await doc.ref.listCollections()
      if (subCols.length > 0) {
        console.log(`  Doc ${doc.id} has subcollections: ${subCols.map(c => c.id).join(", ")}`)
        for (const sub of subCols) {
          const subSnap = await sub.get()
          console.log(`    ${sub.id}: ${subSnap.size} documents`)
        }
      } else {
        console.log(`  Doc ${doc.id}: no subcollections`)
      }
    }
  } catch {
    console.log("  Error checking subcollections")
  }
}

scan()
  .catch(console.error)
  .finally(() => process.exit(0))

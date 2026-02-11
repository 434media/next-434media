/**
 * Scan the OLD Firestore (media-analytics-proxy) for emails by specific sources
 * Run with: npx tsx scripts/scan-old-sources.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

const credPath = resolve(homedir(), "Downloads/media-analytics-proxy.json")
const credentials = JSON.parse(readFileSync(credPath, "utf-8"))

const oldApp = admin.initializeApp(
  { credential: admin.credential.cert(credentials) },
  "old-firestore-scan"
)
const oldDb = oldApp.firestore()

const TARGET_SOURCES = ["txmx", "434media", "vemosvamos", "digitalcanvas"]

async function scan() {
  console.log("\n=== Scanning OLD Firestore (media-analytics-proxy) ===\n")

  // Scan email_signups
  console.log("--- email_signups collection ---")
  const emailSnap = await oldDb.collection("email_signups").get()
  console.log(`Total documents: ${emailSnap.size}`)

  const sourceCounts: Record<string, number> = {}
  const matched: Record<string, { email: string; source: string; tags: string[]; created_at: string; id: string }[]> = {}

  for (const src of TARGET_SOURCES) {
    matched[src] = []
  }

  emailSnap.docs.forEach((doc) => {
    const data = doc.data()
    const source = data.source || "Unknown"
    sourceCounts[source] = (sourceCounts[source] || 0) + 1

    const srcLower = source.toLowerCase().replace(/[\s_-]/g, "")
    for (const target of TARGET_SOURCES) {
      const targetNorm = target.toLowerCase().replace(/[\s_-]/g, "")
      if (srcLower === targetNorm || srcLower.includes(targetNorm) || targetNorm.includes(srcLower)) {
        matched[target].push({
          email: data.email,
          source: data.source,
          tags: data.mailchimp_tags || [],
          created_at: data.created_at || "",
          id: doc.id,
        })
      }
    }
  })

  console.log("\nAll sources breakdown:")
  const sorted = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])
  for (const [src, count] of sorted) {
    console.log(`  ${src}: ${count}`)
  }

  for (const target of TARGET_SOURCES) {
    const emails = matched[target]
    console.log(`\n=== ${target.toUpperCase()} emails: ${emails.length} ===`)
    if (emails.length > 0) {
      emails.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const show = emails.length > 30 ? emails.slice(0, 30) : emails
      show.forEach((e) => {
        console.log(`  ${e.email} | source: ${e.source} | tags: ${JSON.stringify(e.tags)} | date: ${e.created_at}`)
      })
      if (emails.length > 30) {
        console.log(`  ... and ${emails.length - 30} more`)
      }
    }
  }

  // Also check contact_forms collection
  console.log("\n\n--- contact_forms collection ---")
  try {
    const contactSnap = await oldDb.collection("contact_forms").get()
    console.log(`Total documents: ${contactSnap.size}`)

    if (contactSnap.size > 0) {
      const cfSourceCounts: Record<string, number> = {}
      const cfMatched: Record<string, any[]> = {}
      for (const src of TARGET_SOURCES) cfMatched[src] = []

      contactSnap.docs.forEach((doc) => {
        const data = doc.data()
        const source = data.source || "Unknown"
        cfSourceCounts[source] = (cfSourceCounts[source] || 0) + 1

        const srcLower = source.toLowerCase().replace(/[\s_-]/g, "")
        for (const target of TARGET_SOURCES) {
          const targetNorm = target.toLowerCase().replace(/[\s_-]/g, "")
          if (srcLower === targetNorm || srcLower.includes(targetNorm) || targetNorm.includes(srcLower)) {
            cfMatched[target].push({
              email: data.email,
              firstName: data.firstName,
              lastName: data.lastName,
              source: data.source,
              created_at: data.created_at || "",
              id: doc.id,
            })
          }
        }
      })

      console.log("Sources:", JSON.stringify(cfSourceCounts, null, 2))

      for (const target of TARGET_SOURCES) {
        const items = cfMatched[target]
        if (items.length > 0) {
          console.log(`\n  ${target.toUpperCase()} contact forms: ${items.length}`)
          items.forEach((e) => {
            console.log(`    ${e.firstName} ${e.lastName} | ${e.email} | source: ${e.source} | date: ${e.created_at}`)
          })
        }
      }
    }
  } catch (err) {
    console.log("No contact_forms collection or error:", err)
  }

  // Check other collections with email fields
  console.log("\n\n--- Other collections with email fields ---")
  const collections = await oldDb.listCollections()
  for (const col of collections) {
    if (col.id === "email_signups" || col.id === "contact_forms") continue
    const sample = await col.limit(2).get()
    if (!sample.empty) {
      const fields = Object.keys(sample.docs[0].data())
      if (fields.includes("email") || fields.includes("Email")) {
        const allDocs = await col.get()
        const colSourceCounts: Record<string, number> = {}
        allDocs.docs.forEach((doc) => {
          const d = doc.data()
          const src = d.source || d.Source || "Unknown"
          colSourceCounts[src] = (colSourceCounts[src] || 0) + 1
        })
        console.log(`\n  "${col.id}" (${allDocs.size} docs) sources:`, JSON.stringify(colSourceCounts))
      }
    }
  }

  console.log("\n=== Scan complete ===\n")
}

scan()
  .catch(console.error)
  .finally(() => process.exit(0))

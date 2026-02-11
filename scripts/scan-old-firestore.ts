/**
 * Scan the OLD Firestore database (media-analytics-proxy) for AIM newsletter emails
 * Run with: npx tsx scripts/scan-old-firestore.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

// Load old service account credentials
const credPath = resolve(homedir(), "Downloads/media-analytics-proxy.json")
const credentials = JSON.parse(readFileSync(credPath, "utf-8"))

// Initialize with the OLD project
const oldApp = admin.initializeApp(
  {
    credential: admin.credential.cert(credentials),
  },
  "old-firestore"
)

const oldDb = oldApp.firestore()

async function scanOldFirestore() {
  const cutoffDate = new Date("2026-01-05T00:00:00.000Z")

  console.log("\n=== Scanning OLD Firestore (media-analytics-proxy) ===\n")

  // 1. List all collections
  console.log("--- All Collections ---")
  const collections = await oldDb.listCollections()
  for (const col of collections) {
    const countResult = await col.count().get()
    const count = countResult.data().count
    console.log(`  ${col.id}: ${count} documents`)
  }

  // 2. Check email_signups collection
  console.log("\n--- email_signups collection ---")
  try {
    const emailSignupsSnap = await oldDb.collection("email_signups").get()
    console.log(`Total documents: ${emailSignupsSnap.size}`)

    if (emailSignupsSnap.size > 0) {
      // Count by source
      const sourceCounts: Record<string, number> = {}
      const tagCounts: Record<string, number> = {}
      const aimEmails: { email: string; source: string; tags: string[]; created_at: string; id: string }[] = []

      emailSignupsSnap.docs.forEach((doc) => {
        const data = doc.data()
        const source = data.source || "Unknown"
        sourceCounts[source] = (sourceCounts[source] || 0) + 1

        if (data.mailchimp_tags) {
          for (const tag of data.mailchimp_tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          }
        }

        // Collect AIM emails
        const srcLower = (data.source || "").toLowerCase()
        const tags = data.mailchimp_tags || []
        if (
          srcLower === "aim" ||
          srcLower.includes("aim") ||
          tags.includes("web-newsletter") ||
          tags.includes("newsletter-signup")
        ) {
          aimEmails.push({
            email: data.email,
            source: data.source,
            tags: data.mailchimp_tags || [],
            created_at: data.created_at || "",
            id: doc.id,
          })
        }
      })

      console.log("\nSources:", JSON.stringify(sourceCounts, null, 2))
      console.log("\nTags:", JSON.stringify(tagCounts, null, 2))

      console.log(`\nAIM/newsletter emails found: ${aimEmails.length}`)

      // Filter after cutoff
      const aimAfterCutoff = aimEmails.filter((e) => {
        if (!e.created_at) return false
        return new Date(e.created_at) >= cutoffDate
      })
      console.log(`AIM/newsletter emails after Jan 5, 2026: ${aimAfterCutoff.length}`)

      if (aimAfterCutoff.length > 0) {
        console.log("\nEmails after Jan 5, 2026:")
        aimAfterCutoff.forEach((e) => {
          console.log(`  - ${e.email} | source: ${e.source} | tags: ${JSON.stringify(e.tags)} | date: ${e.created_at}`)
        })
      }

      // Also show ALL AIM emails regardless of date
      const allAim = aimEmails.filter((e) => (e.source || "").toLowerCase() === "aim")
      console.log(`\nAll AIM-source emails: ${allAim.length}`)
      if (allAim.length > 0 && allAim.length <= 50) {
        allAim.forEach((e) => {
          console.log(`  - ${e.email} | date: ${e.created_at} | tags: ${JSON.stringify(e.tags)}`)
        })
      } else if (allAim.length > 50) {
        // Show newest 20
        allAim.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        console.log("(Showing newest 20):")
        allAim.slice(0, 20).forEach((e) => {
          console.log(`  - ${e.email} | date: ${e.created_at} | tags: ${JSON.stringify(e.tags)}`)
        })
      }
    }
  } catch (err) {
    console.log("No email_signups collection or error:", err)
  }

  // 3. Check for any other collections that might have email/newsletter data
  console.log("\n--- Checking other collections for email data ---")
  for (const col of collections) {
    if (col.id === "email_signups") continue

    const sample = await col.limit(3).get()
    if (!sample.empty) {
      const fields = Object.keys(sample.docs[0].data())
      if (fields.includes("email") || fields.includes("Email")) {
        console.log(`\n  Collection "${col.id}" has email field. Sample:`)
        sample.docs.forEach((doc) => {
          const d = doc.data()
          console.log(`    ${JSON.stringify({ email: d.email || d.Email, source: d.source || d.Source, created_at: d.created_at || d.createdTime })}`)
        })

        // Count AIM entries
        try {
          const aimDocs = await col.where("source", "==", "AIM").get()
          if (!aimDocs.empty) {
            console.log(`    → Found ${aimDocs.size} AIM-source docs in "${col.id}"`)
          }
        } catch {
          // field might not exist
        }
      }
    }
  }

  console.log("\n=== Scan complete ===\n")
}

scanOldFirestore()
  .catch(console.error)
  .finally(() => process.exit(0))

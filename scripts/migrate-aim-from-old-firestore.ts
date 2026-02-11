/**
 * Migrate AIM newsletter emails from old Firestore (media-analytics-proxy)
 * to new Firestore (groovy-ego-462522-v2)
 * 
 * Targets: source=AIM emails after Jan 5, 2026 that are missing from new DB
 * 
 * Run with: npx tsx scripts/migrate-aim-from-old-firestore.ts
 */

import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"
import { homedir } from "os"

// ── Initialize OLD Firestore (media-analytics-proxy) ──
const oldCredPath = resolve(homedir(), "Downloads/media-analytics-proxy.json")
const oldCredentials = JSON.parse(readFileSync(oldCredPath, "utf-8"))

const oldApp = admin.initializeApp(
  {
    credential: admin.credential.cert(oldCredentials),
  },
  "old-db"
)
const oldDb = oldApp.firestore()

// ── Initialize NEW Firestore (groovy-ego-462522-v2) ──
// Load from .env.local
const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
const envVars: Record<string, string> = {}
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    let value = match[2].trim()
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    envVars[match[1].trim()] = value
  }
})

let newCredentials: { project_id: string; client_email: string; private_key: string }

if (envVars.GOOGLE_SERVICE_ACCOUNT_KEY) {
  const parsed = JSON.parse(envVars.GOOGLE_SERVICE_ACCOUNT_KEY)
  newCredentials = {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  }
} else {
  let pk = envVars.FIREBASE_PRIVATE_KEY || ""
  pk = pk.replace(/\\n/g, "\n")
  newCredentials = {
    project_id: envVars.FIREBASE_PROJECT_ID,
    client_email: envVars.FIREBASE_CLIENT_EMAIL,
    private_key: pk,
  }
}

const newApp = admin.initializeApp(
  {
    credential: admin.credential.cert({
      projectId: newCredentials.project_id,
      clientEmail: newCredentials.client_email,
      privateKey: newCredentials.private_key,
    }),
  },
  "new-db"
)
const newDb = newApp.firestore()

async function migrate() {
  const cutoffDate = new Date("2026-01-05T00:00:00.000Z")

  console.log("\n=== Migrating AIM emails from old Firestore → new Firestore ===")
  console.log(`Old DB: media-analytics-proxy`)
  console.log(`New DB: ${newCredentials.project_id}`)
  console.log(`Cutoff: ${cutoffDate.toISOString()}\n`)

  // 1. Fetch ALL AIM emails from old DB (not just after cutoff - migrate everything missing)
  const oldSnapshot = await oldDb
    .collection("email_signups")
    .where("source", "==", "AIM")
    .get()

  console.log(`Total AIM emails in old DB: ${oldSnapshot.size}`)

  // Filter to after cutoff date
  const emailsToMigrate = oldSnapshot.docs.filter((doc) => {
    const data = doc.data()
    if (!data.created_at) return false
    return new Date(data.created_at) >= cutoffDate
  })

  console.log(`AIM emails after Jan 5, 2026: ${emailsToMigrate.length}\n`)

  // 2. Migrate each email to new DB (skip duplicates)
  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const doc of emailsToMigrate) {
    const data = doc.data()
    const emailLower = (data.email || "").toLowerCase().trim()

    if (!emailLower) {
      console.log(`  SKIP: empty email (doc ${doc.id})`)
      skipped++
      continue
    }

    try {
      // Check if already exists in new DB
      const existing = await newDb
        .collection("email_signups")
        .where("email", "==", emailLower)
        .where("source", "==", "AIM")
        .limit(1)
        .get()

      if (!existing.empty) {
        console.log(`  SKIP: ${emailLower} (already exists)`)
        skipped++
        continue
      }

      // Save to new DB
      await newDb.collection("email_signups").add({
        email: emailLower,
        source: data.source || "AIM",
        created_at: data.created_at || new Date().toISOString(),
        mailchimp_synced: data.mailchimp_synced || false,
        mailchimp_tags: data.mailchimp_tags || ["web-aimsummit", "newsletter-signup"],
        page_url: data.page_url || "",
        ip_address: data.ip_address || "",
        user_agent: data.user_agent || "",
      })

      console.log(`  MIGRATED: ${emailLower} | date: ${data.created_at} | tags: ${JSON.stringify(data.mailchimp_tags || [])}`)
      migrated++
    } catch (err) {
      console.error(`  ERROR: ${emailLower}:`, err)
      errors++
    }
  }

  console.log("\n=== Migration Results ===")
  console.log(`Total processed: ${emailsToMigrate.length}`)
  console.log(`Migrated: ${migrated}`)
  console.log(`Skipped (existing): ${skipped}`)
  console.log(`Errors: ${errors}`)
  console.log("========================\n")
}

migrate()
  .catch(console.error)
  .finally(() => process.exit(0))

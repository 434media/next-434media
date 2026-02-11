/**
 * Diagnostic script to scan Firestore for AIM newsletter emails
 * Run with: npx tsx scripts/scan-aim-emails.ts
 */

import { readFileSync } from "fs"
import { resolve } from "path"

// Manually parse .env.local
const envPath = resolve(process.cwd(), ".env.local")
try {
  const envContent = readFileSync(envPath, "utf-8")
  const lines = envContent.split("\n")
  let currentKey = ""
  let currentValue = ""
  let inMultiline = false

  for (const line of lines) {
    if (inMultiline) {
      currentValue += "\n" + line
      // Check if value ends with a closing quote that isn't escaped
      if (line.endsWith("'") || line.endsWith('"')) {
        process.env[currentKey] = currentValue.slice(0, -1) // Remove trailing quote
        inMultiline = false
      }
      continue
    }

    const match = line.match(/^(\w+)=(.*)$/)
    if (match) {
      const [, key, rawValue] = match
      // Check for multiline values (starts with quote but doesn't end)
      if ((rawValue.startsWith("'") || rawValue.startsWith('"')) && !rawValue.endsWith(rawValue[0])) {
        currentKey = key
        currentValue = rawValue.slice(1) // Remove leading quote
        inMultiline = true
      } else {
        // Single-line value, strip surrounding quotes
        let value = rawValue
        if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    }
  }
} catch (e) {
  console.error("Could not read .env.local:", e)
  process.exit(1)
}

import admin from "firebase-admin"

// Initialize Firebase
const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
let credentials: { project_id: string; client_email: string; private_key: string }

if (serviceAccountKey) {
  const parsed = JSON.parse(serviceAccountKey)
  credentials = {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  }
} else {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || ""
  privateKey = privateKey.replace(/\\n/g, "\n")
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1).replace(/\\n/g, "\n")
  }
  credentials = { project_id: projectId!, client_email: clientEmail!, private_key: privateKey }
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key,
    }),
  })
}

const db = admin.firestore()
db.settings({ ignoreUndefinedProperties: true })

async function scanAIMEmails() {
  const cutoffDate = new Date("2026-01-05T00:00:00.000Z")

  console.log("\n=== Scanning email_signups collection ===")
  console.log(`Looking for: source=AIM OR tags containing 'web-newsletter', after ${cutoffDate.toISOString()}\n`)

  // 1. Query email_signups for source=AIM
  const aimSnapshot = await db.collection("email_signups").where("source", "==", "AIM").get()
  console.log(`Total AIM emails in email_signups: ${aimSnapshot.size}`)

  const aimAfterCutoff = aimSnapshot.docs.filter((doc) => {
    const data = doc.data()
    const createdAt = new Date(data.created_at)
    return createdAt >= cutoffDate
  })
  console.log(`AIM emails after Jan 5, 2026: ${aimAfterCutoff.length}`)
  
  if (aimAfterCutoff.length > 0) {
    console.log("\nAIM emails after Jan 5:")
    aimAfterCutoff.forEach((doc) => {
      const d = doc.data()
      console.log(`  - ${d.email} | source: ${d.source} | tags: ${JSON.stringify(d.mailchimp_tags || [])} | date: ${d.created_at}`)
    })
  }

  // 2. Check all sources in email_signups
  console.log("\n=== All sources in email_signups ===")
  const allSnapshot = await db.collection("email_signups").get()
  const sourceCounts: Record<string, number> = {}
  const tagCounts: Record<string, number> = {}

  allSnapshot.docs.forEach((doc) => {
    const data = doc.data()
    const source = data.source || "Unknown"
    sourceCounts[source] = (sourceCounts[source] || 0) + 1
    
    if (data.mailchimp_tags) {
      for (const tag of data.mailchimp_tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }
  })
  
  console.log("Sources:", JSON.stringify(sourceCounts, null, 2))
  console.log("\nTags:", JSON.stringify(tagCounts, null, 2))

  // 3. Find emails with web-newsletter tag
  const newsletterTagged = allSnapshot.docs.filter((doc) => {
    const data = doc.data()
    const tags = data.mailchimp_tags || []
    return tags.includes("web-newsletter") || tags.includes("newsletter-signup")
  })

  const newsletterAfterCutoff = newsletterTagged.filter((doc) => {
    const data = doc.data()
    const createdAt = new Date(data.created_at)
    return createdAt >= cutoffDate
  })

  console.log(`\nEmails with newsletter tags: ${newsletterTagged.length}`)
  console.log(`Newsletter-tagged emails after Jan 5, 2026: ${newsletterAfterCutoff.length}`)

  // 4. Check all Firestore collections for any AIM-related data
  console.log("\n=== Checking other collections ===")
  
  // Check contact_forms for AIM
  const contactAIM = await db.collection("contact_forms").where("source", "==", "AIM").get()
  console.log(`AIM entries in contact_forms: ${contactAIM.size}`)

  // 5. Look for any "aim" source variants (case-insensitive search by checking common patterns)
  const possibleAimSources = allSnapshot.docs.filter((doc) => {
    const data = doc.data()
    const source = (data.source || "").toLowerCase()
    return source.includes("aim") || source === "aims" || source === "aimsatx"
  })
  console.log(`\nAll aim-like sources in email_signups: ${possibleAimSources.length}`)
  
  const sourceVariants = new Set<string>()
  possibleAimSources.forEach((doc) => sourceVariants.add(doc.data().source))
  if (sourceVariants.size > 0) {
    console.log("Source name variants found:", Array.from(sourceVariants))
  }

  // 6. List ALL collections in the database
  console.log("\n=== All Firestore collections ===")
  const collections = await db.listCollections()
  for (const col of collections) {
    const count = (await col.count().get()).data().count
    console.log(`  ${col.id}: ${count} documents`)
  }

  // 7. Look for any collection that might contain AIM newsletter data
  for (const col of collections) {
    if (col.id === "email_signups" || col.id === "contact_forms") continue
    
    // Check a sample doc for source or email fields
    const sample = await col.limit(1).get()
    if (!sample.empty) {
      const fields = Object.keys(sample.docs[0].data())
      if (fields.includes("email") || fields.includes("source")) {
        // Check for AIM data
        try {
          const aimDocs = await col.where("source", "==", "AIM").get()
          if (!aimDocs.empty) {
            console.log(`\n  Found ${aimDocs.size} AIM docs in collection: ${col.id}`)
            aimDocs.docs.slice(0, 3).forEach((doc) => {
              const d = doc.data()
              console.log(`    - ${JSON.stringify({ email: d.email, source: d.source, created_at: d.created_at })}`)
            })
          }
        } catch {
          // Field not indexed, skip
        }
      }
    }
  }

  console.log("\n=== Scan complete ===\n")

  // Additional: Show recent emails across ALL sources since Jan 5 2026
  console.log("=== ALL emails after Jan 5 2026 (all sources) ===")
  const recentAll = allSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as any))
    .filter((e: any) => new Date(e.created_at) >= cutoffDate)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  console.log(`Total emails after Jan 5 2026: ${recentAll.length}`)
  recentAll.forEach((e: any) => {
    console.log(`  ${e.created_at} | ${e.source} | ${e.email} | tags: ${JSON.stringify(e.mailchimp_tags || [])}`)
  })

  // Also check all AIM emails since Dec 1 2025
  console.log("\n=== AIM emails since Dec 1 2025 ===")
  const decCutoff = new Date("2025-12-01T00:00:00.000Z")
  const aimSinceDec = aimSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as any))
    .filter((e: any) => new Date(e.created_at) >= decCutoff)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  console.log(`AIM emails since Dec 1 2025: ${aimSinceDec.length}`)
  aimSinceDec.slice(0, 10).forEach((e: any) => {
    console.log(`  ${e.created_at} | ${e.email} | tags: ${JSON.stringify(e.mailchimp_tags || [])}`)
  })

  // 8. Check Airtable for AIM emails after Jan 5 2026
  console.log("\n=== Checking Airtable for recent AIM emails ===")
  try {
    const Airtable = (await import("airtable")).default
    const airtableApiKey = process.env.AIRTABLE_API_KEY
    const airtableBaseId = process.env.AIRTABLE_CONTACTS_BASE_ID || process.env.AIRTABLE_BASE_ID || "appjhfV2ev2hb2hox"
    
    if (!airtableApiKey) {
      console.log("  No AIRTABLE_API_KEY found, skipping Airtable check")
    } else {
      const base = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId)
      
      // Get AIM emails from Airtable after Jan 5 2026
      const records = await base("Email Sign Up (All Sites)")
        .select({
          filterByFormula: `AND({Source} = 'AIM', IS_AFTER({Created Time}, '2026-01-05'))`,
          sort: [{ field: "Created Time", direction: "desc" }],
        })
        .all()
      
      console.log(`  AIM emails in Airtable after Jan 5 2026: ${records.length}`)
      records.forEach((r) => {
        console.log(`    ${r.fields["Created Time"]} | ${r.fields["Email"]} | source: ${r.fields["Source"]}`)
      })

      // Also get ALL source counts from Airtable
      const allRecords = await base("Email Sign Up (All Sites)")
        .select({
          filterByFormula: `IS_AFTER({Created Time}, '2026-01-05')`,
          sort: [{ field: "Created Time", direction: "desc" }],
        })
        .all()
      
      console.log(`\n  ALL Airtable emails after Jan 5 2026: ${allRecords.length}`)
      const atSourceCounts: Record<string, number> = {}
      allRecords.forEach((r) => {
        const src = (r.fields["Source"] as string) || "Unknown"
        atSourceCounts[src] = (atSourceCounts[src] || 0) + 1
      })
      console.log("  Source breakdown:", JSON.stringify(atSourceCounts, null, 4))
      
      allRecords.forEach((r) => {
        console.log(`    ${r.fields["Created Time"]} | ${r.fields["Source"]} | ${r.fields["Email"]}`)
      })
    }
  } catch (err) {
    console.error("  Airtable check failed:", err)
  }
}

scanAIMEmails().catch(console.error).finally(() => process.exit(0))

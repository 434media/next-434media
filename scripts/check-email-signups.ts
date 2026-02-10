/**
 * Script to check Firestore email_signups collection
 * for emails received after January 5, 2026
 * 
 * Run with: npx tsx scripts/check-email-signups.ts
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import admin from "firebase-admin"

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local")
try {
  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  console.warn("Could not load .env.local")
}

// Initialize Firebase
function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore()
  }

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (serviceAccountKey) {
    const credentials = JSON.parse(serviceAccountKey)
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        privateKey: credentials.private_key,
      }),
    })
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || ""
    privateKey = privateKey.replace(/\\n/g, "\n")
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId!,
        clientEmail: clientEmail!,
        privateKey,
      }),
    })
  }
  
  const db = admin.firestore()
  db.settings({ ignoreUndefinedProperties: true })
  return db
}

async function checkEmails() {
  const db = initFirebase()
  const cutoffDate = "2026-01-05T00:00:00.000Z"
  const sources = ["AIM", "DigitalCanvas", "TXMX", "434Media", "VemosVamos"]

  console.log("=".repeat(70))
  console.log("Firestore email_signups — Emails after January 5, 2026")
  console.log("=".repeat(70))

  // First get total counts per source
  console.log("\n📊 TOTAL COUNTS (all time):")
  console.log("-".repeat(50))
  
  const allSnapshot = await db.collection("email_signups").get()
  const allDocs = allSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<{ id: string; email: string; source: string; created_at: string }>
  
  const totalsBySource: Record<string, number> = {}
  for (const doc of allDocs) {
    totalsBySource[doc.source] = (totalsBySource[doc.source] || 0) + 1
  }
  
  for (const [source, count] of Object.entries(totalsBySource).sort(([,a], [,b]) => b - a)) {
    console.log(`  ${source}: ${count}`)
  }
  console.log(`  TOTAL: ${allDocs.length}`)

  // Now check each source for post-Jan 5 emails
  console.log("\n📬 EMAILS AFTER JANUARY 5, 2026:")
  console.log("=".repeat(70))

  for (const source of sources) {
    const sourceDocs = allDocs.filter(d => d.source === source)
    const afterCutoff = sourceDocs.filter(d => d.created_at >= cutoffDate)
    
    console.log(`\n🔍 ${source}:`)
    console.log(`   Total: ${sourceDocs.length} | After Jan 5: ${afterCutoff.length}`)
    
    if (afterCutoff.length > 0) {
      console.log("   Recent emails:")
      afterCutoff
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .forEach(doc => {
          const date = new Date(doc.created_at).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
          })
          console.log(`     ${date} — ${doc.email}`)
        })
      if (afterCutoff.length > 10) {
        console.log(`     ... and ${afterCutoff.length - 10} more`)
      }
    } else {
      console.log("   ⚠️  NO emails found after January 5, 2026")
      
      // Show most recent email for this source
      if (sourceDocs.length > 0) {
        const latest = sourceDocs.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        const date = new Date(latest.created_at).toLocaleDateString("en-US", {
          year: "numeric", month: "short", day: "numeric"
        })
        console.log(`   Last email received: ${date} — ${latest.email}`)
      }
    }
  }

  // Check for any other sources that DO have post-Jan 5 emails
  console.log("\n📋 ALL SOURCES WITH POST-JAN 5 ACTIVITY:")
  console.log("-".repeat(50))
  const allAfterCutoff = allDocs.filter(d => d.created_at >= cutoffDate)
  const afterBySource: Record<string, number> = {}
  for (const doc of allAfterCutoff) {
    afterBySource[doc.source] = (afterBySource[doc.source] || 0) + 1
  }
  for (const [source, count] of Object.entries(afterBySource).sort(([,a], [,b]) => b - a)) {
    console.log(`  ${source}: ${count}`)
  }
  if (Object.keys(afterBySource).length === 0) {
    console.log("  ⚠️  NO emails from ANY source after January 5, 2026!")
  }
  
  console.log("\n" + "=".repeat(70))
  process.exit(0)
}

checkEmails().catch(err => {
  console.error("Error:", err)
  process.exit(1)
})

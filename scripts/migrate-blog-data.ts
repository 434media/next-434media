/**
 * Migration Script: Migrate Blog Data from media-analytics-proxy to groovy-ego
 * 
 * This script reads blog data from the source Firebase project (media-analytics-proxy)
 * and migrates missing records to the destination project (groovy-ego-462522-v2).
 * 
 * Usage:
 *   npx tsx scripts/migrate-blog-data.ts
 */

import admin from "firebase-admin"
import * as fs from "fs"
import * as path from "path"

// Blog collection names to migrate
const COLLECTIONS_TO_MIGRATE = [
  "blog_posts",
  "blog_categories",
]

// Source project credentials (media-analytics-proxy)
const SOURCE_CREDENTIALS_PATH = path.join(
  process.env.HOME || "",
  "Downloads",
  "media-analytics-proxy.json"
)

// Destination project credentials (groovy-ego)
const DEST_CREDENTIALS_PATH = path.join(
  process.env.HOME || "",
  "Downloads", 
  "groovy-ego.json"
)

interface MigrationStats {
  collection: string
  sourceCount: number
  destCount: number
  migrated: number
  skipped: number
  errors: string[]
}

async function loadCredentials(filePath: string): Promise<admin.ServiceAccount> {
  const content = fs.readFileSync(filePath, "utf-8")
  return JSON.parse(content) as admin.ServiceAccount
}

async function initializeApps(): Promise<{ sourceApp: admin.app.App; destApp: admin.app.App }> {
  console.log("🔧 Initializing Firebase apps...")
  
  // Load credentials
  const sourceCredentials = await loadCredentials(SOURCE_CREDENTIALS_PATH)
  const destCredentials = await loadCredentials(DEST_CREDENTIALS_PATH)
  
  console.log(`   Source project: ${(sourceCredentials as any).project_id}`)
  console.log(`   Destination project: ${(destCredentials as any).project_id}`)
  
  // Initialize source app
  const sourceApp = admin.initializeApp({
    credential: admin.credential.cert(sourceCredentials),
  }, "source-media-analytics-proxy-blog")
  
  // Initialize destination app
  const destApp = admin.initializeApp({
    credential: admin.credential.cert(destCredentials),
  }, "dest-groovy-ego-blog")
  
  console.log("✅ Firebase apps initialized\n")
  
  return { sourceApp, destApp }
}

async function getExistingIds(
  db: admin.firestore.Firestore,
  collectionName: string
): Promise<Set<string>> {
  const snapshot = await db.collection(collectionName).get()
  return new Set(snapshot.docs.map(doc => doc.id))
}

async function migrateCollection(
  sourceDb: admin.firestore.Firestore,
  destDb: admin.firestore.Firestore,
  collectionName: string
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    collection: collectionName,
    sourceCount: 0,
    destCount: 0,
    migrated: 0,
    skipped: 0,
    errors: [],
  }
  
  console.log(`\n📦 Migrating collection: ${collectionName}`)
  console.log("─".repeat(50))
  
  try {
    // Get all documents from source
    const sourceSnapshot = await sourceDb.collection(collectionName).get()
    stats.sourceCount = sourceSnapshot.docs.length
    console.log(`   Source documents: ${stats.sourceCount}`)
    
    if (stats.sourceCount === 0) {
      console.log(`   ⚠️  No documents found in source collection`)
      return stats
    }
    
    // Get existing IDs in destination
    const existingIds = await getExistingIds(destDb, collectionName)
    stats.destCount = existingIds.size
    console.log(`   Existing in destination: ${stats.destCount}`)
    
    // Migrate missing documents
    const batch = destDb.batch()
    let batchCount = 0
    const MAX_BATCH_SIZE = 500 // Firestore batch limit
    
    for (const doc of sourceSnapshot.docs) {
      const docId = doc.id
      const data = doc.data()
      
      // Skip if already exists
      if (existingIds.has(docId)) {
        stats.skipped++
        continue
      }
      
      try {
        // Add to batch
        const destDocRef = destDb.collection(collectionName).doc(docId)
        batch.set(destDocRef, {
          ...data,
          _migrated_from: "media-analytics-proxy",
          _migrated_at: admin.firestore.FieldValue.serverTimestamp(),
        })
        batchCount++
        stats.migrated++
        
        // Get display name based on collection type
        const displayName = data.title || data.name || data.slug || docId
        console.log(`   ✓ Queued: ${docId} - ${displayName}`)
        
        // Commit batch if it's full
        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit()
          console.log(`   📤 Committed batch of ${batchCount} documents`)
          batchCount = 0
        }
      } catch (error) {
        const errorMsg = `Failed to migrate ${docId}: ${error instanceof Error ? error.message : String(error)}`
        stats.errors.push(errorMsg)
        console.error(`   ❌ ${errorMsg}`)
      }
    }
    
    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit()
      console.log(`   📤 Committed final batch of ${batchCount} documents`)
    }
    
    console.log(`\n   Summary for ${collectionName}:`)
    console.log(`   • Migrated: ${stats.migrated}`)
    console.log(`   • Skipped (already exists): ${stats.skipped}`)
    console.log(`   • Errors: ${stats.errors.length}`)
    
  } catch (error) {
    const errorMsg = `Collection error: ${error instanceof Error ? error.message : String(error)}`
    stats.errors.push(errorMsg)
    console.error(`   ❌ ${errorMsg}`)
  }
  
  return stats
}

async function main() {
  console.log("═".repeat(60))
  console.log("  Blog Data Migration: media-analytics-proxy → groovy-ego")
  console.log("═".repeat(60))
  console.log()
  
  // Check if credential files exist
  if (!fs.existsSync(SOURCE_CREDENTIALS_PATH)) {
    console.error(`❌ Source credentials not found: ${SOURCE_CREDENTIALS_PATH}`)
    process.exit(1)
  }
  
  if (!fs.existsSync(DEST_CREDENTIALS_PATH)) {
    console.error(`❌ Destination credentials not found: ${DEST_CREDENTIALS_PATH}`)
    process.exit(1)
  }
  
  let sourceApp: admin.app.App | null = null
  let destApp: admin.app.App | null = null
  
  try {
    // Initialize Firebase apps
    const apps = await initializeApps()
    sourceApp = apps.sourceApp
    destApp = apps.destApp
    
    const sourceDb = sourceApp.firestore()
    const destDb = destApp.firestore()
    
    // Migrate each collection
    const allStats: MigrationStats[] = []
    
    for (const collectionName of COLLECTIONS_TO_MIGRATE) {
      const stats = await migrateCollection(sourceDb, destDb, collectionName)
      allStats.push(stats)
    }
    
    // Print final summary
    console.log("\n" + "═".repeat(60))
    console.log("  MIGRATION COMPLETE - FINAL SUMMARY")
    console.log("═".repeat(60))
    
    let totalMigrated = 0
    let totalSkipped = 0
    let totalErrors = 0
    
    for (const stats of allStats) {
      console.log(`\n  ${stats.collection}:`)
      console.log(`    Source: ${stats.sourceCount} | Dest before: ${stats.destCount}`)
      console.log(`    Migrated: ${stats.migrated} | Skipped: ${stats.skipped} | Errors: ${stats.errors.length}`)
      
      totalMigrated += stats.migrated
      totalSkipped += stats.skipped
      totalErrors += stats.errors.length
      
      if (stats.errors.length > 0) {
        console.log(`    Errors:`)
        stats.errors.forEach(e => console.log(`      - ${e}`))
      }
    }
    
    console.log("\n" + "─".repeat(60))
    console.log(`  TOTALS: Migrated: ${totalMigrated} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`)
    console.log("═".repeat(60))
    
    if (totalErrors > 0) {
      console.log("\n⚠️  Migration completed with errors. Check the logs above.")
      process.exit(1)
    } else {
      console.log("\n✅ Migration completed successfully!")
    }
    
  } catch (error) {
    console.error("\n❌ Migration failed:", error)
    process.exit(1)
  } finally {
    // Clean up Firebase apps
    if (sourceApp) {
      await sourceApp.delete()
    }
    if (destApp) {
      await destApp.delete()
    }
  }
}

// Run the migration
main().catch(console.error)

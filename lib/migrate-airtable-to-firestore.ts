/**
 * Migration Script: Airtable to Firestore
 * 
 * This script migrates all data from Airtable to Google Firestore.
 * Run this script once to migrate existing data.
 * 
 * Usage:
 * 1. Ensure all environment variables are set (both Airtable and Firebase)
 * 2. Run: npx tsx app/lib/migrate-airtable-to-firestore.ts
 */

import { getDb, COLLECTIONS, TABLE_TO_COLLECTION } from "./firebase-admin"

// Import Airtable functions
import { getEventsFromAirtable } from "./airtable-events"
import { getFeedItems as getFeedItemsFromAirtable } from "./airtable-feed"
import { getBlogPostsFromAirtable } from "./airtable-blog"

// Import types
import type { Event } from "../types/event-types"
import type { FeedItem } from "./airtable-feed"
import type { BlogPost } from "../types/blog-types"

interface MigrationResult {
  collection: string
  success: number
  failed: number
  errors: string[]
}

// Migrate Events
async function migrateEvents(): Promise<MigrationResult> {
  const result: MigrationResult = {
    collection: COLLECTIONS.EVENTS,
    success: 0,
    failed: 0,
    errors: [],
  }

  try {
    console.log("\n📋 Fetching events from Airtable...")
    const events = await getEventsFromAirtable()
    console.log(`   Found ${events.length} events`)

    const db = getDb()
    const batch = db.batch()

    for (const event of events) {
      try {
        // Use Airtable ID as document ID to maintain reference
        const docRef = db.collection(COLLECTIONS.EVENTS).doc(event.id)
        
        // Remove id from data (it's the document ID)
        const { id, ...eventData } = event
        
        batch.set(docRef, {
          ...eventData,
          // Ensure dates are stored properly
          created_at: event.created_at || new Date().toISOString(),
          updated_at: event.updated_at || new Date().toISOString(),
          // Add migration metadata
          _migrated_from: "airtable",
          _migrated_at: new Date().toISOString(),
        })
        
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push(`Event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log("   Committing events to Firestore...")
    await batch.commit()
    console.log(`   ✅ Migrated ${result.success} events`)

  } catch (error) {
    console.error("   ❌ Failed to migrate events:", error)
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

// Migrate Feed Items from a specific table
async function migrateFeedTable(tableName: string, collectionName: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    collection: collectionName,
    success: 0,
    failed: 0,
    errors: [],
  }

  try {
    console.log(`\n📋 Fetching feed items from Airtable table: ${tableName}...`)
    const feedItems = await getFeedItemsFromAirtable({ tableName })
    console.log(`   Found ${feedItems.length} feed items in ${tableName}`)

    if (feedItems.length === 0) {
      console.log(`   ⚠️ No items found in ${tableName}`)
      return result
    }

    const db = getDb()
    
    // Process in smaller batches (Firestore limit is 500 per batch)
    const batchSize = 400
    for (let i = 0; i < feedItems.length; i += batchSize) {
      const batch = db.batch()
      const chunk = feedItems.slice(i, i + batchSize)

      for (const item of chunk) {
        try {
          // Use Airtable ID as document ID to maintain reference
          const docRef = db.collection(collectionName).doc(item.id!)
          
          // Remove id from data (it's the document ID)
          const { id, ...itemData } = item
          
          batch.set(docRef, {
            ...itemData,
            _source_table: tableName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            _migrated_from: "airtable",
            _migrated_at: new Date().toISOString(),
          })
          
          result.success++
        } catch (error) {
          result.failed++
          result.errors.push(`Feed ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      console.log(`   Committing batch ${Math.floor(i / batchSize) + 1}...`)
      await batch.commit()
    }

    console.log(`   ✅ Migrated ${result.success} feed items from ${tableName}`)

  } catch (error) {
    console.error(`   ❌ Failed to migrate ${tableName}:`, error)
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

// Migrate all Feed tables (THEFEED, 8COUNT, CULTUREDECK)
async function migrateAllFeedTables(): Promise<MigrationResult[]> {
  const feedTables = [
    { tableName: "THEFEED", collection: COLLECTIONS.FEED },
    { tableName: "8COUNT", collection: COLLECTIONS.FEED_8COUNT },
    { tableName: "CULTUREDECK", collection: COLLECTIONS.FEED_CULTUREDECK },
  ]

  const results: MigrationResult[] = []

  for (const { tableName, collection } of feedTables) {
    const result = await migrateFeedTable(tableName, collection)
    results.push(result)
  }

  return results
}

// Migrate Blog Posts
async function migrateBlog(): Promise<MigrationResult> {
  const result: MigrationResult = {
    collection: COLLECTIONS.BLOG_POSTS,
    success: 0,
    failed: 0,
    errors: [],
  }

  try {
    console.log("\n📋 Fetching blog posts from Airtable...")
    const posts = await getBlogPostsFromAirtable()
    console.log(`   Found ${posts.length} blog posts`)

    const db = getDb()
    const batch = db.batch()

    for (const post of posts) {
      try {
        // Use Airtable ID as document ID to maintain reference
        const docRef = db.collection(COLLECTIONS.BLOG_POSTS).doc(post.id)
        
        // Remove id from data (it's the document ID)
        const { id, ...postData } = post
        
        batch.set(docRef, {
          ...postData,
          _migrated_from: "airtable",
          _migrated_at: new Date().toISOString(),
        })
        
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push(`Blog ${post.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log("   Committing blog posts to Firestore...")
    await batch.commit()
    console.log(`   ✅ Migrated ${result.success} blog posts`)

  } catch (error) {
    console.error("   ❌ Failed to migrate blog:", error)
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

// Main migration function
export async function runMigration(): Promise<void> {
  console.log("🚀 Starting Airtable to Firestore Migration")
  console.log("==========================================")

  const results: MigrationResult[] = []

  // Migrate each collection
  results.push(await migrateEvents())
  
  // Migrate all feed tables (THEFEED, 8COUNT, CULTUREDECK)
  const feedResults = await migrateAllFeedTables()
  results.push(...feedResults)
  
  results.push(await migrateBlog())

  // Print summary
  console.log("\n==========================================")
  console.log("📊 MIGRATION SUMMARY")
  console.log("==========================================")

  let totalSuccess = 0
  let totalFailed = 0

  for (const result of results) {
    console.log(`\n${result.collection}:`)
    console.log(`   ✅ Success: ${result.success}`)
    console.log(`   ❌ Failed: ${result.failed}`)
    
    if (result.errors.length > 0) {
      console.log("   Errors:")
      result.errors.forEach(err => console.log(`      - ${err}`))
    }

    totalSuccess += result.success
    totalFailed += result.failed
  }

  console.log("\n==========================================")
  console.log(`TOTAL: ${totalSuccess} migrated, ${totalFailed} failed`)
  console.log("==========================================")

  if (totalFailed === 0) {
    console.log("\n✅ Migration completed successfully!")
    console.log("\nNext steps:")
    console.log("1. Verify data in Firebase Console")
    console.log("2. Update API routes to use Firestore functions")
    console.log("3. Test the application thoroughly")
    console.log("4. Remove Airtable environment variables when ready")
  } else {
    console.log("\n⚠️ Migration completed with errors. Please review above.")
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error)
      process.exit(1)
    })
}

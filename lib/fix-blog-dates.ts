/**
 * Fix Blog Post Dates Script
 * 
 * Updates missing created_at and updated_at fields in blog posts
 * to use the original published_at date from Airtable
 */

import { getDb, COLLECTIONS } from "./firebase-admin"

async function fixBlogPostDates() {
  console.log("🔧 Fixing blog post dates...")
  
  const db = getDb()
  const snapshot = await db.collection(COLLECTIONS.BLOG_POSTS).get()
  
  const batch = db.batch()
  let count = 0
  
  snapshot.docs.forEach(doc => {
    const data = doc.data()
    const updates: Record<string, string> = {}
    
    // If created_at is missing, use published_at or _migrated_at
    if (!data.created_at) {
      updates.created_at = data.published_at || data._migrated_at || new Date().toISOString()
    }
    
    // If updated_at is missing, use published_at or created_at
    if (!data.updated_at) {
      updates.updated_at = data.published_at || data.created_at || new Date().toISOString()
    }
    
    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates)
      count++
      console.log(`  Updating: ${data.title}`)
      console.log(`    published_at: ${data.published_at}`)
      console.log(`    created_at: ${updates.created_at || data.created_at}`)
    }
  })
  
  if (count > 0) {
    await batch.commit()
    console.log(`\n✅ Updated ${count} blog posts`)
  } else {
    console.log("\n✅ No updates needed - all dates are correct")
  }
}

// Run if executed directly
fixBlogPostDates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })

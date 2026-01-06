import { getDb } from "./firebase-admin"
import type { EmailSignup as AirtableEmailSignup } from "./airtable-contacts"

// Firestore email signup interface
export interface FirestoreEmailSignup {
  id?: string
  email: string
  source: string
  created_at: string
  mailchimp_synced?: boolean
  mailchimp_tags?: string[]
  ip_address?: string
  user_agent?: string
  page_url?: string
}

const COLLECTION_NAME = "email_signups"

/**
 * Save an email signup to Firestore
 */
export async function saveEmailSignup(data: Omit<FirestoreEmailSignup, "id">): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = getDb()
    
    // Check if email already exists for this source
    const existing = await db
      .collection(COLLECTION_NAME)
      .where("email", "==", data.email.toLowerCase())
      .where("source", "==", data.source)
      .limit(1)
      .get()
    
    if (!existing.empty) {
      console.log(`[Firestore] Email ${data.email} already exists for source ${data.source}`)
      return { success: true, id: existing.docs[0].id }
    }
    
    const docRef = await db.collection(COLLECTION_NAME).add({
      ...data,
      email: data.email.toLowerCase(),
      created_at: data.created_at || new Date().toISOString(),
    })
    
    console.log(`[Firestore] Saved email signup: ${data.email} from ${data.source}`)
    return { success: true, id: docRef.id }
  } catch (error) {
    console.error("[Firestore] Failed to save email signup:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Delete an email signup from Firestore
 */
export async function deleteEmailSignup(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb()
    
    const docRef = db.collection(COLLECTION_NAME).doc(id)
    const doc = await docRef.get()
    
    if (!doc.exists) {
      return { success: false, error: "Email signup not found" }
    }
    
    await docRef.delete()
    
    console.log(`[Firestore] Deleted email signup: ${id}`)
    return { success: true }
  } catch (error) {
    console.error("[Firestore] Failed to delete email signup:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Get email signups with optional filtering
 * Note: Sorting is done client-side to avoid needing Firestore composite indexes
 */
export async function getEmailSignups(filters?: {
  source?: string
  startDate?: string
  endDate?: string
  limit?: number
}): Promise<FirestoreEmailSignup[]> {
  try {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTION_NAME)
    
    if (filters?.source) {
      query = query.where("source", "==", filters.source)
    }
    
    // Skip orderBy to avoid needing composite index - we'll sort client-side
    // This is fine for small-medium datasets (< 10,000 records)
    
    const snapshot = await query.get()
    
    let signups = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FirestoreEmailSignup[]
    
    // Client-side date filtering
    if (filters?.startDate) {
      const start = new Date(filters.startDate)
      signups = signups.filter((s) => new Date(s.created_at) >= start)
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate)
      end.setHours(23, 59, 59, 999)
      signups = signups.filter((s) => new Date(s.created_at) <= end)
    }
    
    // Client-side sorting (newest first)
    signups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    // Apply limit after sorting
    if (filters?.limit) {
      signups = signups.slice(0, filters.limit)
    }
    
    return signups
  } catch (error) {
    console.error("[Firestore] Failed to get email signups:", error)
    throw error
  }
}

/**
 * Get unique sources from Firestore
 */
export async function getEmailSources(): Promise<string[]> {
  try {
    const db = getDb()
    const snapshot = await db.collection(COLLECTION_NAME).get()
    
    const sources = new Set<string>()
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.source) {
        sources.add(data.source)
      }
    })
    
    return Array.from(sources).sort()
  } catch (error) {
    console.error("[Firestore] Failed to get email sources:", error)
    throw error
  }
}

/**
 * Get email counts by source
 */
export async function getEmailCountsBySource(): Promise<Record<string, number>> {
  try {
    const db = getDb()
    const snapshot = await db.collection(COLLECTION_NAME).get()
    
    const counts: Record<string, number> = {}
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      const source = data.source || "Unknown"
      counts[source] = (counts[source] || 0) + 1
    })
    
    return counts
  } catch (error) {
    console.error("[Firestore] Failed to get email counts:", error)
    throw error
  }
}

/**
 * Migrate emails from Airtable to Firestore
 * This is a one-time migration function
 */
export async function migrateFromAirtable(airtableSignups: AirtableEmailSignup[]): Promise<{
  total: number
  migrated: number
  skipped: number
  errors: number
}> {
  const results = {
    total: airtableSignups.length,
    migrated: 0,
    skipped: 0,
    errors: 0,
  }
  
  console.log(`[Migration] Starting migration of ${airtableSignups.length} emails from Airtable to Firestore`)
  
  for (const signup of airtableSignups) {
    try {
      const result = await saveEmailSignup({
        email: signup.email,
        source: signup.source,
        created_at: signup.created_at || new Date().toISOString(),
        mailchimp_synced: true, // Assume already synced if in Airtable
      })
      
      if (result.success) {
        // Check if it was a new insert or existing
        const db = getDb()
        const existing = await db
          .collection(COLLECTION_NAME)
          .where("email", "==", signup.email.toLowerCase())
          .where("source", "==", signup.source)
          .get()
        
        if (existing.size === 1) {
          results.migrated++
        } else {
          results.skipped++
        }
      } else {
        results.errors++
      }
    } catch (error) {
      console.error(`[Migration] Error migrating ${signup.email}:`, error)
      results.errors++
    }
  }
  
  console.log(`[Migration] Complete: ${results.migrated} migrated, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}

/**
 * Migrate emails from MXR Airtable RSVP table to Firestore
 * Emails with "Join The Feed" = Yes are saved with source "DigitalCanvas"
 */
export async function migrateFromMxrRsvp(mxrEmails: { email: string; createdAt: string }[]): Promise<{
  total: number
  migrated: number
  skipped: number
  errors: number
}> {
  const results = {
    total: mxrEmails.length,
    migrated: 0,
    skipped: 0,
    errors: 0,
  }
  
  console.log(`[MXR Migration] Starting migration of ${mxrEmails.length} emails from MXR RSVP to Firestore`)
  
  const db = getDb()
  
  for (const record of mxrEmails) {
    try {
      const emailLower = record.email.toLowerCase().trim()
      
      // Check if email already exists for DigitalCanvas source
      const existing = await db
        .collection(COLLECTION_NAME)
        .where("email", "==", emailLower)
        .where("source", "==", "DigitalCanvas")
        .limit(1)
        .get()
      
      if (!existing.empty) {
        console.log(`[MXR Migration] Email ${emailLower} already exists for DigitalCanvas, skipping`)
        results.skipped++
        continue
      }
      
      // Save new email signup
      await db.collection(COLLECTION_NAME).add({
        email: emailLower,
        source: "DigitalCanvas",
        created_at: record.createdAt || new Date().toISOString(),
        mailchimp_synced: false,
        mailchimp_tags: ["web-digitalcanvas", "rsvp-join-feed"],
        page_url: "mxr-rsvp-migration",
      })
      
      console.log(`[MXR Migration] Saved email: ${emailLower}`)
      results.migrated++
    } catch (error) {
      console.error(`[MXR Migration] Error migrating ${record.email}:`, error)
      results.errors++
    }
  }
  
  console.log(`[MXR Migration] Complete: ${results.migrated} migrated, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}

/**
 * Migrate emails from TXMX Iconic Series Airtable RSVP table to Firestore
 * Emails with "Subscribe to 8 Count" = Yes are saved with source "TXMX"
 */
export async function migrateFromTxmxRsvp(txmxEmails: { email: string; createdAt: string }[]): Promise<{
  total: number
  migrated: number
  skipped: number
  errors: number
}> {
  const results = {
    total: txmxEmails.length,
    migrated: 0,
    skipped: 0,
    errors: 0,
  }
  
  console.log(`[TXMX Migration] Starting migration of ${txmxEmails.length} emails from TXMX RSVP to Firestore`)
  
  const db = getDb()
  
  for (const record of txmxEmails) {
    try {
      const emailLower = record.email.toLowerCase().trim()
      
      // Check if email already exists for TXMX source
      const existing = await db
        .collection(COLLECTION_NAME)
        .where("email", "==", emailLower)
        .where("source", "==", "TXMX")
        .limit(1)
        .get()
      
      if (!existing.empty) {
        console.log(`[TXMX Migration] Email ${emailLower} already exists for TXMX, skipping`)
        results.skipped++
        continue
      }
      
      // Save new email signup
      await db.collection(COLLECTION_NAME).add({
        email: emailLower,
        source: "TXMX",
        created_at: record.createdAt || new Date().toISOString(),
        mailchimp_synced: false,
        mailchimp_tags: ["web-txmx", "rsvp-8count-subscribe"],
        page_url: "txmx-iconic-rsvp-migration",
      })
      
      console.log(`[TXMX Migration] Saved email: ${emailLower}`)
      results.migrated++
    } catch (error) {
      console.error(`[TXMX Migration] Error migrating ${record.email}:`, error)
      results.errors++
    }
  }
  
  console.log(`[TXMX Migration] Complete: ${results.migrated} migrated, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}

/**
 * Convert email signups to CSV format
 */
export function emailSignupsToCSV(signups: FirestoreEmailSignup[]): string {
  const headers = ["Email", "Source", "Signup Date", "Mailchimp Synced"]
  const rows = signups.map((signup) => [
    signup.email,
    signup.source,
    signup.created_at ? new Date(signup.created_at).toLocaleDateString() : "",
    signup.mailchimp_synced ? "Yes" : "No",
  ])
  
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const escaped = String(cell).replace(/"/g, '""')
          return escaped.includes(",") || escaped.includes('"') ? `"${escaped}"` : escaped
        })
        .join(",")
    ),
  ].join("\n")
  
  return csvContent
}

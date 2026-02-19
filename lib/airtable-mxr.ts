import Airtable from "airtable"

/**
 * MXR Airtable Integration
 * Base ID: app5L5dkWVWJ3Ecd1 (mxratmain)
 * Table: RSVP
 * Fields: Email, Join The Feed
 * 
 * Used to migrate emails from the MXR/Digital Canvas RSVP list
 * Emails with "Join The Feed" = "Yes" are saved with source "DigitalCanvas"
 */

// MXR Airtable base configuration
const MXR_BASE_ID = process.env.MXR_AIRTABLE_BASE_ID || "app5L5dkWVWJ3Ecd1"
const MXR_API_KEY = process.env.MXR_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY

if (!MXR_API_KEY) {
  console.warn("Airtable API key not found for MXR base")
}

let mxrBase: Airtable.Base | null = null

function getMxrBase(): Airtable.Base {
  if (!mxrBase && MXR_API_KEY) {
    mxrBase = new Airtable({ apiKey: MXR_API_KEY }).base(MXR_BASE_ID)
  }
  if (!mxrBase) {
    throw new Error("MXR Airtable base not initialized. Check API key configuration.")
  }
  return mxrBase
}

// RSVP table name
const RSVP_TABLE = "rsvp"

export interface MxrRsvpRecord {
  id: string
  email: string
  joinTheFeed: boolean
  createdAt: string
}

/**
 * Get all RSVP records from the MXR Airtable base
 * Filters to only include records where "Join The Feed" is checked/yes
 */
export async function getMxrRsvpEmails(): Promise<MxrRsvpRecord[]> {
  try {
    const base = getMxrBase()
    
    console.log("[MXR Airtable] Fetching RSVP records from base:", MXR_BASE_ID)
    
    const records = await base(RSVP_TABLE)
      .select({
        // Get all records - we'll filter those with "Join The Feed" = Yes
        fields: ["Email", "Join The Feed"],
        sort: [{ field: "Email", direction: "asc" }],
      })
      .all()
    
    console.log(`[MXR Airtable] Found ${records.length} total RSVP records`)
    
    const emails: MxrRsvpRecord[] = []
    
    for (const record of records) {
      const email = record.fields["Email"] as string
      const joinTheFeed = record.fields["Join The Feed"] as string | boolean | undefined
      
      // Skip records without email
      if (!email) {
        continue
      }
      
      // Check if "Join The Feed" is yes/true
      // Airtable can return this as boolean true, "Yes", "yes", checkbox value, etc.
      const isJoiningFeed = 
        joinTheFeed === true ||
        joinTheFeed === "Yes" ||
        joinTheFeed === "yes" ||
        joinTheFeed === "YES" ||
        joinTheFeed === "1" ||
        String(joinTheFeed) === "1"
      
      if (isJoiningFeed) {
        emails.push({
          id: record.id,
          email: email.toLowerCase().trim(),
          joinTheFeed: true,
          createdAt: record._rawJson?.createdTime || new Date().toISOString(),
        })
      }
    }
    
    console.log(`[MXR Airtable] ${emails.length} records have "Join The Feed" = Yes`)
    
    return emails
  } catch (error) {
    console.error("[MXR Airtable] Error fetching RSVP emails:", error)
    throw new Error(`Failed to fetch RSVP emails from MXR Airtable: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Get a count of emails in the MXR RSVP table
 */
export async function getMxrRsvpCount(): Promise<{ total: number; joinTheFeed: number }> {
  try {
    const base = getMxrBase()
    
    const records = await base(RSVP_TABLE)
      .select({
        fields: ["Email", "Join The Feed"],
      })
      .all()
    
    let joinTheFeedCount = 0
    
    for (const record of records) {
      const email = record.fields["Email"] as string
      const joinTheFeed = record.fields["Join The Feed"] as string | boolean | undefined
      
      if (!email) continue
      
      const isJoiningFeed = 
        joinTheFeed === true ||
        joinTheFeed === "Yes" ||
        joinTheFeed === "yes" ||
        joinTheFeed === "YES" ||
        joinTheFeed === "1" ||
        String(joinTheFeed) === "1"
      
      if (isJoiningFeed) {
        joinTheFeedCount++
      }
    }
    
    return {
      total: records.length,
      joinTheFeed: joinTheFeedCount,
    }
  } catch (error) {
    console.error("[MXR Airtable] Error counting RSVP records:", error)
    throw error
  }
}

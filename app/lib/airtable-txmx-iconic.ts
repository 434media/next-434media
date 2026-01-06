import Airtable from "airtable"

/**
 * TXMX Iconic Series Airtable Integration
 * Base ID: appuFb5OfHlJdJ29b (txmx-iconic-series)
 * Table: RSVP
 * Fields: Email, Subscribe to 8 Count
 * 
 * Used to migrate emails from the TXMX Iconic Series RSVP list
 * Emails with "Subscribe to 8 Count" = "Yes" are saved with source "TXMX"
 */

// TXMX Iconic Series Airtable base configuration
const TXMX_BASE_ID = process.env.AIRTABLE_ICONIC_SERIES_BASE_ID || "appuFb5OfHlJdJ29b"
const TXMX_API_KEY = process.env.TXMX_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY

if (!TXMX_API_KEY) {
  console.warn("Airtable API key not found for TXMX Iconic Series base")
}

let txmxBase: Airtable.Base | null = null

function getTxmxBase(): Airtable.Base {
  if (!txmxBase && TXMX_API_KEY) {
    txmxBase = new Airtable({ apiKey: TXMX_API_KEY }).base(TXMX_BASE_ID)
  }
  if (!txmxBase) {
    throw new Error("TXMX Iconic Series Airtable base not initialized. Check API key configuration.")
  }
  return txmxBase
}

// RSVP table name
const RSVP_TABLE = "RSVP"

export interface TxmxRsvpRecord {
  id: string
  email: string
  subscribeTo8Count: boolean
  createdAt: string
}

/**
 * Get all RSVP records from the TXMX Iconic Series Airtable base
 * Filters to only include records where "Subscribe to 8 Count" is checked/yes
 */
export async function getTxmxRsvpEmails(): Promise<TxmxRsvpRecord[]> {
  try {
    const base = getTxmxBase()
    
    console.log("[TXMX Airtable] Fetching RSVP records from base:", TXMX_BASE_ID)
    
    const records = await base(RSVP_TABLE)
      .select({
        // Get all records - we'll filter those with "Subscribe to 8 Count" = Yes
        fields: ["Email", "Subscribe to 8 Count"],
        sort: [{ field: "Email", direction: "asc" }],
      })
      .all()
    
    console.log(`[TXMX Airtable] Found ${records.length} total RSVP records`)
    
    const emails: TxmxRsvpRecord[] = []
    
    for (const record of records) {
      const email = record.fields["Email"] as string
      const subscribeTo8Count = record.fields["Subscribe to 8 Count"] as string | boolean | undefined
      
      // Skip records without email
      if (!email) {
        continue
      }
      
      // Check if "Subscribe to 8 Count" is yes/true
      // Airtable can return this as boolean true, "Yes", "yes", checkbox value, etc.
      const isSubscribing = 
        subscribeTo8Count === true ||
        subscribeTo8Count === "Yes" ||
        subscribeTo8Count === "yes" ||
        subscribeTo8Count === "YES" ||
        subscribeTo8Count === "1" ||
        String(subscribeTo8Count) === "1"
      
      if (isSubscribing) {
        emails.push({
          id: record.id,
          email: email.toLowerCase().trim(),
          subscribeTo8Count: true,
          createdAt: record._rawJson?.createdTime || new Date().toISOString(),
        })
      }
    }
    
    console.log(`[TXMX Airtable] ${emails.length} records have "Subscribe to 8 Count" = Yes`)
    
    return emails
  } catch (error) {
    console.error("[TXMX Airtable] Error fetching RSVP emails:", error)
    throw new Error(`Failed to fetch RSVP emails from TXMX Airtable: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Get a count of emails in the TXMX RSVP table
 */
export async function getTxmxRsvpCount(): Promise<{ total: number; subscribeTo8Count: number }> {
  try {
    const base = getTxmxBase()
    
    const records = await base(RSVP_TABLE)
      .select({
        fields: ["Email", "Subscribe to 8 Count"],
      })
      .all()
    
    let subscribeCount = 0
    
    for (const record of records) {
      const email = record.fields["Email"] as string
      const subscribeTo8Count = record.fields["Subscribe to 8 Count"] as string | boolean | undefined
      
      if (!email) continue
      
      const isSubscribing = 
        subscribeTo8Count === true ||
        subscribeTo8Count === "Yes" ||
        subscribeTo8Count === "yes" ||
        subscribeTo8Count === "YES" ||
        subscribeTo8Count === "1" ||
        String(subscribeTo8Count) === "1"
      
      if (isSubscribing) {
        subscribeCount++
      }
    }
    
    return {
      total: records.length,
      subscribeTo8Count: subscribeCount,
    }
  } catch (error) {
    console.error("[TXMX Airtable] Error counting RSVP records:", error)
    throw error
  }
}

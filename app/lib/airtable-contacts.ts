import Airtable from "airtable"

// Initialize Airtable base for Contacts-Web
// This uses the same base as AIRTABLE_BASE_ID which is already appjhfV2ev2hb2hox
const contactsBaseId = process.env.AIRTABLE_CONTACTS_BASE_ID || process.env.AIRTABLE_BASE_ID || "appjhfV2ev2hb2hox"
const contactsApiKey = process.env.AIRTABLE_CONTACTS_API_KEY || process.env.AIRTABLE_API_KEY

if (!contactsApiKey) {
  console.warn("Airtable API key not found for Contacts base")
}

console.log("Contacts Airtable Config:", { 
  baseId: contactsBaseId, 
  hasApiKey: !!contactsApiKey,
  apiKeyPrefix: contactsApiKey?.substring(0, 10) + "..."
})

let contactsBase: Airtable.Base | null = null

function getContactsBase(): Airtable.Base {
  if (!contactsBase && contactsApiKey) {
    contactsBase = new Airtable({ apiKey: contactsApiKey }).base(contactsBaseId)
  }
  if (!contactsBase) {
    throw new Error("Airtable Contacts base not initialized. Check API key configuration.")
  }
  return contactsBase
}

// Table name in Airtable - verify this matches exactly
const EMAIL_SIGNUP_TABLE = "Email Sign Up (All Sites)"

export interface EmailSignup {
  id: string
  email: string
  source: string
  created_at: string
  name?: string
  phone?: string
  company?: string
  notes?: string
}

export interface EmailSignupFilters {
  source?: string
  startDate?: string
  endDate?: string
}

/**
 * Get all email signups with optional filtering
 */
export async function getEmailSignups(filters?: EmailSignupFilters): Promise<EmailSignup[]> {
  try {
    const base = getContactsBase()
    
    // Build filter formula
    const filterFormulas: string[] = []
    
    if (filters?.source) {
      filterFormulas.push(`{Source} = '${filters.source}'`)
    }
    
    if (filters?.startDate) {
      filterFormulas.push(`IS_AFTER({Created Time}, '${filters.startDate}')`)
    }
    
    if (filters?.endDate) {
      filterFormulas.push(`IS_BEFORE({Created Time}, '${filters.endDate}')`)
    }
    
    const selectOptions: Airtable.SelectOptions<Record<string, unknown>> = {
      sort: [{ field: "Created Time", direction: "desc" }],
    }
    
    if (filterFormulas.length > 0) {
      selectOptions.filterByFormula = filterFormulas.length === 1 
        ? filterFormulas[0] 
        : `AND(${filterFormulas.join(", ")})`
    }
    
    const records = await base(EMAIL_SIGNUP_TABLE).select(selectOptions).all()
    
    return records.map((record) => ({
      id: record.id,
      email: (record.fields["Email"] as string) || "",
      source: (record.fields["Source"] as string) || "Unknown",
      created_at: (record.fields["Created Time"] as string) || record._rawJson?.createdTime || "",
      name: (record.fields["Name"] as string) || undefined,
      phone: (record.fields["Phone"] as string) || undefined,
      company: (record.fields["Company"] as string) || undefined,
      notes: (record.fields["Notes"] as string) || undefined,
    }))
  } catch (error) {
    console.error("Error fetching email signups:", error)
    throw new Error("Failed to fetch email signups from Airtable")
  }
}

/**
 * Get unique sources from email signups
 */
export async function getEmailSources(): Promise<string[]> {
  try {
    const base = getContactsBase()
    const records = await base(EMAIL_SIGNUP_TABLE)
      .select({
        fields: ["Source"],
      })
      .all()
    
    const sources = new Set<string>()
    records.forEach((record) => {
      const source = record.fields["Source"] as string
      if (source) {
        sources.add(source)
      }
    })
    
    return Array.from(sources).sort()
  } catch (error) {
    console.error("Error fetching email sources:", error)
    throw new Error("Failed to fetch email sources")
  }
}

/**
 * Get email count by source
 */
export async function getEmailCountsBySource(): Promise<Record<string, number>> {
  try {
    const base = getContactsBase()
    const records = await base(EMAIL_SIGNUP_TABLE)
      .select({
        fields: ["Source"],
      })
      .all()
    
    const counts: Record<string, number> = {}
    records.forEach((record) => {
      const source = (record.fields["Source"] as string) || "Unknown"
      counts[source] = (counts[source] || 0) + 1
    })
    
    return counts
  } catch (error) {
    console.error("Error fetching email counts:", error)
    throw new Error("Failed to fetch email counts")
  }
}

/**
 * Convert email signups to CSV format
 */
export function emailSignupsToCSV(signups: EmailSignup[]): string {
  const headers = ["Email", "Source", "Name", "Company", "Phone", "Signup Date"]
  const rows = signups.map((signup) => [
    signup.email,
    signup.source,
    signup.name || "",
    signup.company || "",
    signup.phone || "",
    signup.created_at ? new Date(signup.created_at).toLocaleDateString() : "",
  ])
  
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => 
      row.map((cell) => {
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(cell).replace(/"/g, '""')
        return escaped.includes(",") || escaped.includes('"') ? `"${escaped}"` : escaped
      }).join(",")
    ),
  ].join("\n")
  
  return csvContent
}

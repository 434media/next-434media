import { getDb, COLLECTIONS } from "./firebase-admin"
import Airtable from "airtable"

// Firestore contact form submission interface
export interface ContactFormSubmission {
  id?: string
  firstName: string
  lastName: string
  company: string
  email: string
  phone?: string
  message?: string
  source: string // "434Media" | "AIM" | "VemosVamos" | "DigitalCanvas" | "SATechDay"
  created_at: string
}

/**
 * Save a contact form submission to Firestore
 */
export async function saveContactForm(
  data: Omit<ContactFormSubmission, "id">
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.CONTACT_FORMS).add({
      ...data,
      email: data.email.toLowerCase().trim(),
      created_at: data.created_at || new Date().toISOString(),
    })

    console.log(`[Firestore] Saved contact form: ${data.email} from ${data.source}`)
    return { success: true, id: docRef.id }
  } catch (error) {
    console.error("[Firestore] Failed to save contact form:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Delete a contact form submission from Firestore
 */
export async function deleteContactForm(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.CONTACT_FORMS).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      return { success: false, error: "Contact form submission not found" }
    }

    await docRef.delete()
    console.log(`[Firestore] Deleted contact form: ${id}`)
    return { success: true }
  } catch (error) {
    console.error("[Firestore] Failed to delete contact form:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Get contact form submissions with optional filtering
 */
export async function getContactForms(filters?: {
  source?: string
  startDate?: string
  endDate?: string
  limit?: number
}): Promise<ContactFormSubmission[]> {
  try {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.CONTACT_FORMS)

    if (filters?.source) {
      query = query.where("source", "==", filters.source)
    }

    const snapshot = await query.get()

    let submissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ContactFormSubmission[]

    // Client-side date filtering
    if (filters?.startDate) {
      const start = new Date(filters.startDate)
      submissions = submissions.filter((s) => new Date(s.created_at) >= start)
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate)
      end.setHours(23, 59, 59, 999)
      submissions = submissions.filter((s) => new Date(s.created_at) <= end)
    }

    // Sort newest first
    submissions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (filters?.limit) {
      submissions = submissions.slice(0, filters.limit)
    }

    return submissions
  } catch (error) {
    console.error("[Firestore] Failed to get contact forms:", error)
    throw error
  }
}

/**
 * Get unique sources from contact form submissions
 */
export async function getContactFormSources(): Promise<string[]> {
  try {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.CONTACT_FORMS).get()

    const sources = new Set<string>()
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.source) {
        sources.add(data.source)
      }
    })

    return Array.from(sources).sort()
  } catch (error) {
    console.error("[Firestore] Failed to get contact form sources:", error)
    throw error
  }
}

/**
 * Get contact form counts by source
 */
export async function getContactFormCountsBySource(): Promise<Record<string, number>> {
  try {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.CONTACT_FORMS).get()

    const counts: Record<string, number> = {}
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      const source = data.source || "Unknown"
      counts[source] = (counts[source] || 0) + 1
    })

    return counts
  } catch (error) {
    console.error("[Firestore] Failed to get contact form counts:", error)
    throw error
  }
}

/**
 * Convert contact form submissions to CSV format
 */
export function contactFormsToCSV(submissions: ContactFormSubmission[]): string {
  const headers = ["First Name", "Last Name", "Company", "Email", "Phone", "Message", "Source", "Date"]
  const rows = submissions.map((s) => [
    s.firstName,
    s.lastName,
    s.company,
    s.email,
    s.phone || "",
    s.message || "",
    s.source,
    s.created_at ? new Date(s.created_at).toLocaleDateString() : "",
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const escaped = String(cell).replace(/"/g, '""')
          return escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")
            ? `"${escaped}"`
            : escaped
        })
        .join(",")
    ),
  ].join("\n")

  return csvContent
}

// ── Airtable Migration Functions ──

interface AirtableFormRecord {
  firstName: string
  lastName: string
  company: string
  email: string
  phone?: string
  message?: string
  source: string
  createdTime: string
}

/**
 * Fetch contact form records from an Airtable table
 */
async function fetchAirtableFormTable(
  baseId: string,
  tableName: string,
  source: string
): Promise<AirtableFormRecord[]> {
  const apiKey = process.env.AIRTABLE_API_KEY
  if (!apiKey) {
    throw new Error("AIRTABLE_API_KEY not configured")
  }

  const base = new Airtable({ apiKey }).base(baseId)
  const records = await base(tableName).select().all()

  console.log(`[Contact Form Migration] Fetched ${records.length} records from ${tableName} (source: ${source})`)

  return records.map((record) => ({
    firstName: (record.fields["FirstName"] as string) || (record.fields["First Name"] as string) || "",
    lastName: (record.fields["LastName"] as string) || (record.fields["Last Name"] as string) || "",
    company: (record.fields["Company"] as string) || "",
    email: (record.fields["Email"] as string) || "",
    phone: (record.fields["Phone"] as string) || undefined,
    message: (record.fields["Message"] as string) || undefined,
    source,
    createdTime: (record.fields["Created Time"] as string) || record._rawJson?.createdTime || new Date().toISOString(),
  }))
}

/**
 * Migrate contact form data from Airtable to Firestore
 * Tables: 434Form (434Media), AIMForm (AIM), VemosForm (VemosVamos)
 */
export async function migrateContactFormsFromAirtable(): Promise<{
  total: number
  migrated: number
  skipped: number
  errors: number
  details: Record<string, { total: number; migrated: number; skipped: number; errors: number }>
}> {
  const baseId = process.env.AIRTABLE_BASE_ID || "appjhfV2ev2hb2hox"

  const tables = [
    { table: "434Form", source: "434Media" },
    { table: "AIMForm", source: "AIM" },
    { table: "VemosForm", source: "VemosVamos" },
  ]

  const overall = { total: 0, migrated: 0, skipped: 0, errors: 0 }
  const details: Record<string, { total: number; migrated: number; skipped: number; errors: number }> = {}

  const db = getDb()

  for (const { table, source } of tables) {
    const tableResult = { total: 0, migrated: 0, skipped: 0, errors: 0 }

    try {
      console.log(`[Contact Form Migration] Processing ${table} → ${source}...`)
      const records = await fetchAirtableFormTable(baseId, table, source)
      tableResult.total = records.length

      for (const record of records) {
        if (!record.email) {
          tableResult.skipped++
          continue
        }

        try {
          const emailLower = record.email.toLowerCase().trim()

          // Check if already exists
          const existing = await db
            .collection(COLLECTIONS.CONTACT_FORMS)
            .where("email", "==", emailLower)
            .where("source", "==", source)
            .where("firstName", "==", record.firstName)
            .where("lastName", "==", record.lastName)
            .limit(1)
            .get()

          if (!existing.empty) {
            tableResult.skipped++
            continue
          }

          await db.collection(COLLECTIONS.CONTACT_FORMS).add({
            firstName: record.firstName,
            lastName: record.lastName,
            company: record.company,
            email: emailLower,
            phone: record.phone || "",
            message: record.message || "",
            source,
            created_at: record.createdTime,
          })

          tableResult.migrated++
        } catch (err) {
          console.error(`[Contact Form Migration] Error migrating ${record.email}:`, err)
          tableResult.errors++
        }
      }
    } catch (err) {
      console.error(`[Contact Form Migration] Failed to fetch ${table}:`, err)
      tableResult.errors = -1
    }

    details[source] = tableResult
    overall.total += tableResult.total
    overall.migrated += tableResult.migrated
    overall.skipped += tableResult.skipped
    overall.errors += Math.max(0, tableResult.errors)
  }

  console.log(`[Contact Form Migration] Complete: ${overall.migrated} migrated, ${overall.skipped} skipped, ${overall.errors} errors`)
  return { ...overall, details }
}

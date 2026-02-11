import { getDb, getNamedDb, COLLECTIONS, NAMED_DATABASES } from "./firebase-admin"
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
  _dbSource?: string // Track which database this came from
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
 * Supports deletion from both default and aimsatx databases
 */
export async function deleteContactForm(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (id.startsWith("aimsatx:")) {
      const realId = id.replace("aimsatx:", "")
      const aimsDb = getNamedDb(NAMED_DATABASES.AIMSATX)
      await aimsDb.collection("contact_submissions").doc(realId).delete()
      console.log(`[Firestore] Deleted aimsatx contact submission: ${realId}`)
      return { success: true }
    }

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
 * Update a contact form submission in Firestore
 */
export async function updateContactForm(
  id: string,
  data: Partial<Omit<ContactFormSubmission, "id">>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.CONTACT_FORMS).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      return { success: false, error: "Contact form submission not found" }
    }

    // Only update provided fields, normalize email if changed
    const updateData: Record<string, unknown> = {}
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.company !== undefined) updateData.company = data.company
    if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim()
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.message !== undefined) updateData.message = data.message
    if (data.source !== undefined) updateData.source = data.source

    await docRef.update(updateData)
    console.log(`[Firestore] Updated contact form: ${id}`)
    return { success: true }
  } catch (error) {
    console.error("[Firestore] Failed to update contact form:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Fetch contact submissions from the aimsatx named database
 */
async function getAimsatxContactSubmissions(filters?: { source?: string }): Promise<ContactFormSubmission[]> {
  try {
    // If filtering by a non-AIM source, skip
    if (filters?.source && filters.source !== "AIM") return []

    const aimsDb = getNamedDb(NAMED_DATABASES.AIMSATX)
    const snapshot = await aimsDb.collection("contact_submissions").get()
    return snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: `aimsatx:${doc.id}`,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        company: data.company || "",
        email: data.email || "",
        phone: data.phoneNumber || data.phone || "",
        message: data.message || "",
        source: "AIM",
        created_at: data.created_at || "",
        _dbSource: "aimsatx",
      }
    })
  } catch (error) {
    console.error("Error fetching aimsatx contact submissions:", error)
    return []
  }
}

/**
 * Deduplicate contact form submissions across databases by email+source+name
 */
function deduplicateContactForms(submissions: ContactFormSubmission[]): ContactFormSubmission[] {
  const seen = new Map<string, ContactFormSubmission>()
  for (const sub of submissions) {
    const key = `${sub.email.toLowerCase()}|${sub.source}|${sub.firstName}|${sub.lastName}`
    const existing = seen.get(key)
    if (!existing || (sub._dbSource === "default" && existing._dbSource !== "default")) {
      seen.set(key, sub)
    }
  }
  return Array.from(seen.values())
}

/**
 * Get contact form submissions with optional filtering
 * Merges results from default DB and aimsatx named database
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

    const [defaultSnapshot, aimsRegs] = await Promise.all([
      query.get(),
      getAimsatxContactSubmissions(filters),
    ])

    const defaultSubs = defaultSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      _dbSource: "default",
    })) as ContactFormSubmission[]

    // If filtering by source and it's not AIM, only return default
    let submissions: ContactFormSubmission[]
    if (filters?.source && filters.source !== "AIM") {
      submissions = defaultSubs
    } else {
      submissions = deduplicateContactForms([...defaultSubs, ...aimsRegs])
    }

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
 * Get unique sources from contact form submissions (merges aimsatx)
 */
export async function getContactFormSources(): Promise<string[]> {
  try {
    const db = getDb()
    const [defaultSnapshot, aimsRegs] = await Promise.all([
      db.collection(COLLECTIONS.CONTACT_FORMS).get(),
      getAimsatxContactSubmissions(),
    ])

    const sources = new Set<string>()
    defaultSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.source) sources.add(data.source)
    })
    aimsRegs.forEach((r) => {
      if (r.source) sources.add(r.source)
    })

    return Array.from(sources).sort()
  } catch (error) {
    console.error("[Firestore] Failed to get contact form sources:", error)
    throw error
  }
}

/**
 * Get contact form counts by source (merges aimsatx)
 */
export async function getContactFormCountsBySource(): Promise<Record<string, number>> {
  try {
    const allForms = await getContactForms()
    const counts: Record<string, number> = {}
    allForms.forEach((form) => {
      const source = form.source || "Unknown"
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

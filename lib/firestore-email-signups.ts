import { getDb, getNamedDb, NAMED_DATABASES } from "./firebase-admin"

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
  _dbSource?: string // Track which database this came from
}

const COLLECTION_NAME = "email_signups"

/**
 * Fetch email signups from the aimsatx named database
 */
async function getAimsatxEmailSignups(filters?: { source?: string }): Promise<FirestoreEmailSignup[]> {
  try {
    // If filtering by a non-aim source, skip
    if (filters?.source && filters.source.toLowerCase() !== "aim") return []

    const aimsDb = getNamedDb(NAMED_DATABASES.AIMSATX)
    const snapshot = await aimsDb.collection("email_signups").get()
    return snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: `aimsatx:${doc.id}`,
        email: data.email || "",
        source: data.source || "AIM",
        created_at: data.created_at || "",
        mailchimp_synced: data.mailchimp_synced || false,
        mailchimp_tags: data.tags || data.mailchimp_tags || [],
        page_url: data.pageUrl || data.page_url || "",
        _dbSource: "aimsatx",
      }
    })
  } catch (error) {
    console.error("Error fetching aimsatx email signups:", error)
    return []
  }
}

/**
 * Deduplicate email signups across databases by email+source
 */
function deduplicateEmailSignups(signups: FirestoreEmailSignup[]): FirestoreEmailSignup[] {
  const seen = new Map<string, FirestoreEmailSignup>()
  for (const signup of signups) {
    const key = `${signup.email.toLowerCase()}|${signup.source.toLowerCase()}`
    const existing = seen.get(key)
    if (!existing || (signup._dbSource === "default" && existing._dbSource !== "default")) {
      seen.set(key, signup)
    }
  }
  return Array.from(seen.values())
}

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
 * Supports deletion from both default and aimsatx databases
 */
export async function deleteEmailSignup(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (id.startsWith("aimsatx:")) {
      const realId = id.replace("aimsatx:", "")
      const aimsDb = getNamedDb(NAMED_DATABASES.AIMSATX)
      await aimsDb.collection("email_signups").doc(realId).delete()
      console.log(`[Firestore] Deleted aimsatx email signup: ${realId}`)
      return { success: true }
    }

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
 * Merges results from default DB and aimsatx named database
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
    
    const [defaultSnapshot, aimsSignups] = await Promise.all([
      query.get(),
      getAimsatxEmailSignups(filters),
    ])
    
    const defaultSignups = defaultSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      _dbSource: "default",
    })) as FirestoreEmailSignup[]
    
    // If filtering by source and it's not aim, only return default
    let signups: FirestoreEmailSignup[]
    if (filters?.source && filters.source.toLowerCase() !== "aim") {
      signups = defaultSignups
    } else {
      signups = deduplicateEmailSignups([...defaultSignups, ...aimsSignups])
    }
    
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
 * Get unique sources from Firestore (merges aimsatx)
 */
export async function getEmailSources(): Promise<string[]> {
  try {
    const db = getDb()
    const [defaultSnapshot, aimsSignups] = await Promise.all([
      db.collection(COLLECTION_NAME).get(),
      getAimsatxEmailSignups(),
    ])
    
    const sources = new Set<string>()
    defaultSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.source) sources.add(data.source)
    })
    aimsSignups.forEach((s) => {
      if (s.source) sources.add(s.source)
    })
    
    return Array.from(sources).sort()
  } catch (error) {
    console.error("[Firestore] Failed to get email sources:", error)
    throw error
  }
}

/**
 * Get email counts by source (merges aimsatx)
 */
export async function getEmailCountsBySource(): Promise<Record<string, number>> {
  try {
    const allSignups = await getEmailSignups()
    const counts: Record<string, number> = {}
    allSignups.forEach((signup) => {
      const source = signup.source || "Unknown"
      counts[source] = (counts[source] || 0) + 1
    })
    return counts
  } catch (error) {
    console.error("[Firestore] Failed to get email counts:", error)
    throw error
  }
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

import { getDb, admin } from "./firebase-admin"
import type {
  ClientRecord,
  Opportunity,
  PMRecord,
  BudgetView,
  MasterListItem,
  DailySummary,
  Task,
  ClosedLostLead,
  ClosedWonLead,
  ArchivedLead,
  Platform,
  SalesRep,
  BarbPieChart,
  PieSlice,
  CRM_COLLECTIONS,
  CRMDashboardStats,
  PipelineColumn,
  OpportunityStage,
} from "../types/crm-types"

// Re-export collection names
export { CRM_COLLECTIONS } from "../types/crm-types"

// ============================================
// SIMPLE IN-MEMORY CACHE (reduces Firestore reads)
// ============================================
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 30 * 1000 // 30 seconds cache

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// Invalidate cache for a specific collection
export function invalidateCache(collectionName?: string): void {
  if (collectionName) {
    // Delete all cache entries that match this collection
    for (const key of cache.keys()) {
      if (key.includes(collectionName)) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
}

// Helper to convert Firestore timestamps
function convertTimestamp(value: unknown): string {
  const Timestamp = admin.firestore.Timestamp
  if (value instanceof Timestamp) {
    return value.toDate().toISOString()
  }
  if (typeof value === "string") {
    return value
  }
  return new Date().toISOString()
}

// Helper to convert Firestore doc to typed object
function docToData<T>(doc: admin.firestore.DocumentSnapshot): T | null {
  const data = doc.data()
  if (!data) return null

  return {
    ...data,
    id: doc.id,
    created_at: convertTimestamp(data.created_at),
    updated_at: convertTimestamp(data.updated_at),
  } as T
}

// Generic get all documents from a collection (with caching)
async function getAllFromCollection<T>(
  collectionName: string
): Promise<T[]> {
  // Check cache first
  const cacheKey = `collection:${collectionName}`
  const cached = getCached<T[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for collection:", collectionName)
    return cached
  }

  try {
    const db = getDb()
    const snapshot = await db.collection(collectionName).get()
    const results = snapshot.docs
      .map((doc) => docToData<T>(doc))
      .filter((item): item is T => item !== null)
    
    // Cache the results
    setCache(cacheKey, results)
    console.log("[Firestore] Fetched", results.length, "docs from collection:", collectionName)
    
    return results
  } catch (error: unknown) {
    // Check for quota exceeded error - return empty array gracefully
    const errorCode = (error as { code?: number })?.code
    const errorDetails = (error as { details?: string })?.details
    if (errorCode === 8 || errorDetails?.includes('Quota exceeded')) {
      console.warn("[Firestore] Quota exceeded for collection:", collectionName, "- returning empty array")
      return []
    }
    console.error("Error fetching from collection:", collectionName, error)
    throw new Error("Failed to fetch from collection: " + String(collectionName))
  }
}

// Generic get document by ID
async function getById<T>(
  collectionName: string,
  id: string
): Promise<T | null> {
  try {
    const db = getDb()
    const doc = await db.collection(collectionName).doc(id).get()
    return docToData<T>(doc)
  } catch (error) {
    console.error("Error fetching document:", id, "from collection:", collectionName, error)
    return null
  }
}

// Generic create document
async function createDocument<T>(
  collectionName: string,
  data: Omit<T, "id" | "created_at" | "updated_at">
): Promise<T> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const now = FieldValue.serverTimestamp()

    const docRef = await db.collection(collectionName).add({
      ...data,
      created_at: now,
      updated_at: now,
    })

    // Invalidate cache for this collection
    invalidateCache(collectionName)

    const doc = await docRef.get()
    const result = docToData<T>(doc)
    if (!result) throw new Error("Failed to retrieve created document")
    return result
  } catch (error) {
    console.error("Error creating document in collection:", collectionName, error)
    throw new Error("Failed to create in collection: " + String(collectionName))
  }
}

// Generic update document
async function updateDocument<T>(
  collectionName: string,
  id: string,
  updates: Partial<T>
): Promise<T> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const docRef = db.collection(collectionName).doc(id)

    // Remove undefined values and system fields
    const cleanUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== "id" && key !== "created_at") {
        cleanUpdates[key] = value
      }
    }
    cleanUpdates.updated_at = FieldValue.serverTimestamp()

    await docRef.update(cleanUpdates)

    // Invalidate cache for this collection
    invalidateCache(collectionName)

    const doc = await docRef.get()
    const result = docToData<T>(doc)
    if (!result) throw new Error("Failed to retrieve updated document")
    return result
  } catch (error) {
    console.error("Error updating document:", id, "in collection:", collectionName, error)
    throw new Error("Failed to update in collection: " + String(collectionName))
  }
}

// Generic delete document
async function deleteDocument(
  collectionName: string,
  id: string
): Promise<void> {
  try {
    const db = getDb()
    await db.collection(collectionName).doc(id).delete()
    
    // Invalidate cache for this collection
    invalidateCache(collectionName)
  } catch (error) {
    console.error("Error deleting document:", id, "from collection:", collectionName, error)
    throw new Error("Failed to delete from collection: " + String(collectionName))
  }
}

// Generic batch write for migration
export async function batchWrite(
  collectionName: string,
  records: Record<string, unknown>[]
): Promise<number> {
  const db = getDb()
  const FieldValue = admin.firestore.FieldValue
  const now = FieldValue.serverTimestamp()
  
  let writtenCount = 0
  const BATCH_SIZE = 500 // Firestore limit

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = records.slice(i, i + BATCH_SIZE)

    for (const record of chunk) {
      const docRef = db.collection(collectionName).doc()
      batch.set(docRef, {
        ...record,
        created_at: now,
        updated_at: now,
      })
    }

    await batch.commit()
    writtenCount += chunk.length
  }

  return writtenCount
}

// ============================================
// CLIENT RECORDS OPERATIONS
// ============================================
const CLIENTS_COLLECTION = "crm_clients"

// Helper to normalize client data from Firestore (handles Airtable field name variations)
function normalizeClientData(rawData: Record<string, unknown>): ClientRecord {
  // Parse contacts array if it exists
  const rawContacts = rawData.contacts as Array<Record<string, unknown>> | undefined
  const contacts = rawContacts?.map(c => ({
    id: (c.id || `contact_${Date.now()}`) as string,
    name: (c.name || "") as string,
    email: (c.email || "") as string,
    phone: (c.phone || "") as string,
    role: (c.role || "") as string,
    is_primary: (c.is_primary || false) as boolean,
  }))

  // Build full name from first_name + last_name if available
  const firstName = (rawData.first_name || rawData.firstName || rawData["First Name"] || "") as string
  const lastName = (rawData.last_name || rawData.lastName || rawData["Last Name"] || "") as string
  const fullName = firstName && lastName 
    ? `${firstName} ${lastName}`.trim() 
    : (rawData.name || rawData.client_name || rawData.Name || rawData["Client Name"] || "") as string

  // Extract email from email_id or unique_contact_key if needed
  let email = (rawData.email || rawData.email_id || rawData.Email || rawData["Email Address"] || "") as string
  if (!email && rawData.unique_contact_key) {
    const keyParts = (rawData.unique_contact_key as string).split("-")
    if (keyParts.length > 1 && keyParts[keyParts.length - 1].includes("@")) {
      email = keyParts[keyParts.length - 1]
    }
  }

  return {
    id: rawData.id as string,
    // Basic Info - handle both standard and Airtable field names
    name: fullName,
    company_name: (rawData.company_name || rawData.company || rawData.Company || rawData["Company Name"] || "") as string,
    email,
    phone: (rawData.phone || rawData.phone_number || rawData.Phone || rawData["Phone Number"] || "") as string,
    // Multiple contacts
    contacts,
    // Business Details
    industry: (rawData.industry || rawData.Industry || "") as string,
    website: (rawData.website || rawData.Website || "") as string,
    address: (rawData.address || rawData.Address || "") as string,
    city: (rawData.city || rawData.City || "") as string,
    state: (rawData.state || rawData.State || "") as string,
    zip_code: (rawData.zip_code || rawData.zip || rawData["Zip Code"] || "") as string,
    // Relationship
    status: (rawData.status || rawData.Status || "prospect") as ClientRecord["status"],
    lead_source: (rawData.lead_source || rawData.source || rawData["Lead Source"] || "") as string,
    assigned_to: (rawData.assigned_to || rawData.sales_poc || rawData.sales_rep || rawData["Assigned To"] || rawData["Sales Rep"] || rawData["Sales POC"] || "") as string,
    // Contact title/role (for legacy single-contact data)
    // Engagement
    last_contact_date: (rawData.last_contact_date || rawData.last_contact || rawData["Last Contact"] || "") as string,
    next_followup_date: (rawData.next_followup_date || rawData.next_followup || rawData["Next Followup"] || "") as string,
    notes: (rawData.notes || rawData.client_notes || rawData.Notes || rawData["Client Notes"] || "") as string,
    // Financial
    lifetime_value: (rawData.lifetime_value || rawData.ltv || rawData["Lifetime Value"] || 0) as number,
    monthly_retainer: (rawData.monthly_retainer || rawData.retainer || rawData["Monthly Retainer"] || 0) as number,
    // Social
    instagram_handle: (rawData.instagram_handle || rawData.instagram || rawData.Instagram || "") as string,
    linkedin_url: (rawData.linkedin_url || rawData.linkedin || rawData.LinkedIn || "") as string,
    // Timestamps
    created_at: (rawData.created_at || new Date().toISOString()) as string,
    updated_at: (rawData.updated_at || new Date().toISOString()) as string,
  }
}

export async function getClients(): Promise<ClientRecord[]> {
  const rawClients = await getAllFromCollection<Record<string, unknown>>(CLIENTS_COLLECTION)
  return rawClients.map(normalizeClientData)
}

export async function getClientById(id: string): Promise<ClientRecord | null> {
  const rawClient = await getById<Record<string, unknown>>(CLIENTS_COLLECTION, id)
  return rawClient ? normalizeClientData(rawClient) : null
}

export async function createClient(
  data: Omit<ClientRecord, "id" | "created_at" | "updated_at">
): Promise<ClientRecord> {
  return createDocument<ClientRecord>(CLIENTS_COLLECTION, data)
}

export async function updateClient(
  id: string,
  updates: Partial<ClientRecord>
): Promise<ClientRecord> {
  return updateDocument<ClientRecord>(CLIENTS_COLLECTION, id, updates)
}

export async function deleteClient(id: string): Promise<void> {
  return deleteDocument(CLIENTS_COLLECTION, id)
}

export async function getClientsByStatus(status: string): Promise<ClientRecord[]> {
  try {
    const db = getDb()
    const snapshot = await db
      .collection(CLIENTS_COLLECTION)
      .where("status", "==", status)
      .get()
    const rawClients = snapshot.docs
      .map((doc) => {
        const data = doc.data()
        return data ? { ...data, id: doc.id } as Record<string, unknown> : null
      })
      .filter((item): item is Record<string, unknown> => item !== null)
    return rawClients.map(normalizeClientData)
  } catch (error) {
    console.error("Error fetching clients by status:", error)
    throw error
  }
}

// ============================================
// OPPORTUNITIES OPERATIONS
// ============================================
const OPPORTUNITIES_COLLECTION = "crm_opportunities"

export async function getOpportunities(): Promise<Opportunity[]> {
  return getAllFromCollection<Opportunity>(OPPORTUNITIES_COLLECTION)
}

export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  return getById<Opportunity>(OPPORTUNITIES_COLLECTION, id)
}

export async function createOpportunity(
  data: Omit<Opportunity, "id" | "created_at" | "updated_at">
): Promise<Opportunity> {
  return createDocument<Opportunity>(OPPORTUNITIES_COLLECTION, data)
}

export async function updateOpportunity(
  id: string,
  updates: Partial<Opportunity>
): Promise<Opportunity> {
  return updateDocument<Opportunity>(OPPORTUNITIES_COLLECTION, id, updates)
}

export async function deleteOpportunity(id: string): Promise<void> {
  return deleteDocument(OPPORTUNITIES_COLLECTION, id)
}

export async function getOpportunitiesByStage(stage: OpportunityStage): Promise<Opportunity[]> {
  try {
    const db = getDb()
    const snapshot = await db
      .collection(OPPORTUNITIES_COLLECTION)
      .where("stage", "==", stage)
      .get()
    return snapshot.docs
      .map((doc) => docToData<Opportunity>(doc))
      .filter((item): item is Opportunity => item !== null)
  } catch (error) {
    console.error("Error fetching opportunities by stage:", error)
    throw error
  }
}

export async function getOpportunitiesByClient(clientId: string): Promise<Opportunity[]> {
  try {
    const db = getDb()
    const snapshot = await db
      .collection(OPPORTUNITIES_COLLECTION)
      .where("client_id", "==", clientId)
      .get()
    return snapshot.docs
      .map((doc) => docToData<Opportunity>(doc))
      .filter((item): item is Opportunity => item !== null)
  } catch (error) {
    console.error("Error fetching opportunities by client:", error)
    throw error
  }
}

// ============================================
// PM RECORDS OPERATIONS
// ============================================
const PM_RECORDS_COLLECTION = "crm_pm_records"

export async function getPMRecords(): Promise<PMRecord[]> {
  return getAllFromCollection<PMRecord>(PM_RECORDS_COLLECTION)
}

export async function getPMRecordById(id: string): Promise<PMRecord | null> {
  return getById<PMRecord>(PM_RECORDS_COLLECTION, id)
}

export async function createPMRecord(
  data: Omit<PMRecord, "id" | "created_at" | "updated_at">
): Promise<PMRecord> {
  return createDocument<PMRecord>(PM_RECORDS_COLLECTION, data)
}

export async function updatePMRecord(
  id: string,
  updates: Partial<PMRecord>
): Promise<PMRecord> {
  return updateDocument<PMRecord>(PM_RECORDS_COLLECTION, id, updates)
}

export async function deletePMRecord(id: string): Promise<void> {
  return deleteDocument(PM_RECORDS_COLLECTION, id)
}

// ============================================
// BUDGET VIEW OPERATIONS
// ============================================
const BUDGET_COLLECTION = "crm_budget_view"

export async function getBudgetViews(): Promise<BudgetView[]> {
  return getAllFromCollection<BudgetView>(BUDGET_COLLECTION)
}

export async function getBudgetViewById(id: string): Promise<BudgetView | null> {
  return getById<BudgetView>(BUDGET_COLLECTION, id)
}

export async function createBudgetView(
  data: Omit<BudgetView, "id" | "created_at" | "updated_at">
): Promise<BudgetView> {
  return createDocument<BudgetView>(BUDGET_COLLECTION, data)
}

export async function updateBudgetView(
  id: string,
  updates: Partial<BudgetView>
): Promise<BudgetView> {
  return updateDocument<BudgetView>(BUDGET_COLLECTION, id, updates)
}

export async function deleteBudgetView(id: string): Promise<void> {
  return deleteDocument(BUDGET_COLLECTION, id)
}

// ============================================
// MASTER LIST OPERATIONS
// ============================================
const MASTER_LIST_COLLECTION = "crm_master_list"

export async function getMasterList(): Promise<MasterListItem[]> {
  return getAllFromCollection<MasterListItem>(MASTER_LIST_COLLECTION)
}

export async function getMasterListItemById(id: string): Promise<MasterListItem | null> {
  return getById<MasterListItem>(MASTER_LIST_COLLECTION, id)
}

export async function createMasterListItem(
  data: Omit<MasterListItem, "id" | "created_at" | "updated_at">
): Promise<MasterListItem> {
  const result = await createDocument<MasterListItem>(MASTER_LIST_COLLECTION, data)
  // Also invalidate combined tasks cache if this is a task
  if (data.type === "task") {
    cache.delete("all_tasks_combined")
  }
  return result
}

export async function updateMasterListItem(
  id: string,
  updates: Partial<MasterListItem>
): Promise<MasterListItem> {
  const result = await updateDocument<MasterListItem>(MASTER_LIST_COLLECTION, id, updates)
  // Also invalidate combined tasks cache
  cache.delete("all_tasks_combined")
  return result
}

export async function deleteMasterListItem(id: string): Promise<void> {
  await deleteDocument(MASTER_LIST_COLLECTION, id)
  // Also invalidate combined tasks cache
  cache.delete("all_tasks_combined")
}

// ============================================
// DAILY SUMMARY OPERATIONS
// ============================================
const DAILY_SUMMARY_COLLECTION = "crm_daily_summary"

export async function getDailySummaries(): Promise<DailySummary[]> {
  return getAllFromCollection<DailySummary>(DAILY_SUMMARY_COLLECTION)
}

export async function getDailySummaryByDate(date: string): Promise<DailySummary | null> {
  try {
    const db = getDb()
    const snapshot = await db
      .collection(DAILY_SUMMARY_COLLECTION)
      .where("date", "==", date)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    return docToData<DailySummary>(snapshot.docs[0])
  } catch (error) {
    console.error("Error fetching daily summary:", error)
    return null
  }
}

export async function createDailySummary(
  data: Omit<DailySummary, "id" | "created_at" | "updated_at">
): Promise<DailySummary> {
  return createDocument<DailySummary>(DAILY_SUMMARY_COLLECTION, data)
}

export async function updateDailySummary(
  id: string,
  updates: Partial<DailySummary>
): Promise<DailySummary> {
  return updateDocument<DailySummary>(DAILY_SUMMARY_COLLECTION, id, updates)
}

// ============================================
// TASKS OPERATIONS (Generic for all task lists)
// ============================================
const TASK_COLLECTIONS = {
  jake: "crm_tasks_jake",
  pm: "crm_tasks_pm",
  marc: "crm_tasks_marc",
  stacy: "crm_tasks_stacy",
  jesse: "crm_tasks_jesse",
  barb: "crm_tasks_barb",
  teams: "crm_tasks_teams",
  completed: "crm_tasks_completed",
} as const

type TaskOwner = keyof typeof TASK_COLLECTIONS

export async function getTasks(owner: TaskOwner): Promise<Task[]> {
  return getAllFromCollection<Task>(TASK_COLLECTIONS[owner])
}

export async function getTaskById(owner: TaskOwner, id: string): Promise<Task | null> {
  return getById<Task>(TASK_COLLECTIONS[owner], id)
}

export async function createTask(
  owner: TaskOwner,
  data: Omit<Task, "id" | "created_at" | "updated_at">
): Promise<Task> {
  return createDocument<Task>(TASK_COLLECTIONS[owner], data)
}

export async function updateTask(
  owner: TaskOwner,
  id: string,
  updates: Partial<Task>
): Promise<Task> {
  return updateDocument<Task>(TASK_COLLECTIONS[owner], id, updates)
}

export async function deleteTask(owner: TaskOwner, id: string): Promise<void> {
  return deleteDocument(TASK_COLLECTIONS[owner], id)
}

// Get all tasks across all owners (parallel fetch for efficiency)
// Also includes tasks from the master list
export async function getAllTasks(): Promise<Task[]> {
  // Check cache first for the combined result
  const cacheKey = "all_tasks_combined"
  const cached = getCached<Task[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for all tasks")
    return cached
  }

  // Fetch all task collections AND master list in PARALLEL
  const owners = Object.keys(TASK_COLLECTIONS) as TaskOwner[]
  const [taskArrays, masterList] = await Promise.all([
    Promise.all(owners.map((owner) => getTasks(owner))),
    getMasterList(),
  ])
  
  // Combine tasks from individual collections
  const tasksFromCollections = taskArrays.flat()
  
  // Convert master list items of type "task" to Task format
  // Note: Cast to unknown first for flexible field access since Firestore docs may have extra fields
  const tasksFromMasterList: Task[] = masterList
    .filter((item) => item.type === "task")
    .map((item) => {
      const rawItem = item as unknown as Record<string, unknown>
      return {
        id: item.id,
        // Use name as title, fall back to any other name-like field
        title: item.name || (rawItem.title as string) || "Untitled Task",
        description: (rawItem.description as string) || "", 
        assigned_to: item.owner || (rawItem.assigned_to as string) || "Unassigned",
        status: mapMasterListStatusToTaskStatus(item.status) as Task["status"],
        priority: (item.priority || "medium") as Task["priority"],
        due_date: item.due_date || (rawItem.dueDate as string),
        client_name: item.reference_type === "client" ? item.reference_id : (rawItem.client_name as string),
        tags: item.tags || [],
        created_at: item.created_at,
        updated_at: item.updated_at,
        notes: item.color_code || (rawItem.notes as string) || undefined,
        // Use team[0] as brand, or check for brand field directly
        brand: ((rawItem.brand as Task["brand"]) || (item.team && item.team[0])) as Task["brand"] || undefined,
      }
    })
  
  // Combine all tasks, with master list tasks first (most recent/active)
  const allTasks = [...tasksFromMasterList, ...tasksFromCollections]
  
  // Cache the combined result
  setCache(cacheKey, allTasks)
  console.log("[Firestore] Fetched", allTasks.length, "total tasks (", tasksFromMasterList.length, "from master list,", tasksFromCollections.length, "from collections)")
  
  return allTasks
}

// Helper to map master list status to task status
function mapMasterListStatusToTaskStatus(status: string): string {
  const statusMap: Record<string, string> = {
    "active": "in_progress",
    "pending": "not_started",
    "completed": "completed",
    "done": "completed",
    "blocked": "blocked",
    "on_hold": "deferred",
    "deferred": "deferred",
  }
  return statusMap[status?.toLowerCase()] || status || "not_started"
}

// Move task to completed
export async function completeTask(
  owner: TaskOwner,
  id: string
): Promise<Task> {
  // Get the task
  const task = await getTaskById(owner, id)
  if (!task) throw new Error("Task not found")

  // Create in completed collection
  const completedTask = await createTask("completed", {
    ...task,
    status: "completed",
    completed_date: new Date().toISOString(),
  } as Omit<Task, "id" | "created_at" | "updated_at">)

  // Delete from original collection
  await deleteTask(owner, id)

  return completedTask
}

// ============================================
// LEADS OPERATIONS (Closed/Archived)
// ============================================
const CLOSED_LOST_COLLECTION = "crm_closed_lost_leads"
const CLOSED_WON_COLLECTION = "crm_closed_won_leads"
const ARCHIVED_COLLECTION = "crm_archived_leads"

export async function getClosedLostLeads(): Promise<ClosedLostLead[]> {
  return getAllFromCollection<ClosedLostLead>(CLOSED_LOST_COLLECTION)
}

export async function getClosedWonLeads(): Promise<ClosedWonLead[]> {
  return getAllFromCollection<ClosedWonLead>(CLOSED_WON_COLLECTION)
}

export async function getArchivedLeads(): Promise<ArchivedLead[]> {
  return getAllFromCollection<ArchivedLead>(ARCHIVED_COLLECTION)
}

export async function createClosedLostLead(
  data: Omit<ClosedLostLead, "id" | "created_at" | "updated_at">
): Promise<ClosedLostLead> {
  return createDocument<ClosedLostLead>(CLOSED_LOST_COLLECTION, data)
}

export async function createClosedWonLead(
  data: Omit<ClosedWonLead, "id" | "created_at" | "updated_at">
): Promise<ClosedWonLead> {
  return createDocument<ClosedWonLead>(CLOSED_WON_COLLECTION, data)
}

export async function createArchivedLead(
  data: Omit<ArchivedLead, "id" | "created_at" | "updated_at">
): Promise<ArchivedLead> {
  return createDocument<ArchivedLead>(ARCHIVED_COLLECTION, data)
}

// ============================================
// PLATFORMS OPERATIONS
// ============================================
const PLATFORMS_COLLECTION = "crm_platforms"

export async function getPlatforms(): Promise<Platform[]> {
  return getAllFromCollection<Platform>(PLATFORMS_COLLECTION)
}

export async function getPlatformById(id: string): Promise<Platform | null> {
  return getById<Platform>(PLATFORMS_COLLECTION, id)
}

export async function createPlatform(
  data: Omit<Platform, "id" | "created_at" | "updated_at">
): Promise<Platform> {
  return createDocument<Platform>(PLATFORMS_COLLECTION, data)
}

export async function updatePlatform(
  id: string,
  updates: Partial<Platform>
): Promise<Platform> {
  return updateDocument<Platform>(PLATFORMS_COLLECTION, id, updates)
}

export async function deletePlatform(id: string): Promise<void> {
  return deleteDocument(PLATFORMS_COLLECTION, id)
}

// ============================================
// SALES REPS OPERATIONS
// ============================================
const SALES_REPS_COLLECTION = "crm_sales_reps"

export async function getSalesReps(): Promise<SalesRep[]> {
  return getAllFromCollection<SalesRep>(SALES_REPS_COLLECTION)
}

export async function getSalesRepById(id: string): Promise<SalesRep | null> {
  return getById<SalesRep>(SALES_REPS_COLLECTION, id)
}

export async function createSalesRep(
  data: Omit<SalesRep, "id" | "created_at" | "updated_at">
): Promise<SalesRep> {
  return createDocument<SalesRep>(SALES_REPS_COLLECTION, data)
}

export async function updateSalesRep(
  id: string,
  updates: Partial<SalesRep>
): Promise<SalesRep> {
  return updateDocument<SalesRep>(SALES_REPS_COLLECTION, id, updates)
}

export async function deleteSalesRep(id: string): Promise<void> {
  return deleteDocument(SALES_REPS_COLLECTION, id)
}

// ============================================
// PIE CHART OPERATIONS
// ============================================
const PIE_CHART_COLLECTION = "crm_barb_pie_chart"
const PIE_SLICES_COLLECTION = "crm_pie_slices"

export async function getPieCharts(): Promise<BarbPieChart[]> {
  return getAllFromCollection<BarbPieChart>(PIE_CHART_COLLECTION)
}

export async function getPieSlices(): Promise<PieSlice[]> {
  return getAllFromCollection<PieSlice>(PIE_SLICES_COLLECTION)
}

export async function getSlicesByChartId(chartId: string): Promise<PieSlice[]> {
  try {
    const db = getDb()
    const snapshot = await db
      .collection(PIE_SLICES_COLLECTION)
      .where("chart_id", "==", chartId)
      .orderBy("order", "asc")
      .get()
    return snapshot.docs
      .map((doc) => docToData<PieSlice>(doc))
      .filter((item): item is PieSlice => item !== null)
  } catch (error) {
    console.error("Error fetching pie slices:", error)
    throw error
  }
}

// ============================================
// DASHBOARD STATS
// ============================================
export async function getCRMDashboardStats(): Promise<CRMDashboardStats> {
  try {
    const [clients, opportunities, allTasks, closedWon] = await Promise.all([
      getClients(),
      getOpportunities(),
      getAllTasks(),
      getClosedWonLeads(),
    ])

    const activeClients = clients.filter((c) => c.status === "active").length
    
    // Calculate pipeline value (only non-closed stages)
    const pipelineOpportunities = opportunities.filter(
      (o) => o.stage !== "closed_won" && o.stage !== "closed_lost"
    )
    const pipelineValue = pipelineOpportunities.reduce(
      (sum, o) => sum + (o.value || 0),
      0
    )

    // This month's closed won
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const closedWonThisMonth = closedWon.filter((lead) => {
      const closeDate = new Date(lead.closed_date)
      return closeDate >= monthStart
    })
    const closedWonRevenue = closedWonThisMonth.reduce(
      (sum, lead) => sum + (lead.deal_value || 0),
      0
    )

    // Today's tasks
    const today = new Date().toISOString().split("T")[0]
    const tasksToday = allTasks.filter(
      (t) => t.due_date?.startsWith(today) && t.status !== "completed"
    ).length
    
    // Overdue tasks
    const tasksOverdue = allTasks.filter((t) => {
      if (!t.due_date || t.status === "completed") return false
      return new Date(t.due_date) < now
    }).length

    // Conversion rate (won / total closed)
    const totalClosed = opportunities.filter(
      (o) => o.stage === "closed_won" || o.stage === "closed_lost"
    ).length
    const won = opportunities.filter((o) => o.stage === "closed_won").length
    const conversionRate = totalClosed > 0 ? (won / totalClosed) * 100 : 0

    return {
      totalClients: clients.length,
      activeClients,
      totalOpportunities: opportunities.length,
      pipelineValue,
      closedWonThisMonth: closedWonThisMonth.length,
      closedWonRevenue,
      tasksToday,
      tasksOverdue,
      conversionRate: Math.round(conversionRate * 10) / 10,
    }
  } catch (error) {
    console.error("Error calculating dashboard stats:", error)
    throw error
  }
}

// ============================================
// PIPELINE VIEW
// ============================================
const PIPELINE_STAGES: { stage: OpportunityStage; label: string; color: string }[] = [
  { stage: "lead", label: "Lead", color: "#6366f1" },
  { stage: "qualified", label: "Qualified", color: "#8b5cf6" },
  { stage: "proposal", label: "Proposal", color: "#0ea5e9" },
  { stage: "negotiation", label: "Negotiation", color: "#f59e0b" },
  { stage: "closed_won", label: "Closed Won", color: "#22c55e" },
  { stage: "closed_lost", label: "Closed Lost", color: "#ef4444" },
]

export async function getPipelineView(): Promise<PipelineColumn[]> {
  try {
    const opportunities = await getOpportunities()

    return PIPELINE_STAGES.map(({ stage, label, color }) => {
      const stageOpportunities = opportunities.filter((o) => o.stage === stage)
      const totalValue = stageOpportunities.reduce(
        (sum, o) => sum + (o.value || 0),
        0
      )

      return {
        stage,
        label,
        color,
        opportunities: stageOpportunities,
        totalValue,
      }
    })
  } catch (error) {
    console.error("Error building pipeline view:", error)
    throw error
  }
}

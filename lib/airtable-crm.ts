import Airtable from "airtable"
import { AIRTABLE_TO_FIRESTORE_MAP } from "../types/crm-types"

// Initialize Airtable base for CRM
const airtableCRMBaseId = process.env.AIRTABLE_CRM_BASE_ID || "app6lXqEqHFG9ZJ20"
const airtableCRMApiKey = process.env.AIRTABLE_CRM_API_KEY || process.env.AIRTABLE_EVENTS_API_KEY

if (!airtableCRMApiKey) {
  console.warn("Airtable CRM API key not found. Set AIRTABLE_CRM_API_KEY or AIRTABLE_EVENTS_API_KEY")
}

let crmBase: Airtable.Base | null = null

function getCRMBase(): Airtable.Base {
  if (!crmBase && airtableCRMApiKey) {
    crmBase = new Airtable({ apiKey: airtableCRMApiKey }).base(airtableCRMBaseId)
  }
  if (!crmBase) {
    throw new Error("Airtable CRM base not initialized. Check API key configuration.")
  }
  return crmBase
}

// Table names as they appear in Airtable
export const AIRTABLE_CRM_TABLES = [
  "Client Records",
  "Opportunities", 
  "PM Records",
  "Budget View",
  "Master List",
  "Daily Summary",
  "Jake's Task List",
  "PM Task List",
  "Closed lost archived leads",
  "Platforms",
  "Sales Rep's",
  "Closed Won archive leads",
  "Completed Task List",
  "Teams Task List",
  "Marc's Task List",
  "Stacy Task List",
  "Jesse Task List",
  "Barb Task List",
  "Barb Pie Chart",
  "Pie Slices",
  "Archived Leads",
] as const

export type AirtableCRMTable = typeof AIRTABLE_CRM_TABLES[number]

// Generic function to get all records from a table
export async function getRecordsFromTable(
  tableName: string
): Promise<Record<string, unknown>[]> {
  try {
    const base = getCRMBase()
    const records = await base(tableName).select().all()
    
    return records.map((record) => ({
      airtable_id: record.id,
      ...normalizeAirtableFields(record.fields),
      airtable_created_time: record._rawJson?.createdTime,
    }))
  } catch (error) {
    console.error("Error fetching records from table:", tableName, error)
    throw new Error("Failed to fetch records from Airtable table: " + String(tableName))
  }
}

// Normalize Airtable field names to snake_case for Firestore
function normalizeAirtableFields(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(fields)) {
    // Convert field name to snake_case
    const normalizedKey = key
      .toLowerCase()
      .replace(/['']/g, "") // Remove apostrophes
      .replace(/[^a-z0-9]+/g, "_") // Replace non-alphanumeric with underscore
      .replace(/^_|_$/g, "") // Remove leading/trailing underscores

    // Handle Airtable attachment fields (convert to URLs)
    if (Array.isArray(value) && value.length > 0 && value[0]?.url) {
      normalized[normalizedKey] = value.map((attachment: Record<string, unknown>) => ({
        url: attachment.url,
        filename: attachment.filename,
        type: attachment.type,
      }))
    }
    // Handle linked records (just store the IDs)
    else if (Array.isArray(value) && value.every((v) => typeof v === "string" && v.startsWith("rec"))) {
      normalized[`${normalizedKey}_ids`] = value
    }
    // Handle other values
    else {
      normalized[normalizedKey] = value
    }
  }

  return normalized
}

// Get migration status - check how many records are in each table
export async function getMigrationStatus(): Promise<{
  tableName: string
  firestoreCollection: string
  recordCount: number
}[]> {
  const status = []

  for (const tableName of AIRTABLE_CRM_TABLES) {
    try {
      const records = await getRecordsFromTable(tableName)
      const firestoreCollection = AIRTABLE_TO_FIRESTORE_MAP[tableName] || "unknown"
      
      status.push({
        tableName,
        firestoreCollection,
        recordCount: records.length,
      })
    } catch (error) {
      console.error("Error getting status for table:", tableName, error)
      status.push({
        tableName,
        firestoreCollection: AIRTABLE_TO_FIRESTORE_MAP[tableName] || "unknown",
        recordCount: -1, // Indicates error
      })
    }
  }

  return status
}

// Map Airtable fields to our typed interfaces based on table
export function mapAirtableRecordToTyped(
  tableName: string,
  record: Record<string, unknown>
): Record<string, unknown> {
  // Remove airtable-specific fields for a cleaner structure
  const { airtable_id, airtable_created_time, ...data } = record

  // Base mapping - applies to all records
  const baseRecord = {
    ...data,
    _airtable_id: airtable_id, // Keep reference to original Airtable ID
    _migrated_at: new Date().toISOString(),
  }

  // Table-specific mappings
  switch (tableName) {
    case "Client Records":
      return mapClientRecord(baseRecord)
    case "Opportunities":
      return mapOpportunityRecord(baseRecord)
    case "PM Records":
      return mapPMRecord(baseRecord)
    case "Budget View":
      return mapBudgetRecord(baseRecord)
    case "Master List":
      return mapMasterListRecord(baseRecord)
    case "Daily Summary":
      return mapDailySummaryRecord(baseRecord)
    case "Sales Rep's":
      return mapSalesRepRecord(baseRecord)
    case "Platforms":
      return mapPlatformRecord(baseRecord)
    default:
      // For task lists and other tables, apply generic task mapping if it looks like a task
      if (tableName.includes("Task List")) {
        return mapTaskRecord(baseRecord, tableName)
      }
      if (tableName.includes("leads") || tableName.includes("Leads")) {
        return mapLeadRecord(baseRecord, tableName)
      }
      if (tableName.includes("Pie")) {
        return mapPieChartRecord(baseRecord)
      }
      return baseRecord
  }
}

// Client record mapping
function mapClientRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    name: record.name || record.client_name || "",
    company_name: record.company_name || record.company || "",
    email: record.email || "",
    phone: record.phone || record.phone_number || "",
    industry: record.industry || "",
    website: record.website || "",
    address: record.address || "",
    city: record.city || "",
    state: record.state || "",
    zip_code: record.zip_code || record.zip || "",
    status: normalizeStatus(record.status),
    lead_source: record.lead_source || record.source || "",
    assigned_to: record.assigned_to || record.sales_rep || "",
    last_contact_date: record.last_contact_date || record.last_contact || "",
    next_followup_date: record.next_followup_date || record.next_followup || "",
    notes: record.notes || "",
    lifetime_value: parseNumber(record.lifetime_value || record.ltv),
    monthly_retainer: parseNumber(record.monthly_retainer || record.retainer),
    instagram_handle: record.instagram_handle || record.instagram || "",
    linkedin_url: record.linkedin_url || record.linkedin || "",
    ...record,
  }
}

// Opportunity record mapping
function mapOpportunityRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    name: record.name || record.opportunity_name || record.deal_name || "",
    description: record.description || "",
    client_id: record.client_id || "",
    client_name: record.client_name || record.client || "",
    stage: normalizeStage(record.stage || record.status),
    probability: parseNumber(record.probability),
    value: parseNumber(record.value || record.deal_value || record.amount),
    currency: record.currency || "USD",
    expected_close_date: record.expected_close_date || record.close_date || "",
    actual_close_date: record.actual_close_date || "",
    owner_id: record.owner_id || "",
    owner_name: record.owner_name || record.owner || record.sales_rep || "",
    services: normalizeArray(record.services),
    notes: record.notes || "",
    lost_reason: record.lost_reason || "",
    won_reason: record.won_reason || "",
    competitors: normalizeArray(record.competitors),
    ...record,
  }
}

// PM Record mapping
function mapPMRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    project_name: record.project_name || record.name || record.project || "",
    description: record.description || "",
    client_id: record.client_id || "",
    client_name: record.client_name || record.client || "",
    status: record.status || "planning",
    health: record.health || "on_track",
    start_date: record.start_date || "",
    end_date: record.end_date || "",
    deadline: record.deadline || "",
    budget: parseNumber(record.budget),
    spent: parseNumber(record.spent),
    pm_id: record.pm_id || "",
    pm_name: record.pm_name || record.pm || record.project_manager || "",
    team_members: normalizeArray(record.team_members || record.team),
    scope: record.scope || "",
    deliverables: normalizeArray(record.deliverables),
    notes: record.notes || "",
    ...record,
  }
}

// Budget record mapping
function mapBudgetRecord(record: Record<string, unknown>): Record<string, unknown> {
  const allocated = parseNumber(record.allocated_budget || record.budget);
  const spent = parseNumber(record.spent);
  const remaining = allocated - spent;
  
  return {
    name: record.name || "",
    description: record.description || "",
    period_type: record.period_type || "monthly",
    period_start: record.period_start || record.start_date || "",
    period_end: record.period_end || record.end_date || "",
    allocated_budget: allocated,
    spent: spent,
    remaining: remaining,
    category: record.category || "",
    project_id: record.project_id || "",
    client_id: record.client_id || "",
    status: remaining < 0 ? "over_budget" : remaining < allocated * 0.1 ? "on_budget" : "under_budget",
    variance_percent: allocated > 0 ? ((spent - allocated) / allocated) * 100 : 0,
    notes: record.notes || "",
    ...record,
  }
}

// Master List record mapping
function mapMasterListRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    name: record.name || "",
    type: record.type || "task",
    status: record.status || "",
    priority: normalizePriority(record.priority),
    owner: record.owner || record.assigned_to || "",
    team: normalizeArray(record.team),
    due_date: record.due_date || "",
    value: parseNumber(record.value),
    reference_id: record.reference_id || "",
    reference_type: record.reference_type || "",
    tags: normalizeArray(record.tags),
    color_code: record.color_code || record.color || "",
    ...record,
  }
}

// Daily Summary record mapping
function mapDailySummaryRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    date: record.date || new Date().toISOString().split("T")[0],
    new_leads: parseNumber(record.new_leads),
    opportunities_created: parseNumber(record.opportunities_created),
    opportunities_won: parseNumber(record.opportunities_won),
    opportunities_lost: parseNumber(record.opportunities_lost),
    revenue_closed: parseNumber(record.revenue_closed),
    calls_made: parseNumber(record.calls_made),
    emails_sent: parseNumber(record.emails_sent),
    meetings_held: parseNumber(record.meetings_held),
    tasks_completed: parseNumber(record.tasks_completed),
    pipeline_value: parseNumber(record.pipeline_value),
    pipeline_count: parseNumber(record.pipeline_count),
    highlights: record.highlights || "",
    challenges: record.challenges || "",
    notes: record.notes || "",
    ...record,
  }
}

// Task record mapping
function mapTaskRecord(record: Record<string, unknown>, tableName: string): Record<string, unknown> {
  // Extract owner from table name
  let assignedTo = record.assigned_to || ""
  if (!assignedTo) {
    if (tableName.includes("Jake")) assignedTo = "Jake"
    else if (tableName.includes("Marc")) assignedTo = "Marc"
    else if (tableName.includes("Stacy")) assignedTo = "Stacy"
    else if (tableName.includes("Jesse")) assignedTo = "Jesse"
    else if (tableName.includes("Barb")) assignedTo = "Barb"
    else if (tableName.includes("PM")) assignedTo = "PM"
    else if (tableName.includes("Teams")) assignedTo = "Team"
  }

  return {
    title: record.title || record.name || record.task || "",
    description: record.description || "",
    assigned_to: assignedTo,
    assigned_by: record.assigned_by || "",
    status: normalizeTaskStatus(record.status),
    priority: normalizePriority(record.priority),
    due_date: record.due_date || "",
    completed_date: record.completed_date || "",
    client_id: record.client_id || "",
    client_name: record.client_name || record.client || "",
    project_id: record.project_id || "",
    opportunity_id: record.opportunity_id || "",
    estimated_hours: parseNumber(record.estimated_hours),
    actual_hours: parseNumber(record.actual_hours),
    notes: record.notes || "",
    tags: normalizeArray(record.tags),
    ...record,
  }
}

// Lead record mapping
function mapLeadRecord(record: Record<string, unknown>, tableName: string): Record<string, unknown> {
  const isWon = tableName.toLowerCase().includes("won")
  const isLost = tableName.toLowerCase().includes("lost")
  
  return {
    name: record.name || "",
    company_name: record.company_name || record.company || "",
    email: record.email || "",
    phone: record.phone || "",
    lead_source: record.lead_source || record.source || "",
    initial_contact_date: record.initial_contact_date || "",
    closed_date: record.closed_date || record.close_date || "",
    ...(isWon ? {
      won_reason: record.won_reason || "",
      deal_value: parseNumber(record.deal_value || record.value),
      converted_to_client_id: record.converted_to_client_id || "",
      success_factors: record.success_factors || "",
    } : {}),
    ...(isLost ? {
      lost_reason: record.lost_reason || "",
      lost_to_competitor: record.lost_to_competitor || record.competitor || "",
      potential_value: parseNumber(record.potential_value || record.value),
      lessons_learned: record.lessons_learned || "",
    } : {}),
    ...(!isWon && !isLost ? {
      archived_date: record.archived_date || new Date().toISOString(),
      archive_reason: record.archive_reason || "",
      previous_status: record.previous_status || "",
    } : {}),
    notes: record.notes || "",
    owner: record.owner || record.sales_rep || "",
    ...record,
  }
}

// Sales Rep record mapping
function mapSalesRepRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    name: record.name || "",
    email: record.email || "",
    phone: record.phone || "",
    title: record.title || record.role || "",
    department: record.department || "Sales",
    is_active: record.is_active !== false,
    quota: parseNumber(record.quota),
    quota_period: record.quota_period || "monthly",
    client_ids: normalizeArray(record.client_ids || record.clients),
    opportunity_ids: normalizeArray(record.opportunity_ids || record.opportunities),
    avatar_url: record.avatar_url || "",
    notes: record.notes || "",
    ...record,
  }
}

// Platform record mapping
function mapPlatformRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    name: record.name || "",
    type: record.type || "other",
    description: record.description || "",
    url: record.url || "",
    monthly_cost: parseNumber(record.monthly_cost || record.cost),
    is_active: record.is_active !== false,
    client_ids: normalizeArray(record.client_ids || record.clients),
    has_analytics: record.has_analytics === true,
    notes: record.notes || "",
    ...record,
  }
}

// Pie Chart record mapping
function mapPieChartRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    chart_name: record.chart_name || record.name || "",
    chart_type: record.chart_type || "pie",
    total_value: parseNumber(record.total_value || record.total),
    title: record.title || "",
    subtitle: record.subtitle || "",
    label: record.label || "",
    value: parseNumber(record.value),
    percentage: parseNumber(record.percentage),
    color: record.color || "",
    order: parseNumber(record.order),
    chart_id: record.chart_id || "",
    category: record.category || "",
    notes: record.notes || "",
    ...record,
  }
}

// Helper functions
function parseNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""))
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean)
  return []
}

function normalizeStatus(value: unknown): string {
  const status = String(value || "").toLowerCase()
  const statusMap: Record<string, string> = {
    active: "active",
    inactive: "inactive",
    prospect: "prospect",
    churned: "churned",
    "on hold": "on_hold",
    on_hold: "on_hold",
  }
  return statusMap[status] || "prospect"
}

function normalizeStage(value: unknown): string {
  const stage = String(value || "").toLowerCase().replace(/\s+/g, "_")
  const stageMap: Record<string, string> = {
    lead: "lead",
    new: "lead",
    qualified: "qualified",
    proposal: "proposal",
    negotiation: "negotiation",
    negotiating: "negotiation",
    closed_won: "closed_won",
    won: "closed_won",
    closed_lost: "closed_lost",
    lost: "closed_lost",
  }
  return stageMap[stage] || "lead"
}

function normalizePriority(value: unknown): string {
  const priority = String(value || "").toLowerCase()
  const priorityMap: Record<string, string> = {
    low: "low",
    medium: "medium",
    med: "medium",
    high: "high",
    urgent: "urgent",
    critical: "urgent",
  }
  return priorityMap[priority] || "medium"
}

function normalizeTaskStatus(value: unknown): string {
  const status = String(value || "").toLowerCase().replace(/\s+/g, "_")
  const statusMap: Record<string, string> = {
    not_started: "not_started",
    "not_started": "not_started",
    todo: "to_do",
    to_do: "to_do",
    "to_do": "to_do",
    in_progress: "in_progress",
    "in_progress": "in_progress",
    working: "in_progress",
    ready_for_review: "ready_for_review",
    "ready_for_review": "ready_for_review",
    review: "ready_for_review",
    pending_review: "ready_for_review",
    completed: "completed",
    done: "completed",
    // Legacy status conversions
    blocked: "not_started",
    deferred: "not_started",
    on_hold: "not_started",
    "on_hold": "not_started",
  }
  return statusMap[status] || "not_started"
}

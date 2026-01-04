// CRM Types for 434 Media Sales CRM
// Migrated from Airtable Base: app6lXqEqHFG9ZJ20

// Base record interface with common fields
export interface BaseRecord {
  id: string
  created_at: string
  updated_at: string
}

// Client status enum
export type ClientStatus = 
  | "active" 
  | "inactive" 
  | "prospect" 
  | "churned" 
  | "on_hold"

// Opportunity stage enum
export type OpportunityStage = 
  | "lead" 
  | "qualified" 
  | "proposal" 
  | "negotiation" 
  | "closed_won" 
  | "closed_lost"

// Priority level enum
export type Priority = "low" | "medium" | "high" | "urgent"

// Task status enum
export type TaskStatus = 
  | "not_started" 
  | "in_progress" 
  | "completed" 
  | "blocked" 
  | "deferred"

// Platform types
export type PlatformType = 
  | "instagram" 
  | "facebook" 
  | "linkedin" 
  | "tiktok" 
  | "youtube" 
  | "twitter" 
  | "website" 
  | "email" 
  | "other"

// ============================================
// CLIENT RECORDS
// ============================================

// Contact information for a client
export interface ClientContact {
  id: string
  name: string
  email?: string
  phone?: string
  role?: string
  is_primary?: boolean
}

export interface ClientRecord extends BaseRecord {
  // Basic Info
  name: string
  company_name?: string
  email?: string
  phone?: string
  
  // Multiple contacts support
  contacts?: ClientContact[]
  
  // Business Details
  industry?: string
  website?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  
  // Relationship
  status: ClientStatus
  lead_source?: string
  assigned_to?: string // Sales rep ID
  
  // Engagement
  last_contact_date?: string
  next_followup_date?: string
  notes?: string
  
  // Financial
  lifetime_value?: number
  monthly_retainer?: number
  
  // Social
  instagram_handle?: string
  linkedin_url?: string
  
  // Sales/Opportunity fields
  brand?: "434 Media" | "Vemos Vamos" | "DEVSA TV" | "Digital Canvas" | "TXMX Boxing"
  pitch_value?: number
  source?: string
  is_opportunity?: boolean
  disposition?: "open" | "pitched" | "closed_won" | "closed_lost"
  doc?: "25" | "50" | "75" | "90"
  
  // Linked records
  opportunity_ids?: string[]
  pm_record_ids?: string[]
}

// ============================================
// OPPORTUNITIES
// ============================================
export interface Opportunity extends BaseRecord {
  // Basic Info
  name: string
  description?: string
  
  // Client Link
  client_id?: string
  client_name?: string
  
  // Sales Info
  stage: OpportunityStage
  probability?: number // 0-100
  
  // Value
  value?: number
  currency?: string
  
  // Timeline
  expected_close_date?: string
  actual_close_date?: string
  
  // Assignment
  owner_id?: string
  owner_name?: string
  
  // Details
  services?: string[] // What services are being proposed
  notes?: string
  
  // Tracking
  lost_reason?: string
  won_reason?: string
  competitors?: string[]
}

// ============================================
// PM RECORDS (Project Management)
// ============================================
export interface PMRecord extends BaseRecord {
  // Basic Info
  project_name: string
  description?: string
  
  // Client Link
  client_id?: string
  client_name?: string
  
  // Status
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled"
  health: "on_track" | "at_risk" | "off_track"
  
  // Timeline
  start_date?: string
  end_date?: string
  deadline?: string
  
  // Budget
  budget?: number
  spent?: number
  
  // Assignment
  pm_id?: string
  pm_name?: string
  team_members?: string[]
  
  // Details
  scope?: string
  deliverables?: string[]
  notes?: string
  
  // Linked
  opportunity_id?: string
  task_ids?: string[]
}

// ============================================
// BUDGET VIEW
// ============================================
export interface BudgetView extends BaseRecord {
  // Identifier
  name: string
  description?: string
  
  // Period
  period_type: "monthly" | "quarterly" | "annual"
  period_start: string
  period_end: string
  
  // Amounts
  allocated_budget: number
  spent: number
  remaining: number
  
  // Breakdown
  category?: string
  project_id?: string
  client_id?: string
  
  // Status
  status: "under_budget" | "on_budget" | "over_budget"
  variance_percent?: number
  
  // Notes
  notes?: string
}

// ============================================
// MASTER LIST (Combined Overview)
// ============================================
export interface MasterListItem extends BaseRecord {
  // Core Info
  name: string
  type: "client" | "opportunity" | "project" | "task" | "lead"
  
  // Status
  status: string
  priority?: Priority
  
  // Assignment
  owner?: string
  team?: string[]
  
  // Timeline
  due_date?: string
  
  // Value
  value?: number
  
  // Linked IDs
  reference_id?: string
  reference_type?: string
  
  // Display
  tags?: string[]
  color_code?: string
}

// ============================================
// DAILY SUMMARY
// ============================================
export interface DailySummary extends BaseRecord {
  // Date
  date: string
  
  // Metrics
  new_leads: number
  opportunities_created: number
  opportunities_won: number
  opportunities_lost: number
  revenue_closed: number
  
  // Activity
  calls_made: number
  emails_sent: number
  meetings_held: number
  tasks_completed: number
  
  // Pipeline
  pipeline_value: number
  pipeline_count: number
  
  // Notes
  highlights?: string
  challenges?: string
  notes?: string
}

// ============================================
// TASK LIST (Base interface for all task lists)
// ============================================

// Brand type for task assignment
export type Brand = 
  | "434 Media" 
  | "Vemos Vamos" 
  | "DEVSA TV" 
  | "Digital Canvas" 
  | "TXMX Boxing"

// Task attachment interface
export interface TaskAttachment {
  id: string
  name: string
  type: "image" | "document" | "link"
  url: string
  uploaded_by: string
  uploaded_at: string
}

// Task comment interface
export interface TaskComment {
  id: string
  content: string
  author_name: string
  author_email: string
  author_avatar?: string
  created_at: string
  updated_at?: string
  mentions?: string[] // Array of user emails mentioned
}

export interface Task extends BaseRecord {
  // Basic Info
  title: string
  description?: string
  
  // Assignment
  assigned_to: string // Team member name or ID
  assigned_by?: string
  brand?: Brand // Which brand this task belongs to
  
  // Status
  status: TaskStatus
  priority: Priority
  
  // Timeline
  due_date?: string
  completed_date?: string
  
  // Links
  client_id?: string
  client_name?: string
  project_id?: string
  opportunity_id?: string
  
  // Effort
  estimated_hours?: number
  actual_hours?: number
  
  // Notes
  notes?: string
  tags?: string[]
  
  // Extended fields
  web_links?: string[] // Array of URLs
  attachments?: TaskAttachment[]
  comments?: TaskComment[]
  tagged_users?: string[] // Array of user emails
}

// Specific task lists extend the base Task interface
export interface JakeTaskList extends Task {
  assigned_to: "Jake"
}

export interface PMTaskList extends Task {
  pm_specific_notes?: string
  project_phase?: string
}

export interface MarcTaskList extends Task {
  assigned_to: "Marc"
}

export interface StacyTaskList extends Task {
  assigned_to: "Stacy"
}

export interface JesseTaskList extends Task {
  assigned_to: "Jesse"
}

export interface BarbTaskList extends Task {
  assigned_to: "Barb"
}

export interface TeamsTaskList extends Task {
  team_name: string
  team_members?: string[]
}

export interface CompletedTask extends Task {
  status: "completed"
  completed_date: string
  completion_notes?: string
}

// ============================================
// LEADS (Closed/Archived)
// ============================================
export interface ClosedLostLead extends BaseRecord {
  // Basic Info
  name: string
  company_name?: string
  email?: string
  phone?: string
  
  // Lead Info
  lead_source?: string
  initial_contact_date?: string
  
  // Loss Info
  closed_date: string
  lost_reason: string
  lost_to_competitor?: string
  
  // Value
  potential_value?: number
  
  // Notes
  notes?: string
  lessons_learned?: string
  
  // Original assignment
  original_owner?: string
}

export interface ClosedWonLead extends BaseRecord {
  // Basic Info
  name: string
  company_name?: string
  email?: string
  phone?: string
  
  // Lead Info
  lead_source?: string
  initial_contact_date?: string
  
  // Win Info
  closed_date: string
  won_reason?: string
  
  // Value
  deal_value: number
  
  // Conversion
  converted_to_client_id?: string
  converted_to_opportunity_id?: string
  
  // Notes
  notes?: string
  success_factors?: string
  
  // Original assignment
  owner?: string
}

export interface ArchivedLead extends BaseRecord {
  // Basic Info
  name: string
  company_name?: string
  email?: string
  phone?: string
  
  // Archive Info
  archived_date: string
  archive_reason: string
  
  // Previous Status
  previous_status?: string
  previous_stage?: string
  
  // Notes
  notes?: string
  
  // Original assignment
  original_owner?: string
}

// ============================================
// PLATFORMS
// ============================================
export interface Platform extends BaseRecord {
  // Basic Info
  name: string
  type: PlatformType
  
  // Details
  description?: string
  url?: string
  
  // Pricing
  monthly_cost?: number
  
  // Usage
  is_active: boolean
  client_ids?: string[] // Clients using this platform
  
  // Analytics Integration
  has_analytics: boolean
  analytics_api_key?: string
  
  // Notes
  notes?: string
}

// ============================================
// SALES REPS
// ============================================
export interface SalesRep extends BaseRecord {
  // Personal Info
  name: string
  email: string
  phone?: string
  
  // Role
  title?: string
  department?: string
  is_active: boolean
  
  // Performance
  quota?: number
  quota_period?: "monthly" | "quarterly" | "annual"
  
  // Assignments
  client_ids?: string[]
  opportunity_ids?: string[]
  
  // Avatar
  avatar_url?: string
  
  // Notes
  notes?: string
}

// ============================================
// PIE CHART DATA (Barb Pie Chart & Pie Slices)
// ============================================
export interface BarbPieChart extends BaseRecord {
  // Chart Info
  chart_name: string
  chart_type: string
  
  // Data
  total_value: number
  
  // Display
  title?: string
  subtitle?: string
  
  // Linked slices
  slice_ids?: string[]
}

export interface PieSlice extends BaseRecord {
  // Slice Info
  label: string
  value: number
  percentage?: number
  
  // Display
  color?: string
  order?: number
  
  // Link to chart
  chart_id?: string
  
  // Meta
  category?: string
  notes?: string
}

// ============================================
// COLLECTION NAMES
// ============================================
export const CRM_COLLECTIONS = {
  CLIENT_RECORDS: "crm_clients",
  OPPORTUNITIES: "crm_opportunities",
  PM_RECORDS: "crm_pm_records",
  BUDGET_VIEW: "crm_budget_view",
  MASTER_LIST: "crm_master_list",
  DAILY_SUMMARY: "crm_daily_summary",
  TASKS_JAKE: "crm_tasks_jake",
  TASKS_PM: "crm_tasks_pm",
  TASKS_MARC: "crm_tasks_marc",
  TASKS_STACY: "crm_tasks_stacy",
  TASKS_JESSE: "crm_tasks_jesse",
  TASKS_BARB: "crm_tasks_barb",
  TASKS_TEAMS: "crm_tasks_teams",
  TASKS_COMPLETED: "crm_tasks_completed",
  CLOSED_LOST_LEADS: "crm_closed_lost_leads",
  CLOSED_WON_LEADS: "crm_closed_won_leads",
  ARCHIVED_LEADS: "crm_archived_leads",
  PLATFORMS: "crm_platforms",
  SALES_REPS: "crm_sales_reps",
  BARB_PIE_CHART: "crm_barb_pie_chart",
  PIE_SLICES: "crm_pie_slices",
} as const

// Map Airtable table names to Firestore collections
export const AIRTABLE_TO_FIRESTORE_MAP: Record<string, string> = {
  "Client Records": CRM_COLLECTIONS.CLIENT_RECORDS,
  "Opportunities": CRM_COLLECTIONS.OPPORTUNITIES,
  "PM Records": CRM_COLLECTIONS.PM_RECORDS,
  "Budget View": CRM_COLLECTIONS.BUDGET_VIEW,
  "Master List": CRM_COLLECTIONS.MASTER_LIST,
  "Daily Summary": CRM_COLLECTIONS.DAILY_SUMMARY,
  "Jake's Task List": CRM_COLLECTIONS.TASKS_JAKE,
  "PM Task List": CRM_COLLECTIONS.TASKS_PM,
  "Marc's Task List": CRM_COLLECTIONS.TASKS_MARC,
  "Stacy Task List": CRM_COLLECTIONS.TASKS_STACY,
  "Jesse Task List": CRM_COLLECTIONS.TASKS_JESSE,
  "Barb Task List": CRM_COLLECTIONS.TASKS_BARB,
  "Teams Task List": CRM_COLLECTIONS.TASKS_TEAMS,
  "Completed Task List": CRM_COLLECTIONS.TASKS_COMPLETED,
  "Closed lost archived leads": CRM_COLLECTIONS.CLOSED_LOST_LEADS,
  "Closed Won archive leads": CRM_COLLECTIONS.CLOSED_WON_LEADS,
  "Archived Leads": CRM_COLLECTIONS.ARCHIVED_LEADS,
  "Platforms": CRM_COLLECTIONS.PLATFORMS,
  "Sales Rep's": CRM_COLLECTIONS.SALES_REPS,
  "Barb Pie Chart": CRM_COLLECTIONS.BARB_PIE_CHART,
  "Pie Slices": CRM_COLLECTIONS.PIE_SLICES,
}

// Type for CRM Dashboard Stats
export interface CRMDashboardStats {
  totalClients: number
  activeClients: number
  totalOpportunities: number
  pipelineValue: number
  closedWonThisMonth: number
  closedWonRevenue: number
  tasksToday: number
  tasksOverdue: number
  conversionRate: number
}

// Type for Pipeline View
export interface PipelineColumn {
  stage: OpportunityStage
  label: string
  color: string
  opportunities: Opportunity[]
  totalValue: number
}

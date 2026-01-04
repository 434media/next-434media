// CRM Types & Constants

export interface CRMTag {
  id: string
  name: string
  color?: string
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  totalClients: number
  activeClients: number
  totalOpportunities: number
  pipelineValue: number
  closedWonThisMonth: number
  closedWonRevenue: number
  closedLostRevenue: number
  tasksToday: number
  tasksOverdue: number
  conversionRate: number
  // Brand-specific stats
  brandStats: {
    brand: string
    totalPitched: number
    wonRevenue: number
    lostRevenue: number
    activeOpportunities: number
  }[]
  // Monthly revenue for chart
  monthlyRevenue: {
    month: string
    value: number
  }[]
}

export interface PipelineColumn {
  stage: string
  label: string
  color: string
  opportunities: Opportunity[]
  totalValue: number
}

export interface Opportunity {
  id: string
  name: string
  description?: string
  client_id?: string
  client_name?: string
  stage: string
  probability?: number
  value?: number
  expected_close_date?: string
  owner_name?: string
  created_at: string
  updated_at: string
}

// Contact information for a client
export interface ClientContact {
  id: string
  name: string
  email?: string
  phone?: string
  role?: string
  is_primary?: boolean
  address?: string
  city?: string
  state?: string
  zipcode?: string
  date_of_birth?: string
}

export interface Client {
  id: string
  name: string  // Primary contact name (for backwards compatibility)
  company_name?: string
  email?: string  // Primary contact email (for backwards compatibility)
  phone?: string  // Primary contact phone (for backwards compatibility)
  contacts?: ClientContact[]  // Additional contacts
  status: string
  source?: string  // Lead source: web, cold_call, event, inbound_call, referral, warm_intro
  tags?: string[]  // CRM tags for categorization and filtering
  is_opportunity?: boolean  // Whether to show in pipeline/opportunities view
  disposition?: Disposition  // Opportunity stage: open, pitched, closed_won, closed_lost
  doc?: DOC  // Degree of Confidence: 25, 50, 75, 90 (percentage probability)
  industry?: string  // Deprecated: use brand instead
  brand?: Brand  // Which brand this client is associated with
  website?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  lead_source?: string
  assigned_to?: string
  lifetime_value?: number
  monthly_retainer?: number
  pitch_value?: number  // Value pitched to this client
  last_contact_date?: string
  next_followup_date?: string
  instagram_handle?: string
  linkedin_url?: string
  notes?: string
  created_at: string
  updated_at: string
}

// Brand type
export type Brand = "434 Media" | "Vemos Vamos" | "DEVSA TV" | "Digital Canvas" | "TXMX Boxing"

// Disposition (opportunity stage) type - used in kanban columns
export type Disposition = "open" | "pitched" | "closed_won" | "closed_lost"

// DOC (Degree of Confidence) - stage probability values
export type DOC = "25" | "50" | "75" | "90"

// Disposition options for UI
export const DISPOSITION_OPTIONS: { value: Disposition; label: string; color: string }[] = [
  { value: "open", label: "Open", color: "#3b82f6" },
  { value: "pitched", label: "Pitched", color: "#8b5cf6" },
  { value: "closed_won", label: "Closed Won", color: "#10b981" },
  { value: "closed_lost", label: "Closed Lost", color: "#ef4444" },
]

// DOC options for UI
export const DOC_OPTIONS: { value: DOC; label: string }[] = [
  { value: "25", label: "25%" },
  { value: "50", label: "50%" },
  { value: "75", label: "75%" },
  { value: "90", label: "90%" },
]

// Brand Sales Goals (annual targets)
export interface BrandGoal {
  brand: Brand
  annualGoal: number
  color: string
  description: string
  // Optional: array of brands that share this goal (for combined tracking)
  includedBrands?: Brand[]
}

// Helper to check if a brand belongs to the 434 Media group (parent company)
export function is434MediaGroup(brand: Brand | undefined): boolean {
  return brand === "434 Media" || brand === "Digital Canvas"
}

// Brands that belong to the 434 Media parent company
export const MEDIA_434_BRANDS: Brand[] = ["434 Media", "Digital Canvas"]

export const BRAND_GOALS: BrandGoal[] = [
  { brand: "TXMX Boxing", annualGoal: 1000000, color: "#ef4444", description: "Sports & Entertainment" },
  { brand: "Vemos Vamos", annualGoal: 250000, color: "#f97316", description: "Bilingual Studio & Agency" },
  { brand: "DEVSA TV", annualGoal: 250000, color: "#8b5cf6", description: "Documentary & Video Production" },
  { 
    brand: "434 Media", 
    annualGoal: 50000, 
    color: "#10b981", 
    description: "Parent Company & Digital Canvas",
    includedBrands: ["434 Media", "Digital Canvas"]
  },
]

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
  mentions?: string[]
}

// Current user interface
export interface CurrentUser {
  email: string
  name: string
  picture?: string
}

export interface Task {
  id: string
  title: string
  description?: string
  assigned_to: string
  assigned_by?: string
  brand?: Brand
  status: string
  priority: string
  due_date?: string
  completed_date?: string
  client_id?: string
  client_name?: string
  opportunity_id?: string
  is_opportunity?: boolean  // Whether to show in pipeline/opportunities view
  disposition?: Disposition  // Opportunity stage: open, pitched, closed_won, closed_lost
  doc?: DOC  // Degree of Confidence: 25, 50, 75, 90 (percentage probability)
  category?: string
  estimated_hours?: number
  actual_hours?: number
  tags?: string[]
  notes?: string
  web_links?: string[]
  attachments?: TaskAttachment[]
  comments?: TaskComment[]
  tagged_users?: string[]
  created_at: string
  updated_at: string
}

export interface Toast {
  message: string
  type: "success" | "error" | "warning"
}

export interface MigrationTableStatus {
  tableName: string
  firestoreCollection: string
  recordCount: number
}

export interface MigrationResult {
  success: boolean
  dryRun: boolean
  summary: {
    tablesProcessed: number
    successCount: number
    errorCount: number
    totalRecordsMigrated: number
  }
  results: Array<{
    table: string
    collection: string
    recordCount: number
    status: string
    error?: string
  }>
}

export type ViewMode = "dashboard" | "pipeline" | "clients" | "tasks"

// Status color mappings
export const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  prospect: "bg-blue-100 text-blue-700 border-blue-200",
  churned: "bg-red-100 text-red-700 border-red-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
}

export const TASK_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  blocked: "bg-red-100 text-red-700",
  deferred: "bg-amber-100 text-amber-700",
}

// Brand options
export const BRANDS: Brand[] = ["434 Media", "Vemos Vamos", "DEVSA TV", "Digital Canvas", "TXMX Boxing"]

// Team members for tagging and assignment
// Full names from Airtable migration
// Note: This is a fallback list. Team members are now managed in Firestore (crm_team_members collection)
export const TEAM_MEMBERS = [
  { name: "Jacob Lee Miles", email: "jake@434media.com" },
  { name: "Marcos Resendez", email: "marcos@434media.com" },
  { name: "Stacy Carrizales", email: "stacy@434media.com" },
  { name: "Jesse Hernandez", email: "jesse@434media.com" },
  { name: "Barbara Carreon", email: "barb@434media.com" },
  { name: "Nichole Snow", email: "nichole@434media.com" },
]

// TeamMember type for Firestore
export interface TeamMember {
  id: string
  name: string
  email: string
  isActive: boolean
  created_at: string
  updated_at: string
}

// Helper to normalize assignee names (maps short names to full names)
export function normalizeAssigneeName(name: string): string {
  if (!name) return "Unassigned"
  
  const nameMap: Record<string, string> = {
    "jake": "Jacob Lee Miles",
    "Jake": "Jacob Lee Miles",
    "marc": "Marcos Resendez",
    "Marc": "Marcos Resendez",
    "marcos": "Marcos Resendez",
    "Marcos": "Marcos Resendez",
    "jesse": "Jesse Hernandez",
    "Jesse": "Jesse Hernandez",
    "barb": "Barbara Carreon",
    "Barb": "Barbara Carreon",
    "nichole": "Nichole Snow",
    "Nichole": "Nichole Snow",
    "stacy": "Stacy Carrizales",
    "Stacy": "Stacy Carrizales",
    "pm": "Unassigned",
    "PM": "Unassigned",
    "teams": "Unassigned",
    "Teams": "Unassigned",
    "Team": "Unassigned",
  }
  
  return nameMap[name] || name
}

// Check if an assignee name is a valid full name (not a short name)
export function isValidAssigneeName(name: string): boolean {
  if (!name || name === "Unassigned") return true
  
  const shortNames = ["jake", "marc", "marcos", "jesse", "barb", "nichole", "stacy", "pm", "teams", "team"]
  return !shortNames.includes(name.toLowerCase())
}

// Helper to parse a date string, handling YYYY-MM-DD format as local time
export function parseLocalDate(date: string): Date {
  // Check if the date is in YYYY-MM-DD format (from date input)
  // If so, parse it as local time to avoid timezone shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-").map(Number)
    return new Date(year, month - 1, day) // month is 0-indexed
  }
  // For ISO strings with time component, use the date as-is
  return new Date(date)
}

// Helper function to check due date status
export function getDueDateStatus(dueDate: string | undefined, status: string): "overdue" | "approaching" | "normal" | null {
  if (!dueDate || status === "completed") return null
  
  const now = new Date()
  now.setHours(0, 0, 0, 0) // Start of today
  const due = parseLocalDate(dueDate)
  due.setHours(0, 0, 0, 0) // Start of due date
  
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return "overdue"
  if (diffDays <= 3) return "approaching"
  return "normal"
}

// Helper to format currency
export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 0)}K`
    }
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Helper to format date
// Handles YYYY-MM-DD format strings correctly to avoid timezone shifts
export function formatDate(date: string): string {
  if (!date) return "—"
  
  const parsedDate = parseLocalDate(date)
  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

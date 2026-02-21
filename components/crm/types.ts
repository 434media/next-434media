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
  first_name: string
  last_name: string
  name?: string  // For backwards compatibility - computed from first_name + last_name
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
  department?: string  // For large clients with multiple departments (e.g., "Marketing", "HR", "IT")
  email?: string  // Primary contact email (for backwards compatibility)
  phone?: string  // Primary contact phone (for backwards compatibility)
  contacts?: ClientContact[]  // Additional contacts
  status: string
  source?: string  // Lead source: web, cold_call, event, inbound_call, referral, warm_intro
  tags?: string[]  // CRM tags for categorization and filtering
  is_opportunity?: boolean  // Whether to show in pipeline/opportunities view
  opportunity_id?: string  // ID of linked opportunity (when this is a contact linked to an opportunity)
  disposition?: Disposition  // Opportunity stage: pitched, closed_won, closed_lost
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
  title?: string  // Opportunity title
  web_links?: string[]  // Web links related to this opportunity
  docs?: string[]  // Document URLs (external or uploaded)
  is_archived?: boolean  // Whether this opportunity is archived (for closed won/lost older than 60 days)
  archived_at?: string  // Date when the opportunity was archived
  created_at: string
  updated_at: string
}

// Brand type
export type Brand = "434 Media" | "Vemos Vamos" | "DEVSA TV" | "Digital Canvas" | "TXMX Boxing" | "AIMSATX"

// Disposition (opportunity stage) type - used in kanban columns
export type Disposition = "pitched" | "closed_won" | "closed_lost"

// DOC (Degree of Confidence) - stage probability values
export type DOC = "25" | "50" | "75" | "90" | "100"

// Disposition options for UI
// Colors chosen to NOT conflict with brand colors (no purple, red, orange, or emerald)
export const DISPOSITION_OPTIONS: { value: Disposition; label: string; color: string }[] = [
  { value: "pitched", label: "Pitched", color: "#0ea5e9" },      // Sky blue - active opportunities
  { value: "closed_won", label: "Closed Won", color: "#22c55e" }, // Green - success (different from 434 Media emerald)
  { value: "closed_lost", label: "Closed Lost", color: "#64748b" }, // Slate gray - neutral/inactive
]

// DOC options for UI
export const DOC_OPTIONS: { value: DOC; label: string }[] = [
  { value: "25", label: "25%" },
  { value: "50", label: "50%" },
  { value: "75", label: "75%" },
  { value: "90", label: "90%" },
  { value: "100", label: "100%" },
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
  { brand: "TXMX Boxing", annualGoal: 1000000, color: "#000000", description: "Sports & Entertainment" },
  { brand: "Vemos Vamos", annualGoal: 250000, color: "#fc0000", description: "Bilingual Studio & Agency" },
  { brand: "DEVSA TV", annualGoal: 250000, color: "#c454f0", description: "Documentary & Video Production" },
  { 
    brand: "434 Media", 
    annualGoal: 250000, 
    color: "#fa6400", 
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
  secondary_assigned_to?: string | string[]  // Can be single name or array of names for multi-select
  assigned_by?: string
  created_by?: string  // Who created the task (uneditable)
  brand?: Brand
  status: string
  priority: string
  due_date?: string
  completed_date?: string
  client_id?: string
  client_name?: string
  opportunity_id?: string
  is_opportunity?: boolean  // Whether to show in pipeline/opportunities view
  disposition?: Disposition  // Opportunity stage: pitched, closed_won, closed_lost
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
  // Social Media Calendar fields
  is_social_post?: boolean  // Whether this task is linked to social media calendar
  social_post_date?: string  // Scheduled date for social media post
  social_platforms?: SocialPlatform[]  // Which platforms this post is scheduled for
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

export type ViewMode = "dashboard" | "pipeline" | "clients" | "tasks" | "social-calendar"

// Social Media Platform type
export type SocialPlatform = "instagram" | "youtube" | "tiktok" | "linkedin" | "facebook"

// Calendar view mode for social calendar
export type CalendarViewMode = "day" | "week" | "month"

// Content Post Status type (for Social Calendar)
export type ContentPostStatus = "to_do" | "planning" | "in_progress" | "needs_approval" | "approved" | "scheduled" | "posted"

// Content Post Status options with colors for UI
// planning/in_progress: no color (neutral), needs_approval: light red, approved: blue, scheduled: yellow, posted: green
export const CONTENT_POST_STATUS_OPTIONS: { value: ContentPostStatus; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { value: "to_do", label: "To Do", color: "#6b7280", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
  { value: "planning", label: "Planning", color: "#6b7280", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
  { value: "in_progress", label: "In Progress", color: "#6b7280", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
  { value: "needs_approval", label: "Needs Approval", color: "#dc2626", bgColor: "bg-red-50", borderColor: "border-red-200" },
  { value: "approved", label: "Approved", color: "#2563eb", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  { value: "scheduled", label: "Scheduled", color: "#ca8a04", bgColor: "bg-yellow-50", borderColor: "border-yellow-200" },
  { value: "posted", label: "Posted", color: "#16a34a", bgColor: "bg-green-50", borderColor: "border-green-200" },
]

// Content Post interface (for Social Calendar - independent from Tasks)
export interface ContentPost {
  id: string
  user: string  // Assigned user (dropdown)
  date_created: string  // Hard-coded creation date
  platform?: Brand | ""  // Platform/brand dropdown
  status: ContentPostStatus
  title: string
  date_to_post?: string  // Scheduled post date
  notes?: string
  thumbnail?: string  // Uploaded thumbnail URL
  social_copy?: string  // The actual social media copy/text
  links: string[]  // Array of links
  assets: string[]  // Array of asset URLs
  tags?: string  // Text field for tags
  social_platforms: SocialPlatform[]  // Which social platforms (IG, TikTok, etc.)
  comments?: TaskComment[]  // Comments with tagging/notifications
  created_at: string
  updated_at: string
}

// Social platform options with colors for UI
export const SOCIAL_PLATFORM_OPTIONS: { value: SocialPlatform; label: string; color: string; bgColor: string }[] = [
  { value: "instagram", label: "Instagram", color: "#E1306C", bgColor: "bg-pink-100" },
  { value: "youtube", label: "YouTube", color: "#FF0000", bgColor: "bg-red-100" },
  { value: "tiktok", label: "TikTok", color: "#000000", bgColor: "bg-gray-100" },
  { value: "linkedin", label: "LinkedIn", color: "#0077B5", bgColor: "bg-blue-100" },
  { value: "facebook", label: "Facebook", color: "#1877F2", bgColor: "bg-blue-100" },
]

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
  in_progress: "bg-sky-100 text-sky-700",
  to_do: "bg-amber-100 text-amber-700",
  ready_for_review: "bg-cyan-100 text-cyan-700",
  completed: "bg-emerald-100 text-emerald-700",
  // Legacy statuses for backwards compatibility
  pending_review: "bg-cyan-100 text-cyan-700",
  on_hold: "bg-amber-100 text-amber-700",
  blocked: "bg-red-100 text-red-700",
  deferred: "bg-amber-100 text-amber-700",
}

// Brand options
export const BRANDS: Brand[] = ["434 Media", "Vemos Vamos", "DEVSA TV", "Digital Canvas", "TXMX Boxing", "AIMSATX"]

// Shared owner map: maps assignee display names to Firestore task collection owners
// Used across task handlers to determine which collection a task belongs to
export const OWNER_MAP: Record<string, string> = {
  "Jake": "jake",
  "Jacob Lee Miles": "jake",
  "Marc": "marc",
  "Marcos Resendez": "marc",
  "Stacy": "stacy",
  "Stacy Ramirez": "stacy",
  "Stacy Carrizales": "stacy",
  "Jesse": "jesse",
  "Jesse Hernandez": "jesse",
  "Barb": "barb",
  "Barbara Carreon": "barb",
  "Nichole": "teams",
  "Nichole Snow": "teams",
}

// Get the Firestore collection owner key for a given assignee name
export function getTaskOwner(assigneeName: string): string {
  return OWNER_MAP[assigneeName] || "teams"
}

// CRM Super Admins - can update/delete tasks across all collections regardless of ownership
export const CRM_SUPER_ADMINS = [
  "marcos@434media.com",
  "jesse@434media.com",
]

// Check if a user is a CRM super admin
export function isCrmSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  return CRM_SUPER_ADMINS.includes(email.toLowerCase())
}

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
  
  // Use lowercase for matching to handle all case variations
  const nameMapLower: Record<string, string> = {
    "jake": "Jacob Lee Miles",
    "jacob": "Jacob Lee Miles",
    "marc": "Marcos Resendez",
    "marcos": "Marcos Resendez",
    "jesse": "Jesse Hernandez",
    "barb": "Barbara Carreon",
    "barbara": "Barbara Carreon",
    "nichole": "Nichole Snow",
    "stacy": "Stacy Carrizales",
    "pm": "Unassigned",
    "teams": "Unassigned",
    "team": "Unassigned",
  }
  
  const lowerName = name.toLowerCase().trim()
  return nameMapLower[lowerName] || name
}

// Check if an assignee name is a valid full name (not a short name)
export function isValidAssigneeName(name: string): boolean {
  if (!name || name === "Unassigned") return true
  
  // All short/partial names that should be filtered out
  const shortNames = ["jake", "jacob", "marc", "marcos", "jesse", "barb", "barbara", "nichole", "stacy", "pm", "teams", "team"]
  return !shortNames.includes(name.toLowerCase().trim())
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
      // Show 1 decimal place for millions if not a round number
      const millions = value / 1000000
      return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`
    }
    if (value >= 1000) {
      // Show 1 decimal place for thousands to avoid rounding (e.g., $2.5K instead of $3K)
      const thousands = value / 1000
      return `$${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`
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

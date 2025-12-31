// CRM Types & Constants

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
}

export interface Client {
  id: string
  name: string  // Primary contact name (for backwards compatibility)
  company_name?: string
  email?: string  // Primary contact email (for backwards compatibility)
  phone?: string  // Primary contact phone (for backwards compatibility)
  contacts?: ClientContact[]  // Additional contacts
  status: string
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

// Brand Sales Goals (annual targets)
export interface BrandGoal {
  brand: Brand
  annualGoal: number
  color: string
  description: string
}

export const BRAND_GOALS: BrandGoal[] = [
  { brand: "TXMX Boxing", annualGoal: 1000000, color: "#ef4444", description: "Sports & Entertainment" },
  { brand: "Vemos Vamos", annualGoal: 250000, color: "#f97316", description: "Media & Content" },
  { brand: "DEVSA TV", annualGoal: 250000, color: "#8b5cf6", description: "Digital Broadcasting" },
  { brand: "434 Media", annualGoal: 300000, color: "#3b82f6", description: "Marketing Agency" },
  { brand: "Digital Canvas", annualGoal: 200000, color: "#10b981", description: "Creative Services" },
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
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  inactive: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
  prospect: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  churned: "bg-red-500/20 text-red-400 border-red-500/30",
  on_hold: "bg-amber-500/20 text-amber-400 border-amber-500/30",
}

export const TASK_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-neutral-500/20 text-neutral-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  blocked: "bg-red-500/20 text-red-400",
  deferred: "bg-amber-500/20 text-amber-400",
}

// Brand options
export const BRANDS: Brand[] = ["434 Media", "Vemos Vamos", "DEVSA TV", "Digital Canvas", "TXMX Boxing"]

// Team members for tagging
export const TEAM_MEMBERS = [
  { name: "Jake", email: "jake@434media.com" },
  { name: "Marc", email: "marc@434media.com" },
  { name: "Stacy", email: "stacy@434media.com" },
  { name: "Jesse", email: "jesse@434media.com" },
  { name: "Barb", email: "barb@434media.com" },
]

// Helper function to check due date status
export function getDueDateStatus(dueDate: string | undefined, status: string): "overdue" | "approaching" | "normal" | null {
  if (!dueDate || status === "completed") return null
  
  const now = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return "overdue"
  if (diffDays <= 3) return "approaching"
  return "normal"
}

// Helper to format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Helper to format date
export function formatDate(date: string): string {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

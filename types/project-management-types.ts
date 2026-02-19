// Project Management Types
// Based on 434 Media Project Management Airtable Base (appYlReVbar7qmCRe)

// ============================================
// Event Link Type
// ============================================
export interface EventLink {
  label: string
  url: string
}

// ============================================
// Event Client Contact Type
// ============================================
export interface EventClientContact {
  name: string
  email?: string
  phone?: string
  company?: string
  title?: string
  notes?: string
}

// ============================================
// PM Events Table Types
// ============================================
export interface PMEvent {
  id: string
  airtable_id?: string
  name: string
  date: string
  start_date?: string
  end_date?: string
  start_time?: string
  end_time?: string
  location?: string
  venue_name?: string
  venue_location?: string
  venue_address?: string
  venue_map_link?: string
  description?: string
  agenda_overview?: string
  status: 'planning' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled'
  budget?: number
  actual_cost?: number
  actual_expenses?: number
  estimated_expenses?: number
  on_budget?: string
  days_to_go?: string
  month?: string
  photo_banner?: string
  img_ai?: string
  website_url?: string
  notes?: string
  links?: EventLink[]
  client_contacts?: EventClientContact[]
  vendor_ids?: string[]
  speaker_ids?: string[]
  created_at?: string
  updated_at?: string
}

// ============================================
// Vendors Table Types
// ============================================
export interface Vendor {
  id: string
  airtable_id?: string
  name: string
  company?: string
  email?: string
  phone?: string
  category: string
  specialty?: string
  website?: string
  link_url?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  photo?: string
  social_media?: string
  research?: string
  rate?: number
  rate_type?: 'hourly' | 'daily' | 'project' | 'flat'
  contract_status?: 'active' | 'inactive' | 'pending' | 'expired'
  notes?: string
  rating?: number
  event_ids?: string[]
  attachments?: VendorAttachment[]
  created_at?: string
  updated_at?: string
}

export interface VendorAttachment {
  url: string
  filename?: string
  type?: string
}

// ============================================
// Speakers Table Types
// ============================================
export interface Speaker {
  id: string
  airtable_id?: string
  name: string
  title?: string
  company?: string
  bio?: string
  introduction?: string
  email?: string
  phone?: string
  website?: string
  linkedin?: string
  linkedin_url?: string
  linkedin_summary?: string
  twitter?: string
  instagram?: string
  headshot?: string
  photo?: string
  topics?: string[]
  session_topics?: string[]
  session_topic_ids?: string[]
  speaking_fee?: number
  travel_requirements?: string
  availability?: string
  notes?: string
  event_ids?: string[]
  created_at?: string
  updated_at?: string
}

// ============================================
// SOP Types
// ============================================
export interface SOP {
  id: string
  airtable_id?: string
  title: string
  category: string
  department?: string
  description?: string
  content: string // Rich text/markdown content
  version?: string
  status: 'draft' | 'active' | 'archived' | 'under-review'
  owner?: string
  reviewers?: string[]
  last_reviewed?: string
  next_review?: string
  related_sops?: string[]
  attachments?: SOPAttachment[]
  tags?: string[]
  created_at?: string
  updated_at?: string
}

export interface SOPAttachment {
  url: string
  filename?: string
  type?: string
}

// ============================================
// UI State Types
// ============================================
export type PMViewMode = 'events' | 'vendors' | 'speakers'
export type SOPViewMode = 'list' | 'detail' | 'edit' | 'create'

export interface PMFilters {
  search: string
  status?: string
  category?: string
  dateRange?: {
    start: string
    end: string
  }
}

export interface SOPFilters {
  search: string
  category?: string
  status?: string
  department?: string
}

// ============================================
// API Response Types
// ============================================
export interface PMEventsResponse {
  events: PMEvent[]
  total: number
}

export interface VendorsResponse {
  vendors: Vendor[]
  total: number
}

export interface SpeakersResponse {
  speakers: Speaker[]
  total: number
}

export interface SOPsResponse {
  sops: SOP[]
  total: number
}

// ============================================
// Airtable to Firestore Mapping
// ============================================
export const PM_AIRTABLE_TO_FIRESTORE_MAP: Record<string, string> = {
  'Events': 'pm_events',
  'Vendors': 'pm_vendors',
  'Speakers': 'pm_speakers',
  'SOPs': 'pm_sops',
} as const

// Categories for vendors
export const VENDOR_CATEGORIES = [
  'Catering',
  'Audio/Visual',
  'Photography',
  'Videography',
  'Venue',
  'Entertainment',
  'Decor',
  'Transportation',
  'Security',
  'Marketing',
  'Print',
  'Staffing',
  'Equipment Rental',
  'Florist',
  'Other',
] as const

// Categories for SOPs
export const SOP_CATEGORIES = [
  'Event Planning',
  'Vendor Management',
  'Client Relations',
  'Marketing',
  'Operations',
  'Finance',
  'HR',
  'Safety',
  'Quality Control',
  'IT',
  'Other',
] as const

// Event statuses
export const PM_EVENT_STATUSES = [
  'planning',
  'confirmed',
  'in-progress',
  'completed',
  'cancelled',
] as const

// SOP statuses
export const SOP_STATUSES = [
  'draft',
  'active',
  'archived',
  'under-review',
] as const

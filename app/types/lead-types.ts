export type LeadStatus = "new" | "contacted" | "qualified" | "closed"

export interface Lead {
  id: string
  company_name: string
  website_url?: string
  industry?: string
  location?: string
  contact_name?: string
  contact_title?: string
  email?: string
  phone?: string
  status: LeadStatus
  notes?: string
  source_url?: string
  created_at?: string
  updated_at?: string
}

export interface Contact {
  id: string
  lead_id: string
  name: string
  title?: string
  email?: string
  phone?: string
  linkedin_url?: string
  twitter_url?: string
  created_at?: string
}

export interface LeadSearchParams {
  search?: string
  status?: LeadStatus | "all"
  limit?: number
  offset?: number
}

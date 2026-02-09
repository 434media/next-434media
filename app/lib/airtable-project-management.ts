import Airtable from "airtable"
import type { PMEvent, Vendor, Speaker, SOP } from "../types/project-management-types"

// Initialize Airtable base for Project Management
const airtablePMBaseId = process.env.AIRTABLE_PM_BASE_ID || "appYlReVbar7qmCRe"
const airtablePMApiKey = process.env.AIRTABLE_PM_API_KEY || process.env.AIRTABLE_EVENTS_API_KEY

if (!airtablePMApiKey) {
  console.warn("Airtable PM API key not found. Set AIRTABLE_PM_API_KEY or AIRTABLE_EVENTS_API_KEY")
}

let pmBase: Airtable.Base | null = null

function getPMBase(): Airtable.Base {
  if (!pmBase && airtablePMApiKey) {
    pmBase = new Airtable({ apiKey: airtablePMApiKey }).base(airtablePMBaseId)
  }
  if (!pmBase) {
    throw new Error("Airtable PM base not initialized. Check API key configuration.")
  }
  return pmBase
}

// Table names in Airtable - configurable via env vars
// Common variations: "Events", "434 Events", "PM Events", etc.
export const AIRTABLE_PM_TABLES = {
  EVENTS: process.env.AIRTABLE_PM_EVENTS_TABLE || "Events",
  VENDORS: process.env.AIRTABLE_PM_VENDORS_TABLE || "Vendors",
  SPEAKERS: process.env.AIRTABLE_PM_SPEAKERS_TABLE || "Speakers",
  SOPS: process.env.AIRTABLE_PM_SOPS_TABLE || "SOPs",
} as const

// ============================================
// Helper Functions
// ============================================

// Extract URL from Airtable button field
// Button fields return objects like {"label":"Website","url":"https://..."}
function extractButtonUrl(field: any): string | undefined {
  if (!field) return undefined
  if (typeof field === "string") return field || undefined
  if (typeof field === "object" && field.url) return field.url || undefined
  return undefined
}

// Extract URL from Airtable attachment field
function extractAttachmentUrl(field: any): string | undefined {
  if (!field) return undefined
  if (typeof field === "string") return field
  if (Array.isArray(field) && field.length > 0) {
    const att = field[0]
    return att.url || att.thumbnails?.large?.url || att.thumbnails?.small?.url
  }
  return undefined
}

// Extract AI field value (some fields are AI-generated with a {state, value} structure)
function extractAIFieldValue(field: any): string | undefined {
  if (!field) return undefined
  if (typeof field === "string") return field || undefined
  if (typeof field === "object" && field !== null) {
    if (field.error || field.state === "error") return undefined
    if (field.state === "empty") return undefined
    if (field.value !== undefined && field.value !== null) return String(field.value)
  }
  return undefined
}

// ============================================
// Events Functions
// ============================================

function mapAirtableToPMEvent(record: Airtable.Record<Airtable.FieldSet>): PMEvent {
  const fields = record.fields

  // Extract photo/banner URL from attachment field
  const photoBanner = extractAttachmentUrl(fields["Photo/Banner"])
  const imgAi = extractAttachmentUrl(fields["IMG AI"])
  
  // Extract website URL from button field
  const websiteUrl = extractButtonUrl(fields["Website"])
  
  // Parse dates
  const startDate = (fields["Event Start Date"] as string) || ""
  const endDate = (fields["Event End Date"] as string) || ""
  
  // Determine status from Days to Go or date
  const daysToGo = (fields["Days to Go"] as string) || ""
  const isCompleted = daysToGo.toLowerCase().includes("completed") || daysToGo.toLowerCase().includes("past")
  
  let status: PMEvent["status"] = "planning"
  if (fields.Status) {
    status = normalizeEventStatus(fields.Status as string)
  } else if (isCompleted) {
    status = "completed"
  } else if (startDate) {
    const today = new Date().toISOString().split("T")[0]
    if (startDate < today) {
      status = "completed"
    } else {
      status = "confirmed"
    }
  }

  return {
    id: record.id,
    airtable_id: record.id,
    name: (fields["Event Name"] as string) || (fields.Name as string) || (fields.Title as string) || "",
    date: startDate,
    start_date: startDate,
    end_date: endDate,
    start_time: (fields["Start Time"] as string) || undefined,
    end_time: (fields["End Time"] as string) || undefined,
    location: (fields["Venue Location"] as string) || (fields.Location as string) || undefined,
    venue_name: (fields["Venue Name"] as string) || undefined,
    venue_location: (fields["Venue Location"] as string) || undefined,
    venue_address: (fields["Venue Address"] as string) || undefined,
    venue_map_link: (fields["Venue Map Link"] as string) || extractButtonUrl(fields["Location Map Link (B)"]) || undefined,
    description: (fields.Description as string) || undefined,
    agenda_overview: (fields["Agenda Overview"] as string) || undefined,
    status,
    budget: fields.Budget ? parseFloat(fields.Budget as string) : undefined,
    actual_cost: fields["Actual Cost"] ? parseFloat(fields["Actual Cost"] as string) : undefined,
    actual_expenses: fields["Actual Expenses"] ? Number(fields["Actual Expenses"]) : undefined,
    estimated_expenses: fields["Estimated Expenses"] ? Number(fields["Estimated Expenses"]) : undefined,
    on_budget: (fields["On Budget?"] as string) || undefined,
    days_to_go: daysToGo || undefined,
    month: (fields.Month as string) || undefined,
    photo_banner: photoBanner || undefined,
    img_ai: imgAi || undefined,
    website_url: websiteUrl || undefined,
    notes: (fields.Notes as string) || undefined,
    vendor_ids: (fields.Vendors as string[]) || undefined,
    speaker_ids: (fields.Speakers as string[]) || undefined,
    created_at: record._rawJson?.createdTime,
    updated_at: (fields["Last Modified"] as string) || record._rawJson?.createdTime,
  }
}

function normalizeEventStatus(status: string | undefined): PMEvent["status"] {
  if (!status) return "planning"
  const normalized = status.toLowerCase().replace(/[^a-z]/g, "")
  switch (normalized) {
    case "planning":
      return "planning"
    case "confirmed":
      return "confirmed"
    case "inprogress":
    case "inprogress":
      return "in-progress"
    case "completed":
    case "done":
      return "completed"
    case "cancelled":
    case "canceled":
      return "cancelled"
    default:
      return "planning"
  }
}

export async function getPMEventsFromAirtable(): Promise<PMEvent[]> {
  try {
    const base = getPMBase()
    console.log(`Fetching PM events from table: "${AIRTABLE_PM_TABLES.EVENTS}" in base: ${airtablePMBaseId}`)
    const records = await base(AIRTABLE_PM_TABLES.EVENTS)
      .select({
        // Don't specify sort - field names may vary
      })
      .all()

    console.log(`Successfully fetched ${records.length} PM events from Airtable`)
    return records.map(mapAirtableToPMEvent)
  } catch (error: any) {
    console.error("Error fetching PM events from Airtable:", error?.message || error)
    if (error?.statusCode === 404 || error?.error === "NOT_FOUND") {
      console.error(`Table "${AIRTABLE_PM_TABLES.EVENTS}" not found. Check your Airtable base and set AIRTABLE_PM_EVENTS_TABLE if needed.`)
    }
    throw new Error(`Failed to fetch PM events from Airtable: ${error?.message || "Unknown error"}`)
  }
}

export async function getPMEventByIdFromAirtable(id: string): Promise<PMEvent | null> {
  try {
    const base = getPMBase()
    const record = await base(AIRTABLE_PM_TABLES.EVENTS).find(id)
    return mapAirtableToPMEvent(record)
  } catch (error) {
    console.error("Error fetching PM event by ID from Airtable:", error)
    return null
  }
}

// ============================================
// Vendors Functions
// ============================================

function mapAirtableToVendor(record: Airtable.Record<Airtable.FieldSet>): Vendor {
  const fields = record.fields

  // Handle photo attachment
  const photo = extractAttachmentUrl(fields.Photo)
  
  // Handle link/button field
  const linkUrl = extractButtonUrl(fields.Link)

  // Handle attachments
  let attachments: Vendor["attachments"] = undefined
  if (Array.isArray(fields.Attachments) && fields.Attachments.length > 0) {
    attachments = (fields.Attachments as any[]).map((att) => ({
      url: att.url,
      filename: att.filename,
      type: att.type,
    }))
  }

  // Parse address into parts if it's a full address string
  const fullAddress = (fields.Address as string) || ""
  
  return {
    id: record.id,
    airtable_id: record.id,
    name: (fields["Company Name"] as string) || (fields.Name as string) || "",
    company: (fields["Company Name"] as string) || (fields.Company as string) || undefined,
    email: (fields["Primary Email"] as string) || (fields.Email as string) || undefined,
    phone: (fields["Primary Phone"] as string) || (fields.Phone as string) || undefined,
    category: (fields["Service Category"] as string) || (fields.Category as string) || "Other",
    specialty: (fields.Specialty as string) || undefined,
    website: (fields["Company Website"] as string) || (fields.Website as string) || undefined,
    link_url: linkUrl || undefined,
    address: fullAddress || undefined,
    city: (fields.City as string) || undefined,
    state: (fields.State as string) || undefined,
    zip: (fields.Zip as string) || (fields.ZIP as string) || undefined,
    photo: photo || undefined,
    social_media: (fields["Company Social Media"] as string) || undefined,
    research: extractAIFieldValue(fields.Research) || undefined,
    rate: fields.Rate ? parseFloat(fields.Rate as string) : undefined,
    rate_type: normalizeRateType(fields["Rate Type"] as string),
    contract_status: normalizeContractStatus(fields["Contract Status"] as string),
    notes: (fields.Notes as string) || undefined,
    rating: fields.Rating ? parseFloat(fields.Rating as string) : undefined,
    event_ids: (fields.Events as string[]) || undefined,
    attachments,
    created_at: record._rawJson?.createdTime,
    updated_at: (fields["Last Modified"] as string) || record._rawJson?.createdTime,
  }
}

function normalizeRateType(rateType: string | undefined): Vendor["rate_type"] {
  if (!rateType) return undefined
  const normalized = rateType.toLowerCase()
  if (normalized.includes("hour")) return "hourly"
  if (normalized.includes("day")) return "daily"
  if (normalized.includes("project")) return "project"
  if (normalized.includes("flat")) return "flat"
  return "hourly"
}

function normalizeContractStatus(status: string | undefined): Vendor["contract_status"] {
  if (!status) return undefined
  const normalized = status.toLowerCase()
  if (normalized.includes("active")) return "active"
  if (normalized.includes("inactive")) return "inactive"
  if (normalized.includes("pending")) return "pending"
  if (normalized.includes("expired")) return "expired"
  return "active"
}

export async function getVendorsFromAirtable(): Promise<Vendor[]> {
  try {
    const base = getPMBase()
    console.log(`Fetching vendors from table: "${AIRTABLE_PM_TABLES.VENDORS}" in base: ${airtablePMBaseId}`)
    const records = await base(AIRTABLE_PM_TABLES.VENDORS)
      .select({
        // Don't specify sort - field names may vary
      })
      .all()

    console.log(`Successfully fetched ${records.length} vendors from Airtable`)
    return records.map(mapAirtableToVendor)
  } catch (error: any) {
    console.error("Error fetching vendors from Airtable:", error?.message || error)
    if (error?.statusCode === 404 || error?.error === "NOT_FOUND") {
      console.error(`Table "${AIRTABLE_PM_TABLES.VENDORS}" not found. Check your Airtable base and set AIRTABLE_PM_VENDORS_TABLE if needed.`)
    }
    throw new Error(`Failed to fetch vendors from Airtable: ${error?.message || "Unknown error"}`)
  }
}

export async function getVendorByIdFromAirtable(id: string): Promise<Vendor | null> {
  try {
    const base = getPMBase()
    const record = await base(AIRTABLE_PM_TABLES.VENDORS).find(id)
    return mapAirtableToVendor(record)
  } catch (error) {
    console.error("Error fetching vendor by ID from Airtable:", error)
    return null
  }
}

// ============================================
// Speakers Functions
// ============================================

function mapAirtableToSpeaker(record: Airtable.Record<Airtable.FieldSet>): Speaker {
  const fields = record.fields

  // Handle photo/headshot attachment
  const photo = extractAttachmentUrl(fields.Photo) || extractAttachmentUrl(fields.Headshot)
  
  // Handle LinkedIn button field
  const linkedinUrl = extractButtonUrl(fields["Open URL Button"]) || (fields.LinkedIn as string)

  // Handle topics - can be array of strings (from linked records) or comma-separated
  let topics: string[] | undefined = undefined
  if (fields["Past & Current Session Topics"]) {
    if (Array.isArray(fields["Past & Current Session Topics"])) {
      topics = fields["Past & Current Session Topics"] as string[]
    } else if (typeof fields["Past & Current Session Topics"] === "string") {
      topics = (fields["Past & Current Session Topics"] as string).split(",").map((t: string) => t.trim())
    }
  } else if (fields.Topics) {
    if (typeof fields.Topics === "string") {
      topics = (fields.Topics as string).split(",").map((t: string) => t.trim())
    } else if (Array.isArray(fields.Topics)) {
      topics = fields.Topics as string[]
    }
  }

  // Handle linked session topic IDs
  const sessionTopicIds = Array.isArray(fields["Session Topic"]) ? (fields["Session Topic"] as string[]) : undefined

  // Extract AI field values for bio and introduction
  const bio = extractAIFieldValue(fields.Bio) || (typeof fields.Bio === "string" ? fields.Bio : undefined)
  const introduction = extractAIFieldValue(fields.Introduction) || (typeof fields.Introduction === "string" ? fields.Introduction : undefined)
  const linkedinSummary = extractAIFieldValue(fields["LinkedIn Summary"]) || (typeof fields["LinkedIn Summary"] === "string" ? fields["LinkedIn Summary"] : undefined)

  return {
    id: record.id,
    airtable_id: record.id,
    name: (fields["Speaker Name"] as string) || (fields.Name as string) || "",
    title: (fields["Role / Title"] as string) || (fields.Title as string) || undefined,
    company: (fields.Company as string) || (fields.Organization as string) || undefined,
    bio: bio || undefined,
    introduction: introduction || undefined,
    email: (fields.Email as string) || undefined,
    phone: (fields.Phone as string) || undefined,
    website: (fields.Website as string) || undefined,
    linkedin: (fields.LinkedIn as string) || undefined,
    linkedin_url: linkedinUrl || undefined,
    linkedin_summary: linkedinSummary || undefined,
    twitter: (fields.Twitter as string) || (fields.X as string) || undefined,
    instagram: (fields.Instagram as string) || undefined,
    headshot: photo || undefined,
    photo: photo || undefined,
    topics,
    session_topics: topics,
    session_topic_ids: sessionTopicIds || undefined,
    speaking_fee: fields["Speaking Fee"] ? parseFloat(fields["Speaking Fee"] as string) : undefined,
    travel_requirements: (fields["Travel Requirements"] as string) || undefined,
    availability: (fields.Availability as string) || undefined,
    notes: (fields.Notes as string) || undefined,
    event_ids: (fields.Events as string[]) || undefined,
    created_at: (fields.Created as string) || record._rawJson?.createdTime,
    updated_at: (fields["Last Modified"] as string) || record._rawJson?.createdTime,
  }
}

export async function getSpeakersFromAirtable(): Promise<Speaker[]> {
  try {
    const base = getPMBase()
    console.log(`Fetching speakers from table: "${AIRTABLE_PM_TABLES.SPEAKERS}" in base: ${airtablePMBaseId}`)
    const records = await base(AIRTABLE_PM_TABLES.SPEAKERS)
      .select({
        // Don't specify sort - field names may vary
      })
      .all()

    console.log(`Successfully fetched ${records.length} speakers from Airtable`)
    return records.map(mapAirtableToSpeaker)
  } catch (error: any) {
    console.error("Error fetching speakers from Airtable:", error?.message || error)
    if (error?.statusCode === 404 || error?.error === "NOT_FOUND") {
      console.error(`Table "${AIRTABLE_PM_TABLES.SPEAKERS}" not found. Check your Airtable base and set AIRTABLE_PM_SPEAKERS_TABLE if needed.`)
    }
    throw new Error(`Failed to fetch speakers from Airtable: ${error?.message || "Unknown error"}`)
  }
}

export async function getSpeakerByIdFromAirtable(id: string): Promise<Speaker | null> {
  try {
    const base = getPMBase()
    const record = await base(AIRTABLE_PM_TABLES.SPEAKERS).find(id)
    return mapAirtableToSpeaker(record)
  } catch (error) {
    console.error("Error fetching speaker by ID from Airtable:", error)
    return null
  }
}

// ============================================
// SOPs Functions
// ============================================

function mapAirtableToSOP(record: Airtable.Record<Airtable.FieldSet>): SOP {
  const fields = record.fields

  // Handle attachments
  let attachments: SOP["attachments"] = undefined
  if (Array.isArray(fields.Attachments) && fields.Attachments.length > 0) {
    attachments = (fields.Attachments as any[]).map((att) => ({
      url: att.url,
      filename: att.filename,
      type: att.type,
    }))
  }

  // Handle tags
  let tags: string[] | undefined = undefined
  if (fields.Tags) {
    if (typeof fields.Tags === "string") {
      tags = fields.Tags.split(",").map((t: string) => t.trim())
    } else if (Array.isArray(fields.Tags)) {
      tags = fields.Tags as string[]
    }
  }

  // Handle reviewers
  let reviewers: string[] | undefined = undefined
  if (fields.Reviewers) {
    if (typeof fields.Reviewers === "string") {
      reviewers = fields.Reviewers.split(",").map((r: string) => r.trim())
    } else if (Array.isArray(fields.Reviewers)) {
      reviewers = fields.Reviewers as string[]
    }
  }

  return {
    id: record.id,
    airtable_id: record.id,
    title: (fields.Title as string) || (fields.Name as string) || "",
    category: (fields.Category as string) || "Other",
    department: (fields.Department as string) || undefined,
    description: (fields.Description as string) || undefined,
    content: (fields.Content as string) || (fields.Procedure as string) || "",
    version: (fields.Version as string) || "1.0",
    status: normalizeSOPStatus(fields.Status as string),
    owner: (fields.Owner as string) || undefined,
    reviewers,
    last_reviewed: (fields["Last Reviewed"] as string) || undefined,
    next_review: (fields["Next Review"] as string) || undefined,
    related_sops: (fields["Related SOPs"] as string[]) || undefined,
    attachments,
    tags,
    created_at: record._rawJson?.createdTime,
    updated_at: (fields["Last Modified"] as string) || record._rawJson?.createdTime,
  }
}

function normalizeSOPStatus(status: string | undefined): SOP["status"] {
  if (!status) return "draft"
  const normalized = status.toLowerCase().replace(/[^a-z]/g, "")
  switch (normalized) {
    case "draft":
      return "draft"
    case "active":
    case "published":
    case "approved":
      return "active"
    case "archived":
      return "archived"
    case "underreview":
    case "review":
    case "pending":
      return "under-review"
    default:
      return "draft"
  }
}

export async function getSOPsFromAirtable(): Promise<SOP[]> {
  try {
    const base = getPMBase()
    console.log(`Fetching SOPs from table: "${AIRTABLE_PM_TABLES.SOPS}" in base: ${airtablePMBaseId}`)
    const records = await base(AIRTABLE_PM_TABLES.SOPS)
      .select({
        // Don't specify sort - field names may vary
      })
      .all()

    console.log(`Successfully fetched ${records.length} SOPs from Airtable`)
    return records.map(mapAirtableToSOP)
  } catch (error: any) {
    console.error("Error fetching SOPs from Airtable:", error?.message || error)
    if (error?.statusCode === 404 || error?.error === "NOT_FOUND") {
      console.error(`Table "${AIRTABLE_PM_TABLES.SOPS}" not found. Check your Airtable base and set AIRTABLE_PM_SOPS_TABLE if needed.`)
    }
    throw new Error(`Failed to fetch SOPs from Airtable: ${error?.message || "Unknown error"}`)
  }
}

export async function getSOPByIdFromAirtable(id: string): Promise<SOP | null> {
  try {
    const base = getPMBase()
    const record = await base(AIRTABLE_PM_TABLES.SOPS).find(id)
    return mapAirtableToSOP(record)
  } catch (error) {
    console.error("Error fetching SOP by ID from Airtable:", error)
    return null
  }
}

// ============================================
// Generic Functions
// ============================================

export async function getAllPMDataFromAirtable(): Promise<{
  events: PMEvent[]
  vendors: Vendor[]
  speakers: Speaker[]
  sops: SOP[]
}> {
  // Fetch each table individually and catch errors for missing tables
  // This allows partial sync even if some tables don't exist
  const results = await Promise.allSettled([
    getPMEventsFromAirtable(),
    getVendorsFromAirtable(),
    getSpeakersFromAirtable(),
    getSOPsFromAirtable(),
  ])

  const events = results[0].status === "fulfilled" ? results[0].value : []
  const vendors = results[1].status === "fulfilled" ? results[1].value : []
  const speakers = results[2].status === "fulfilled" ? results[2].value : []
  const sops = results[3].status === "fulfilled" ? results[3].value : []

  // Log which tables failed
  if (results[0].status === "rejected") console.warn("Events table sync failed:", results[0].reason)
  if (results[1].status === "rejected") console.warn("Vendors table sync failed:", results[1].reason)
  if (results[2].status === "rejected") console.warn("Speakers table sync failed:", results[2].reason)
  if (results[3].status === "rejected") console.warn("SOPs table sync failed:", results[3].reason)

  console.log(`Synced from Airtable: ${events.length} events, ${vendors.length} vendors, ${speakers.length} speakers, ${sops.length} SOPs`)

  return { events, vendors, speakers, sops }
}

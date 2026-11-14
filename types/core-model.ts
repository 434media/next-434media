// The core data model, V1 item 4's first step (434-context `04 Build/434_Core_Data_Model_Spec.md`, approved
// 2026-11-13): Person, Organization, the Affiliation link and Activity, with the inbox as a view of untriaged
// activities. Old collections (`leads`, `crm_clients`, `contact_forms`, AIM `contact_submissions`) are read in
// at read time by lib/core-model/adapters.ts and never written; their identifiers and stored values stay as
// they are.

import type { IcpFitBreakdown, IcpGrade, LeadSource } from "./crm-types"

/** Contact → lead → customer. Lead is a stage, not a record. */
export type LifecycleStage = "contact" | "lead" | "customer"
export const LIFECYCLE_STAGES: LifecycleStage[] = ["contact", "lead", "customer"]

/** Roles replace separate tables (spec, "The link"). */
export type CoreRole = "client" | "vendor" | "contractor" | "partner" | "prospect" | "speaker" | "staff"
export const CORE_ROLES: CoreRole[] = ["client", "vendor", "contractor", "partner", "prospect", "speaker", "staff"]

/**
 * Where a record first came from. The lead sources keep their stored values, so the cold-outreach gate in
 * lib/prospecting/scorer.ts (keyed on `source`, `COLD_LEAD_SOURCES`) reads a Person exactly as it reads a lead.
 */
export type CoreSource = LeadSource | "google_contacts"
export const CORE_SOURCES: CoreSource[] = [
  "event",
  "web",
  "manual",
  "newsletter",
  "referral",
  "partner",
  "social",
  "prospected",
  "google_contacts",
]

/**
 * Who may see a record. `business` (the default) is any admin; `restricted` is full admins only; `private` is the
 * founder only (`ADMIN_FOUNDER_EMAIL`, lib/founder-guard.ts), the tier his personal contacts carry (spec, "Personal
 * or business"; interface contract 1.5 §2).
 */
export type Visibility = "business" | "restricted" | "private"
export const VISIBILITIES: Visibility[] = ["business", "restricted", "private"]

/** Whether a Person is a business contact or one of the founder's personal contacts. Personal is always `private`. */
export type Relationship = "business" | "personal"
export const RELATIONSHIPS: Relationship[] = ["business", "personal"]

/** A date as Google holds it: any part may be missing (a birthday with no year). */
export interface AddressBookDate {
  year?: number
  month?: number
  day?: number
}

/**
 * The whole Google Contacts record, under Google's own meanings, so nothing is lost or renamed (spec, "What comes
 * over"). Company and job title are not stored here: they become an Affiliation to an Organization. The CRM's own
 * fields (stage, roles, relationship, visibility, consent) sit on the Person beside it.
 */
export interface AddressBook {
  name: { given?: string; family?: string; middle?: string; prefix?: string; suffix?: string }
  nicknames: string[]
  /** Emails and phones stay lists, as in Google, with Google's type ("home", "work", a custom label). */
  emails: Array<{ value: string; type?: string }>
  phones: Array<{ value: string; type?: string }>
  addresses: Array<{
    formatted?: string
    street?: string
    extended?: string
    po_box?: string
    city?: string
    region?: string
    postal_code?: string
    country?: string
    country_code?: string
    type?: string
  }>
  birthday?: AddressBookDate & { text?: string }
  events: Array<{ date: AddressBookDate; type?: string }>
  urls: Array<{ value: string; type?: string }>
  relations: Array<{ person: string; type?: string }>
  custom_fields: Array<{ key: string; value: string }>
  /** Google's "Notes" (biographies). */
  notes?: string
  /** Contact group names, read from Google; the "Business" label decides `relationship` on arrival. */
  labels: string[]
  /** Read only: Google's photo URL. Never written back. */
  photo_url?: string
  /** Company and title as Google holds them; the Affiliation is built from these. */
  organizations: Array<{ name?: string; title?: string; department?: string }>
}

/** The address-book fields the CRM may write back to Google. Labels and the photo are read only. */
export const ADDRESS_BOOK_WRITABLE = [
  "name",
  "nicknames",
  "emails",
  "phones",
  "addresses",
  "birthday",
  "events",
  "urls",
  "relations",
  "custom_fields",
  "notes",
  "organizations",
] as const
export type AddressBookField = (typeof ADDRESS_BOOK_WRITABLE)[number]

/** The link to the founder's Google contact. */
export interface GoogleLink {
  /** People API `resourceName`, e.g. "people/c123". */
  resource_name: string
  /** The etag of the copy last read or written. Every write sends it; Google refuses a stale one. */
  etag: string
  /** The contact's CONTACT source (id and etag), which an update must name. */
  contact_source?: { id: string; etag: string }
  /** Google's own update time for the contact, from the last read. */
  update_time?: string
  /** The address book as Google last held it: the base for telling who changed what (latest edit wins). */
  snapshot: AddressBook
  /** In the "434" contact group, which marks the contacts the CRM owns and is the only place it writes. */
  in_434_group: boolean
  synced_at: string
  /** Set when the contact was deleted in Google. The Person is never deleted for it. */
  deleted_at?: string
}

export type ConsentStatus = "granted" | "none" | "withdrawn"

/** Why a channel's consent is what it is. */
export type ConsentBasis =
  | "requested_contact" // wrote to us through a form and asked to hear back
  | "subscribed" // signed up for a newsletter
  | "registered" // registered for an event
  | "none" // no consent given (prospected, partner list, address book, hand-entered)
  | "withdrawn" // unsubscribed or asked us to stop

export interface ChannelConsent {
  status: ConsentStatus
  basis: ConsentBasis
  /** The source the consent came from. */
  source: CoreSource
  /** ISO time it was granted or withdrawn; empty for `none`. */
  at: string
}

/** Consent lives on the Person, per channel (spec rule 2). Suppression is read from `email_suppression`. */
export interface PersonConsent {
  email: ChannelConsent
}

/** A pointer to the old record a core record was read from. */
export interface LegacyRef {
  /** e.g. "leads", "crm_clients", "contact_forms", "aimsatx/contact_submissions" */
  collection: string
  id: string
}

export interface Person {
  id: string
  name: string
  /** Normalized (trimmed, lower-case). The first is the primary. One Person per email. */
  emails: string[]
  phones: string[]
  title?: string
  lifecycle_stage: LifecycleStage
  roles: CoreRole[]
  consent: PersonConsent
  /** Source of first touch. */
  source: CoreSource
  /** ISO 3166-1 alpha-2 where known (a cold-gate input). */
  country?: string
  /** Free text, e.g. "San Antonio, TX" (a cold-gate input). */
  location?: string
  visibility: Visibility
  /** `personal` is the founder's own contact and is always `private`. Missing reads as `business`. */
  relationship: Relationship
  notes?: string
  added_by?: string
  /** The full Google Contacts record, for a Person synced with the founder's address book. */
  address_book?: AddressBook
  /** When a person last edited an address-book field in the CRM (latest edit wins against Google's time). */
  address_book_edited_at?: string
  google?: GoogleLink
  legacy_refs: LegacyRef[]
  /** Set when an explicit merge absorbed this Person into another. The record is kept, never deleted. */
  merged_into?: string
  /** True when this Person is read from an old collection and has no stored record yet. */
  read_only?: boolean
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  /** Website domain, lower-case, no `www.`. Organizations are matched on it. */
  domain?: string
  roles: CoreRole[]
  industry?: string
  location?: string
  employee_count?: number
  annual_revenue?: number
  // Fit is scored here, because the rubric scores the company (lib/icp/rubric.ts).
  icp_fit_score?: number
  icp_grade?: IcpGrade
  icp_breakdown?: IcpFitBreakdown
  icp_review?: string | null
  scored_at?: string
  /** Vendor role: what they do and what they charge, free text for now. */
  capabilities?: string
  rates?: string
  visibility: Visibility
  legacy_refs: LegacyRef[]
  merged_into?: string
  read_only?: boolean
  created_at: string
  updated_at: string
}

/**
 * The role on an Affiliation: one of 434's relationship roles, or `works_at` when the link only records where the
 * person works (a company and title from the address book), with no relationship to 434 implied.
 */
export type AffiliationRole = CoreRole | "works_at"
export const AFFILIATION_ROLES: AffiliationRole[] = [...CORE_ROLES, "works_at"]

/** Person ⟷ Organization with a role. The role lives on the link, not the person. */
export interface Affiliation {
  id: string
  person_id: string
  organization_id: string
  role: AffiliationRole
  title?: string
  active: boolean
  read_only?: boolean
  created_at: string
  updated_at: string
}

export type ActivityType =
  | "form_submission"
  | "prospect_found"
  | "email"
  | "meeting"
  | "note"
  | "google_contact"
  /** A change to address-book fields, keeping the value that was overwritten (latest edit wins). */
  | "address_book_change"
export const ACTIVITY_TYPES: ActivityType[] = [
  "form_submission",
  "prospect_found",
  "email",
  "meeting",
  "note",
  "google_contact",
  "address_book_change",
]

/** The full envelope of a sent or received email. The CRM keeps the full text (V1 item 4). */
export interface ActivityEmail {
  direction: "sent" | "received"
  from: string
  to: string[]
  cc: string[]
  subject: string
  message_id?: string
}

/** Who the activity is about, as it arrived, before matching. */
export interface ActivityContact {
  name?: string
  email?: string
  phone?: string
  company?: string
  title?: string
  website?: string
  location?: string
  country?: string
}

/**
 * Every touch, written once and never edited. `triaged` is derived: true when a triage record exists for the
 * activity (or, for an old contact form, when it was already handled in the old inbox).
 */
export interface Activity {
  id: string
  type: ActivityType
  source: CoreSource
  /** Which site or channel, e.g. "434Media", "AIM". */
  channel?: string
  occurred_at: string
  contact: ActivityContact
  person_id?: string
  organization_id?: string
  opportunity_id?: string
  job_id?: string
  summary: string
  /** The full text. Never truncated. */
  body?: string
  email?: ActivityEmail
  legacy_ref?: LegacyRef
  created_by?: string
  /**
   * Who may see the activity on its own, before it is linked to a Person (a phone arrival is `private`). An activity
   * linked to a Person is also hidden whenever that Person is. Missing reads as `business`.
   */
  visibility?: Visibility
  /** The relationship an arrival is proposed with: a phone arrival is `personal`, a "Business"-labeled one `business`. */
  relationship?: Relationship
  /** Read time only: the whole Google record of an address-book arrival still waiting in the inbox. Never stored. */
  address_book?: AddressBook
  /** For an address-book change: the values before and after, by field. */
  change?: { field: string; before: unknown; after: unknown; winner: "crm" | "google" }[]
  /** Derived at read time; never stored on the activity. */
  triaged: boolean
  read_only?: boolean
  created_at: string
}

export type TriageDecision = "promote" | "save" | "dismiss"
export const TRIAGE_DECISIONS: TriageDecision[] = ["promote", "save", "dismiss"]

export interface TriageRecord {
  /** The activity id. */
  id: string
  decision: TriageDecision
  by: string
  at: string
  person_id?: string
  lead_id?: string
}

export interface MergeRecord {
  id: string
  kind: "person" | "organization"
  kept_id: string
  absorbed_id: string
  by: string
  at: string
  /** What moved across, e.g. emails. */
  moved: Record<string, unknown>
}

/** One row of the inbox view. */
export interface InboxItem {
  activity: Activity
  person?: Person
  organization?: Organization
}

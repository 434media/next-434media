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

/** Who may see a record. `business` (the default) is any admin; `restricted` is full admins only. */
export type Visibility = "business" | "restricted"
export const VISIBILITIES: Visibility[] = ["business", "restricted"]

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
  notes?: string
  added_by?: string
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

/** Person ⟷ Organization with a role. The role lives on the link, not the person. */
export interface Affiliation {
  id: string
  person_id: string
  organization_id: string
  role: CoreRole
  title?: string
  active: boolean
  read_only?: boolean
  created_at: string
  updated_at: string
}

export type ActivityType = "form_submission" | "prospect_found" | "email" | "meeting" | "note" | "google_contact"
export const ACTIVITY_TYPES: ActivityType[] = ["form_submission", "prospect_found", "email", "meeting", "note", "google_contact"]

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

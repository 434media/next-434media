// Read-time adapters: today's collections surfaced as Persons, Organizations, Affiliations and Activities.
// Nothing is migrated and nothing is written back (spec, "How today's collections map in"). Identifiers and
// stored values are read as they are; the old record's id travels in `legacy_refs` / `legacy_ref`.
//
//   leads                          → Person (lifecycle_stage from status) + Organization + Affiliation + Activity
//   crm_clients                    → Organization (client role) + Persons + Affiliations
//   contact_forms, AIM submissions → Activity (form_submission, full message) + Person + Organization

import type { ClientRecord, Lead } from "@/types/crm-types"
import type { ContactFormSubmission } from "@/lib/firestore-contact-forms"
import type {
  Activity,
  Affiliation,
  CoreRole,
  LifecycleStage,
  Organization,
  Person,
} from "@/types/core-model"
import { consentFromSource } from "./consent"
import { normalizeEmail, organizationDomain, organizationNameKey } from "./identity"
import { summarize } from "./activity"

export interface CoreBundle {
  people: Person[]
  organizations: Organization[]
  affiliations: Affiliation[]
  activities: Activity[]
}

export const emptyBundle = (): CoreBundle => ({ people: [], organizations: [], affiliations: [], activities: [] })

/** Stable id for a read-time Organization: by domain when there is one, else by folded name. */
export function adaptedOrganizationId(domain: string, name: string): string {
  return domain ? `org:domain:${domain}` : `org:name:${organizationNameKey(name)}`
}

function adaptedOrganization(input: {
  name: string
  domain: string
  roles: CoreRole[]
  industry?: string
  location?: string
  employee_count?: number
  annual_revenue?: number
  legacy: { collection: string; id: string }
  at: string
}): Organization | undefined {
  const name = input.name.trim() || input.domain
  if (!name || (!input.domain && !organizationNameKey(name))) return undefined
  return {
    id: adaptedOrganizationId(input.domain, name),
    name,
    domain: input.domain || undefined,
    roles: input.roles,
    industry: input.industry || undefined,
    location: input.location || undefined,
    employee_count: input.employee_count,
    annual_revenue: input.annual_revenue,
    visibility: "business",
    legacy_refs: [input.legacy],
    read_only: true,
    created_at: input.at,
    updated_at: input.at,
  }
}

function affiliation(personId: string, org: Organization, role: CoreRole, at: string, title?: string): Affiliation {
  return {
    id: `aff:${personId}|${org.id}|${role}`,
    person_id: personId,
    organization_id: org.id,
    role,
    title: title || undefined,
    active: true,
    read_only: true,
    created_at: at,
    updated_at: at,
  }
}

// ── leads ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A converted lead is a customer; every other lead status is the lead stage. */
export function stageFromLeadStatus(status: Lead["status"] | undefined): LifecycleStage {
  return status === "converted" ? "customer" : "lead"
}

export function adaptLead(lead: Lead): CoreBundle {
  const out = emptyBundle()
  const at = lead.created_at || lead.updated_at || ""
  const email = normalizeEmail(lead.email)
  const personId = `lead:${lead.id}`
  const role: CoreRole = lead.source === "prospected" ? "prospect" : lead.source === "partner" ? "partner" : "prospect"
  out.people.push({
    id: personId,
    name: lead.name || email,
    emails: email ? [email] : [],
    phones: lead.phone ? [lead.phone] : [],
    title: lead.title || undefined,
    lifecycle_stage: stageFromLeadStatus(lead.status),
    roles: lead.status === "converted" ? ["client"] : [role],
    consent: consentFromSource(lead.source || "manual", at),
    source: lead.source || "manual",
    country: lead.country || undefined,
    location: lead.location || undefined,
    visibility: "business",
    notes: lead.notes || undefined,
    added_by: lead.created_by || undefined,
    legacy_refs: [{ collection: "leads", id: lead.id }],
    read_only: true,
    created_at: at,
    updated_at: lead.updated_at || at,
  })
  const org = adaptedOrganization({
    name: lead.company || "",
    domain: organizationDomain({ email }),
    roles: lead.status === "converted" ? ["client"] : ["prospect"],
    industry: lead.industry,
    location: lead.location,
    employee_count: lead.employee_count,
    annual_revenue: lead.annual_revenue,
    legacy: { collection: "leads", id: lead.id },
    at,
  })
  if (org) {
    out.organizations.push(org)
    out.affiliations.push(affiliation(personId, org, lead.status === "converted" ? "client" : "prospect", at, lead.title))
  }
  // The arrival itself. A lead is already in the pipeline, so it is not an untriaged inbox item.
  out.activities.push({
    id: `leads:${lead.id}`,
    type: lead.source === "prospected" ? "prospect_found" : lead.source === "web" ? "form_submission" : "note",
    source: lead.source || "manual",
    occurred_at: at,
    contact: {
      name: lead.name,
      email: email || undefined,
      phone: lead.phone || undefined,
      company: lead.company || undefined,
      title: lead.title || undefined,
      location: lead.location || undefined,
      country: lead.country || undefined,
    },
    person_id: personId,
    organization_id: org?.id,
    summary: `Lead added (${lead.source || "manual"})${lead.company ? `: ${lead.company}` : ""}`,
    body: lead.notes || undefined,
    legacy_ref: { collection: "leads", id: lead.id },
    created_by: lead.created_by || undefined,
    triaged: true,
    read_only: true,
    created_at: at,
  })
  return out
}

// ── crm_clients ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A client row becomes an Organization with the client role, and each contact on it a Person. Opportunity rows
 * (`is_opportunity`) are Opportunities, which are V1 item 8, and are skipped here.
 */
export function adaptClient(client: ClientRecord): CoreBundle {
  const out = emptyBundle()
  if (client.is_opportunity) return out
  const at = client.created_at || client.updated_at || ""
  const stage: LifecycleStage = client.status === "prospect" ? "lead" : "customer"
  const orgRole: CoreRole = client.status === "prospect" ? "prospect" : "client"
  const name = (client.company_name || client.name || "").trim()
  const contactEmails = [client.email, ...(client.contacts ?? []).map((c) => c.email)]
  const domain = organizationDomain({ website: client.website }) || contactEmails.map((e) => organizationDomain({ email: e })).find(Boolean) || ""
  const org: Organization | undefined = name || domain
    ? {
        id: `client:${client.id}`,
        name: name || domain,
        domain: domain || undefined,
        roles: [orgRole],
        industry: client.industry || undefined,
        location: [client.city, client.state].filter(Boolean).join(", ") || undefined,
        visibility: "business",
        legacy_refs: [{ collection: "crm_clients", id: client.id }],
        read_only: true,
        created_at: at,
        updated_at: client.updated_at || at,
      }
    : undefined
  if (org) out.organizations.push(org)

  const addPerson = (id: string, personName: string, emailRaw: string | undefined, phone: string | undefined, title?: string) => {
    const email = normalizeEmail(emailRaw)
    if (!email && !personName.trim()) return
    out.people.push({
      id,
      name: personName.trim() || email,
      emails: email ? [email] : [],
      phones: phone ? [phone] : [],
      title: title || undefined,
      lifecycle_stage: stage,
      roles: [orgRole],
      consent: consentFromSource("manual", at),
      source: "manual",
      visibility: "business",
      legacy_refs: [{ collection: "crm_clients", id: client.id }],
      read_only: true,
      created_at: at,
      updated_at: client.updated_at || at,
    })
    if (org) out.affiliations.push(affiliation(id, org, orgRole, at, title))
  }

  const contacts = client.contacts ?? []
  for (const c of contacts) {
    const personName = c.name || `${c.first_name ?? ""} ${c.last_name ?? ""}`
    addPerson(`client-contact:${client.id}:${c.id}`, personName, c.email, c.phone, c.role)
  }
  // The row's own email, when no listed contact already holds it.
  const primary = normalizeEmail(client.email)
  if (primary && !contacts.some((c) => normalizeEmail(c.email) === primary)) {
    addPerson(`client:${client.id}:primary`, client.name || "", primary, client.phone, client.title)
  }
  return out
}

// ── contact_forms and AIM contact_submissions ────────────────────────────────────────────────────────────────

/** The submission's own id in its store, and the store it lives in. AIM ids are read as `aimsatx:<id>`. */
export function contactFormLegacyRef(sub: Pick<ContactFormSubmission, "id">): { collection: string; id: string } {
  const id = sub.id ?? ""
  return id.startsWith("aimsatx:")
    ? { collection: "aimsatx/contact_submissions", id: id.slice("aimsatx:".length) }
    : { collection: "contact_forms", id }
}

/** The whole message, with the "Start a production" intake answers kept beneath it. Never truncated. */
export function contactFormBody(sub: ContactFormSubmission): string {
  const intake: Array<[string, string | undefined]> = [
    ["Role", sub.role],
    ["Organization type", sub.organizationType],
    ["Request", sub.requestType],
    ["Timeline", sub.timeline],
    ["Budget", sub.budgetRange],
    ["Heard about us", sub.referralSource],
  ]
  const lines = intake.filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => `${k}: ${v}`)
  return [sub.message?.trim() ?? "", lines.join("\n")].filter(Boolean).join("\n\n")
}

/**
 * `handled` is true when the old inbox already dealt with the submission (a `submission_states` state other
 * than "new", or promoted to a lead). Such a submission is not an untriaged inbox item.
 */
export function adaptContactForm(sub: ContactFormSubmission, handled: boolean): CoreBundle {
  const out = emptyBundle()
  const at = sub.created_at || ""
  const ref = contactFormLegacyRef(sub)
  const email = normalizeEmail(sub.email)
  const name = `${sub.firstName ?? ""} ${sub.lastName ?? ""}`.trim()
  const personId = `form:${sub.id}`
  if (email || name) {
    out.people.push({
      id: personId,
      name: name || email,
      emails: email ? [email] : [],
      phones: sub.phone ? [sub.phone] : [],
      title: sub.role || undefined,
      lifecycle_stage: sub.promotedLeadId ? "lead" : "contact",
      roles: [],
      // A form submitter wrote to us and asked to hear back.
      consent: consentFromSource("web", at),
      source: "web",
      visibility: "business",
      legacy_refs: [ref],
      read_only: true,
      created_at: at,
      updated_at: at,
    })
  }
  const org = adaptedOrganization({
    name: sub.company || "",
    domain: organizationDomain({ email }),
    roles: [],
    legacy: ref,
    at,
  })
  if (org) {
    out.organizations.push(org)
    if (email || name) out.affiliations.push(affiliation(personId, org, "prospect", at, sub.role))
  }
  const body = contactFormBody(sub)
  out.activities.push({
    id: `contact_forms:${sub.id}`,
    type: "form_submission",
    source: "web",
    channel: sub.source || undefined,
    occurred_at: at,
    contact: {
      name: name || undefined,
      email: email || undefined,
      phone: sub.phone || undefined,
      company: sub.company || undefined,
      title: sub.role || undefined,
    },
    person_id: email || name ? personId : undefined,
    organization_id: org?.id,
    summary: summarize(sub.message, `Form submission from ${sub.source || "the website"}`),
    body: body || undefined,
    legacy_ref: ref,
    triaged: handled || Boolean(sub.promotedLeadId),
    read_only: true,
    created_at: at,
  })
  return out
}

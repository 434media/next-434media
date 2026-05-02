import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getEmailSignups } from "@/lib/firestore-email-signups"
import { getContactForms } from "@/lib/firestore-contact-forms"
import { getEventRegistrations } from "@/lib/firestore-event-registrations"
import { getLeads } from "@/lib/firestore-leads"
import { getMailchimpSubscriberMap } from "@/lib/mailchimp-analytics"
import {
  getStatesForSubmissions,
  type SubmissionSourceCollection,
  type SubmissionState,
} from "@/lib/firestore-submission-states"

export const runtime = "nodejs"
export const maxDuration = 60

interface InboxRow {
  rowKey: string                  // unique across sources: `${source}:${id}`
  source: SubmissionSourceCollection
  id: string
  email: string
  name?: string                   // best-guess display name (firstName + lastName, falls back to email)
  firstName?: string
  lastName?: string
  company?: string
  phone?: string
  message?: string
  sourceSite: string              // public source code (e.g. "434Media", "TXMX") or event slug
  eventName?: string              // events only
  eventDate?: string              // events only
  pageUrl?: string
  createdAt: string               // unified timestamp (ISO)
  state: SubmissionState          // resolved with sidecar (default "new")
  crmLeadId?: string              // matched lead id, if any
  mailchimpSubscribed: boolean
}

interface InboxStats {
  total: number
  bySource: Record<SubmissionSourceCollection, number>
  byState: Record<SubmissionState, number>
  inCrm: number
  inMailchimp: number
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

function isoOrEmpty(value: unknown): string {
  if (typeof value === "string") return value
  if (value instanceof Date) return value.toISOString()
  return ""
}

// GET /api/admin/submissions/inbox
//
// Unified inbox feed. Fans out to all three submission collections, the leads
// CRM, the Mailchimp subscriber map, and the per-source state sidecar — then
// joins everything into a flat row list sorted by recency.
//
// One round trip from the client. Source-specific filtering, state filtering,
// and search all happen client-side on this normalized payload.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const [signups, forms, events, leads, mcMap] = await Promise.all([
      getEmailSignups(),
      getContactForms(),
      getEventRegistrations(),
      getLeads(),
      getMailchimpSubscriberMap().catch(() => null),
    ])

    // Build the email → leadId map for the CRM cross-link
    const leadsByEmail = new Map<string, string>()
    for (const l of leads) {
      if (l.email) leadsByEmail.set(l.email.toLowerCase(), l.id)
    }

    // Mailchimp subscriber set (lowercased emails)
    const mcEmails = new Set<string>()
    if (mcMap?.byEmail) {
      for (const email of Object.keys(mcMap.byEmail)) {
        mcEmails.add(email.toLowerCase())
      }
    }

    // Build raw rows first (without state) so we can batch the state lookup per source.
    const rawSignups = signups
      .filter((s) => !!s.id && !!s.email)
      .map<InboxRow>((s) => ({
        rowKey: `email_signups:${s.id!}`,
        source: "email_signups",
        id: s.id!,
        email: s.email,
        sourceSite: s.source || "newsletter",
        pageUrl: s.page_url,
        createdAt: isoOrEmpty(s.created_at),
        state: "new",
        crmLeadId: leadsByEmail.get(s.email.toLowerCase()),
        mailchimpSubscribed: mcEmails.has(s.email.toLowerCase()),
      }))

    const rawForms = forms
      .filter((f) => !!f.id && !!f.email)
      .map<InboxRow>((f) => ({
        rowKey: `contact_forms:${f.id!}`,
        source: "contact_forms",
        id: f.id!,
        email: f.email,
        firstName: f.firstName,
        lastName: f.lastName,
        name: `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() || undefined,
        company: f.company || undefined,
        phone: f.phone,
        message: f.message,
        sourceSite: f.source || "contact",
        createdAt: isoOrEmpty(f.created_at),
        state: "new",
        crmLeadId: leadsByEmail.get(f.email.toLowerCase()),
        mailchimpSubscribed: mcEmails.has(f.email.toLowerCase()),
      }))

    const rawEvents = events
      .filter((e) => !!e.id && !!e.email)
      .map<InboxRow>((e) => ({
        rowKey: `event_registrations:${e.id!}`,
        source: "event_registrations",
        id: e.id!,
        email: e.email,
        firstName: e.firstName,
        lastName: e.lastName,
        name: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || e.fullName || undefined,
        company: e.company || undefined,
        sourceSite: e.event,
        eventName: e.eventName,
        eventDate: e.eventDate,
        pageUrl: e.pageUrl,
        createdAt: isoOrEmpty(e.registeredAt),
        state: "new",
        crmLeadId: leadsByEmail.get(e.email.toLowerCase()),
        mailchimpSubscribed: mcEmails.has(e.email.toLowerCase()),
      }))

    // Batch-fetch states per source
    const [signupStates, formStates, eventStates] = await Promise.all([
      getStatesForSubmissions("email_signups", rawSignups.map((r) => r.id)),
      getStatesForSubmissions("contact_forms", rawForms.map((r) => r.id)),
      getStatesForSubmissions("event_registrations", rawEvents.map((r) => r.id)),
    ])

    for (const r of rawSignups) r.state = signupStates.get(r.id) ?? "new"
    for (const r of rawForms) r.state = formStates.get(r.id) ?? "new"
    for (const r of rawEvents) r.state = eventStates.get(r.id) ?? "new"

    const rows: InboxRow[] = [...rawSignups, ...rawForms, ...rawEvents]
    rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))

    // Stats — computed server-side so the chip badges render with the first paint
    const stats: InboxStats = {
      total: rows.length,
      bySource: { email_signups: 0, contact_forms: 0, event_registrations: 0 },
      byState: { new: 0, triaged: 0, replied: 0, archived: 0, spam: 0 },
      inCrm: 0,
      inMailchimp: 0,
    }
    for (const r of rows) {
      stats.bySource[r.source]++
      stats.byState[r.state]++
      if (r.crmLeadId) stats.inCrm++
      if (r.mailchimpSubscribed) stats.inMailchimp++
    }

    return NextResponse.json({
      ok: true,
      rows,
      stats,
      mailchimpAvailable: mcMap !== null,
    })
  } catch (err) {
    console.error("[GET /submissions/inbox]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load inbox" },
      { status: 500 },
    )
  }
}

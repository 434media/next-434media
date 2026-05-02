import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getEventRegistrations } from "@/lib/firestore-event-registrations"
import { getLeads } from "@/lib/firestore-leads"
import { getMailchimpSubscriberMap } from "@/lib/mailchimp-analytics"

export const runtime = "nodejs"
export const maxDuration = 60

interface EventSummary {
  event: string
  eventName: string
  eventDate: string
  isPast: boolean
  totalRegistrations: number
  uniqueAttendees: number
  inCrm: number
  inMailchimp: number
  conversionRate: number // unique attendees in CRM / unique attendees, 0..1
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/events/summary
//
// Per-event rollup for the Events drilldown view. Joins registrations against
// the CRM `leads` collection and the Mailchimp subscriber map so each event
// card can show "X registrations · Y in CRM · Z in Mailchimp" without the
// client needing to fan out to three endpoints.
//
// If Mailchimp is unavailable the in-Mailchimp counts come back as 0 — the
// rest of the summary still renders.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const [registrations, leads, mailchimpMap] = await Promise.all([
      getEventRegistrations(),
      getLeads(),
      getMailchimpSubscriberMap().catch(() => null),
    ])

    const leadEmails = new Set<string>()
    for (const l of leads) {
      if (l.email) leadEmails.add(l.email.toLowerCase())
    }

    const mcEmails = new Set<string>()
    if (mailchimpMap?.byEmail) {
      for (const email of Object.keys(mailchimpMap.byEmail)) {
        mcEmails.add(email.toLowerCase())
      }
    }

    // Bucket registrations by event slug
    interface Bucket {
      event: string
      eventName: string
      eventDate: string
      rows: Array<{ email: string }>
    }
    const buckets = new Map<string, Bucket>()
    for (const r of registrations) {
      if (!r.event) continue
      let b = buckets.get(r.event)
      if (!b) {
        b = { event: r.event, eventName: r.eventName || r.event, eventDate: r.eventDate || "", rows: [] }
        buckets.set(r.event, b)
      }
      // Promote a meaningful eventName/date if a later row carries one
      if (!b.eventName && r.eventName) b.eventName = r.eventName
      if (!b.eventDate && r.eventDate) b.eventDate = r.eventDate
      if (r.email) b.rows.push({ email: r.email.toLowerCase() })
    }

    const now = Date.now()
    const events: EventSummary[] = []
    for (const b of buckets.values()) {
      const uniqueEmails = new Set(b.rows.map((row) => row.email))
      let inCrm = 0
      let inMc = 0
      for (const email of uniqueEmails) {
        if (leadEmails.has(email)) inCrm++
        if (mcEmails.has(email)) inMc++
      }
      const eventDateMs = b.eventDate ? new Date(b.eventDate).getTime() : NaN
      const isPast = !isNaN(eventDateMs) ? eventDateMs < now : true
      const uniqueAttendees = uniqueEmails.size
      events.push({
        event: b.event,
        eventName: b.eventName,
        eventDate: b.eventDate,
        isPast,
        totalRegistrations: b.rows.length,
        uniqueAttendees,
        inCrm,
        inMailchimp: inMc,
        conversionRate: uniqueAttendees > 0 ? inCrm / uniqueAttendees : 0,
      })
    }

    // Sort: upcoming first (chronologically ascending), then past (most recent first)
    events.sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? 1 : -1
      // both past or both upcoming
      const aTs = a.eventDate ? new Date(a.eventDate).getTime() : 0
      const bTs = b.eventDate ? new Date(b.eventDate).getTime() : 0
      return a.isPast ? bTs - aTs : aTs - bTs
    })

    const totals = {
      events: events.length,
      registrations: events.reduce((acc, e) => acc + e.totalRegistrations, 0),
      uniqueAttendees: events.reduce((acc, e) => acc + e.uniqueAttendees, 0),
    }

    return NextResponse.json({
      ok: true,
      events,
      totals,
      mailchimpAvailable: mailchimpMap !== null,
    })
  } catch (err) {
    console.error("[GET /events/summary]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to summarize events" },
      { status: 500 },
    )
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getEmailSignups } from "@/lib/firestore-email-signups"
import { getContactForms } from "@/lib/firestore-contact-forms"
import { getEventRegistrations } from "@/lib/firestore-event-registrations"
import { getLeads } from "@/lib/firestore-leads"

export const runtime = "nodejs"
export const maxDuration = 30

type SourceKey = "email_signups" | "contact_forms" | "event_registrations"

interface DupeRow {
  source: SourceKey
  id: string
  sourceSite: string
  created_at: string
  firstName?: string
  lastName?: string
  company?: string
  phone?: string
  message?: string
  eventName?: string
  eventDate?: string
}

interface DupeGroup {
  email: string
  name?: string
  company?: string
  crmLeadId?: string
  counts: { email_signups: number; contact_forms: number; event_registrations: number }
  rows: DupeRow[]
  firstSeen: string
  lastSeen: string
  totalRows: number
  distinctSources: number
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

// GET /api/admin/submissions/cross-source-dupes
//
// Pulls every submission across the 3 collections, groups by lowercased email,
// returns groups that appear in 2+ distinct collections. Each group is annotated
// with whether a matching CRM lead already exists so the UI can offer one-click
// merge or skip the dedupe.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  // Default: only show emails that span 2+ different submission types.
  // Pass `?minSources=1` to also surface within-collection dupes.
  const minSources = Math.max(1, Number(url.searchParams.get("minSources") || "2"))

  try {
    const [signups, forms, events, leads] = await Promise.all([
      getEmailSignups(),
      getContactForms(),
      getEventRegistrations(),
      getLeads(),
    ])

    // email → leadId map for the "already in CRM" pill
    const leadsByEmail = new Map<string, string>()
    for (const l of leads) {
      if (l.email) leadsByEmail.set(l.email.toLowerCase(), l.id)
    }

    const groups = new Map<string, DupeGroup>()

    function ensureGroup(email: string): DupeGroup {
      const key = email.toLowerCase()
      let g = groups.get(key)
      if (!g) {
        g = {
          email: key,
          counts: { email_signups: 0, contact_forms: 0, event_registrations: 0 },
          rows: [],
          firstSeen: "",
          lastSeen: "",
          totalRows: 0,
          distinctSources: 0,
          crmLeadId: leadsByEmail.get(key),
        }
        groups.set(key, g)
      }
      return g
    }

    for (const s of signups) {
      if (!s.email || !s.id) continue
      const g = ensureGroup(s.email)
      g.counts.email_signups++
      g.rows.push({
        source: "email_signups",
        id: s.id,
        sourceSite: s.source || "newsletter",
        created_at: isoOrEmpty(s.created_at),
      })
    }

    for (const f of forms) {
      if (!f.email || !f.id) continue
      const g = ensureGroup(f.email)
      g.counts.contact_forms++
      g.rows.push({
        source: "contact_forms",
        id: f.id,
        sourceSite: f.source || "contact",
        created_at: isoOrEmpty(f.created_at),
        firstName: f.firstName,
        lastName: f.lastName,
        company: f.company,
        phone: f.phone,
        message: f.message,
      })
      // Promote name/company onto the group if not yet set — contact forms
      // carry the richest contact info, so they win the tie.
      if (!g.name && (f.firstName || f.lastName)) {
        g.name = `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim()
      }
      if (!g.company && f.company) g.company = f.company
    }

    for (const e of events) {
      if (!e.email || !e.id) continue
      const g = ensureGroup(e.email)
      g.counts.event_registrations++
      g.rows.push({
        source: "event_registrations",
        id: e.id,
        sourceSite: e.event,
        created_at: isoOrEmpty(e.registeredAt),
        firstName: e.firstName,
        lastName: e.lastName,
        company: e.company || undefined,
        eventName: e.eventName,
        eventDate: e.eventDate,
      })
      if (!g.name && (e.firstName || e.lastName)) {
        g.name = `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || e.fullName
      }
      if (!g.company && e.company) g.company = e.company
    }

    // Finalize groups: compute totals, distinct source count, first/last seen
    const finalized: DupeGroup[] = []
    for (const g of groups.values()) {
      g.totalRows = g.rows.length
      g.distinctSources =
        (g.counts.email_signups > 0 ? 1 : 0) +
        (g.counts.contact_forms > 0 ? 1 : 0) +
        (g.counts.event_registrations > 0 ? 1 : 0)

      // Filter: must hit the minSources threshold
      if (g.distinctSources < minSources) continue

      // Sort rows by created_at desc so the most recent surfaces first in the UI
      g.rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      g.firstSeen = g.rows[g.rows.length - 1]?.created_at || ""
      g.lastSeen = g.rows[0]?.created_at || ""
      finalized.push(g)
    }

    // Sort groups: most-recent activity first (so what's actively duplicating
    // surfaces over stale long-tail dupes)
    finalized.sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || ""))

    const stats = {
      totalEmails: groups.size,
      duplicateEmails: finalized.length,
      totalRows: finalized.reduce((acc, g) => acc + g.totalRows, 0),
      crmCovered: finalized.filter((g) => !!g.crmLeadId).length,
    }

    return NextResponse.json({ ok: true, groups: finalized, stats })
  } catch (err) {
    console.error("[GET /cross-source-dupes]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute dupes" },
      { status: 500 },
    )
  }
}

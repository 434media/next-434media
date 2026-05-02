import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getEmailSignups } from "@/lib/firestore-email-signups"
import { getContactForms } from "@/lib/firestore-contact-forms"
import { getEventRegistrations } from "@/lib/firestore-event-registrations"
import { getLeads } from "@/lib/firestore-leads"
import { getMailchimpSubscriberMap } from "@/lib/mailchimp-analytics"

export const runtime = "nodejs"
export const maxDuration = 60

interface SourceCounts {
  email_signups: number
  contact_forms: number
  event_registrations: number
  leads: number
}

interface OrphanSubscriber {
  email: string
  audiences: string[]
  tags: string[]
  status: string
}

interface OrphanCollectionRow {
  email: string
  /** Where the email was seen in our collections. */
  sources: string[]
  /** Source labels (e.g. "AIM", "TXMX") attached to the email. */
  sourceSites: string[]
}

interface SyncAuditResponse {
  ok: true
  generatedAt: string
  mailchimpAvailable: boolean
  /** Per-audience subscriber counts, mirrored from Mailchimp. */
  audiences: Array<{ id: string; name: string; count: number }>
  totals: {
    mailchimpDistinctEmails: number
    collectionsDistinctEmails: number
    inBoth: number
    mailchimpOnly: number
    collectionsOnly: number
  }
  /** Where the in-collections-only emails came from (count per source collection). */
  collectionsOnlyBySource: SourceCounts
  /** Up to 50 sample emails per orphan bucket. */
  mailchimpOnlySample: OrphanSubscriber[]
  collectionsOnlySample: OrphanCollectionRow[]
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/mailchimp/sync-audit
//
// Read-only diagnostic. Compares every Mailchimp subscriber across every
// configured audience to the union of every email captured across the 434media
// admin's collections (email_signups + contact_forms + event_registrations +
// leads CRM, fanned out across every named DB the admin reads from).
//
// Surfaces three buckets:
//   - in both        → healthy path, just a count
//   - mailchimp-only → orphaned subscribers we have no other capture signal for;
//                      candidates for "capture as CRM lead" follow-up
//   - collections-only → captured but never synced to Mailchimp; candidates for
//                        the existing PR #5 "Push to Mailchimp" bulk action
//
// First step before designing the sync UI panel — see real numbers, then design.
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
      getMailchimpSubscriberMap().catch((err) => {
        console.error("[sync-audit] Mailchimp read failed:", err)
        return null
      }),
    ])

    // Build union of all collection emails (lowercased) with a per-email
    // breakdown of which sources surfaced them.
    interface CollectionInfo {
      sources: Set<string>      // collection names (email_signups | contact_forms | ...)
      sourceSites: Set<string>  // source-site labels (AIM, TXMX, ...)
    }
    const collectionEmails = new Map<string, CollectionInfo>()

    function noteEmail(email: string, source: string, sourceSite: string): void {
      const key = email.trim().toLowerCase()
      if (!key) return
      let info = collectionEmails.get(key)
      if (!info) {
        info = { sources: new Set(), sourceSites: new Set() }
        collectionEmails.set(key, info)
      }
      info.sources.add(source)
      if (sourceSite) info.sourceSites.add(sourceSite)
    }

    for (const s of signups) {
      if (s.email) noteEmail(s.email, "email_signups", s.source || "")
    }
    for (const f of forms) {
      if (f.email) noteEmail(f.email, "contact_forms", f.source || "")
    }
    for (const e of events) {
      if (e.email) noteEmail(e.email, "event_registrations", e.source || "")
    }
    for (const l of leads) {
      if (l.email) noteEmail(l.email, "leads", l.platform || l.source || "")
    }

    // Build Mailchimp set
    const mcEmails = new Set<string>()
    if (mcMap?.byEmail) {
      for (const e of Object.keys(mcMap.byEmail)) mcEmails.add(e.toLowerCase())
    }

    // Compute the 3 buckets
    let inBoth = 0
    const mailchimpOnly: string[] = []
    const collectionsOnly: string[] = []

    for (const e of mcEmails) {
      if (collectionEmails.has(e)) inBoth++
      else mailchimpOnly.push(e)
    }
    for (const e of collectionEmails.keys()) {
      if (!mcEmails.has(e)) collectionsOnly.push(e)
    }

    // Count collectionsOnly by source collection
    const collectionsOnlyBySource: SourceCounts = {
      email_signups: 0,
      contact_forms: 0,
      event_registrations: 0,
      leads: 0,
    }
    for (const e of collectionsOnly) {
      const info = collectionEmails.get(e)
      if (!info) continue
      for (const src of info.sources) {
        if (src in collectionsOnlyBySource) {
          collectionsOnlyBySource[src as keyof SourceCounts]++
        }
      }
    }

    // Sample 50 mailchimp-only with their audience + tag context
    const mailchimpOnlySample: OrphanSubscriber[] = mailchimpOnly.slice(0, 50).map((email) => {
      const entry = mcMap?.byEmail[email]
      const memberships = entry?.memberships ?? []
      return {
        email,
        audiences: memberships.map((m) => m.audienceName),
        tags: Array.from(new Set(memberships.flatMap((m) => m.tags))),
        status: memberships[0]?.status || "",
      }
    })

    // Sample 50 collections-only with their source context
    const collectionsOnlySample: OrphanCollectionRow[] = collectionsOnly.slice(0, 50).map((email) => {
      const info = collectionEmails.get(email)
      return {
        email,
        sources: Array.from(info?.sources ?? []),
        sourceSites: Array.from(info?.sourceSites ?? []).filter(Boolean),
      }
    })

    const response: SyncAuditResponse = {
      ok: true,
      generatedAt: new Date().toISOString(),
      mailchimpAvailable: mcMap !== null,
      audiences: mcMap?.audiences ?? [],
      totals: {
        mailchimpDistinctEmails: mcEmails.size,
        collectionsDistinctEmails: collectionEmails.size,
        inBoth,
        mailchimpOnly: mailchimpOnly.length,
        collectionsOnly: collectionsOnly.length,
      },
      collectionsOnlyBySource,
      mailchimpOnlySample,
      collectionsOnlySample,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("[GET /mailchimp/sync-audit]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync audit failed" },
      { status: 500 },
    )
  }
}

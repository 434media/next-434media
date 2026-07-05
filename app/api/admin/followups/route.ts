import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getLeads } from "@/lib/firestore-leads"
import { getClients } from "@/lib/firestore-crm"

export const dynamic = "force-dynamic"

// Unified follow-up queue — the one place that merges the funnel's three
// previously-separate "what's due" signals: a lead's next_followup_date, an
// opportunity's next_followup_date, and a running sequence's next auto-send.
// Window: everything overdue + due within the next 7 days.

type Bucket = "overdue" | "today" | "upcoming"

interface FollowupItem {
  type: "lead" | "opportunity" | "sequence"
  id: string
  name: string
  company?: string
  date: string
  bucket: Bucket
  detail: string
  href: string
}

const DAY = 86_400_000

function bucketFor(dateStr: string, todayStr: string): Bucket | null {
  const d = dateStr.split("T")[0]
  if (d < todayStr) return "overdue"
  if (d === todayStr) return "today"
  const diff = (new Date(`${d}T00:00:00Z`).getTime() - new Date(`${todayStr}T00:00:00Z`).getTime()) / DAY
  return diff <= 7 ? "upcoming" : null
}

export async function GET() {
  const session = await getSession()
  if (!session || !isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const [leads, clients] = await Promise.all([getLeads(), getClients()])
    const today = new Date().toISOString().split("T")[0]
    const items: FollowupItem[] = []

    for (const l of leads) {
      if (l.status === "archived" || l.status === "converted") continue
      if (l.next_followup_date) {
        const b = bucketFor(l.next_followup_date, today)
        if (b)
          items.push({
            type: "lead",
            id: l.id,
            name: l.name || l.email,
            company: l.company,
            date: l.next_followup_date.split("T")[0],
            bucket: b,
            detail: `Lead follow-up · ${l.status}`,
            href: `/admin/leads?openLead=${encodeURIComponent(l.id)}`,
          })
      }
      const seq = l.outreach_sequence
      if (seq && seq.status === "active" && seq.next_send_at) {
        const b = bucketFor(seq.next_send_at, today)
        if (b)
          items.push({
            type: "sequence",
            id: l.id,
            name: l.name || l.email,
            company: l.company,
            date: seq.next_send_at.split("T")[0],
            bucket: b,
            detail: `Sequence email ${seq.next_step ?? "?"} of 3 — sends automatically`,
            href: `/admin/leads?openLead=${encodeURIComponent(l.id)}`,
          })
      }
    }

    for (const c of clients) {
      if (!c.is_opportunity || c.is_archived || !c.next_followup_date) continue
      if (c.disposition === "closed_won" || c.disposition === "closed_lost") continue
      const b = bucketFor(c.next_followup_date, today)
      if (b)
        items.push({
          type: "opportunity",
          id: c.id,
          name: c.title || c.company_name || c.name || "Opportunity",
          company: c.company_name,
          date: c.next_followup_date.split("T")[0],
          bucket: b,
          detail: `Opportunity · ${c.disposition ?? "discovery"}`,
          href: `/admin/crm?tab=pipeline`,
        })
    }

    const order: Record<Bucket, number> = { overdue: 0, today: 1, upcoming: 2 }
    items.sort((a, b) => order[a.bucket] - order[b.bucket] || a.date.localeCompare(b.date))

    return NextResponse.json({ success: true, items, today })
  } catch (err) {
    console.error("[GET /api/admin/followups]", err)
    return NextResponse.json({ error: "Failed to load follow-ups" }, { status: 500 })
  }
}

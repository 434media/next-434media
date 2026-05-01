import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getLeads } from "@/lib/firestore-leads"
import { getClients } from "@/lib/firestore-crm"
import { getResend, DEFAULT_FROM, assertVerifiedSender } from "@/lib/resend"
import { getDb } from "@/lib/firebase-admin"
import type { Lead } from "@/types/crm-types"
import type { ClientRecord } from "@/types/crm-types"

export const runtime = "nodejs"
export const maxDuration = 120

interface FollowupItem {
  kind: "lead" | "client"
  id: string
  name: string
  company: string
  followUpDate: string
  daysOverdue: number
  assignedTo: string
  url: string
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0]
}

function daysBetween(iso: string, today: Date): number {
  const then = new Date(iso)
  const ms = today.getTime() - then.getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function leadDue(l: Lead, today: string): boolean {
  if (l.status !== "contacted") return false
  if (!l.next_followup_date) return false
  return l.next_followup_date.split("T")[0] <= today
}

function clientDue(c: ClientRecord, today: string): boolean {
  if (!c.next_followup_date) return false
  // Only flag clients/opportunities still in motion
  if (c.disposition === "closed_won" || c.disposition === "closed_lost") return false
  return c.next_followup_date.split("T")[0] <= today
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderHtml(rep: string, items: FollowupItem[]): string {
  const rows = items
    .map((it) => {
      const overdueColor = it.daysOverdue > 7 ? "#dc2626" : it.daysOverdue > 2 ? "#d97706" : "#737373"
      const kindBadge = it.kind === "lead"
        ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:#eff6ff;color:#1d4ed8;">LEAD</span>`
        : `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:#f0fdf4;color:#15803d;">CLIENT</span>`
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:13px;">
            ${kindBadge}
            <a href="${it.url}" style="color:#0a0a0a;text-decoration:none;font-weight:600;margin-left:6px;">${escapeHtml(it.name)}</a>
            <div style="color:#737373;font-size:12px;margin-top:2px;">${escapeHtml(it.company)}</div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:12px;color:#737373;">
            ${escapeHtml(it.followUpDate)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:13px;color:${overdueColor};text-align:right;font-weight:600;">
            ${it.daysOverdue === 0 ? "today" : `${it.daysOverdue}d`}
          </td>
        </tr>
      `
    })
    .join("")

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0a0a0a;">
  <div style="max-width:640px;margin:0 auto;background:white;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #e5e5e5;">
      <div style="font-size:11px;font-weight:600;color:#737373;letter-spacing:0.05em;text-transform:uppercase;">Daily follow-ups</div>
      <h1 style="margin:6px 0 0;font-size:18px;font-weight:600;">${rep} — ${items.length} item${items.length === 1 ? "" : "s"} due</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#fafafa;">
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#737373;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid #e5e5e5;">Item</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#737373;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid #e5e5e5;">Due</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#737373;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid #e5e5e5;">Overdue</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #e5e5e5;font-size:12px;color:#737373;">
      Click any item to open it in the CRM. Digest fires every weekday at 8am CT.
    </div>
  </div>
</body></html>`
}

interface TeamMemberMap {
  [name: string]: string // name → email
}

async function loadTeamEmailMap(): Promise<TeamMemberMap> {
  const map: TeamMemberMap = {}
  try {
    const db = getDb()
    const snap = await db.collection("team_members").where("isActive", "==", true).get()
    for (const doc of snap.docs) {
      const d = doc.data()
      if (d.name && d.email) map[d.name] = d.email
    }
  } catch (err) {
    console.error("[lead-followup-digest] failed to load team_members:", err)
  }
  return map
}

export async function GET(request: NextRequest) {
  return runCronJob("lead-followup-digest", request, async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://434media.com"
    const today = todayIso()
    const now = new Date()

    // Pull both datasets in parallel
    const [leads, clients, repEmailMap] = await Promise.all([
      getLeads(),
      getClients(),
      loadTeamEmailMap(),
    ])

    // Bucket by assigned_to
    const buckets = new Map<string, FollowupItem[]>()
    const push = (rep: string, item: FollowupItem) => {
      const key = rep || "unassigned"
      const list = buckets.get(key) ?? []
      list.push(item)
      buckets.set(key, list)
    }

    for (const l of leads) {
      if (!leadDue(l, today)) continue
      push(l.assigned_to ?? "unassigned", {
        kind: "lead",
        id: l.id,
        name: l.name || l.email,
        company: l.company || "",
        followUpDate: l.next_followup_date!.split("T")[0],
        daysOverdue: daysBetween(l.next_followup_date!, now),
        assignedTo: l.assigned_to ?? "unassigned",
        url: `${baseUrl}/admin/crm?tab=leads&openLead=${encodeURIComponent(l.id)}`,
      })
    }

    for (const c of clients) {
      if (!clientDue(c, today)) continue
      const isOpp = !!c.is_opportunity
      push(c.assigned_to ?? "unassigned", {
        kind: "client",
        id: c.id,
        name: c.title || c.name || c.company_name || "(untitled)",
        company: c.company_name || "",
        followUpDate: c.next_followup_date!.split("T")[0],
        daysOverdue: daysBetween(c.next_followup_date!, now),
        assignedTo: c.assigned_to ?? "unassigned",
        url: `${baseUrl}/admin/crm?tab=${isOpp ? "pipeline&openOpportunity" : "clients&open"}=${encodeURIComponent(c.id)}`,
      })
    }

    if (buckets.size === 0) {
      return {
        message: "No follow-ups due today — skipped sends",
        detail: { leadsChecked: leads.length, clientsChecked: clients.length },
      }
    }

    const sender = process.env.LEAD_DIGEST_FROM || DEFAULT_FROM
    assertVerifiedSender(sender)
    const resend = getResend()

    let sent = 0
    let skipped = 0
    const detail: Record<string, unknown> = {}

    for (const [rep, items] of buckets.entries()) {
      const recipientEmail = repEmailMap[rep]
      if (!recipientEmail) {
        // No mapping for this rep — log and skip rather than misroute
        console.warn(`[lead-followup-digest] no email for rep "${rep}", skipping ${items.length} items`)
        detail[`${rep}_skipped`] = items.length
        skipped++
        continue
      }
      // Sort each rep's bucket worst-overdue-first
      items.sort((a, b) => b.daysOverdue - a.daysOverdue)

      const { error } = await resend.emails.send({
        from: sender,
        to: recipientEmail,
        subject: `${items.length} follow-up${items.length === 1 ? "" : "s"} due today`,
        html: renderHtml(rep, items),
      })
      if (error) {
        console.error(`[lead-followup-digest] resend send failed for ${rep}:`, error)
        detail[`${rep}_error`] = error.message ?? "unknown"
        continue
      }
      detail[`${rep}_sent`] = items.length
      sent++
    }

    return {
      message: `Sent ${sent} digest${sent === 1 ? "" : "s"}, skipped ${skipped}`,
      detail,
    }
  })
}

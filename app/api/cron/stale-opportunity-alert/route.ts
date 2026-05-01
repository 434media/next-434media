import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getClients } from "@/lib/firestore-crm"
import { getResend, DEFAULT_FROM, assertVerifiedSender } from "@/lib/resend"
import type { ClientRecord } from "@/types/crm-types"

export const runtime = "nodejs"
export const maxDuration = 60

// Terminal dispositions — stop alerting once an opportunity is decided.
const TERMINAL_DISPOSITIONS = new Set(["closed_won", "closed_lost"])

// Required env. We fail loudly rather than silently sending to the wrong recipient.
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

interface StaleOpp {
  id: string
  name: string
  company: string
  value: number
  daysOverdue: number
  followUpDate: string
  disposition: string
  assignedTo: string
}

function daysBetween(iso: string, now: Date): number {
  const then = new Date(iso)
  const ms = now.getTime() - then.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function isStale(c: ClientRecord, today: string, now: Date): StaleOpp | null {
  if (!c.is_opportunity) return null
  if (c.disposition && TERMINAL_DISPOSITIONS.has(c.disposition)) return null
  if (!c.next_followup_date) return null
  if (c.next_followup_date >= today) return null
  return {
    id: c.id,
    name: c.title || c.company_name || "(untitled)",
    company: c.company_name || "",
    value: typeof c.pitch_value === "number" ? c.pitch_value : Number(c.pitch_value) || 0,
    daysOverdue: daysBetween(c.next_followup_date, now),
    followUpDate: c.next_followup_date,
    disposition: c.disposition || "(no disposition)",
    assignedTo: c.assigned_to || "(unassigned)",
  }
}

function formatCurrency(n: number): string {
  if (!n) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderHtml(opps: StaleOpp[], baseUrl: string): string {
  const totalValue = opps.reduce((sum, o) => sum + o.value, 0)
  const rows = opps
    .map((o) => {
      const url = `${baseUrl}/admin/crm?tab=pipeline&openOpportunity=${encodeURIComponent(o.id)}`
      const overdueColor = o.daysOverdue > 30 ? "#dc2626" : o.daysOverdue > 14 ? "#d97706" : "#737373"
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:13px;">
            <a href="${url}" style="color:#0a0a0a;text-decoration:none;font-weight:600;">${escapeHtml(o.company)}</a>
            <div style="color:#737373;font-size:12px;margin-top:2px;">${escapeHtml(o.name)}</div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:13px;color:#171717;text-align:right;font-variant-numeric:tabular-nums;">
            ${formatCurrency(o.value)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:13px;color:${overdueColor};text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">
            ${o.daysOverdue}d
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:12px;color:#737373;">
            ${escapeHtml(o.followUpDate)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:12px;color:#737373;">
            ${escapeHtml(o.assignedTo)}
          </td>
        </tr>
      `
    })
    .join("")

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0a0a0a;">
    <div style="max-width:640px;margin:0 auto;background:white;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e5e5e5;">
        <div style="font-size:11px;font-weight:600;color:#737373;letter-spacing:0.05em;text-transform:uppercase;">Weekly stale opportunity sweep</div>
        <h1 style="margin:6px 0 0;font-size:18px;font-weight:600;color:#0a0a0a;">${opps.length} opportunit${opps.length === 1 ? "y is" : "ies are"} overdue for follow-up</h1>
        <div style="margin-top:6px;font-size:13px;color:#525252;">${formatCurrency(totalValue)} in stalled pipeline</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#737373;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid #e5e5e5;">Opportunity</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#737373;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid #e5e5e5;">Value</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#737373;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid #e5e5e5;">Overdue</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#737373;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid #e5e5e5;">Follow-up</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#737373;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid #e5e5e5;">Owner</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #e5e5e5;font-size:12px;color:#737373;">
        Click any opportunity above to open it in the CRM. Sweep runs every Monday at 7am CT.
      </div>
    </div>
  </body>
</html>`
}

function renderText(opps: StaleOpp[]): string {
  const totalValue = opps.reduce((sum, o) => sum + o.value, 0)
  const lines = opps.map(
    (o) => `  • ${o.company} — ${o.name} — ${formatCurrency(o.value)} — ${o.daysOverdue}d overdue (followup: ${o.followUpDate}, owner: ${o.assignedTo})`,
  )
  return [
    `${opps.length} opportunit${opps.length === 1 ? "y is" : "ies are"} overdue for follow-up`,
    `${formatCurrency(totalValue)} in stalled pipeline`,
    "",
    ...lines,
    "",
    "Sweep runs every Monday at 7am CT.",
  ].join("\n")
}

export async function GET(request: NextRequest) {
  return runCronJob("stale-opportunity-alert", request, async () => {
    const recipient = requireEnv("STALE_OPP_ALERT_RECIPIENT")
    const sender = process.env.STALE_OPP_ALERT_FROM || DEFAULT_FROM
    assertVerifiedSender(sender)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://434media.com"

    const today = new Date().toISOString().split("T")[0]
    const now = new Date()

    const clients = await getClients()
    const stale: StaleOpp[] = []
    for (const c of clients) {
      const s = isStale(c, today, now)
      if (s) stale.push(s)
    }

    // Sort by days overdue (worst first)
    stale.sort((a, b) => b.daysOverdue - a.daysOverdue)

    if (stale.length === 0) {
      return {
        message: "No stale opportunities — skipped send",
        detail: { checked: clients.length, stale: 0 },
      }
    }

    const totalValue = stale.reduce((sum, o) => sum + o.value, 0)

    const { data, error } = await getResend().emails.send({
      from: sender,
      to: recipient,
      subject: `${stale.length} stale opportunit${stale.length === 1 ? "y" : "ies"} — ${formatCurrency(totalValue)} stalled`,
      html: renderHtml(stale, baseUrl),
      text: renderText(stale),
    })

    if (error) {
      throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`)
    }

    return {
      message: `Sent stale-opportunity digest with ${stale.length} item(s)`,
      detail: {
        checked: clients.length,
        stale: stale.length,
        totalValue,
        emailId: data?.id,
        recipient,
      },
    }
  })
}

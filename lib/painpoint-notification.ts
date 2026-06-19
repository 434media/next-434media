import { getResend, DEFAULT_FROM } from "@/lib/resend"
import { VERTICAL_LABELS, type Painpoint } from "@/types/crm-types"

// Internal recipient for new painpoint-intake notifications. Reuses the same
// INBOX_NOTIFY_TO knob as contact-form alerts so there's one place to manage
// who gets program intake mail; override via env without a redeploy.
const NOTIFY_TO = process.env.INBOX_NOTIFY_TO || "marcos@434media.com"

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://434media.com"
}

/**
 * Fire an internal email when an underwriter submits a painpoint via the public
 * intake form. Best-effort and self-contained — never throws, so a Resend hiccup
 * can't break the public submission. Call AFTER the painpoint is persisted.
 *
 * The CTA deep-links to the painpoints triage queue (status:submitted) so an
 * operator or the Underwriter Onboarding squad can pick it up immediately.
 */
export async function notifyNewPainpoint(p: Painpoint): Promise<void> {
  try {
    const who = p.underwriterName?.trim() || p.contactEmail?.trim() || "an underwriter"
    const triageUrl = `${appBaseUrl()}/admin/painpoints`
    const subject = `New painpoint — ${p.title}${p.sponsorName ? ` (${p.sponsorName})` : ""}`

    const rows: Array<[string, string]> = [
      ["Title", p.title],
      ["Vertical", VERTICAL_LABELS[p.vertical]],
      ["Underwriter", p.underwriterName || "—"],
      ["Role", p.underwriterRole || "—"],
      ["Organization", p.sponsorName || "—"],
      ["Contact", p.contactEmail || "—"],
      ["Cost impact", p.costImpact || "—"],
    ]

    const text = [
      `New painpoint submitted by ${who}`,
      "",
      ...rows.map(([k, v]) => `${k}: ${v}`),
      "",
      "Problem:",
      p.problemStatement?.trim() || "(none)",
      "",
      `Triage: ${triageUrl}`,
    ].join("\n")

    const rowsHtml = rows
      .map(
        ([k, v]) => `
          <tr>
            <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;color:#737373;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;color:#171717;font-size:14px;">${escapeHtml(v)}</td>
          </tr>`,
      )
      .join("")

    const problemHtml = escapeHtml(p.problemStatement?.trim() || "(none)").replace(/\n/g, "<br/>")

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#171717;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#737373;margin:0 0 4px;">Digital Canvas · Painpoint intake</p>
  <h1 style="font-size:20px;font-weight:800;margin:0 0 16px;">New painpoint submitted</h1>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
    ${rowsHtml}
  </table>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#737373;margin:20px 0 6px;">Problem</p>
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.55;color:#171717;">${problemHtml}</div>
  <div style="margin:24px 0 8px;">
    <a href="${triageUrl}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px;">Triage painpoint &rarr;</a>
  </div>
</div>`

    const replyTo = p.contactEmail && EMAIL_RE.test(p.contactEmail) ? p.contactEmail : undefined

    const { error } = await getResend().emails.send({
      from: DEFAULT_FROM,
      to: NOTIFY_TO,
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
      html,
    })
    if (error) console.error("[notifyNewPainpoint] Resend returned an error:", error)
  } catch (err) {
    console.error("[notifyNewPainpoint] failed (non-fatal):", err)
  }
}

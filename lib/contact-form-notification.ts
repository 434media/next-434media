import { getResend, DEFAULT_FROM } from "@/lib/resend"

// Internal recipient for new inbox (contact-form) notifications.
// Single recipient for now; override via env without a redeploy if the list
// grows (Resend accepts a comma-joined string or array for `to`).
const INBOX_NOTIFY_TO = process.env.INBOX_NOTIFY_TO || "marcos@434media.com"

// Linear-time email check. Domain labels exclude '.' so the dot is matched only
// by the literal \., avoiding the polynomial backtracking of `[^\s@]+\.[^\s@]+`.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

export interface ContactFormNotification {
  id?: string
  firstName: string
  lastName: string
  company: string
  email: string
  phone?: string
  message?: string
  source: string
  created_at: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function appBaseUrl(): string {
  // Same env the cron digests use to build admin deep links.
  return process.env.NEXT_PUBLIC_APP_URL || "https://434media.com"
}

/**
 * Fire an internal email when a new contact-form submission lands in the inbox.
 *
 * Best-effort and fully self-contained: it never throws, so a Resend hiccup
 * (or a missing RESEND_API_KEY in some environment) can't break the public
 * form submission that triggered it. Call this AFTER the submission has been
 * persisted — it's purely a notification.
 *
 * The CTA links to /admin/inbox?search=<email>, which the inbox already honors
 * via `initialSearch`, landing the admin on exactly this submission without
 * needing a new row-level deep-link param. `reply-to` is set to the sender so
 * a quick reply from the mailbox reaches the prospect directly; for a tracked
 * reply (logged + state→replied), the admin uses the in-app composer via the
 * Open in Inbox link.
 */
export async function notifyNewContactForm(sub: ContactFormNotification): Promise<void> {
  try {
    const fullName = `${sub.firstName} ${sub.lastName}`.trim() || sub.email
    const submittedAt = new Date(sub.created_at).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
    })
    const inboxUrl = `${appBaseUrl()}/admin/inbox?search=${encodeURIComponent(sub.email)}`
    const subject = `New inbox message — ${fullName}${sub.company ? `, ${sub.company}` : ""}`

    const rows: Array<[string, string]> = [
      ["Name", fullName],
      ["Company", sub.company || "—"],
      ["Email", sub.email],
      ["Phone", sub.phone || "—"],
      ["Source", sub.source],
      ["Received", submittedAt],
    ]

    const text = [
      `New inbox message from ${fullName}`,
      "",
      ...rows.map(([k, v]) => `${k}: ${v}`),
      "",
      "Message:",
      sub.message?.trim() || "(no message)",
      "",
      `Open in Inbox: ${inboxUrl}`,
      "",
      "Replying to this email reaches the sender directly. To reply and track it in the CRM, open the inbox.",
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

    const messageHtml = escapeHtml(sub.message?.trim() || "(no message)").replace(/\n/g, "<br/>")

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#171717;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#737373;margin:0 0 4px;">434 Media · Inbox</p>
  <h1 style="font-size:20px;font-weight:800;margin:0 0 16px;">New inbox message</h1>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
    ${rowsHtml}
  </table>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#737373;margin:20px 0 6px;">Message</p>
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.55;color:#171717;">${messageHtml}</div>
  <div style="margin:24px 0 8px;">
    <a href="${inboxUrl}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px;">Open in Inbox &rarr;</a>
  </div>
  <p style="font-size:12px;color:#a3a3a3;margin:12px 0 0;line-height:1.5;">Replying to this email reaches ${escapeHtml(sub.email)} directly. To reply and track it in the CRM, open the inbox.</p>
</div>`

    const replyTo = EMAIL_RE.test(sub.email) ? sub.email : undefined

    const { error } = await getResend().emails.send({
      from: DEFAULT_FROM,
      to: INBOX_NOTIFY_TO,
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
      html,
    })
    if (error) {
      console.error("[notifyNewContactForm] Resend returned an error:", error)
    }
  } catch (err) {
    console.error("[notifyNewContactForm] failed (non-fatal):", err)
  }
}

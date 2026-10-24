import { RESEND_DOMAIN } from "@/lib/resend"
import { EVENT_NAME, OTHER_OPTION } from "@/lib/lead-with-ops-feedback"

/**
 * Who hears about a call request from the Lead with Ops feedback form.
 *
 * Adam Carroll (Carroll Strategy & Operations) runs the workshop and takes the
 * call; the founder is copied. Founder decision, 2026-10-24: "Email future call
 * requests to Adam Carroll, cc me." Override either list without a redeploy
 * via the env vars (comma-separated), as lib/contact-form-notification.ts does.
 */
export const CALL_REQUEST_RECIPIENTS = {
  to: listFromEnv(process.env.LEAD_WITH_OPS_CALL_REQUEST_TO, ["adam@carrollstrategyoperations.com"]),
  cc: listFromEnv(process.env.LEAD_WITH_OPS_CALL_REQUEST_CC, ["marcos@434media.com"]),
} as const

/** Same mailbox as DEFAULT_FROM, under a name that says what the email is. */
export const CALL_REQUEST_FROM = `Lead with Ops feedback <crm@${RESEND_DOMAIN}>`

function listFromEnv(value: string | undefined, fallback: string[]): string[] {
  const list = (value ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  return list.length > 0 ? list : fallback
}

/** The saved row's fields the email needs. */
export interface CallRequest {
  name: string
  email: string
  company: string
  role: string
  industry: string
  industryOther?: string
  mostUseful: string
  biggestQuestion: string
  submittedAt: string
}

export interface CallRequestMessage {
  from: string
  to: string[]
  cc: string[]
  replyTo: string
  subject: string
  text: string
  html: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Subject text is user input; keep it on one line. */
function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim()
}

/**
 * The notification for one "Yes, let's set up a call" submission. Internal to
 * a partner, not outbound to the submitter: it goes to Carroll, and Reply-To is
 * the submitter so Adam answers them directly.
 */
export function callRequestMessage(req: CallRequest): CallRequestMessage {
  const submitted = new Date(req.submittedAt).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  })
  const industry =
    req.industry === OTHER_OPTION && req.industryOther ? `Other: ${req.industryOther}` : req.industry
  const subject = oneLine(`Call request from ${req.name}, ${req.company} — ${EVENT_NAME} feedback`)

  const rows: Array<[string, string]> = [
    ["Name", req.name],
    ["Email", req.email],
    ["Company", req.company],
    ["Role", req.role],
    ["Industry", industry],
    ["Submitted", `${submitted} (Central)`],
  ]
  const answers: Array<[string, string]> = [
    ["What was most useful, or what would have made it better", req.mostUseful],
    ["Biggest question or blocker with AI right now", req.biggestQuestion],
  ]

  const text = [
    `${req.name} asked for a call in the ${EVENT_NAME} feedback form.`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    ...answers.flatMap(([q, a]) => [`${q}:`, a, ""]),
    `Replying to this email reaches ${req.email} directly.`,
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
  const answersHtml = answers
    .map(
      ([q, a]) => `
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#737373;margin:20px 0 6px;">${escapeHtml(q)}</p>
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.55;color:#171717;">${escapeHtml(a).replace(/\n/g, "<br/>")}</div>`,
    )
    .join("")

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#171717;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#737373;margin:0 0 4px;">${escapeHtml(EVENT_NAME)} · Feedback</p>
  <h1 style="font-size:20px;font-weight:800;margin:0 0 16px;">${escapeHtml(req.name)} asked for a call</h1>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
    ${rowsHtml}
  </table>${answersHtml}
  <p style="font-size:12px;color:#a3a3a3;margin:20px 0 0;line-height:1.5;">Replying to this email reaches ${escapeHtml(req.email)} directly.</p>
</div>`

  return {
    from: CALL_REQUEST_FROM,
    to: [...CALL_REQUEST_RECIPIENTS.to],
    cc: [...CALL_REQUEST_RECIPIENTS.cc],
    replyTo: req.email,
    subject,
    text,
    html,
  }
}

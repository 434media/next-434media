import { getResend, DEFAULT_FROM } from "@/lib/resend"
import { TEAM_MEMBERS, SOCIAL_PLATFORM_OPTIONS } from "@/components/crm/types"
import type { ContentPost } from "@/components/crm/types"

// Reviewers who approve content. Comma-separated override via env without a
// redeploy, mirroring lib/contact-form-notification.ts's INBOX_NOTIFY_TO.
const CONTENT_REVIEW_NOTIFY_TO = (
  process.env.CONTENT_REVIEW_NOTIFY_TO || "marcos@434media.com,jesse@434media.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

// Resolve a content post's assignee display name (e.g. "Jesse Hernandez") to an
// email, so reviewers can reply straight to the producer. Same approach as the
// decision route's resolveAssigneeEmail (TEAM_MEMBERS is the canonical map).
function resolveAssigneeEmail(userName: string | undefined): string | null {
  if (!userName) return null
  const trimmed = userName.trim().toLowerCase()
  const match = TEAM_MEMBERS.find(
    (m) => m.name.toLowerCase() === trimmed || m.name.split(" ")[0].toLowerCase() === trimmed,
  )
  return match?.email ?? null
}

function platformLabels(post: ContentPost): string {
  const labels = (post.social_platforms || [])
    .map((p) => SOCIAL_PLATFORM_OPTIONS.find((o) => o.value === p)?.label || p)
  return labels.length > 0 ? labels.join(", ") : "—"
}

function scheduledLabel(post: ContentPost): string {
  if (!post.date_to_post) return "Not scheduled"
  const d = new Date(`${post.date_to_post.split("T")[0]}T00:00:00`)
  if (Number.isNaN(d.getTime())) return post.date_to_post
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

/**
 * Notify the reviewers (Marcos + Jesse) that a content post just entered Review
 * (status → needs_approval). Best-effort and self-contained: it never throws, so
 * a Resend hiccup can't break the status change that triggered it. Call it AFTER
 * the post has been persisted.
 *
 * The CTA deep-links to /admin/content?openContent=<id>, which opens the post's
 * drawer where the reviewer can Approve / Request changes. reply-to is set to the
 * post's assignee so a quick reply reaches the producer.
 */
export async function notifyContentNeedsApproval(post: ContentPost): Promise<void> {
  try {
    if (CONTENT_REVIEW_NOTIFY_TO.length === 0) return

    const title = post.title?.trim() || "Untitled post"
    const assigneeEmail = resolveAssigneeEmail(post.user)
    const openUrl = `${appBaseUrl()}/admin/content?openContent=${encodeURIComponent(post.id)}`
    const subject = `Needs approval — ${title}`

    const rows: Array<[string, string]> = [
      ["Title", title],
      ["Assignee", post.user || "—"],
      ["Brand", post.platform || "—"],
      ["Platforms", platformLabels(post)],
      ["Scheduled", scheduledLabel(post)],
    ]

    const text = [
      `A content post is ready for your review.`,
      "",
      ...rows.map(([k, v]) => `${k}: ${v}`),
      ...(post.social_copy?.trim() ? ["", "Copy:", post.social_copy.trim()] : []),
      "",
      `Review it: ${openUrl}`,
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

    const copyHtml = post.social_copy?.trim()
      ? `
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#737373;margin:20px 0 6px;">Copy</p>
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.55;color:#171717;">${escapeHtml(post.social_copy.trim()).replace(/\n/g, "<br/>")}</div>`
      : ""

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#171717;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#737373;margin:0 0 4px;">434 Media · Content</p>
  <h1 style="font-size:20px;font-weight:800;margin:0 0 16px;">Ready for review</h1>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
    ${rowsHtml}
  </table>
  ${copyHtml}
  <div style="margin:24px 0 8px;">
    <a href="${openUrl}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px;">Review &amp; approve &rarr;</a>
  </div>
  ${assigneeEmail ? `<p style="font-size:12px;color:#a3a3a3;margin:12px 0 0;line-height:1.5;">Replying to this email reaches ${escapeHtml(assigneeEmail)} (the assignee) directly.</p>` : ""}
</div>`

    const replyTo = assigneeEmail && EMAIL_RE.test(assigneeEmail) ? assigneeEmail : undefined

    const { error } = await getResend().emails.send({
      from: DEFAULT_FROM,
      to: CONTENT_REVIEW_NOTIFY_TO,
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
      html,
    })
    if (error) {
      console.error("[notifyContentNeedsApproval] Resend returned an error:", error)
    }
  } catch (err) {
    console.error("[notifyContentNeedsApproval] failed (non-fatal):", err)
  }
}

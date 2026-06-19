import { getResend, DEFAULT_FROM } from "@/lib/resend"
import { SQUAD_LABELS } from "@/components/crm/types"
import type { Cohort, CohortTask } from "@/types/crm-types"

// Who hears about shipped deliverables. Defaults to the two owners; override via
// env (comma-separated) without a redeploy.
const NOTIFY_TO = (process.env.COHORT_NOTIFY_TO || "jesse@434media.com,marcos@434media.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://434media.com"
}

/**
 * Fire an internal email when a STARRED deliverable is marked Done on a cohort
 * board — the "Ship & Show" signal. Best-effort and self-contained: never throws,
 * so a Resend hiccup can't break the task update that triggered it.
 */
export async function notifyCohortDeliverableShipped(
  task: CohortTask,
  cohort: Cohort | null,
  actor: { name?: string; email: string },
): Promise<void> {
  try {
    const squad = SQUAD_LABELS[task.squad] ?? task.squad
    const who = actor.name || actor.email
    const cohortName = cohort?.name ?? "a cohort"
    const boardUrl = `${appBaseUrl()}/admin/cohorts/${task.cohortId}`
    const subject = `✅ Deliverable shipped — ${squad}: ${task.title}`

    const text = [
      `${squad} marked a Week-${task.week ?? "?"} deliverable as Done on ${cohortName}.`,
      "",
      `Deliverable: ${task.title}`,
      `Marked by: ${who}`,
      "",
      `Open the board: ${boardUrl}`,
    ].join("\n")

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#171717;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#737373;margin:0 0 4px;">Digital Canvas · ${escapeHtml(cohortName)}</p>
  <h1 style="font-size:20px;font-weight:800;margin:0 0 12px;">Deliverable shipped 🚀</h1>
  <p style="font-size:14px;line-height:1.6;color:#171717;margin:0 0 16px;">
    <strong>${escapeHtml(squad)}</strong> marked a Week-${task.week ?? "?"} deliverable as <strong>Done</strong>.
  </p>
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;font-size:14px;color:#171717;">
    ${escapeHtml(task.title)}
  </div>
  <p style="font-size:12px;color:#737373;margin:12px 0 20px;">Marked by ${escapeHtml(who)}.</p>
  <a href="${boardUrl}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px;">Open the board &rarr;</a>
</div>`

    const { error } = await getResend().emails.send({
      from: DEFAULT_FROM,
      to: NOTIFY_TO,
      subject,
      text,
      html,
    })
    if (error) console.error("[notifyCohortDeliverableShipped] Resend error:", error)
  } catch (err) {
    console.error("[notifyCohortDeliverableShipped] failed (non-fatal):", err)
  }
}

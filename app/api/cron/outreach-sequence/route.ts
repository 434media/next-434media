import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getActiveSequenceLeads } from "@/lib/firestore-leads"
import { runSequenceStep } from "@/lib/outreach-sequence"
import { getResend, DEFAULT_FROM, assertVerifiedSender } from "@/lib/resend"

export const runtime = "nodejs"
export const maxDuration = 120

// Partial, failed and stale runs are emailed here (founder decision,
// 2026-10-07). Lead IDs only — never an address.
const ALERT_RECIPIENT = process.env.CRON_ALERT_RECIPIENT || "marcos@434media.com"

// Resend errors can quote the recipient; the alert and the run record carry
// lead IDs, so strip anything shaped like an address from error text.
const scrubEmails = (s: string) => s.replace(/[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g, "[address]")

// GET /api/cron/outreach-sequence — auto-sends the next due step of every active
// 3-email sequence. Stop conditions + consent are re-checked per lead inside
// runSequenceStep, and every send is claimed in a transaction first, so a step
// is sent at most once however runs overlap (lib/outreach-claim.ts). Reads only
// leads whose sequence is active, then compares the full `next_send_at` (works
// for both business-day dates and QA test mode's minute timestamps).
export async function GET(req: NextRequest) {
  return runCronJob("outreach-sequence", req, async () => {
    const nowIso = new Date().toISOString()
    const { leads, read } = await getActiveSequenceLeads()
    const due = leads.filter((l) => {
      const seq = l.outreach_sequence
      return !!seq && seq.status === "active" && seq.next_step != null && !!seq.next_send_at && seq.next_send_at <= nowIso
    })

    const sent: string[] = []
    const completed: string[] = []
    const stopped: string[] = []
    const claimedElsewhere: string[] = []
    const stale: { lead: string; step?: number; claimed_at?: string }[] = []
    const failed: { lead: string; error: string }[] = []
    for (const lead of due) {
      try {
        const r = await runSequenceStep(lead)
        if (r.action === "sent") sent.push(lead.id)
        else if (r.action === "completed") completed.push(lead.id)
        else if (r.action === "stopped") stopped.push(lead.id)
        else if (r.action === "stale") stale.push({ lead: lead.id, step: r.step, claimed_at: r.staleClaim?.claimed_at })
        else if (r.action === "skipped" && r.skipReason === "claimed") claimedElsewhere.push(lead.id)
      } catch (err) {
        const error = scrubEmails(err instanceof Error ? err.message : String(err))
        failed.push({ lead: lead.id, error })
        console.error(`[cron:outreach-sequence] step failed for ${lead.id}: ${error}`)
      }
    }

    // success: nothing failed, nothing stale. error: every due send failed.
    // partial: anything in between.
    const delivered = sent.length + completed.length
    const status: "success" | "partial" | "error" =
      failed.length === 0 && stale.length === 0
        ? "success"
        : failed.length > 0 && failed.length === due.length
          ? "error"
          : "partial"

    const message = `Outreach sequence: ${delivered} sent · ${completed.length} completed · ${stopped.length} stopped · ${failed.length} failed · ${stale.length} stale · ${claimedElsewhere.length} claimed elsewhere (${due.length} due, ${read} read)`
    const detail: Record<string, unknown> = {
      read,
      due: due.length,
      sent,
      completed,
      stopped,
      failed,
      stale,
      claimedElsewhere,
    }

    if (status !== "success") {
      detail.alert = await sendAlert(status, message, failed, stale).catch((err) => {
        console.error("[cron:outreach-sequence] alert email failed:", err)
        return `failed: ${scrubEmails(err instanceof Error ? err.message : String(err))}`
      })
    }

    return { message, detail, status }
  })
}

async function sendAlert(
  status: "partial" | "error",
  message: string,
  failed: { lead: string; error: string }[],
  stale: { lead: string; step?: number; claimed_at?: string }[],
): Promise<string> {
  const from = process.env.CRON_ALERT_FROM || DEFAULT_FROM
  assertVerifiedSender(from)
  const lines = [
    `The outreach sequence cron finished with status: ${status}.`,
    "",
    message,
    "",
    ...(failed.length
      ? ["Failed sends (retried on the next run, with the same idempotency key):", ...failed.map((f) => `  lead ${f.lead}: ${f.error}`), ""]
      : []),
    ...(stale.length
      ? [
          "Paused for review — a step was claimed and never confirmed, so it may already have been sent. Check the Resend log for the lead before resuming its sequence:",
          ...stale.map((s) => `  lead ${s.lead}: step ${s.step ?? "?"}, claimed ${s.claimed_at ?? "?"}`),
          "",
        ]
      : []),
    "Run details are in the cron_runs collection (job: outreach-sequence).",
  ]
  const { data, error } = await getResend().emails.send({
    from,
    to: ALERT_RECIPIENT,
    subject: `Outreach cron ${status}: ${failed.length} failed, ${stale.length} stale`,
    text: lines.join("\n"),
  })
  if (error || !data?.id) throw new Error(error?.message ?? "Resend returned no email id")
  return `sent ${data.id}`
}

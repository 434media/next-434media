import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getLeads } from "@/lib/firestore-leads"
import { runSequenceStep } from "@/lib/outreach-sequence"

export const runtime = "nodejs"
export const maxDuration = 120

// GET /api/cron/outreach-sequence — auto-sends the next due step of every active
// 3-email sequence. Stop conditions + consent are re-checked per lead inside
// runSequenceStep, so a send never reaches an opted-out or out-of-funnel lead.
// Compares the full `next_send_at` (works for both business-day dates and the
// minute-precision timestamps of QA test mode — see SEQUENCE_STEP_GAP_MINUTES).
export async function GET(req: NextRequest) {
  return runCronJob("outreach-sequence", req, async () => {
    const nowIso = new Date().toISOString()
    const leads = await getLeads()
    const due = leads.filter((l) => {
      const seq = l.outreach_sequence
      return (
        !!seq &&
        seq.status === "active" &&
        seq.next_step != null &&
        !!seq.next_send_at &&
        seq.next_send_at <= nowIso
      )
    })

    let sent = 0
    let completed = 0
    let stopped = 0
    let failed = 0
    for (const lead of due) {
      try {
        const r = await runSequenceStep(lead)
        if (r.action === "sent") sent++
        else if (r.action === "completed") completed++
        else if (r.action === "stopped") stopped++
      } catch (err) {
        failed++
        console.error(`[cron:outreach-sequence] step failed for ${lead.id}:`, err)
      }
    }

    return {
      message: `Outreach sequence: ${sent} sent · ${completed} completed · ${stopped} stopped · ${failed} failed (${due.length} due)`,
      detail: { due: due.length, sent, completed, stopped, failed },
    }
  })
}

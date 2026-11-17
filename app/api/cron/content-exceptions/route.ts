import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getDb } from "@/lib/firebase-admin"
import { getContentPosts } from "@/lib/firestore-crm"
import { getResend, DEFAULT_FROM, assertVerifiedSender } from "@/lib/resend"
import { founderEmails } from "@/lib/founder-guard"
import { chicagoDay, contentExceptions, exceptionsText } from "@/lib/content-exceptions"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * GET /api/cron/content-exceptions — the end-of-day content exceptions report (434 build sequence V1 item 0, founder
 * 2026-11-17). At 4 pm Central (22:00 UTC; 5 pm in daylight time), before the day ends: every approved or scheduled post whose day to post has passed but is not confirmed
 * Posted, grouped by the person assigned, and one email to each of them. Nothing when there is nothing. A post whose
 * assignee is not an active team member with an address goes to the founder instead. Reads and reports; changes no post.
 */
export async function GET(request: NextRequest) {
  return runCronJob("content-exceptions", request, async () => {
    const sender = DEFAULT_FROM
    assertVerifiedSender(sender)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.434media.com"
    const today = chicagoDay(Date.now())

    const groups = contentExceptions(await getContentPosts(), today)
    if (groups.length === 0) return { message: "No unconfirmed posts — nothing sent", detail: { today, owners: 0 } }

    const team = await getDb().collection("crm_team_members").get()
    const emailByName = new Map<string, string>()
    for (const d of team.docs) {
      const m = d.data() as { name?: string; email?: string; isActive?: boolean }
      if (m.isActive !== false && m.name && m.email) emailByName.set(m.name.trim().toLowerCase(), m.email.trim().toLowerCase())
    }
    const founder = founderEmails()[0]

    const sent: string[] = []
    const failed: string[] = []
    for (const g of groups) {
      const to = emailByName.get(g.owner.toLowerCase()) ?? founder
      if (!to) {
        failed.push(`${g.owner || "(unassigned)"}: no address`)
        continue
      }
      const unassigned = !emailByName.has(g.owner.toLowerCase())
      const count = g.posts.length
      const { error } = await getResend().emails.send({
        from: sender,
        to,
        subject: `${count} post${count === 1 ? "" : "s"} to confirm as Posted${unassigned ? ` (assigned to ${g.owner || "no one"})` : ""}`,
        text: exceptionsText(g, baseUrl),
      })
      if (error) failed.push(`${g.owner || "(unassigned)"}: ${error.message}`)
      else sent.push(`${g.owner || "(unassigned)"} (${count})`)
    }
    return {
      message: `Sent ${sent.length} report${sent.length === 1 ? "" : "s"}${failed.length ? `, ${failed.length} failed` : ""}`,
      detail: { today, sent, failed },
      status: failed.length ? (sent.length ? "partial" : "error") : "success",
    }
  })
}

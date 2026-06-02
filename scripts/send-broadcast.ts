/**
 * Lead with Ops invite broadcast → opted-in 434-network across the 5 audiences.
 *
 * DRY-RUN BY DEFAULT (builds + counts, sends nothing). Pass --apply to send.
 *   npx tsx --env-file=.env.local scripts/send-broadcast.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/send-broadcast.ts --apply  # live
 *
 * Requires UNSUBSCRIBE_SECRET (signs the unsubscribe links). The same value must
 * be set in Vercel and the app deployed, or the unsubscribe links won't verify.
 */
import { gatherBroadcastRecipients } from "../lib/broadcast-recipients"
import { sendBroadcast } from "../lib/broadcast-send"
import { RESEND_DOMAIN } from "../lib/resend"

const APPLY = process.argv.includes("--apply")
const SELECTED = ["aim-newsletter", "aim-2026", "sa-tech-day-2026", "nucleate-tx-sxsw", "rise-of-a-champion"]

const FROM = `Digital Canvas | 434 Media <vip@${RESEND_DOMAIN}>`
const REPLY_TO = "VIP@434media.com"
const SUBJECT = "Limited Seating: Lead with Ops. Layer in AI. featuring Adam Carroll | June 18"
const REGISTRATION_URL = "https://www.digitalcanvas.community/workshops/lead-with-ops"

async function main() {
  const { recipients, stats } = await gatherBroadcastRecipients(SELECTED)
  console.log(`\n${APPLY ? "🔴 LIVE SEND" : "🟢 DRY-RUN"} — ${stats.finalCount} recipients`)
  console.log(`Per audience: ${JSON.stringify(stats.perAudience)}`)
  console.log(`Excluded: ${stats.excludedUnsubscribed} unsubscribed, ${stats.excludedSuppressed} suppressed`)
  console.log(`With first name: ${recipients.filter((r) => r.firstName).length}/${recipients.length}\n`)

  const result = await sendBroadcast({
    recipients,
    subject: SUBJECT,
    from: FROM,
    replyTo: REPLY_TO,
    registrationUrl: REGISTRATION_URL,
    dryRun: !APPLY,
    label: "lead-with-ops-invite",
  })

  console.log(JSON.stringify(result, null, 1))
  if (!APPLY) {
    console.log(`\n🟢 Dry-run — ${result.attempted} payloads built across ${result.batches} batches, nothing sent. Re-run with --apply.\n`)
  } else {
    console.log(`\n✅ Sent ${result.sent}/${result.attempted} (${result.failed} failed) — broadcast ${result.broadcastId}\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

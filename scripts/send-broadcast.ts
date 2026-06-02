/**
 * Lead with Ops invite broadcast → opted-in 434-network.
 *
 * DRY-RUN BY DEFAULT (builds + counts, sends nothing). Pass --apply to send.
 *   npx tsx --env-file=.env.local scripts/send-broadcast.ts
 *   npx tsx --env-file=.env.local scripts/send-broadcast.ts --audiences=sa-tech-day-2026 --apply
 *
 * Campaign-deduped: every send records recipients to the `broadcast_sends`
 * ledger and excludes anyone already sent this campaign — so overlapping
 * audiences across multiple sends never double-email a person.
 *
 * Requires UNSUBSCRIBE_SECRET (signs unsubscribe links; must match Vercel).
 */
import { gatherBroadcastRecipients } from "../lib/broadcast-recipients"
import { sendBroadcast } from "../lib/broadcast-send"
import { getSentEmails, recordSent } from "../lib/broadcast-ledger"
import { RESEND_DOMAIN } from "../lib/resend"

const APPLY = process.argv.includes("--apply")
const audiencesArg = process.argv.find((a) => a.startsWith("--audiences="))
const SELECTED = audiencesArg
  ? audiencesArg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean)
  : ["aim-newsletter", "aim-2026", "sa-tech-day-2026", "nucleate-tx-sxsw", "rise-of-a-champion"]

const CAMPAIGN = "lead-with-ops-invite"
const FROM = `Digital Canvas | 434 Media <vip@${RESEND_DOMAIN}>`
const REPLY_TO = "VIP@434media.com"
const SUBJECT = "Limited Seating: Lead with Ops. Layer in AI. featuring Adam Carroll | June 18"
const REGISTRATION_URL = "https://www.digitalcanvas.community/workshops/lead-with-ops"

async function main() {
  const { recipients, stats } = await gatherBroadcastRecipients(SELECTED)

  // Exclude anyone already sent this campaign (dedup across sends).
  const alreadySent = await getSentEmails(CAMPAIGN)
  const fresh = recipients.filter((r) => !alreadySent.has(r.email.toLowerCase()))
  const excludedAlreadySent = recipients.length - fresh.length

  console.log(`\n${APPLY ? "🔴 LIVE SEND" : "🟢 DRY-RUN"} — audiences: ${SELECTED.join(", ")}`)
  console.log(`Per audience: ${JSON.stringify(stats.perAudience)}`)
  console.log(`Matched opted-in: ${recipients.length} | already sent (excluded): ${excludedAlreadySent}`)
  console.log(`>>> NEW recipients this send: ${fresh.length} <<<`)
  console.log(`With first name: ${fresh.filter((r) => r.firstName).length}/${fresh.length}\n`)

  const result = await sendBroadcast({
    recipients: fresh,
    subject: SUBJECT,
    from: FROM,
    replyTo: REPLY_TO,
    registrationUrl: REGISTRATION_URL,
    dryRun: !APPLY,
    label: CAMPAIGN,
  })

  console.log(JSON.stringify(result, null, 1))

  if (APPLY && result.sentEmails.length > 0) {
    // Record ONLY the emails that actually sent (not failures), so failures
    // can be retried on a re-run.
    await recordSent(CAMPAIGN, result.sentEmails, result.broadcastId!)
    console.log(`\n✅ Sent ${result.sent}/${result.attempted} (invalid ${result.invalid}, failed ${result.failed}) — recorded ${result.sentEmails.length} to ledger. Broadcast ${result.broadcastId}\n`)
  } else if (!APPLY) {
    console.log(`\n🟢 Dry-run — ${fresh.length} would send, nothing sent. Re-run with --apply.\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

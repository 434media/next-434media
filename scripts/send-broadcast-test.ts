/**
 * Phase 1 test send — renders the Lead with Ops invite and sends ONE email to
 * jesse@434media.com so the real render/deliverability can be eyeballed before
 * any broadcast. No recipient gathering, no suppression writes, no volume.
 *
 *   npx tsx --env-file=.env.local scripts/send-broadcast-test.ts
 */
import { getResend, RESEND_DOMAIN, assertVerifiedSender } from "../lib/resend"
import { inviteEmailHtml } from "../lib/email-templates/lead-with-ops"

const TO = "jesse@434media.com"
const FROM = `Digital Canvas | 434 Media <vip@${RESEND_DOMAIN}>`
const REPLY_TO = "VIP@434media.com"
const REGISTRATION_URL = "https://www.digitalcanvas.community/workshops/lead-with-ops"
// Placeholder for the test only — the real broadcast generates a signed,
// per-recipient unsubscribe URL.
const UNSUBSCRIBE_URL = "https://434media.com/unsubscribe?test=1"

async function main() {
  assertVerifiedSender(FROM)

  const html = inviteEmailHtml({
    firstName: "Jesse",
    registrationUrl: REGISTRATION_URL,
    unsubscribeUrl: UNSUBSCRIBE_URL,
  })

  const { data, error } = await getResend().emails.send({
    from: FROM,
    to: TO,
    replyTo: REPLY_TO,
    subject: "[TEST] Limited Seating: Lead with Ops. Layer in AI. featuring Adam Carroll | June 18",
    html,
    headers: {
      "List-Unsubscribe": `<${UNSUBSCRIBE_URL}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  })

  if (error) {
    console.error("✗ Test send failed:", error)
    process.exit(1)
  }
  console.log(`✅ Test sent to ${TO} — Resend id: ${data?.id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

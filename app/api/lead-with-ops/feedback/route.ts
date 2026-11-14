import { after } from "next/server"
import { getNamedDb, NAMED_DATABASES } from "@/lib/firebase-admin"
import { requireHumanRequest } from "@/lib/botid-guard"
import { assertVerifiedSender, getResend } from "@/lib/resend"
import { FEEDBACK_COLLECTION } from "@/lib/lead-with-ops-feedback"
import { handleFeedbackPost } from "@/lib/lead-with-ops-feedback-handler"
import { CALL_REQUEST_ROUTE_ID, resolveCallRequestRecipients } from "@/lib/lead-with-ops-call-request"
import { getNotificationRoute } from "@/lib/firestore-notification-routes"
import { recordMessage } from "@/lib/core-model/messages-server"
import { callRequestRecord } from "@/lib/core-model/message-paths"

/**
 * Post-event feedback intake for the Lead with Ops. Layer in AI. lunch. The
 * validation, the Firestore write and the call-request email are in
 * lib/lead-with-ops-feedback-handler.ts; this file supplies the real BotID
 * check, the `digitalcanvas` database and Resend.
 *
 * The call-request email goes to a partner, so only the production deployment
 * sends it. A preview or local submission logs what it would have sent.
 */
export async function POST(request: Request) {
  return handleFeedbackPost(request, {
    requireHuman: requireHumanRequest,
    saveRow: async (row) => {
      await getNamedDb(NAMED_DATABASES.DIGITALCANVAS).collection(FEEDBACK_COLLECTION).add(row)
    },
    callRequestRecipients: async () => resolveCallRequestRecipients(await getNotificationRoute(CALL_REQUEST_ROUTE_ID)),
    sendCallRequest: async (message) => {
      if (process.env.VERCEL_ENV !== "production") {
        console.log(
          `[lead-with-ops] not production; call request email not sent (to ${message.to.join(", ")}, cc ${message.cc.join(", ")}): ${message.subject}`,
        )
        return
      }
      assertVerifiedSender(message.from)
      const { data, error } = await getResend().emails.send(message)
      if (error) throw new Error(error.message ?? JSON.stringify(error))
      // The CRM keeps the full text (V1 item 4): the call request goes to a partner outside 434.
      if (data?.id) await recordMessage(callRequestRecord({ ...message, messageId: data.id, at: new Date().toISOString() }))
    },
    afterResponse: (task) => after(task),
  })
}

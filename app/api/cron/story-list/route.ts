import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getResend, DEFAULT_FROM, assertVerifiedSender } from "@/lib/resend"
import { chicagoDay } from "@/lib/content-exceptions"

export const runtime = "nodejs"
export const maxDuration = 300
/** Research and photo checks stop starting new work after this, leaving time to send. */
const BUILD_BUDGET_MS = 200_000
const BRAND_ID = "milcity"
/** Staff only: the list goes to the producer's 434 address (STORY_LIST_TO overrides it, comma-separated). */
const DEFAULT_TO = "audrey@434media.com"
/** Where Audrey's replies ("Reply to this email with feedback") go: the founder. */
const REPLY_TO = process.env.STORY_LIST_REPLY_TO || "marcos@434media.com"

/**
 * GET /api/cron/story-list — the morning story list (434 build sequence V1 item 0, founder 2026-11-17). Weekday
 * mornings (12:00 UTC: 6 am Central, 7 am in daylight time) the content engine's existing research job runs under
 * MilCityUSA's published brand profile and one email goes to the producer with 3 to 5 story candidates: each one's
 * source, why it fits and its photo lead. It drafts nothing and changes no job or post. An internal email to staff,
 * so no audience, consent or jurisdiction gate applies; recipients are held to 434 addresses. At most one list a day:
 * a second firing on the same Central day sends nothing. Model calls are recorded against the task
 * `story-list:<day>` and the brand (lib/engine/task-context.ts).
 */
export async function GET(request: NextRequest) {
  return runCronJob("story-list", request, async () => {
    const sender = DEFAULT_FROM
    assertVerifiedSender(sender)
    const to = (process.env.STORY_LIST_TO || DEFAULT_TO).split(",").map(e => e.trim().toLowerCase()).filter(e => e.endsWith("@434media.com"))
    if (!to.length) return { message: "No 434 recipient for the story list", status: "error" as const }
    const today = chicagoDay(Date.now())

    const [{ readPublishedProfile }, { getStoryListSent, saveStoryListSent }] = await Promise.all([import("@/lib/firestore-brand-profiles"), import("@/lib/firestore-content-pipeline")])
    const sent = await getStoryListSent(BRAND_ID)
    if (sent.lastDay === today) return { message: `Already sent for ${today}`, detail: { today } }
    const r = await readPublishedProfile(BRAND_ID)
    if ("problems" in r) return { message: `Skipped: no runnable ${BRAND_ID} brand profile: ${r.problems.slice(0, 3).join("; ")}`.slice(0, 500), status: "partial" as const }
    const active = r.active

    const [{ withProfile }, { withTask }, { pipelineDeps }, { buildStoryList, storyListEmail, LIST_MIN }] = await Promise.all([
      import("@/lib/content-pipeline/brand"), import("@/lib/engine/task-context"), import("@/lib/content-pipeline/run"), import("@/lib/content-pipeline/story-list"),
    ])
    const list = await withProfile(active, () => withTask({ task: `story-list:${today}`, kind: "story-list", property: BRAND_ID }, async () =>
      buildStoryList(await pipelineDeps(), { titles: sent.items.map(i => i.title), urls: sent.items.map(i => i.url) }, BUILD_BUDGET_MS)))

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.434media.com"
    const mail = storyListEmail(list, { brand: active.profile.name, day: today, createUrl: `${baseUrl}/admin/content`, versionId: active.versionId })
    // The email says "Reply to this email with feedback": replies go to the founder, not to the sending address.
    const { error } = await getResend().emails.send({ from: sender, to, replyTo: REPLY_TO, subject: mail.subject, text: mail.text, html: mail.html })
    const detail = {
      today, kind: list.kind, profile: active.versionId, stories: list.stories.length,
      photoLeads: list.stories.filter(s => "pageUrl" in s.photo).length, hold: list.hold?.slice(0, 300) ?? null,
      calls: list.calls.length, outputTokens: list.calls.reduce((n, c) => n + (c.outputTokens ?? 0), 0),
    }
    if (error) return { message: `Story list not sent: ${error.message}`, detail, status: "error" as const }
    await saveStoryListSent(BRAND_ID, today, list.stories.map(s => ({ title: s.title, url: s.url })), sent)
    return {
      message: `Sent ${list.stories.length} candidate${list.stories.length === 1 ? "" : "s"}`,
      detail,
      status: list.stories.length >= LIST_MIN ? "success" as const : "partial" as const,
    }
  })
}

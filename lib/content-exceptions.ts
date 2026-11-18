// The end-of-day content exceptions report (434 build sequence V1 item 0, founder 2026-11-17). Pure (no Firestore,
// no email), so it is tested directly (lib/__tests__/content-exceptions.test.ts); the cron route reads and sends.
//
// A post whose day to post has passed but is not confirmed Posted is an exception: it went out and was not recorded,
// or it did not go out. Either way the person producing it hears the same evening, not a week later when the ICYMI
// cannot find it.

import type { ContentPost } from "@/components/crm/types"
import { QUEUES, timeOf } from "@/lib/queue-age"

/** How far back an unconfirmed post is still reported. Older ones are counted, not listed. */
export const EXCEPTIONS_LOOKBACK_DAYS = 14

/**
 * How long a post may wait for approval before it is listed: the founder-review queue's own limit, so the producer hears
 * about a late approval on the same terms the founder's alert uses.
 */
export const APPROVAL_LIMIT_MS = QUEUES.find((q) => q.name === "founder-review")!.limitMs

export interface ExceptionPost { id: string; title: string; dateToPost: string; status: string }
/** A post at needs_approval past APPROVAL_LIMIT_MS; `waitingSince` is the Chicago day of its last update. */
export interface ApprovalPost { id: string; title: string; waitingSince: string }
export interface OwnerExceptions { owner: string; posts: ExceptionPost[]; older: number; approvals: ApprovalPost[] }

/** Today in Chicago as YYYY-MM-DD: the day the team works in. */
export function chicagoDay(nowMs: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(nowMs)
}

function dayMinus(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10)
}

/**
 * Grouped by the person assigned, two kinds: approved or scheduled posts whose day to post is before today, and posts
 * at needs_approval whose last update is more than APPROVAL_LIMIT_MS before `nowMs` (the founder-review queue's rule:
 * archived ones are skipped, and one with no readable updated_at is not aged). Archived posts and pipeline "no new
 * content" cards are left out of the first kind. Newest first within each owner; longest waiting first for approvals.
 */
export function contentExceptions(posts: ContentPost[], today: string, nowMs = Date.now(), lookbackDays = EXCEPTIONS_LOOKBACK_DAYS): OwnerExceptions[] {
  const since = dayMinus(today, lookbackDays)
  const byOwner = new Map<string, OwnerExceptions & { approvalAt: Map<string, number> }>()
  const entryFor = (p: ContentPost) => {
    const owner = (p.user || "").trim()
    const entry = byOwner.get(owner) ?? { owner, posts: [], older: 0, approvals: [], approvalAt: new Map<string, number>() }
    byOwner.set(owner, entry)
    return entry
  }
  for (const p of posts) {
    if (p.archived) continue
    if (p.status === "needs_approval") {
      const at = timeOf(p.updated_at)
      if (at === null || nowMs - at <= APPROVAL_LIMIT_MS) continue
      const entry = entryFor(p)
      entry.approvals.push({ id: p.id, title: p.title || "(untitled)", waitingSince: chicagoDay(at) })
      entry.approvalAt.set(p.id, at)
      continue
    }
    if (p.pipeline_outcome) continue
    if (p.status !== "approved" && p.status !== "scheduled") continue
    const day = typeof p.date_to_post === "string" ? p.date_to_post.slice(0, 10) : ""
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day >= today) continue
    const entry = entryFor(p)
    if (day < since) entry.older++
    else entry.posts.push({ id: p.id, title: p.title || "(untitled)", dateToPost: day, status: p.status })
  }
  return [...byOwner.values()]
    .filter((e) => e.posts.length > 0 || e.approvals.length > 0)
    .map(({ approvalAt, ...e }) => ({
      ...e,
      posts: e.posts.sort((a, b) => b.dateToPost.localeCompare(a.dateToPost)),
      approvals: e.approvals.sort((a, b) => approvalAt.get(a.id)! - approvalAt.get(b.id)!),
    }))
}

/** The subject for one person's message; `unassigned` when it goes to the founder in place of the assignee. */
export function exceptionsSubject(e: OwnerExceptions, unassigned = false): string {
  const n = e.posts.length
  const a = e.approvals.length
  const confirm = `${n} post${n === 1 ? "" : "s"} to confirm as Posted`
  const waiting = `${a} post${a === 1 ? "" : "s"} waiting for approval over a day`
  const subject = n && a ? `${confirm}, ${a} waiting for approval over a day` : n ? confirm : waiting
  return `${subject}${unassigned ? ` (assigned to ${e.owner || "no one"})` : ""}`
}

/** The message for one person: plain text, with a link to open each post. */
export function exceptionsText(e: OwnerExceptions, baseUrl: string): string {
  const first = e.owner.split(/\s+/)[0] || "there"
  const link = (id: string) => `${baseUrl}/admin/content?openContent=${encodeURIComponent(id)}`
  const confirm = e.posts.length
    ? [
        "",
        `${e.posts.length === 1 ? "This post's" : "These posts'"} day to post has passed, but ${e.posts.length === 1 ? "it isn't" : "they aren't"} confirmed Posted in the content tool:`,
        "",
        ...e.posts.map((p) => `- ${p.title} (due ${p.dateToPost}, still ${p.status}): ${link(p.id)}`),
        "",
        "If it went live, confirm it Posted today so it counts in the right week (the ICYMI reads that date). If it didn't go out, move its date or send it back.",
        ...(e.older ? ["", `${e.older} older ${e.older === 1 ? "post is" : "posts are"} also unconfirmed and not listed.`] : []),
      ]
    : []
  const approvals = e.approvals.length
    ? [
        "",
        "Waiting for approval for over a day:",
        "",
        ...e.approvals.map((p) => `- ${p.title} (waiting since ${p.waitingSince}): ${link(p.id)}`),
      ]
    : []
  return [`Hi ${first},`, ...confirm, ...approvals, "", "Sent each evening, only when something needs your attention."].join("\n")
}

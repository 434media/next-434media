// The end-of-day content exceptions report (434 build sequence V1 item 0, founder 2026-11-17). Pure (no Firestore,
// no email), so it is tested directly (lib/__tests__/content-exceptions.test.ts); the cron route reads and sends.
//
// A post whose day to post has passed but is not confirmed Posted is an exception: it went out and was not recorded,
// or it did not go out. Either way the person producing it hears the same evening, not a week later when the ICYMI
// cannot find it.

import type { ContentPost } from "@/components/crm/types"

/** How far back an unconfirmed post is still reported. Older ones are counted, not listed. */
export const EXCEPTIONS_LOOKBACK_DAYS = 14

export interface ExceptionPost { id: string; title: string; dateToPost: string; status: string }
export interface OwnerExceptions { owner: string; posts: ExceptionPost[]; older: number }

/** Today in Chicago as YYYY-MM-DD: the day the team works in. */
export function chicagoDay(nowMs: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(nowMs)
}

function dayMinus(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10)
}

/**
 * Approved or scheduled posts whose day to post is before today, grouped by the person assigned. Archived posts and
 * pipeline "no new content" cards are left out. Newest first within each owner.
 */
export function contentExceptions(posts: ContentPost[], today: string, lookbackDays = EXCEPTIONS_LOOKBACK_DAYS): OwnerExceptions[] {
  const since = dayMinus(today, lookbackDays)
  const byOwner = new Map<string, OwnerExceptions>()
  for (const p of posts) {
    if (p.archived || p.pipeline_outcome) continue
    if (p.status !== "approved" && p.status !== "scheduled") continue
    const day = typeof p.date_to_post === "string" ? p.date_to_post.slice(0, 10) : ""
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day >= today) continue
    const owner = (p.user || "").trim()
    const entry = byOwner.get(owner) ?? { owner, posts: [], older: 0 }
    if (day < since) entry.older++
    else entry.posts.push({ id: p.id, title: p.title || "(untitled)", dateToPost: day, status: p.status })
    byOwner.set(owner, entry)
  }
  return [...byOwner.values()]
    .filter((e) => e.posts.length > 0)
    .map((e) => ({ ...e, posts: e.posts.sort((a, b) => b.dateToPost.localeCompare(a.dateToPost)) }))
}

/** The message for one person: plain text, with a link to open each post. */
export function exceptionsText(e: OwnerExceptions, baseUrl: string): string {
  const first = e.owner.split(/\s+/)[0] || "there"
  const lines = e.posts.map((p) => `- ${p.title} (due ${p.dateToPost}, still ${p.status}): ${baseUrl}/admin/content?openContent=${encodeURIComponent(p.id)}`)
  return [
    `Hi ${first},`,
    "",
    `${e.posts.length === 1 ? "This post's" : "These posts'"} day to post has passed, but ${e.posts.length === 1 ? "it isn't" : "they aren't"} confirmed Posted in the content tool:`,
    "",
    ...lines,
    "",
    "If it went live, confirm it Posted today so it counts in the right week (the ICYMI reads that date). If it didn't go out, move its date or send it back.",
    ...(e.older ? ["", `${e.older} older ${e.older === 1 ? "post is" : "posts are"} also unconfirmed and not listed.`] : []),
    "",
    "Sent each evening, only when something needs confirming.",
  ].join("\n")
}

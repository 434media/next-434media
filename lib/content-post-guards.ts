import type { ContentPost } from "@/components/crm/types"

/**
 * A content-pipeline "no new content" card (pipeline_outcome) is a notice, never a post: it is closed with "Confirm no
 * new content" and its status never moves (security review, finding 4). The decision route already refuses it; the
 * generic update (PUT /api/admin/crm/content-posts) and "Mark as posted" use this. Saving other fields with the status
 * unchanged stays allowed. Returns the refusal, or null when the change may go ahead.
 */
export function outcomeStatusRefusal(post: Pick<ContentPost, "status" | "pipeline_outcome"> | null, nextStatus: unknown): string | null {
  if (!post?.pipeline_outcome || nextStatus === undefined || nextStatus === post.status) return null
  return "This card records that no new content was found, so its status can't change; close it with Confirm no new content"
}

/**
 * The posted date an admin gives on "Mark as posted" or when correcting it afterwards: a calendar day (YYYY-MM-DD,
 * read as noon UTC so it lands on that day in every US time zone) or a full ISO time. Refused when unreadable, before
 * 2020, or more than a day ahead of now. A post marked late keeps the day it really went out, so the ICYMI counts it
 * in its own week (2026-11-17).
 */
export function postedDateFrom(input: unknown, nowMs = Date.now()): { at: string } | { error: string } {
  if (typeof input !== "string" || !input.trim()) return { error: "posted_at is required" }
  const raw = input.trim()
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? Date.parse(`${raw}T12:00:00.000Z`) : Date.parse(raw)
  if (!Number.isFinite(ms)) return { error: "posted_at is not a date" }
  if (ms < Date.parse("2020-01-01T00:00:00Z")) return { error: "posted_at is before 2020" }
  if (ms > nowMs + 86_400_000) return { error: "posted_at is in the future" }
  return { at: new Date(ms).toISOString() }
}

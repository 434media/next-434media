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

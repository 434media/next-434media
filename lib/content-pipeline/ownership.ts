import type { ContentPost } from "@/components/crm/types"

/**
 * What marks a record as the content pipeline's own (security review, finding 3). The pipeline keys the shared Canva
 * create ledger and content posts' intake.requestId with this prefix and its draft ids (worker.ts's KEY_PREFIX), and
 * draft ids are predictable, so no other caller may use the prefix: the publisher's connector refuses it in create_post
 * and canva_create_design. A post the pipeline creates also carries intake.source = PIPELINE_SOURCE, set only by
 * run.ts, and the pipeline adopts an existing post for its request id only when it carries that marker.
 */
export const PIPELINE_KEY_PREFIX = "admin:"
export const PIPELINE_SOURCE = "content-pipeline"

/** A request id reserved for the pipeline (any case, any leading space). */
export function reservedRequestId(requestId: string): boolean {
  return requestId.trim().toLowerCase().startsWith(PIPELINE_KEY_PREFIX)
}

/** A new post's fields, with intake.source marking it as the pipeline's (run.ts only). */
export function pipelineMarked(post: Omit<ContentPost, "id" | "created_at" | "updated_at">): Omit<ContentPost, "id" | "created_at" | "updated_at"> {
  return { ...post, ...(post.intake ? { intake: { ...post.intake, source: PIPELINE_SOURCE } } : {}) }
}

/** The existing post for a pipeline request id, if the pipeline created it; another caller's post is never adopted. */
export function adoptablePost<T extends Pick<ContentPost, "id" | "intake">>(found: T | null): T | null {
  if (!found) return null
  if (found.intake?.source !== PIPELINE_SOURCE) throw new Error(`Post ${found.id} already holds this draft's request id but was not created by the content pipeline, so it is not adopted`)
  return found
}

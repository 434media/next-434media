import type { ContentPost } from "../components/crm/types"

/**
 * Bounded record lookup for an agent that cannot use the admin UI.
 *
 * Pure matching lives here so it is testable; Firestore access stays in
 * lib/firestore-crm.ts. The dedupe rule is deliberately narrow and explicit:
 * a record is "the same" when it carries the same Canva design id, or when
 * its normalized title matches and it is not already posted/archived. Nothing
 * fuzzy, so Smartie can never be handed a near-miss as a match.
 */
export interface RecordQuery { id?: string; canvaDesignId?: string; title?: string; status?: ContentPost["status"][] }

export function normalizeTitle(value: string): string { return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() }

export function matchContentRecords(posts: ContentPost[], q: RecordQuery): ContentPost[] {
  const title = q.title ? normalizeTitle(q.title) : ""
  return posts.filter(p => {
    if (p.archived) return false
    if (q.id && p.id !== q.id) return false
    if (q.canvaDesignId && p.canva_design_id !== q.canvaDesignId) return false
    if (title && normalizeTitle(p.title || "") !== title) return false
    if (q.status?.length && !q.status.includes(p.status)) return false
    return !!(q.id || q.canvaDesignId || title || q.status?.length)
  })
}

/** The record an agent may reuse for a design: bound by design id first, then an unposted exact-title match. */
export function findReusableRecord(posts: ContentPost[], input: { canvaDesignId: string; title: string }): ContentPost | null {
  const byDesign = matchContentRecords(posts, { canvaDesignId: input.canvaDesignId })
  if (byDesign.length) return byDesign[0]
  const byTitle = matchContentRecords(posts, { title: input.title }).filter(p => p.status !== "posted" && !p.canva_design_id)
  return byTitle[0] ?? null
}

/** Compact, secret-free view for tool results. */
export function summarizeRecord(p: ContentPost) {
  return {
    id: p.id, title: p.title, status: p.status, platform: p.platform || null, social_platforms: p.social_platforms,
    date_to_post: p.date_to_post || null, canva_design_id: p.canva_design_id || null, export_fingerprint: p.export_fingerprint || null,
    assets: p.assets.map(a => ({ url: a.url, kind: a.kind, source: a.source || null, width: a.width ?? null, height: a.height ?? null, sha256: a.sha256 || null, page: a.page ?? null })),
    published_url: p.published_url || null, posted_at: p.posted_at || null,
    owned_meta: p.owned_meta ? { batchId: p.owned_meta.batchId, hash: p.owned_meta.hash, started: p.owned_meta.started, revision: p.owned_meta_revision ?? null } : null,
    approvals: (p.approvals || []).map(a => ({ decision: a.decision, by: a.by_email, at: a.at, manifest_hash: a.manifest_hash || null })),
  }
}

import { gateway } from "@ai-sdk/gateway"
import { createMcuAi } from "./model"
import { PIPELINE_MODELS } from "./models"
import { fetchImage, fetchSourcePage, searchCommons, searchNasa, searchOpenverse } from "./sources"
import { runDue, label, type PostRow, type WorkerDeps } from "./worker"
import type { McuDraft, McuJob } from "./store"

/**
 * Production wiring for the content pipeline worker. The Canva fill, the export staging and the content-post lookup
 * are the publisher connector's own dependencies (lib/owned-meta-execution.ts), called directly here rather than
 * through the pilot's service hop. Writing a draft to the board stages its exports on a new crm_content_posts record
 * in Review; it never prepares, approves or publishes (those need the publisher, production and the approver).
 */
export async function pipelineDeps(): Promise<WorkerDeps> {
  const [{ ownedMetaConnectorDeps }, crm, { firestorePipelineStore, getMcuSeeds, getIcymiWindow }, { attachExports }, { sendDraftsReadyNotification }] = await Promise.all([
    import("@/lib/owned-meta-execution"), import("@/lib/firestore-crm"), import("@/lib/firestore-content-pipeline"), import("@/lib/owned-meta-intake"), import("@/lib/notifications"),
  ])
  const tools = await ownedMetaConnectorDeps()
  const searchTools = { web_search: gateway.tools.parallelSearch({ mode: "agentic", maxResults: 10 }) }
  return {
    store: firestorePipelineStore(),
    ai: onCall => createMcuAi({ models: PIPELINE_MODELS, searchTools, onCall }),
    seeds: getMcuSeeds,
    icymiWindow: getIcymiWindow,
    fetchPage: url => fetchSourcePage(url),
    fetchImage: url => fetchImage(url),
    searchCommons: q => searchCommons(q),
    searchMore: async q => (await Promise.all([searchOpenverse(q).catch(() => []), searchNasa(q).catch(() => [])])).flat(),
    nowMs: Date.now,
    content: {
      // MCU's posts under any of the names they carry (older records are not all tagged "milcity"), as findPosts
      // matches them (title, caption or tags), with when each went out for the ICYMI window. Newest first.
      recentPosts: async () => {
        const mcu = (await tools.intake.listPosts()).filter(p => !p.archived && [p.title, p.social_copy, p.tags, p.platform].some(v => typeof v === "string" && /milcity|\bmcu\b/i.test(v)))
        const when = (p: (typeof mcu)[number]) => p.posted_at || (p.status === "posted" || p.published_url ? p.date_to_post : undefined)
        return mcu.map((p): PostRow => ({ id: p.id, title: p.title, status: p.status, ...(p.published_url ? { publishedUrl: p.published_url } : {}), ...(p.social_copy ? { caption: p.social_copy.slice(0, 800) } : {}), ...(when(p) ? { publishedAt: when(p) } : {}) }))
          .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 75)
      },
      templateFields: templateId => tools.canvaFields(templateId),
      createDesign: async input => {
        const { design } = await tools.canvaCreate(input)
        return { designId: design.designId, editUrl: design.editUrl, viewUrl: design.viewUrl, previewUrls: design.previewUrls }
      },
      writePost: async p => {
        const now = new Date().toISOString()
        // Idempotent on requestId: a resumed step finds the post it already created.
        const post = await tools.intake.findByRequestId(p.requestId) ?? await crm.createContentPost({
          user: p.requestedBy.name, date_created: now.slice(0, 10), platform: p.property, status: "needs_approval", title: p.title,
          notes: p.notes, social_copy: p.caption, links: p.links, assets: [], tags: "milcity", social_platforms: ["instagram", "facebook"],
          intake: { requestId: p.requestId, metaBrand: "milcity", requestedBy: p.requestedBy.email, at: now },
        })
        if (post.assets.length && post.export_fingerprint) return { postId: post.id, holds: [] }
        // Fresh exports in frame order; a single design is bound to the post as its Canva source.
        const single = p.designIds.length === 1
        const items: { url: string; label: string }[] = []
        for (const [i, id] of p.designIds.entries()) {
          const urls = await tools.canvaExport(id)
          if (!urls.length) throw new Error(`Canva returned no export for design ${id}`)
          if (single) urls.forEach((url, n) => items.push({ url, label: `page-${n + 1}` }))
          else items.push({ url: urls[0], label: `frame-${i + 1}` })
        }
        const attached = await attachExports(tools.intake, { postId: post.id, items, randomId: tools.randomId, ...(single ? { canva: { designId: p.designIds[0] } } : {}) })
        return { postId: post.id, holds: attached.holds }
      },
      writeNoContent: async p => {
        const now = new Date().toISOString()
        const existing = await tools.intake.findByRequestId(p.requestId)
        if (existing) return { postId: existing.id }
        // A notice, not a post: no assets, no platforms, no Canva design. pipeline_outcome marks it everywhere.
        const post = await crm.createContentPost({
          user: p.requestedBy.name, date_created: now.slice(0, 10), platform: p.property, status: "needs_approval", title: p.title.slice(0, 200),
          notes: `The content pipeline found no new content for this request, so nothing was drafted. Confirm to close it.\n\nWhy: ${p.reason}`.slice(0, 4000),
          links: p.tried.map(t => t.url), assets: [], tags: "milcity", social_platforms: [],
          intake: { requestId: p.requestId, metaBrand: "milcity", requestedBy: p.requestedBy.email, at: now },
          pipeline_outcome: { kind: "no_new_content", job_id: p.jobId, reason: p.reason, tried: p.tried },
        })
        return { postId: post.id }
      },
    },
    notify: async (job: McuJob, drafts: McuDraft[]) => {
      const ready = drafts.filter(d => d.status === "in_review" && d.postId), held = drafts.filter(d => d.status !== "in_review")
      const kind = label(job.kind)
      // A job that opened no drafts (held at research) still reports back, with its reason.
      const message = drafts.length
        ? `${ready.length} ${kind} draft${ready.length === 1 ? "" : "s"} ready for review${held.length ? ` (${held.length} held or failed: see Generate)` : ""}`
        : `No ${kind} draft: ${(job.note ?? "no qualifying story found").slice(0, 300)}`
      await sendDraftsReadyNotification({ recipients: [job.request.actorEmail], message, postId: ready[0]?.postId ?? job.noContentPostId ?? "", title: ready[0] ? `${ready.length} drafts ready` : drafts.length ? `${kind} drafts` : `No new ${kind} content` })
    },
  }
}

/** Runs due pipeline work for up to budgetMs. */
export async function runPipeline(budgetMs: number): Promise<{ steps: number }> {
  return { steps: await runDue(await pipelineDeps(), budgetMs) }
}

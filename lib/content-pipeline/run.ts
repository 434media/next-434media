import { gateway } from "@ai-sdk/gateway"
import { BRAND, activeProfile, withProfile, type ActiveProfile } from "./brand"
import { DEFAULT_PROPERTY } from "./properties"
import { createMcuAi } from "./model"
import { PIPELINE_MODELS } from "./models"
import { fetchImage, fetchSourcePage, searchCommons, searchDvids, searchNasa, searchOpenverse } from "./sources"
import { runDue, label, type ChoiceTasks, type PostRow, type WorkerDeps } from "./worker"
import type { McuDraft, McuJob } from "./store"
import { adoptablePost, pipelineMarked } from "./ownership"

/** Every post the pipeline writes carries the published profile version it ran under (crm_content_posts). */
export const profileStamp = () => ({ profile_version_id: activeProfile().versionId })

/** The ICYMI choice's CRM task: completed, with what happened in its notes (who chose and when, or why it closed). */
export const choiceTasks: ChoiceTasks = {
  close: async (taskId, note) => {
    const { updateUnifiedTask } = await import("@/lib/firestore-crm")
    await updateUnifiedTask(taskId, { status: "completed", completed_date: new Date().toISOString().slice(0, 10), notes: note })
  },
}

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
    // The same search tool, set to return a page's full extracted text: refused official pages are read through it.
    ai: onCall => createMcuAi({ models: PIPELINE_MODELS, searchTools, readTools: { web_search: gateway.tools.parallelSearch({ mode: "one-shot", maxResults: 5, excerpts: { maxCharsPerResult: 20_000 } }) }, onCall }),
    seeds: getMcuSeeds,
    icymiWindow: getIcymiWindow,
    fetchPage: url => fetchSourcePage(url),
    fetchImage: url => fetchImage(url),
    searchCommons: q => searchCommons(q),
    searchMore: async q => (await Promise.all([searchOpenverse(q).catch(() => []), searchNasa(q).catch(() => [])])).flat(),
    // DVIDS through its API with the public key the founder set in Vercel (DVIDS_API_KEY); without it, not searched.
    ...(process.env.DVIDS_API_KEY ? { searchDvids: (q: string) => searchDvids(q, process.env.DVIDS_API_KEY!) } : {}),
    photoFirst: true,
    nowMs: Date.now,
    content: {
      // The brand's posts under any of the names they carry (older MCU records are not all tagged "milcity"), as
      // findPosts matches them (title, caption or tags), with when each went out for the ICYMI window. Newest first.
      recentPosts: async () => {
        const ours = new RegExp(BRAND.posts.match, "i")
        const mcu = (await tools.intake.listPosts()).filter(p => !p.archived && [p.title, p.social_copy, p.tags, p.platform].some(v => typeof v === "string" && ours.test(v)))
        const when = (p: (typeof mcu)[number]) => p.posted_at || (p.status === "posted" || p.published_url ? p.date_to_post : undefined)
        // card: the post's first staged image, the card as posted, which ICYMI reuses as the story's slide.
        const card = (p: (typeof mcu)[number]) => (Array.isArray(p.assets) ? p.assets : []).find(a => a.kind === "image" && /^https:\/\//.test(a.url))
        return mcu.map((p): PostRow => ({ id: p.id, title: p.title, status: p.status, ...(p.published_url ? { publishedUrl: p.published_url } : {}), ...(p.social_copy ? { caption: p.social_copy.slice(0, 2200) } : {}), ...(when(p) ? { publishedAt: when(p) } : {}), ...(Array.isArray(p.pipeline_media) && p.pipeline_media.length ? { media: p.pipeline_media.slice(0, 6) } : {}), ...(card(p) ? { card: { url: card(p)!.url, ...(card(p)!.sha256 ? { sha256: card(p)!.sha256 } : {}) } } : {}) }))
          .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 75)
      },
      templateFields: templateId => tools.canvaFields(templateId),
      createDesign: async input => {
        const { design } = await tools.canvaCreate(input)
        return { designId: design.designId, editUrl: design.editUrl, viewUrl: design.viewUrl, previewUrls: design.previewUrls }
      },
      writePost: async p => {
        const now = new Date().toISOString()
        // Idempotent on requestId: a resumed step finds the post it already created, and only a post it created.
        const post = adoptablePost(await tools.intake.findByRequestId(p.requestId)) ?? await crm.createContentPost(pipelineMarked({
          user: p.requestedBy.name, date_created: now.slice(0, 10), platform: p.property, status: "needs_approval", title: p.title,
          notes: p.notes, social_copy: p.caption, links: p.links, pipeline_media: p.media, assets: [], tags: BRAND.posts.tag, social_platforms: ["instagram", "facebook"], ...profileStamp(),
          intake: { requestId: p.requestId, metaBrand: BRAND.posts.metaBrand, requestedBy: p.requestedBy.email, at: now },
        }))
        if (post.assets.length && post.export_fingerprint) return { postId: post.id, holds: [] }
        // Fresh exports in frame order; a single design is bound to the post as its Canva source. Slides (an ICYMI
        // roundup's published story cards) follow the exports as they are, so such a post is bound to no one design.
        const slides = p.slides ?? [], single = p.designIds.length === 1 && !slides.length
        const items: { url: string; label: string }[] = []
        for (const [i, id] of p.designIds.entries()) {
          const urls = await tools.canvaExport(id)
          if (!urls.length) throw new Error(`Canva returned no export for design ${id}`)
          if (single) urls.forEach((url, n) => items.push({ url, label: `page-${n + 1}` }))
          else items.push({ url: urls[0], label: `frame-${i + 1}` })
        }
        items.push(...slides)
        const attached = await attachExports(tools.intake, { postId: post.id, items, randomId: tools.randomId, ...(single ? { canva: { designId: p.designIds[0] } } : {}) })
        return { postId: post.id, holds: attached.holds }
      },
      writeNoContent: async p => {
        const now = new Date().toISOString()
        const existing = adoptablePost(await tools.intake.findByRequestId(p.requestId))
        if (existing) return { postId: existing.id }
        // A notice, not a post: no assets, no platforms, no Canva design. pipeline_outcome marks it everywhere.
        const post = await crm.createContentPost(pipelineMarked({
          user: p.requestedBy.name, date_created: now.slice(0, 10), platform: p.property, status: "needs_approval", title: p.title.slice(0, 200),
          notes: `The content pipeline found no new content for this request, so nothing was drafted. Confirm to close it.\n\nWhy: ${p.reason}`.slice(0, 4000),
          links: p.tried.map(t => t.url), assets: [], tags: BRAND.posts.tag, social_platforms: [], ...profileStamp(),
          intake: { requestId: p.requestId, metaBrand: BRAND.posts.metaBrand, requestedBy: p.requestedBy.email, at: now },
          pipeline_outcome: { kind: "no_new_content", job_id: p.jobId, reason: p.reason, tried: p.tried },
        }))
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
    closeChoiceTask: choiceTasks.close,
    // An ICYMI roundup with more stories than it takes: the requester chooses on the draft, in the Admin.
    askChoice: async (job: McuJob, draft: McuDraft) => {
      const [{ postSlackNotice }, { createUnifiedTask }] = await Promise.all([import("@/lib/owned-meta-slack"), import("@/lib/firestore-crm")])
      const path = `/admin/content?icymiDraft=${encodeURIComponent(draft.id)}`, url = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"}${path}`
      const n = draft.story.roundup?.length ?? 0, { min, max } = draft.choice ?? { min: 3, max: 5 }
      const message = `${BRAND.name} ICYMI: ${n} published stories qualify; choose ${min}–${max} for the roundup on ${draft.id}`
      const task = await createUnifiedTask({
        title: `Choose the ICYMI stories (${draft.id})`, description: `${message}.\n\nOpen the draft in the Admin to choose: ${url}`,
        assigned_to: job.request.actorName || "Unassigned", assigned_by: "Content pipeline",
        status: "not_started", priority: "high", due_date: new Date().toISOString().slice(0, 10), web_links: [url], tags: ["content-pipeline", "icymi"],
      }).catch(err => { console.error("[content-pipeline] choice task failed", draft.id, err instanceof Error ? err.message : err); return null })
      await Promise.all([
        postSlackNotice(`${message}: ${url}`, process.env.OWNED_META_SLACK_WEBHOOK_URL),
        sendDraftsReadyNotification({ recipients: [job.request.actorEmail], message, postId: task?.id ?? "", title: `Choose the ICYMI stories`, link: path }),
      ])
      return task ? { taskId: task.id } : {}
    },
  }
}

/**
 * Runs due pipeline work for up to budgetMs, under the brand's published profile: the one the caller already read and
 * checked for this request (Generate passes the version it validated), or else read from the database now (never
 * cached: a Publish governs the next run). Only MilCityUSA runs today; when a second brand does, each job's property
 * chooses its profile. With no valid published profile nothing runs, and the reason is returned rather than thrown,
 * so the minute cron reports a skip, not an error.
 */
export async function runPipeline(budgetMs: number, active?: ActiveProfile): Promise<{ steps: number; profileVersionId: string } | { steps: 0; skipped: string }> {
  if (!active) {
    const { readPublishedProfile } = await import("@/lib/firestore-brand-profiles")
    const r = await readPublishedProfile(DEFAULT_PROPERTY)
    if ("problems" in r) return { steps: 0, skipped: `no runnable ${DEFAULT_PROPERTY} brand profile: ${r.problems.slice(0, 3).join("; ")}` }
    active = r.active
  }
  const run = active
  return withProfile(run, async () => ({ steps: await runDue(await pipelineDeps(), budgetMs), profileVersionId: run.versionId }))
}

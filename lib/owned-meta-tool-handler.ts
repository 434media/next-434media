import { z } from "zod4"
import { META_BRANDS, MetaBlocked, MetaPermissionError, type MetaBatch, type MetaBrand, type MetaDestination, type MetaRecord, type MetaStore } from "./owned-meta-publisher"
import { needsContinuation, noticesFor, parseApprovers, preflightFor, recordExternalPublication, slackApprovalFrom, slackText, summarize, type SlackMessage } from "./owned-meta-tool"
import { assertAttachable, attachExports, createPost, findPosts, type IntakeDeps, type Principal } from "./owned-meta-intake"
import type { PrepareChoices } from "./owned-meta-execution"

/**
 * Operations behind the publisher connector (Smartie, through a ChatGPT MCP connector).
 * The transport authenticates the principal first (lib/owned-meta-oauth.ts). These
 * operations can find/create a content post, attach exports, read, prepare, record a
 * Slack-authored approval, execute and record owner-reported external posts. They cannot
 * approve on the caller's word, reset, release claims, recover a Facebook attempt or
 * bypass any publisher guard. All effects go through injected deps.
 */
export interface ToolDeps {
  env: { OWNED_META_APPROVER_SLACK_IDS?: string }
  store: MetaStore
  intake: IntakeDeps
  brandEnabled(brand: MetaBrand): Promise<boolean>
  prepare(id: string, choices: PrepareChoices): Promise<MetaBatch>
  decide(id: string, revision: number, hash: string, reviewerEmail: string, note: string): Promise<MetaBatch>
  execute(args: { id: string; runId: string; record: MetaRecord; store: MetaStore; trigger: string; only?: MetaDestination[] }): Promise<MetaBatch>
  recordFailure(args: { id: string; runId: string; batchId?: string; brand?: MetaBrand; error: unknown; startedAt: string; run: boolean; trigger: string }): Promise<{ message: string; status: number; detail?: unknown }>
  exclude(id: string, input: { by: string; evidence: string; links: string[] }): Promise<void>
  health(id: string): Promise<unknown>
  readSlackMessage(channel: string, ts: string): Promise<SlackMessage | undefined>
  /** Canva Connect export (JPG, page order). Throws when Canva is not connected. */
  canvaExport(designId: string, pages?: number[]): Promise<string[]>
  randomId(): string
  now(): string
}

const postId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const brandEnum = z.enum(META_BRANDS)
export const toolInput = {
  find_posts: z.object({ query: z.string().min(1).max(200), includeArchived: z.boolean().optional(), limit: z.number().int().min(1).max(25).optional() }),
  create_post: z.object({ requestId: z.string(), title: z.string().max(200), brand: brandEnum, caption: z.string().max(2200), dateToPost: z.string().optional(), notes: z.string().max(4000).optional() }),
  attach_exports: z.object({ postId, items: z.array(z.object({ url: z.string().url().max(2000), label: z.string().max(60).optional() })).min(1).max(10) }),
  attach_canva_design: z.object({ postId, designId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/), pages: z.array(z.number().int().min(1)).min(1).max(10).optional() }),
  status: z.object({ postId }),
  health: z.object({ postId }),
  prepare: z.object({ postId, brand: brandEnum, format: z.enum(["still", "carousel", "video"]),
    captions: z.object({ instagram: z.string().max(2200), facebook: z.string().max(63206) }),
    placements: z.object({ instagram: z.enum(["feed", "reels"]), facebook: z.enum(["feed", "video", "reels"]) }),
    instagramShareToFeed: z.boolean(), aiGenerated: z.boolean(), publicHostingApproved: z.boolean(), templateRevision: z.string().max(200).default("unknown") }),
  approve: z.object({ postId, revision: z.number().int().positive(), hash: z.string().regex(/^[a-f0-9]{64}$/), approval: z.object({ channel: z.string(), ts: z.string() }) }),
  execute: z.object({ postId, batchId: z.string(), hash: z.string() }),
  record_external: z.object({ postId, batchId: z.string(), hash: z.string(), destination: z.enum(["instagram", "facebook"]), permalink: z.string().max(500), remoteId: z.string().max(64).optional(), evidence: z.string().max(2000) }),
  exclude: z.object({ postId, links: z.array(z.string().max(500)).min(1).max(4), evidence: z.string().max(2000) }),
} as const
export type ToolName = keyof typeof toolInput
export type ToolResult = { status: number; body: Record<string, unknown> }

function view(batch: MetaBatch, title: string) {
  const notices = noticesFor(batch.manifest)
  return { ...summarize(batch), preflight: preflightFor(batch.manifest), notices, approvalPhrase: `approve ${batch.hash.slice(0, 12)}`, slackText: slackText(title, batch, notices) }
}

export async function runOwnedMetaTool(name: ToolName, rawInput: unknown, principal: Principal, deps: ToolDeps): Promise<ToolResult> {
  const parsed = toolInput[name]?.safeParse(rawInput)
  if (!parsed?.success) return { status: 400, body: { error: "Invalid request" } }
  const input = parsed.data as Record<string, unknown> & { postId?: string }
  const id = input.postId ?? "", runId = deps.randomId(), startedAt = deps.now()
  let brand: MetaBrand | undefined, batchId: string | undefined
  try {
    switch (name) {
      case "find_posts": { const i = parsed.data as z.infer<typeof toolInput.find_posts>; return { status: 200, body: { posts: await findPosts(deps.intake, i) } } }
      case "create_post": { const i = parsed.data as z.infer<typeof toolInput.create_post>; return { status: 200, body: await createPost(deps.intake, principal, i) } }
      case "attach_exports": { const i = parsed.data as z.infer<typeof toolInput.attach_exports>; return { status: 200, body: { ...await attachExports(deps.intake, { ...i, randomId: deps.randomId }), next: "Prepare a new draft; any earlier unstarted draft for this post was invalidated by the new files." } } }
      case "attach_canva_design": {
        const i = parsed.data as z.infer<typeof toolInput.attach_canva_design>
        await assertAttachable(deps.intake, i.postId) // never start a Canva export for a post that cannot take it
        let urls: string[]
        try { urls = await deps.canvaExport(i.designId, i.pages) } catch (error) { throw new MetaBlocked(error instanceof Error && error.name === "CanvaError" ? error.message : "Canva export failed") }
        const items = urls.map((url, n) => ({ url, label: `page-${i.pages?.[n] ?? n + 1}` }))
        return { status: 200, body: { ...await attachExports(deps.intake, { postId: i.postId, items, randomId: deps.randomId }), canva: { designId: i.designId, pages: items.length }, next: "Prepare a new draft; any earlier unstarted draft for this post was invalidated by the new files." } }
      }
      case "prepare": {
        const i = parsed.data as z.infer<typeof toolInput.prepare>
        brand = i.brand
        const choices: PrepareChoices = { brand: i.brand, format: i.format, captions: i.captions, placements: i.placements, instagramShareToFeed: i.instagramShareToFeed, aiGenerated: i.aiGenerated, publicHostingApproved: i.publicHostingApproved, templateRevision: i.templateRevision }
        return { status: 200, body: view(await deps.prepare(id, choices), "Prepared for approval") }
      }
      case "exclude": {
        const i = parsed.data as z.infer<typeof toolInput.exclude>
        if (i.evidence.trim().length < 20) throw new MetaBlocked("Observation evidence (20–2,000 characters) required")
        const links = i.links.map(l => { let u: URL; try { u = new URL(l) } catch { throw new MetaBlocked("Platform permalinks only") } if (u.protocol !== "https:" || !["instagram.com", "www.instagram.com", "facebook.com", "www.facebook.com"].includes(u.hostname)) throw new MetaBlocked("Platform permalinks only"); u.search = ""; u.hash = ""; return u.toString() })
        await deps.exclude(id, { by: principal.email, evidence: i.evidence.trim(), links })
        return { status: 200, body: { excluded: true, postId: id, links, slackText: `Recorded as published outside the publisher (owner-reported, not API verified). Every publish path is blocked for this post.\n${links.map(l => `• ${l}`).join("\n")}` } }
      }
    }
    const record = await deps.store.read(id)
    brand = record.batch.manifest.brand; batchId = record.batch.id
    if (name === "status") return { status: 200, body: { ...view(record.batch, "Publisher status"), archived: record.archived, excluded: !!record.excluded, claimed: !!record.batch.claim } }
    if (name === "health") return { status: 200, body: { health: await deps.health(id), batch: summarize(record.batch) } }
    if (name === "approve") {
      const i = parsed.data as z.infer<typeof toolInput.approve>
      // Approval comes from the exact Slack message, read server-side; the caller cannot assert it.
      if (i.revision !== record.batch.manifest.revision || i.hash !== record.batch.hash) throw new MetaBlocked("Displayed batch changed; prepare a new approval request")
      if (!await deps.brandEnabled(brand)) throw new MetaBlocked("Publisher disabled")
      const approver = slackApprovalFrom(await deps.readSlackMessage(i.approval.channel, i.approval.ts), parseApprovers(deps.env.OWNED_META_APPROVER_SLACK_IDS), record.batch.hash)
      return { status: 200, body: view(await deps.decide(id, i.revision, i.hash, approver.email, `Approved in Slack ${i.approval.channel}/${i.approval.ts} by ${approver.user}; requested through the connector by ${principal.email}`), "Approved") }
    }
    const i = parsed.data as { batchId: string; hash: string }
    if (i.batchId !== record.batch.id || i.hash !== record.batch.hash) throw new MetaBlocked("Displayed batch changed; reload before acting")
    if (name === "record_external") {
      const r = parsed.data as z.infer<typeof toolInput.record_external>
      await deps.store.update(id, current => {
        if (current.batch.id !== record.batch.id) throw new MetaBlocked("Batch changed")
        recordExternalPublication(current, r.destination, { permalink: r.permalink, remoteId: r.remoteId, actor: principal.email, evidence: r.evidence, at: deps.now() })
        return { next: current, result: null }
      })
      return { status: 200, body: view((await deps.store.read(id)).batch, "Recorded owner-reported publication") }
    }
    // execute: the unchanged state machine; a second request loses the transactional claim.
    if (!await deps.brandEnabled(brand)) throw new MetaBlocked("Publisher disabled")
    return { status: 200, body: view(await deps.execute({ id, runId, record, store: deps.store, trigger: `connector:${principal.email}` }), "Publish run finished") }
  } catch (error) {
    if (!(error instanceof MetaBlocked) && !(error instanceof MetaPermissionError) && !batchId) return { status: 500, body: { error: "Publisher state unavailable" } }
    const failure = await deps.recordFailure({ id, runId, batchId, brand, error, startedAt, run: name === "execute", trigger: `connector:${principal.email}` })
    const saved = batchId ? await deps.store.read(id).catch(() => null) : null
    return { status: failure.status, body: { error: failure.message, ...(saved && saved.batch.id === batchId ? view(saved.batch, "Stopped") : {}), ...(failure.detail ? { providerError: failure.detail } : {}) } }
  }
}

/** Cron continuation: resumes only Meta-processing preparation; never a recorded final intent. */
export async function continueOwnedMeta(deps: Pick<ToolDeps, "store" | "execute" | "recordFailure" | "randomId" | "now"> & { deploymentEnabled(): Promise<boolean>; listIds(): Promise<string[]>; notify(text: string): Promise<unknown> }) {
  if (!await deps.deploymentEnabled()) return { message: "Publisher disabled; nothing resumed", detail: { scanned: 0, resumed: 0 } }
  const ids = await deps.listIds()
  let resumed = 0, failed = 0
  for (const id of ids) {
    let record: MetaRecord
    try { record = await deps.store.read(id) } catch { continue }
    const only = needsContinuation(record)
    if (!only.length) continue
    const runId = deps.randomId(), startedAt = deps.now()
    try {
      const batch = await deps.execute({ id, runId, record, store: deps.store, trigger: "continuation", only })
      resumed++
      const changed = (["instagram", "facebook"] as const).some(d => batch.jobs[d].status !== record.batch.jobs[d].status)
      if (changed) await deps.notify(slackText("Publisher continuation", batch, noticesFor(batch.manifest))).catch(() => {})
    } catch (error) {
      failed++
      const failure = await deps.recordFailure({ id, runId, batchId: record.batch.id, brand: record.batch.manifest.brand, error, startedAt, run: true, trigger: "continuation" })
      await deps.notify(`Publisher continuation stopped for ${id}: ${failure.message}. Inspect saved state; nothing is retried automatically.`).catch(() => {})
      if (error instanceof MetaPermissionError) break // credential failure: stop every brand run this tick
    }
  }
  return { message: `Resumed ${resumed}, stopped ${failed}`, status: failed ? "partial" as const : "success" as const, detail: { scanned: ids.length, resumed, failed } }
}

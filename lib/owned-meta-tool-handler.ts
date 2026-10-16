import { z } from "zod"
import { META_BRANDS, MetaBlocked, MetaPermissionError, type MetaBatch, type MetaBrand, type MetaDestination, type MetaRecord, type MetaStore } from "./owned-meta-publisher"
import { needsContinuation, noticesFor, parseApprovers, preflightFor, recordExternalPublication, slackApprovalFrom, slackText, summarize, toolAuthorized, type SlackMessage } from "./owned-meta-tool"
import type { PrepareChoices } from "./owned-meta-execution"

/**
 * The narrowly authorized machine surface (Slack executor) over the existing publisher.
 * It can read, prepare, record a Slack-authored approval, execute and record owner-reported
 * external posts. It cannot approve on its own word, reset, release claims, recover a
 * Facebook attempt or bypass any publisher guard. All effects go through injected deps.
 */
export interface ToolDeps {
  env: { VERCEL_ENV?: string; OWNED_META_TOOL_SECRET?: string; OWNED_META_APPROVER_SLACK_IDS?: string }
  store: MetaStore
  brandEnabled(brand: MetaBrand): Promise<boolean>
  prepare(id: string, choices: PrepareChoices): Promise<MetaBatch>
  decide(id: string, revision: number, hash: string, reviewerEmail: string, note: string): Promise<MetaBatch>
  execute(args: { id: string; runId: string; record: MetaRecord; store: MetaStore; trigger: string; only?: MetaDestination[] }): Promise<MetaBatch>
  recordFailure(args: { id: string; runId: string; batchId?: string; brand?: MetaBrand; error: unknown; startedAt: string; run: boolean; trigger: string }): Promise<{ message: string; status: number; detail?: unknown }>
  exclude(id: string, input: { by: string; evidence: string; links: string[] }): Promise<void>
  health(id: string): Promise<unknown>
  readSlackMessage(channel: string, ts: string): Promise<SlackMessage | undefined>
  randomId(): string
  now(): string
}

const slackRef = z.object({ channel: z.string(), ts: z.string() })
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), postId: z.string() }),
  z.object({ action: z.literal("health"), postId: z.string() }),
  z.object({ action: z.literal("prepare"), postId: z.string(), brand: z.enum(META_BRANDS), format: z.enum(["still", "carousel", "video"]),
    captions: z.object({ instagram: z.string(), facebook: z.string() }),
    placements: z.object({ instagram: z.enum(["feed", "reels"]), facebook: z.enum(["feed", "video", "reels"]) }),
    instagramShareToFeed: z.boolean(), aiGenerated: z.boolean(), publicHostingApproved: z.boolean(), templateRevision: z.string().max(200).default("unknown") }),
  z.object({ action: z.literal("approve"), postId: z.string(), revision: z.number().int().positive(), hash: z.string().regex(/^[a-f0-9]{64}$/), approval: slackRef }),
  z.object({ action: z.literal("execute"), postId: z.string(), batchId: z.string(), hash: z.string() }),
  z.object({ action: z.literal("record-external"), postId: z.string(), batchId: z.string(), hash: z.string(), destination: z.enum(["instagram", "facebook"]), permalink: z.string().max(500), remoteId: z.string().max(64).optional(), evidence: z.string().max(2000), requestedBy: z.string() }),
  z.object({ action: z.literal("exclude"), postId: z.string(), links: z.array(z.string().max(500)).min(1).max(4), evidence: z.string().max(2000), requestedBy: z.string() }),
])
type Body = z.infer<typeof body>

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "private, no-store" } })

function view(batch: MetaBatch, title: string) {
  const notices = noticesFor(batch.manifest)
  return { ...summarize(batch), preflight: preflightFor(batch.manifest), notices, approvalPhrase: `approve ${batch.hash.slice(0, 12)}`, slackText: slackText(title, batch, notices) }
}

export async function handleOwnedMetaTool(req: Request, deps: ToolDeps): Promise<Response> {
  // Order: environment, then credential, then input. Nothing is read before all three pass.
  if (deps.env.VERCEL_ENV !== "production") return json({ error: "Previews cannot use the publisher tool" }, 423)
  if (!deps.env.OWNED_META_TOOL_SECRET) return json({ error: "Publisher tool is not configured" }, 503)
  if (!toolAuthorized(req.headers.get("authorization"), deps.env.OWNED_META_TOOL_SECRET)) return json({ error: "Unauthorized" }, 401)
  let input: Body
  try { input = body.parse(await req.json()) } catch { return json({ error: "Invalid request" }, 400) }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.postId)) return json({ error: "Invalid post id" }, 400)
  const id = input.postId, runId = deps.randomId(), startedAt = deps.now(), approvers = parseApprovers(deps.env.OWNED_META_APPROVER_SLACK_IDS)
  let brand: MetaBrand | undefined, batchId: string | undefined
  const requester = (user: string) => { const email = approvers.get(user); if (!email) throw new MetaBlocked("Requester is not an authorized approver"); return email }
  try {
    if (input.action === "prepare") {
      brand = input.brand
      const choices: PrepareChoices = { brand: input.brand, format: input.format, captions: input.captions, placements: input.placements, instagramShareToFeed: input.instagramShareToFeed, aiGenerated: input.aiGenerated, publicHostingApproved: input.publicHostingApproved, templateRevision: input.templateRevision }
      return json(view(await deps.prepare(id, choices), "Prepared for approval"))
    }
    if (input.action === "exclude") {
      const by = requester(input.requestedBy)
      if (input.evidence.trim().length < 20) throw new MetaBlocked("Observation evidence (20–2,000 characters) required")
      const links = input.links.map(l => { const u = new URL(l); if (u.protocol !== "https:" || !["instagram.com", "www.instagram.com", "facebook.com", "www.facebook.com"].includes(u.hostname)) throw new MetaBlocked("Platform permalinks only"); u.search = ""; u.hash = ""; return u.toString() })
      await deps.exclude(id, { by, evidence: input.evidence.trim(), links })
      return json({ excluded: true, postId: id, links, slackText: `Recorded as published outside the publisher (owner-reported, not API verified). Every publish path is now blocked for this post.\n${links.map(l => `• ${l}`).join("\n")}` })
    }
    const record = await deps.store.read(id)
    brand = record.batch.manifest.brand; batchId = record.batch.id
    if (input.action === "status") return json({ ...view(record.batch, "Publisher status"), archived: record.archived, excluded: !!record.excluded, claimed: !!record.batch.claim })
    if (input.action === "health") return json({ health: await deps.health(id), batch: summarize(record.batch) })
    if (input.action === "approve") {
      // Approval comes from the exact Slack message, read server-side; the caller cannot assert it.
      if (input.revision !== record.batch.manifest.revision || input.hash !== record.batch.hash) throw new MetaBlocked("Displayed batch changed; prepare a new approval request")
      if (!await deps.brandEnabled(brand)) throw new MetaBlocked("Publisher disabled")
      const approver = slackApprovalFrom(await deps.readSlackMessage(input.approval.channel, input.approval.ts), approvers, record.batch.hash)
      const batch = await deps.decide(id, input.revision, input.hash, approver.email, `Approved in Slack ${input.approval.channel}/${input.approval.ts} by ${approver.user}`)
      return json(view(batch, "Approved"))
    }
    if (input.batchId !== record.batch.id || input.hash !== record.batch.hash) throw new MetaBlocked("Displayed batch changed; reload before acting")
    if (input.action === "record-external") {
      const by = requester(input.requestedBy)
      await deps.store.update(id, r => {
        if (r.batch.id !== record.batch.id) throw new MetaBlocked("Batch changed")
        recordExternalPublication(r, input.destination, { permalink: input.permalink, remoteId: input.remoteId, actor: by, evidence: input.evidence, at: deps.now() })
        return { next: r, result: null }
      })
      return json(view((await deps.store.read(id)).batch, "Recorded owner-reported publication"))
    }
    // execute: the unchanged state machine; a second request loses the transactional claim.
    if (!await deps.brandEnabled(brand)) throw new MetaBlocked("Publisher disabled")
    const batch = await deps.execute({ id, runId, record, store: deps.store, trigger: "slack-tool" })
    return json(view(batch, "Publish run finished"))
  } catch (error) {
    if (!(error instanceof MetaBlocked) && !(error instanceof MetaPermissionError) && !batchId && input.action !== "prepare") return json({ error: "Publisher state unavailable" }, 404)
    const failure = await deps.recordFailure({ id, runId, batchId, brand, error, startedAt, run: input.action === "execute", trigger: "slack-tool" })
    const saved = batchId ? await deps.store.read(id).catch(() => null) : null
    return json({ error: failure.message, ...(saved && saved.batch.id === batchId ? view(saved.batch, "Stopped") : {}), ...(failure.detail ? { providerError: failure.detail } : {}) }, failure.status)
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

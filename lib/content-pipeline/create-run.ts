import { BRAND, activeProfile } from "./brand"
import { SERIES, checkFields, normalizeFields } from "./series"
import { contentPropertyOf } from "./properties"
import { pipelineMarked, adoptablePost, PIPELINE_KEY_PREFIX } from "./ownership"
import { FORMAT_LABEL, createTemplates, designText, exportFileBase, formatsOf, rowProblems, type CreateFormat, type CreateRow, type CreateTemplate } from "./create-table"
import { frozen } from "./row-approval"
import { createHash } from "node:crypto"
import type { ContentPost } from "@/components/crm/types"
import { canvaEditUrl, type CreateInput, type CreatedDesign } from "../canva-create"

/**
 * Run job for one Create row (plan v11 Step 2), inside withProfile() with the brand's published profile read fresh by
 * the route. Each format the row's platforms need gets its brand template filled (the row's text, its photo or video
 * in the template's image field), exported, and staged on its own content post in Review (needs_approval). Nothing is
 * prepared, approved or published. Idempotent on the row id and what the design is made from: the post's intake.requestId
 * is keyed `admin:create:<row>:<format>` (the pipeline's reserved prefix), and the Canva ledger adds a hash of the
 * template, the card text and the media, so a retried run reuses its designs and posts, while a run after the row's
 * text or media changed makes a new design and puts it on the same post (Step 3 part 2: the "TEST" / 0:05 design).
 */
export interface CreateRunDeps {
  templateFields(templateId: string): Promise<Record<string, string>>
  createDesign(input: CreateInput): Promise<CreatedDesign>
  /** JPG pages (feed with a photo) or one MP4 (a video, and every Reels design), as download URLs. */
  exportDesign(designId: string, as: "jpg" | "mp4"): Promise<string[]>
  findByRequestId(requestId: string): Promise<ContentPost | null>
  createPost(post: Omit<ContentPost, "id" | "created_at" | "updated_at">): Promise<ContentPost>
  /** The guarded update: a changed caption, date or platforms sends an approved post back for approval. */
  updatePost(id: string, updates: Partial<ContentPost>): Promise<ContentPost>
  /** `rebind`: the post takes a new design in place of its old one (a re-run after the row changed). */
  attachExports(input: { postId: string; items: { url: string; label: string }[]; canva: { designId: string }; fileBase: string; rebind?: boolean }): Promise<{ holds: string[] }>
  /**
   * Claims the row for one run, atomically (a Firestore transaction): false while another run of it holds an unexpired
   * lease. Two tabs or a double click can't then fill two designs and stage two Review posts, since the Canva ledger
   * and the post lookup are read-then-write.
   */
  claimRow(rowId: string, by: string): Promise<boolean>
  releaseRow(rowId: string): Promise<void>
  now(): string
}
export interface CreatedPost { format: CreateFormat; postId: string; designId: string; editUrl: string; previewUrl?: string; holds: string[]; reused: boolean }
export class CreateRowError extends Error {
  constructor(readonly problems: string[], readonly status: 400 | 409 | 502 = 400) { super(problems.join("; ")) }
}

export const createRequestId = (rowId: string, format: CreateFormat) => `${PIPELINE_KEY_PREFIX}create:${rowId}:${format}`

/** What a design is made from: its template, card text and media. A change makes a new design. */
export function designInputHash(input: { templateId: string; text: Record<string, string>; media?: { kind: string; url: string; bytes?: number } | null }): string {
  const text = Object.fromEntries(Object.entries(input.text).sort(([a], [b]) => a.localeCompare(b)))
  return createHash("sha256").update(JSON.stringify({ t: input.templateId, text, m: input.media ? { k: input.media.kind, u: input.media.url, b: input.media.bytes ?? 0 } : null })).digest("hex").slice(0, 16)
}

/** The row checked against the brand's published profile: the table's own checks, then the template's field limits. */
export function serverRowProblems(row: CreateRow): { template?: CreateTemplate; problems: string[] } {
  const template = createTemplates(activeProfile().profile).find(t => t.kind === row.kind)
  const problems = rowProblems(row, template)
  if (!template || problems.length) return { template, problems }
  const series = SERIES[template.series]
  const values: Record<string, string> = {}
  for (const f of template.fields) values[f.name] = f.role === "headline" ? row.headline : f.role === "subHeadline" ? row.subHeadline : row.fields[f.name] ?? ""
  // The server fills the rest (dates, labels); the person's text is checked as the card will set it (uppercase, lines).
  const written = Object.fromEntries(Object.entries(normalizeFields(series, values)).filter(([k]) => template.fields.some(f => f.name === k)))
  const own = { ...series, fields: series.fields.filter(f => template.fields.some(x => x.name === f.name)) }
  problems.push(...checkFields(own, written))
  if (row.caption.length > 2100) problems.push("Caption is longer than Instagram allows (2,200 characters with credits)")
  if (/@[A-Za-z0-9_.]{2,}/.test(row.caption)) problems.push("Caption contains an @handle; use plain names (account tags are added by hand)")
  return { template, problems }
}

export async function runCreateRow(deps: CreateRunDeps, row: CreateRow, actor: { email: string; name: string }): Promise<{ posts: CreatedPost[]; profileVersionId: string }> {
  const { versionId } = activeProfile()
  const { template, problems } = serverRowProblems(row)
  if (!template || problems.length) throw new CreateRowError(problems)
  if (!await deps.claimRow(row.id, actor.email)) throw new CreateRowError(["This row is already running (another tab or click); wait for it to finish"], 409)
  try { return { posts: await runClaimedRow(deps, row, template, actor, versionId), profileVersionId: versionId } }
  finally { await deps.releaseRow(row.id).catch(err => console.error("[create-run] release failed:", row.id, err)) }
}

async function runClaimedRow(deps: CreateRunDeps, row: CreateRow, template: CreateTemplate, actor: { email: string; name: string }, versionId: string): Promise<CreatedPost[]> {
  const posts: CreatedPost[] = []
  for (const { format, platforms } of formatsOf(row.platforms)) {
    const templateId = template.templates[format]!, postKey = createRequestId(row.id, format)
    const existing = adoptablePost(await deps.findByRequestId(postKey))
    const dataset = await deps.templateFields(templateId)
    const { text, unfilled } = designText(template, row, dataset)
    if (unfilled.length) throw new CreateRowError([`The ${FORMAT_LABEL[format]} template has no place for: ${unfilled.join(", ")}`])
    const mediaField = template.media[format]
    if (mediaField && dataset[mediaField] !== "image") throw new CreateRowError([`The ${FORMAT_LABEL[format]} template has no media field "${mediaField}"`])
    const media = row.media && mediaField ? row.media : null
    const inputHash = designInputHash({ templateId, text, media })
    if (existing?.assets.length && existing.export_fingerprint && existing.canva_design_id && existing.create_input_hash === inputHash) {
      posts.push({ format, postId: existing.id, designId: existing.canva_design_id, editUrl: canvaEditUrl(existing.canva_design_id), previewUrl: existing.assets[0]?.url, holds: [], reused: true })
      continue
    }
    // A post made before designs were hashed that is already out stays as it is: the run reuses it, as it did then.
    if (existing?.canva_design_id && !existing.create_input_hash && frozen(existing)) {
      posts.push({ format, postId: existing.id, designId: existing.canva_design_id, editUrl: canvaEditUrl(existing.canva_design_id), previewUrl: existing.assets[0]?.url, holds: [], reused: true })
      continue
    }
    if (existing && frozen(existing)) throw new CreateRowError([`The ${FORMAT_LABEL[format]} post from this row is already out or publishing; its design can't change. Start a new row.`], 409)
    // The board title leaves the format out (the card shows it); the files carry brand, date and headline.
    const title = `${BRAND.shortName} ${template.label} — ${row.headline.replace(/\s+/g, " ").trim()}`.slice(0, 200)
    const design = await deps.createDesign({
      requestId: `${postKey}:${inputHash}`, templateId, title, text,
      ...(media?.kind === "image" ? { image: { field: mediaField!, url: media.url, name: media.name } } : {}),
      ...(media?.kind === "video" ? { video: { field: mediaField!, url: media.url, name: media.name, bytes: media.bytes ?? 0 } } : {}),
    })
    const asVideo = media?.kind === "video" || format === "reels"
    const urls = asVideo ? await deps.exportDesign(design.designId, "mp4") : design.previewUrls.length ? design.previewUrls : await deps.exportDesign(design.designId, "jpg")
    if (!urls.length) throw new CreateRowError([`Canva returned no export for the ${FORMAT_LABEL[format]} design`], 502)
    const now = deps.now()
    const notes = [`Made in the Create table (${template.label}, ${FORMAT_LABEL[format]}).`, row.referenceLink ? `Reference: ${row.referenceLink}` : "", row.notes.trim() ? `Notes: ${row.notes.trim()}` : ""].filter(Boolean).join("\n").slice(0, 4000)
    const post = existing
      // A re-run after the row changed: the post takes the row's current text with the new design.
      ? await deps.updatePost(existing.id, { title, notes, social_copy: row.caption.trim(), links: row.referenceLink ? [row.referenceLink] : [], social_platforms: platforms, date_to_post: row.date, profile_version_id: versionId })
      : await deps.createPost(pipelineMarked({
        user: actor.name || actor.email, date_created: now.slice(0, 10), platform: contentPropertyOf(BRAND.id), status: "needs_approval", title, notes,
        social_copy: row.caption.trim(), links: row.referenceLink ? [row.referenceLink] : [], assets: [], tags: BRAND.posts.tag,
        social_platforms: platforms, date_to_post: row.date, profile_version_id: versionId,
        ...(row.copyVersionId && row.copyVersionId !== versionId ? { copy_profile_version_id: row.copyVersionId } : {}),
        create_row_id: row.id, create_format: format,
        intake: { requestId: postKey, metaBrand: BRAND.posts.metaBrand, requestedBy: actor.email, at: now },
      } as Omit<ContentPost, "id" | "created_at" | "updated_at">))
    const items = asVideo ? [{ url: urls[0], label: `${format}-video` }] : urls.map((url, n) => ({ url, label: `${format}-page-${n + 1}` }))
    const attached = await deps.attachExports({ postId: post.id, items, canva: { designId: design.designId }, fileBase: exportFileBase(BRAND.id, row.date, row.headline), ...(existing ? { rebind: true } : {}) })
    await deps.updatePost(post.id, { create_input_hash: inputHash })
    posts.push({ format, postId: post.id, designId: design.designId, editUrl: canvaEditUrl(design.designId), previewUrl: design.previewUrls[0], holds: [...attached.holds, ...(design.folderProblem ? [design.folderProblem] : [])], reused: false })
  }
  return posts
}

/** Production wiring: the publisher connector's Canva fill, export staging and post lookup (as run.ts uses them). */
export async function createRunDeps(): Promise<CreateRunDeps> {
  const [{ ownedMetaConnectorDeps, canvaDeps }, crm, { attachExports }, { exportDesignMp4, CanvaError }] = await Promise.all([
    import("@/lib/owned-meta-execution"), import("@/lib/firestore-crm"), import("@/lib/owned-meta-intake"), import("@/lib/canva-export"),
  ])
  const tools = await ownedMetaConnectorDeps()
  return {
    templateFields: id => tools.canvaFields(id),
    createDesign: async input => (await tools.canvaCreate(input)).design,
    exportDesign: async (designId, as) => {
      if (as === "jpg") return tools.canvaExport(designId)
      const { deps } = await canvaDeps()
      if (!deps) throw new CanvaError("Canva integration is not configured")
      return exportDesignMp4(deps, { designId })
    },
    findByRequestId: id => tools.intake.findByRequestId(id),
    createPost: post => crm.createContentPost(post),
    updatePost: (id, updates) => crm.updateContentPost(id, updates),
    attachExports: input => attachExports(tools.intake, { ...input, randomId: tools.randomId }),
    claimRow: (rowId, by) => crm.claimCreateRun(rowId, by, Date.now()),
    releaseRow: rowId => crm.releaseCreateRun(rowId),
    now: () => new Date().toISOString(),
  }
}
